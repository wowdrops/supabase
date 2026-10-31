window.selectedBlocks = [];
window.cachedQCBlocksData = {};
window.currentStatusFilter = 'ALL';
window.existingOrd2Data = {};
window.activeQCTimerInterval = null;
window.qcStartTime = 0;
window.activeUploadContext = null;

window.startQCTimer = function(actionLabel) {
    var timerBadge = document.getElementById('qc-live-timer');
    if (!timerBadge) return;
    timerBadge.outerHTML = '<span id="qc-live-timer" class="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-400 font-black px-3 py-1.5 rounded-lg text-sm border-2 border-indigo-200 dark:border-indigo-700 shadow-inner flex items-center gap-1.5 min-w-max transition-colors"><svg class="w-4 h-4 animate-spin text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>' + actionLabel + ': <span id="qc-timer-sec">0.00</span>s</span>';
    document.getElementById('qc-live-timer').classList.remove('hidden');
    window.qcStartTime = performance.now();
    
    if(window.activeQCTimerInterval) clearInterval(window.activeQCTimerInterval);
    
    window.activeQCTimerInterval = setInterval(function() {
        var secEl = document.getElementById('qc-timer-sec');
        if(secEl) secEl.innerText = ((performance.now() - window.qcStartTime) / 1000).toFixed(2);
    }, 50);
};

window.stopQCTimer = function(successLabel, isError) {
    if(window.activeQCTimerInterval) clearInterval(window.activeQCTimerInterval);
    var finalTime = ((performance.now() - window.qcStartTime) / 1000).toFixed(2);
    var badge = document.getElementById('qc-live-timer');
    if(badge) {
        badge.outerHTML = isError 
            ? '<span id="qc-live-timer" class="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400 font-bold px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-800 text-xs uppercase tracking-widest whitespace-nowrap shadow-sm min-w-max transition-colors">Failed</span>'
            : '<span id="qc-live-timer" class="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400 font-bold px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 text-xs uppercase tracking-widest whitespace-nowrap shadow-sm min-w-max transition-colors">' + successLabel + ' in ' + finalTime + 's</span>';
    }
};

window.updateHeaderCounts = function () {
    var total = document.querySelectorAll('.qc-block-group').length;
    var finished = document.querySelectorAll('.qc-block-status.bg-emerald-500').length;
    document.getElementById('qc-count-total').innerText = total;
    document.getElementById('qc-count-finished').innerText = finished;
    document.getElementById('qc-count-pending').innerText = total - finished;
};

window.getDoorExceptionState = function (d) {
    var actD = d.dvj + d.dnvj;
    var actE = d.evj + d.envj;
    var reqRep = d.replaceQty || 0;
    var actRep = (d.repVj || 0) + (d.repNvj || 0);
    var isShort = (d.ordD > actD) || (d.ordE > actE) || (reqRep > actRep);
    var hasVariance = (d.ordD !== actD) || (d.ordE !== actE) || (reqRep !== actRep);
    var isZeroActual = (actD === 0 && actE === 0 && actRep === 0);
    var cleanComment = (d.delComment || "").replace(/\[ROLLOVER:\s*(YES|NO)\]/g, "").trim();
    return { isException: hasVariance || isZeroActual || cleanComment !== "", hasVariance, isShort, isZeroActual, hasDriverException: cleanComment !== "", cleanComment };
};

window.updateExceptionBadge = function () {
    var count = 0;
    for (var blockId in window.cachedQCBlocksData) {
        window.cachedQCBlocksData[blockId].doors.forEach(d => { if (window.getDoorExceptionState(d).isException) count++; });
    }
    var badge = document.getElementById('qc-exception-badge');
    if (badge) { badge.innerText = count; badge.classList.toggle('hidden', count === 0); }
};

window.toggleQCHeader = function () {
    document.getElementById('qc-header-collapsible').classList.toggle('hidden');
    document.getElementById('qc-header-icon').classList.toggle('rotate-180');
};

window.parseImgUrl = function (url) {
    if (!url || String(url).trim() === "") return 'https://via.placeholder.com/100?text=No+Photo';
    if (url.includes('imgbb.com') || url.includes('ibb.co')) return url;
    var match = String(url).match(/[-\w]{25,}/);
    return match ? 'https://lh3.googleusercontent.com/d/' + match[0] : url;
};

// --- SUPABASE DATA FETCHING ---
window.loadDeliveryQCData = async function (filterArg) {
    window.startQCTimer('Loading');
    document.getElementById('qc-blocks-container').innerHTML = '<div class="text-center p-8 font-bold text-slate-500 dark:text-slate-400 animate-pulse">Loading Pending Deliveries...</div>';
    window.selectedBlocks = [];
    document.getElementById('qc-select-all-chk').checked = false;

    try {
        const { data: ordData, error: ordErr } = await window.supabase1.from('orders').select('cpn_no, ord_d, ord_e');
        if (ordErr) throw ordErr;
        
        window.existingOrd2Data = {};
        if (ordData) {
            ordData.forEach(o => {
                if (o.cpn_no) window.existingOrd2Data[o.cpn_no.toUpperCase()] = { ordD: o.ord_d || 0, ordE: o.ord_e || 0 };
            });
        }

        const { data: delData, error: delErr } = await window.supabase1.from('deliveries').select('*').order('apartment', { ascending: true }).order('block', { ascending: true }).order('door', { ascending: true });
        if (delErr) throw delErr;

        var blocksData = {};
        var counts = { total: 0, finished: 0, pending: 0 };

        if (!delData || delData.length === 0) {
            window.stopQCTimer('Loaded', false);
            document.getElementById('qc-count-total').innerText = '0';
            document.getElementById('qc-count-finished').innerText = '0';
            document.getElementById('qc-count-pending').innerText = '0';
            document.getElementById('qc-blocks-container').innerHTML = '<div class="text-center p-8 font-black text-xl text-slate-400 dark:text-slate-500">No active deliveries found.</div>';
            return;
        }

        delData.forEach(d => {
            if (!d.apartment || !d.block || !d.cpn_no || !d.unique_no) return;
            var blockId = (d.apartment + "_" + d.block).replace(/\s+/g, '_');

            if (!blocksData[blockId]) {
                blocksData[blockId] = {
                    apartment: d.apartment, blockName: d.block,
                    v2bPhoto: d.van_to_block_link || "", b2vPhoto: d.block_to_van_link || "",
                    v2bFulls: 0, b2vFulls: 0, b2vEmpties: 0,
                    isBlockVerified: false, varFull: 0, varEmp: 0, reason: "",
                    unloadOn: d.unload_on, unloadBy: d.unload_by, loadOn: d.load_on, loadBy: d.load_by,
                    v2bAI: d.van_to_block_full_can_count_ai || 0, b2vF_AI: d.block_to_van_full_count_ai || 0, b2vE_AI: d.block_to_van_empty_count_ai || 0,
                    doors: []
                };
                counts.total++;
            }

            blocksData[blockId].v2bFulls = Math.max(blocksData[blockId].v2bFulls, d.van_to_block_full_can_count || 0);
            blocksData[blockId].b2vFulls = Math.max(blocksData[blockId].b2vFulls, d.block_to_van_full_count || 0);
            blocksData[blockId].b2vEmpties = Math.max(blocksData[blockId].b2vEmpties, d.block_to_van_empty_count || 0);

            if (d.block_qc === "VERIFIED") {
                blocksData[blockId].isBlockVerified = true;
                blocksData[blockId].varFull = d.variance_full || 0;
                blocksData[blockId].varEmp = d.variance_empty || 0;
                blocksData[blockId].reason = d.variance_reason || "";
            }

            var cmt = d.delivery_comment || "";
            var rolloverState = cmt.includes("[ROLLOVER: YES]") || cmt.includes("[DEFERRED");

            blocksData[blockId].doors.push({
                dbId: d.id, uniqueNo: d.unique_no, doorNo: d.door || "", cpn: d.cpn_no,
                delDate: d.del_date, enterOn: d.delivery_entered_at, enterBy: d.delivery_entered_by,
                ordD: d.ord_d || 0, ordE: d.ord_e || 0,
                actD: (d.act_d_vj || 0) + (d.act_d_nvj || 0), actE: (d.act_e_vj || 0) + (d.act_e_nvj || 0),
                dvj: d.act_d_vj || 0, dnvj: d.act_d_nvj || 0, evj: d.act_e_vj || 0, envj: d.act_e_nvj || 0,
                replaceQty: d.replace_qty || 0, replaceReason: d.replace_reason || "",
                repVj: d.replace_act_vj || 0, repNvj: d.replace_act_nvj || 0,
                aiD: d.act_d_ai || 0, aiE: d.act_e_ai || 0,
                doorPhoto: d.door_qc_photo || d.door_delivery_link || "", 
                isVerified: d.door_qc === 'true' || d.door_qc === 'TRUE' || d.door_qc === true,
                delComment: cmt, rollover: rolloverState, rate: d.rate || d.default_rate || 0
            });
        });

        for (var key in blocksData) {
            if (blocksData[key].isBlockVerified) counts.finished++;
            else counts.pending++;
        }

        window.cachedQCBlocksData = blocksData;
        document.getElementById('qc-count-total').innerText = counts.total;
        document.getElementById('qc-count-finished').innerText = counts.finished;
        document.getElementById('qc-count-pending').innerText = counts.pending;

        window.populateQCFilters(blocksData);
        window.renderQCDashboard(blocksData);
        window.updateExceptionBadge();
        
        for (var blockId in blocksData) {
            window.updateBlockMath(blockId, true);
            if (blocksData[blockId].isBlockVerified) window.selectedBlocks.push(blockId);
        }

        window.sortBlocks();
        window.checkTransferReady();
        
        if (filterArg && ['ALL', 'VERIFIED', 'PENDING'].includes(filterArg.toUpperCase())) {
            window.setStatusFilter(filterArg.toUpperCase());
        } else {
            window.setStatusFilter('ALL'); 
        }

        window.stopQCTimer('Loaded', false);

    } catch (err) {
        window.stopQCTimer('Failed', true);
        if(window.showToast) window.showToast("Load Error: " + err.message, "error");
        document.getElementById('qc-blocks-container').innerHTML = '<div class="text-center p-8 font-black text-red-500 dark:text-red-400">Error: ' + err.message + '</div>';
    }
};

window.requestEodPin = async function() {
    var btn = document.getElementById('btn-generate-otp');
    var originalText = btn.innerHTML;
    btn.innerHTML = '⏳ Generating...'; btn.disabled = true;
    
    if (!window.activeAdminSession || !window.activeAdminSession.mailid) {
        btn.innerHTML = originalText; btn.disabled = false;
        if(window.showToast) return window.showToast("Session error: No active admin email.", "error");
        return;
    }
    
    window.startQCTimer('Generating PIN');

    try {
        var newPin = Math.floor(1000 + Math.random() * 9000).toString();
        var expiryTime = new Date(new Date().getTime() + (60 * 60 * 1000)).toISOString(); 

        const { error } = await window.supabase1.from('users')
            .update({ pin: newPin, pin_expiry: expiryTime })
            .eq('mail_id', window.activeAdminSession.mailid);

        if (error) throw error;
        
        window.stopQCTimer('Generated', false);
        if(window.showToast) {
            window.showToast("PIN Generated successfully.", "success");
            alert("🔐 EOD Handshake PIN generated:\n\n" + newPin + "\n\nProvide this PIN to the van crew. It will expire in 60 minutes.");
        } else {
            alert("🔐 EOD Handshake PIN generated:\n\n" + newPin + "\n\nProvide this PIN to the van crew. It will expire in 60 minutes.");
        }
    } catch(err) {
        window.stopQCTimer('Failed', true);
        if(window.showToast) window.showToast("Server Error: " + err.message, "error");
    } finally {
        btn.innerHTML = originalText; btn.disabled = false;
    }
};

window.toggleRolloverLive = async function (blockId, uniqueNo, checkbox) {
    var isChecked = checkbox.checked;
    var statusEl = document.querySelector('.save-status-' + uniqueNo);
    statusEl.innerText = 'SAVING...';
    statusEl.className = 'block text-[8px] text-amber-600 dark:text-amber-400 mt-1.5 font-black uppercase tracking-widest h-3 animate-pulse save-status-' + uniqueNo;
    checkbox.disabled = true;

    try {
        var bData = window.cachedQCBlocksData[blockId];
        var door = bData.doors.find(d => d.uniqueNo === uniqueNo);
        var cmt = door.delComment.replace(/\[ROLLOVER: YES\]/g, "").replace(/\[ROLLOVER: NO\]/g, "").trim();
        cmt += (isChecked ? " [ROLLOVER: YES]" : " [ROLLOVER: NO]");

        const { error } = await window.supabase1.from('deliveries').update({ delivery_comment: cmt.trim() }).eq('unique_no', uniqueNo);
        if (error) throw error;

        door.rollover = isChecked;
        door.delComment = cmt.trim();
        statusEl.innerText = 'SAVED';
        statusEl.className = 'block text-[8px] text-emerald-600 dark:text-emerald-400 mt-1.5 font-black uppercase tracking-widest h-3 save-status-' + uniqueNo;
        setTimeout(() => statusEl.innerText = '', 2000);

        if (!isChecked) {
            var rowEl = document.getElementById('exc-row-' + uniqueNo);
            if (rowEl) rowEl.classList.replace('bg-rose-100', 'hover:bg-amber-50/50');
            var badgeEl = document.getElementById('badge-' + uniqueNo);
            if (badgeEl) badgeEl.style.display = 'none';
        }
    } catch (err) {
        checkbox.checked = !isChecked;
        statusEl.innerText = 'FAILED';
        statusEl.className = 'block text-[8px] text-rose-600 dark:text-rose-400 mt-1.5 font-black uppercase tracking-widest h-3 save-status-' + uniqueNo;
        if(window.showToast) window.showToast("Failed to save Rollover state.", "error");
    } finally {
        checkbox.disabled = false;
    }
};

window.syncQCStateBatch = async function (blockId, blockData, doorsArray) {
    try {
        var promises = [];
        if (blockData) {
            promises.push(window.supabase1.from('deliveries').update({
                block_qc: "VERIFIED", variance_full: blockData.fullVar, variance_empty: blockData.empVar,
                variance_reason: blockData.reason, van_to_block_full_can_count: blockData.v2bF,
                block_to_van_full_count: blockData.b2vF, block_to_van_empty_count: blockData.b2vE
            }).eq('apartment', blockData.apt).eq('block', blockData.blk));
        }

        doorsArray.forEach(d => {
            var actD = d.dvj + d.dnvj;
            var actE = d.evj + d.envj;
            promises.push(window.supabase1.from('deliveries').update({
                door_qc: d.isVerified ? "TRUE" : "FALSE",
                act_d: actD, act_e: actE, amount: actD * d.rate,
                act_d_vj: d.dvj, act_d_nvj: d.dnvj, act_e_vj: d.evj, act_e_nvj: d.envj,
                replace_act_vj: d.repVj, replace_act_nvj: d.repNvj
            }).eq('unique_no', d.id));
        });

        await Promise.all(promises);
    } catch(e) { console.error("Sync Error", e); }
};

window.verifyBlockQC = function (blockId) {
    var blockGroup = document.querySelector('.qc-block-group[data-block-id="' + blockId + '"]');
    if (blockGroup.querySelectorAll('.qc-door-chk:not(:checked)').length > 0) {
        if(window.showToast) return window.showToast("Verify all doors in this block first.", "warning");
        return;
    }

    var driverB2vF = parseInt(blockGroup.querySelector('.qc-inp-b2vf').value) || 0;
    var driverB2vE = parseInt(blockGroup.querySelector('.qc-inp-b2ve').value) || 0;
    var xF = parseInt(blockGroup.querySelector('.qc-var-xf').value) || 0;
    var sF = parseInt(blockGroup.querySelector('.qc-var-sf').value) || 0;
    var xE = parseInt(blockGroup.querySelector('.qc-var-xe').value) || 0;
    var sE = parseInt(blockGroup.querySelector('.qc-var-se').value) || 0;

    var finalF = (parseInt(blockGroup.querySelector('.qc-sys-fulls').innerText) || 0) + xF - sF;
    var finalE = (parseInt(blockGroup.querySelector('.qc-sys-empties').innerText) || 0) + xE - sE;

    if (finalF !== driverB2vF || finalE !== driverB2vE) {
        if(window.showToast) return window.showToast("Math Error! Use Variance boxes to balance discrepancies.", "error");
        return;
    }

    blockGroup.querySelector('.qc-block-status').innerText = "VERIFIED";
    blockGroup.querySelector('.qc-block-status').className = "qc-block-status bg-emerald-500 px-4 py-1.5 rounded-lg font-black text-xs tracking-widest shadow text-white";
    blockGroup.querySelector('.block-transfer-chk').classList.replace('hidden', 'block');
    blockGroup.querySelector('.block-transfer-chk').checked = true;

    blockGroup.querySelectorAll('.qc-inp-v2bf, .qc-inp-b2vf, .qc-inp-b2ve').forEach(inp => {
        inp.disabled = true; inp.classList.add('bg-slate-200', 'dark:bg-slate-700', 'text-slate-500', 'dark:text-slate-400', 'border-slate-300', 'dark:border-slate-600');
    });

    if (!window.selectedBlocks.includes(blockId)) window.selectedBlocks.push(blockId);
    window.checkTransferReady();

    var bData = window.cachedQCBlocksData[blockId];
    window.syncQCStateBatch(blockId, {
        apt: bData.apartment, blk: bData.blockName, fullVar: xF - sF, empVar: xE - sE,
        reason: blockGroup.querySelector('.qc-var-reason').value || "Verified",
        v2bF: parseInt(blockGroup.querySelector('.qc-inp-v2bf').value) || 0, b2vF: driverB2vF, b2vE: driverB2vE
    }, []);
    window.updateHeaderCounts();
    setTimeout(window.sortBlocks, 300);
};

window.executeTransferToSales = async function () {
    var btn = document.getElementById('btn-transfer-sales');
    if (window.selectedBlocks.length === 0) {
        if (window.showToast) return window.showToast("Select at least one verified block.", "warning");
        return;
    }
    
    if (!confirm("Execute batch sync for " + window.selectedBlocks.length + " selected block(s)?")) return;

    btn.innerText = "Syncing..."; btn.disabled = true;
    window.startQCTimer('Syncing');

    try {
        var adminName = window.activeAdminSession ? window.activeAdminSession.username : 'ADMIN';
        var deliveryIdsToProcess = [];
        var rolloverOrdersBatch = [];
        var timeNow = new Date().toISOString();
        var todayDateStr = timeNow.split('T')[0];
        
        // 1. GATHER DELIVERIES & IDENTIFY ROLLOVER SHORTAGES
        window.selectedBlocks.forEach(blockId => {
            var bData = window.cachedQCBlocksData[blockId];
            
            bData.doors.forEach(d => {
                deliveryIdsToProcess.push(d.dbId);

                // If driver marked rollover and there is a shortage, create the new pending order
                if (d.rollover) {
                    var actD = d.dvj + d.dnvj;
                    var actE = d.evj + d.envj;
                    var reqRep = d.replaceQty || 0;
                    var actRep = d.repVj + d.repNvj;

                    var diffD = Math.max(0, d.ordD - actD);
                    var diffE = Math.max(0, d.ordE - actE);
                    var diffRep = Math.max(0, reqRep - actRep);

                    if (diffD > 0 || diffE > 0 || diffRep > 0) {
                        var pushReason = "[ADMIN ROLLED: SHORTAGE]";
                        if (d.delComment && d.delComment.includes("[DEFERRED")) {
                            pushReason = d.delComment.replace("[DEFERRED", "[AUTO-DEFERRED");
                        }
                        
                        rolloverOrdersBatch.push({
                            unique_no: d.uniqueNo + ((actD > 0 || actE > 0) ? "-P1" : "-R1"),
                            cpn_no: d.cpn, apartment: bData.apartment, block: bData.blockName, door: d.doorNo,
                            order_date: todayDateStr, ord_d: diffD, ord_e: diffE, rate: d.rate, amount: diffD * d.rate,
                            order_comment: pushReason, status: "PENDING", pending_qty: diffD,
                            replace_qty: diffRep, replace_reason: d.replaceReason,
                            created_at: timeNow, created_by: adminName
                        });
                    }
                }
            });
        });

        // 2. GODOWN HANDSHAKE VALIDATION
        var startOfToday = new Date();
        startOfToday.setHours(0,0,0,0);
        var startOfTodayISO = startOfToday.toISOString();

        const { data: eodLogs } = await window.supabase1.from('eod_log')
            .select('*')
            .gte('created_at', startOfTodayISO)
            .order('created_at', { ascending: false })
            .limit(1);

        var activeLog = eodLogs && eodLogs.length > 0 ? eodLogs[0] : null;

        if (activeLog && activeLog.status !== 'Completed') {
            throw new Error("TRANSFER BLOCKED: The Godown has not completed physical inward for today's active trip.");
        }

        // 3. LIVE COLLISION CHECK
        const { data: ordData } = await window.supabase1.from('orders').select('cpn_no');
        var currentOrders = ordData ? ordData.map(o => o.cpn_no.toUpperCase()) : [];
        var liveCollisions = rolloverOrdersBatch.some(r => currentOrders.includes(r.cpn_no.toUpperCase()));

        if (liveCollisions) {
            window.loadDeliveryQCData(); 
            throw new Error("LIVE COLLISION DETECTED! A customer placed a new order while you were reviewing. Please disable Rollover for highlighted exceptions.");
        }

        // 4. FIRE THE RPC TRANSFER
        const { data: rpcResult, error: rpcErr } = await window.supabase1.rpc('process_deliveryqc_to_sales', {
            p_delivery_ids: deliveryIdsToProcess,
            p_admin_name: adminName
        });

        if (rpcErr) throw rpcErr;

        // 5. INSERT LEFTOVER ROLLOVER ORDERS (If Any)
        if (rolloverOrdersBatch.length > 0) {
            const { error: ordInsErr } = await window.supabase1.from('orders').insert(rolloverOrdersBatch);
            if (ordInsErr) throw ordInsErr;
        }

        // 6. POST-TRANSFER RECONCILIATION
        const { count, error: countErr } = await window.supabase1.from('deliveries')
            .select('*', { count: 'exact', head: true });

        if (count === 0 && !countErr && activeLog) {
            const { data: allTripSales } = await window.supabase1.from('sales')
                .select('act_d, act_e, apartment, block, van_to_block_full_can_count')
                .gte('created_at', activeLog.created_at);

            if (allTripSales) {
                let totalActD = 0, totalActE = 0;
                let uniqueBlockUnloads = {};

                allTripSales.forEach(s => {
                    totalActD += (s.act_d || 0);
                    totalActE += (s.act_e || 0);
                    
                    let bKey = s.apartment + "_" + s.block;
                    if (uniqueBlockUnloads[bKey] === undefined) {
                        uniqueBlockUnloads[bKey] = s.van_to_block_full_can_count || 0;
                    }
                });

                let totalUnloaded = 0;
                Object.values(uniqueBlockUnloads).forEach(val => totalUnloaded += val);

                let qcExpectedF = Math.max(0, totalUnloaded - totalActD);
                let qcExpectedE = totalActE;

                let godownActualF = (activeLog.full_vj || 0) + (activeLog.full_nvj || 0);
                let godownActualE = (activeLog.empty_vj || 0) + (activeLog.empty_nvj || 0);

                let reconStatus = 'COMPLETED';
                let varianceNote = '';

                if (qcExpectedF !== godownActualF || qcExpectedE !== godownActualE) {
                    reconStatus = 'COMPLETED (SHORTAGE)';
                    varianceNote = `QC Expected: ${qcExpectedF}F / ${qcExpectedE}E. Godown Received: ${godownActualF}F / ${godownActualE}E.`;
                }

                await window.supabase1.from('eod_log').update({
                    recon_status: reconStatus,
                    godown_variance_reason: varianceNote
                }).eq('id', activeLog.id);
            }
        }

        window.stopQCTimer('Synced', false);
        if (window.showToast) window.showToast("Batch Sync Successful!", "success");
        
        btn.innerText = "Process Selected";
        btn.disabled = false;
        window.scrollTo({ top: 0, behavior: 'smooth' });

        window.loadDeliveryQCData();

    } catch (err) {
        window.stopQCTimer('Blocked', true);
        
        btn.innerText = "Process Selected";
        btn.disabled = false;
        
        if (err.message.includes("LIVE COLLISION")) window.openExceptionReview();
        if (window.showToast) window.showToast(err.message, "error");
        else alert(err.message);
        
        window.checkTransferReady();
    }
};

// --- IMGBB UPLOAD FOR ADMIN OVERRIDE ---
window.compressAdminImage = function(file) {
    return new Promise((resolve, reject) => {
        var reader = new FileReader();
        reader.onload = e => {
            var img = new Image();
            img.onload = () => {
                var canvas = document.createElement('canvas');
                canvas.width = 800; canvas.height = img.height * (800 / img.width);
                var ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                
                var now = new Date();
                var timeString = now.toLocaleDateString('en-IN') + " | " + now.toLocaleTimeString('en-IN');
                ctx.fillStyle = "rgba(185, 28, 28, 0.85)"; ctx.fillRect(0, canvas.height - 75, canvas.width, 75);
                ctx.fillStyle = "#ffffff"; ctx.font = "bold 22px sans-serif";
                ctx.fillText("ADMIN OVERRIDE UPLOAD", 20, canvas.height - 45);
                ctx.font = "bold 18px sans-serif"; ctx.fillText("Date: " + timeString, 20, canvas.height - 18);
                
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
            img.onerror = () => reject("Image load error");
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
};

document.addEventListener("DOMContentLoaded", function () {
    var fileInput = document.getElementById('admin-qc-upload-input');
    if (fileInput) {
        fileInput.addEventListener('change', async function (e) {
            if (!e.target.files || e.target.files.length === 0 || !window.activeUploadContext) return;
            var file = e.target.files[0];
            var payload = window.activeUploadContext;
            window.showAdminUploadLoader("Compressing & Watermarking...");

            try {
                var b64String = await window.compressAdminImage(file);
                
                document.getElementById('admin-qc-upload-text').innerText = "Uploading to ImgBB...";
                let formData = new FormData();
                formData.append("image", b64String.split(',')[1]); 
                
                let res = await fetch("https://api.imgbb.com/1/upload?key=" + window.IMGBB_API_KEY, { method: "POST", body: formData });
                let json = await res.json();
                
                if (!json.success) throw new Error("ImgBB Upload Failed.");
                var finalUrl = json.data.url;

                var updatePayload = {};
                if (payload.type === 'v2b') updatePayload.van_to_block_link = finalUrl;
                else if (payload.type === 'b2v') updatePayload.block_to_van_link = finalUrl;
                else updatePayload.door_delivery_link = finalUrl;

                var query = window.supabase1.from('deliveries').update(updatePayload);
                if (payload.type === 'door') query = query.eq('unique_no', payload.doorUniqueNo);
                else query = query.eq('apartment', payload.apt).eq('block', payload.blk);
                
                const { error: dbErr } = await query;
                if (dbErr) throw dbErr;

                var imgEl = document.getElementById(payload.imgId);
                imgEl.src = finalUrl;
                imgEl.setAttribute('onclick', 'window.openLightbox("' + finalUrl + '")');
                
                if (payload.type === 'door') imgEl.closest('.qc-door-row').setAttribute('data-photo-url', finalUrl);
                else if (payload.type === 'v2b') window.cachedQCBlocksData[payload.blockId].v2bPhoto = finalUrl;
                else window.cachedQCBlocksData[payload.blockId].b2vPhoto = finalUrl;

                if(window.showToast) window.showToast("Image override successful.", "success");

            } catch(err) {
                if(window.showToast) window.showToast("Upload Error: " + err.message, "error");
            } finally {
                window.hideAdminUploadLoader();
                e.target.value = '';
            }
        });
    }
});

window.overrideMasterPhoto = function (imgId) {
    var parts = imgId.split('-');
    if (parts.length < 3) return;
    var type = parts[1];
    var blockId = parts.slice(2).join('-');
    var bData = window.cachedQCBlocksData[blockId];
    if (!bData) return;
    window.activeUploadContext = { type: type, imgId: imgId, apt: bData.apartment, blk: bData.blockName, blockId: blockId };
    document.getElementById('admin-qc-upload-input').click();
};

window.overrideRowPhoto = function (imgId) {
    var el = document.getElementById(imgId);
    var rowEl = el.closest('.qc-door-row');
    var blockEl = el.closest('.qc-block-group');
    var rIdx = parseInt(rowEl.getAttribute('data-row-idx'));
    var blockId = blockEl.getAttribute('data-block-id');
    var bData = window.cachedQCBlocksData[blockId];

    if (!bData) return;
    var doorUnique = null;
    if (rIdx > 0) {
        var cachedDoor = bData.doors.find(d => d.dbId === rIdx);
        if (cachedDoor) doorUnique = cachedDoor.uniqueNo;
    }
    window.activeUploadContext = { type: 'door', imgId: imgId, apt: bData.apartment, blk: bData.blockName, doorUniqueNo: doorUnique, blockId: blockId };
    document.getElementById('admin-qc-upload-input').click();
};

window.showAdminUploadLoader = function (msg) {
    var loader = document.getElementById('admin-qc-upload-overlay');
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'admin-qc-upload-overlay';
        loader.className = 'fixed inset-0 z-[9999] bg-slate-900/90 dark:bg-slate-950/90 flex flex-col items-center justify-center backdrop-blur-sm transition-opacity';
        loader.innerHTML = '<svg class="animate-spin h-16 w-16 text-emerald-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><p id="admin-qc-upload-text" class="text-white font-black tracking-widest uppercase text-sm animate-pulse">' + msg + '</p>';
        document.body.appendChild(loader);
    } else {
        document.getElementById('admin-qc-upload-text').innerText = msg;
        loader.classList.remove('hidden'); loader.classList.add('flex');
    }
};

window.hideAdminUploadLoader = function () {
    var loader = document.getElementById('admin-qc-upload-overlay');
    if (loader) { loader.classList.add('hidden'); loader.classList.remove('flex'); }
};

window.renderQCDashboard = function (blocksData) {
    var container = document.getElementById('qc-blocks-container');
    var html = '';

    for (var blockId in blocksData) {
        var block = blocksData[blockId];
        var v2bImgSrc = window.parseImgUrl(block.v2bPhoto);
        var b2vImgSrc = window.parseImgUrl(block.b2vPhoto);

        var isVerified = block.isBlockVerified;
        var statText = isVerified ? "VERIFIED" : "PENDING";
        var statClass = isVerified ? "bg-emerald-500 shadow text-white" : "bg-slate-600 dark:bg-slate-500 text-white";
        var chkClass = isVerified ? "block" : "hidden";
        var chkChecked = isVerified ? "checked" : "";
        var freezeClass = isVerified ? 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-600' : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-white border-slate-400 dark:border-slate-600';
        var freezeAttr = isVerified ? 'disabled' : '';

        var preXf = block.varFull > 0 ? block.varFull : 0;
        var preSf = block.varFull < 0 ? Math.abs(block.varFull) : 0;
        var preXe = block.varEmp > 0 ? block.varEmp : 0;
        var preSe = block.varEmp < 0 ? Math.abs(block.varEmp) : 0;

        function parsePDate(dateStr, byStr) {
            if (!dateStr) return "N/A";
            var dStr = String(dateStr);
            if (dStr.includes('T')) {
                var d = new Date(dStr);
                dStr = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
            }
            return (byStr ? byStr + " | " : "") + dStr;
        }

        html += '<div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-xl overflow-hidden qc-block-group mb-8 transition-colors" data-block-id="' + blockId + '">' +
            '<div class="bg-slate-800 dark:bg-slate-900 p-4 text-white flex justify-between items-center shadow-inner transition-colors">' +
            '<div class="flex items-center gap-3">' +
            '<input type="checkbox" value="' + blockId + '" class="w-6 h-6 rounded border-slate-500 bg-slate-700 cursor-pointer block-transfer-chk ' + chkClass + '" ' + chkChecked + ' onchange="window.toggleBlockSelection(this, \'' + blockId + '\')">' +
            '<h3 class="font-black text-lg md:text-xl tracking-widest uppercase">' + block.apartment + ' - Block ' + block.blockName + '</h3>' +
            '</div>' +
            '<span class="qc-block-status ' + statClass + ' px-4 py-1.5 rounded-lg font-black text-xs tracking-widest transition-colors">' + statText + '</span>' +
            '</div>' +

            '<div class="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/50 border-b-2 border-slate-200 dark:border-slate-700 transition-colors">' +

            '<div class="flex gap-4 items-center bg-white dark:bg-slate-900 p-3 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm transition-colors">' +
            '<div class="flex flex-col items-center gap-1 w-28">' +
            '<img src="' + v2bImgSrc + '" class="w-24 h-24 rounded-lg object-cover border-2 border-slate-200 dark:border-slate-700 cursor-pointer transition hover:scale-105" onclick="window.openLightbox(\'' + block.v2bPhoto + '\')" id="img-v2b-' + blockId + '">' +
            '<button onclick="window.overrideMasterPhoto(\'img-v2b-' + blockId + '\')" class="text-[9px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition w-full">Override</button>' +
            '<p class="text-[8px] text-center font-bold text-slate-400 mt-1 uppercase leading-tight bg-slate-50 dark:bg-slate-800 p-1 rounded border border-slate-100 dark:border-slate-700 w-full">' + parsePDate(block.unloadOn, block.unloadBy) + '</p>' +
            '</div>' +
            '<div class="flex-1"><p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Unloaded (Van to Block)</p>' +
            '<div class="flex items-center gap-2 mb-2"><input type="number" oninput="window.updateBlockMath(\'' + blockId + '\')" class="w-20 p-2 text-2xl font-black rounded-lg border-2 text-center qc-inp-v2bf color-scheme-dark ' + freezeClass + '" value="' + block.v2bFulls + '" ' + freezeAttr + '><span class="text-xs font-black text-slate-500 tracking-widest">FULLS</span></div>' +
            '<div class="bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 text-[10px] font-black px-2 py-1 rounded w-max tracking-widest uppercase">🤖 AI: ' + block.v2bAI + '</div>' +
            '</div>' +
            '</div>' +

            '<div class="flex gap-4 items-center bg-white dark:bg-slate-900 p-3 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm transition-colors">' +
            '<div class="flex flex-col items-center gap-1 w-28">' +
            '<img src="' + b2vImgSrc + '" class="w-24 h-24 rounded-lg object-cover border-2 border-slate-200 dark:border-slate-700 cursor-pointer transition hover:scale-105" onclick="window.openLightbox(\'' + block.b2vPhoto + '\')" id="img-b2v-' + blockId + '">' +
            '<button onclick="window.overrideMasterPhoto(\'img-b2v-' + blockId + '\')" class="text-[9px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition w-full">Override</button>' +
            '<p class="text-[8px] text-center font-bold text-slate-400 mt-1 uppercase leading-tight bg-slate-50 dark:bg-slate-800 p-1 rounded border border-slate-100 dark:border-slate-700 w-full">' + parsePDate(block.loadOn, block.loadBy) + '</p>' +
            '</div>' +
            '<div class="flex-1"><p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Loaded (Block to Van)</p>' +
            '<div class="flex items-center gap-4 mb-2">' +
            '<div class="flex items-center gap-1"><input type="number" oninput="window.updateBlockMath(\'' + blockId + '\')" class="w-16 p-2 text-xl font-black rounded-lg border-2 text-emerald-700 dark:text-emerald-400 text-center qc-inp-b2vf color-scheme-dark ' + freezeClass + '" value="' + block.b2vFulls + '" ' + freezeAttr + '><span class="text-[10px] font-black text-emerald-600 dark:text-emerald-500 tracking-widest">F</span></div>' +
            '<div class="flex items-center gap-1"><input type="number" oninput="window.updateBlockMath(\'' + blockId + '\')" class="w-16 p-2 text-xl font-black rounded-lg border-2 text-amber-700 dark:text-amber-400 text-center qc-inp-b2ve color-scheme-dark ' + freezeClass + '" value="' + block.b2vEmpties + '" ' + freezeAttr + '><span class="text-[10px] font-black text-amber-600 dark:text-amber-500 tracking-widest">E</span></div>' +
            '</div>' +
            '<div class="flex gap-2"><div class="bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-[9px] font-black px-2 py-1 rounded w-max tracking-widest uppercase">🤖 AI: ' + block.b2vF_AI + ' F</div><div class="bg-amber-50 dark:bg-amber-900/30 border border-amber-100 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-[9px] font-black px-2 py-1 rounded w-max tracking-widest uppercase">🤖 AI: ' + block.b2vE_AI + ' E</div></div>' +
            '</div>' +
            '</div>' +
            '</div>' +

            '<div class="hidden md:grid grid-cols-12 gap-4 px-6 py-3 bg-slate-200 dark:bg-slate-700 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300 border-b border-slate-300 dark:border-slate-600 transition-colors">' +
            '<div class="col-span-3">Customer Profile</div><div class="col-span-1 text-center">Ordered</div><div class="col-span-4 text-center">Actual Delivery (2x2)</div><div class="col-span-2 text-center">QC Photo</div><div class="col-span-2 text-center">Action</div>' +
            '</div><div class="bg-white dark:bg-slate-800 qc-doors-list transition-colors">';

        for (var i = 0; i < block.doors.length; i++) {
            var door = block.doors[i];
            var isDoorChecked = door.isVerified ? 'checked' : '';
            var dFzClass = door.isVerified ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-600' : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-white border-indigo-200 dark:border-indigo-800';
            var dFzAttr = door.isVerified ? 'disabled' : '';
            var doorPhotoRaw = door.doorPhoto || "";
            var uniqImgId = "img-" + blockId + "-" + door.uniqueNo; 

            var cmtUI = '';
            if (door.delComment) {
                var hasDeferred = door.delComment.includes("[DEFERRED");
                var hasCancelled = door.delComment.includes("[CANCELLED");
                var badgeColor = hasDeferred ? 'amber' : (hasCancelled ? 'rose' : 'slate');
                var darkBadgeClass = hasDeferred ? 'dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800' : (hasCancelled ? 'dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800' : 'dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600');
                cmtUI = '<div class="mt-1.5 inline-block text-[9px] font-black bg-' + badgeColor + '-50 text-' + badgeColor + '-700 px-1.5 py-0.5 rounded border border-' + badgeColor + '-200 uppercase tracking-widest leading-tight shadow-sm transition-colors ' + darkBadgeClass + '">💬 ' + door.delComment + '</div>';
            }

            html += '<div class="grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 p-4 md:px-6 md:py-3 qc-door-row hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors" data-row-idx="' + door.dbId + '" data-photo-url="' + doorPhotoRaw + '">' +
                '<div class="col-span-1 md:col-span-3 flex justify-between md:block items-start"><span class="md:hidden text-[10px] font-black text-slate-400 uppercase tracking-widest">Door</span><div><p class="font-black text-lg text-slate-800 dark:text-white">Door ' + door.doorNo + '</p><span class="inline-flex items-center gap-1.5 px-2 py-0.5 mt-1 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/50 hover:shadow-sm active:scale-95 transition-all cursor-pointer group" onclick="window.openCustomer360(\'' + door.cpn + '\')">' + door.cpn + '<svg class="w-3.5 h-3.5 text-indigo-400 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg></span>' + cmtUI + '</div></div>' +
                '<div class="col-span-1 md:col-span-1 flex justify-between md:justify-center items-center gap-2"><span class="md:hidden text-[10px] font-black text-slate-400 uppercase tracking-widest">Ordered</span><div class="flex flex-row gap-2"><div class="bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-600 text-center"><span class="font-black text-slate-700 dark:text-slate-200">' + door.ordD + '</span> <span class="text-[9px] font-bold text-slate-400 dark:text-slate-400">F</span></div><div class="bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-600 text-center"><span class="font-black text-slate-700 dark:text-slate-200">' + door.ordE + '</span> <span class="text-[9px] font-bold text-slate-400 dark:text-slate-400">E</span></div></div></div>' +
                '<div class="col-span-1 md:col-span-4 flex flex-col justify-center items-center gap-2"><span class="md:hidden text-[10px] font-black text-slate-400 uppercase tracking-widest w-full text-left">Actuals</span>' +
                '<div class="flex gap-2 w-full justify-center">' +
                '<div class="relative flex items-center gap-1"><span class="text-[9px] font-black text-slate-400 uppercase w-6">VJ</span><input type="number" oninput="window.updateBlockMath(\'' + blockId + '\')" class="w-12 p-1.5 border-2 rounded font-black text-center outline-none qc-inp-actd-vj color-scheme-dark ' + dFzClass + '" value="' + door.dvj + '" ' + dFzAttr + ' title="VJ Full"><span class="text-[9px] font-bold text-slate-400">F</span></div>' +
                '<div class="relative flex items-center gap-1 ml-2"><input type="number" oninput="window.updateBlockMath(\'' + blockId + '\')" class="w-12 p-1.5 border-2 rounded font-black text-center outline-none qc-inp-acte-vj color-scheme-dark ' + dFzClass + '" value="' + door.evj + '" ' + dFzAttr + ' title="VJ Empty"><span class="text-[9px] font-bold text-slate-400">E</span></div>' +
                '</div>' +
                '<div class="flex gap-2 w-full justify-center">' +
                '<div class="relative flex items-center gap-1"><span class="text-[9px] font-black text-slate-400 uppercase w-6">NVJ</span><input type="number" oninput="window.updateBlockMath(\'' + blockId + '\')" class="w-12 p-1.5 border-2 rounded font-black text-center outline-none qc-inp-actd-nvj color-scheme-dark ' + dFzClass + '" value="' + door.dnvj + '" ' + dFzAttr + ' title="NVJ Full"><span class="text-[9px] font-bold text-slate-400">F</span></div>' +
                '<div class="relative flex items-center gap-1 ml-2"><input type="number" oninput="window.updateBlockMath(\'' + blockId + '\')" class="w-12 p-1.5 border-2 rounded font-black text-center outline-none qc-inp-acte-nvj color-scheme-dark ' + dFzClass + '" value="' + door.envj + '" ' + dFzAttr + ' title="NVJ Empty"><span class="text-[9px] font-bold text-slate-400">E</span></div>' +
                '</div>' +
                '<div class="flex gap-4 mt-1"><span class="text-[8px] font-black text-indigo-400 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 rounded uppercase tracking-widest border border-indigo-100 dark:border-indigo-800">🤖 AI F: ' + door.aiD + '</span><span class="text-[8px] font-black text-amber-400 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 px-1.5 rounded uppercase tracking-widest border border-amber-100 dark:border-amber-800">🤖 AI E: ' + door.aiE + '</span></div>';

                var repUI = '';
                if (door.replaceQty > 0) {
                    repUI = '<div class="mt-2 bg-amber-50 dark:bg-amber-900/20 p-2 rounded-lg border border-amber-200 dark:border-amber-800 shadow-inner w-full max-w-[240px]">' +
                            '<div class="text-[9px] font-black text-amber-800 dark:text-amber-400 uppercase text-center mb-1">Rep Ord: ' + door.replaceQty + ' (' + door.replaceReason + ')</div>' +
                            '<div class="flex gap-2 w-full justify-center">' +
                            '<div class="relative flex items-center gap-1"><span class="text-[9px] font-black text-amber-600 dark:text-amber-500 uppercase w-6">VJ</span><input type="number" oninput="window.updateBlockMath(\'' + blockId + '\')" class="w-12 p-1 border border-amber-300 dark:border-amber-700 rounded font-black text-center outline-none color-scheme-dark qc-inp-actrep-vj ' + dFzClass + '" value="' + door.repVj + '" ' + dFzAttr + '></div>' +
                            '<div class="relative flex items-center gap-1 ml-2"><span class="text-[9px] font-black text-amber-600 dark:text-amber-500 uppercase w-6">NVJ</span><input type="number" oninput="window.updateBlockMath(\'' + blockId + '\')" class="w-12 p-1 border border-amber-300 dark:border-amber-700 rounded font-black text-center outline-none color-scheme-dark qc-inp-actrep-nvj ' + dFzClass + '" value="' + door.repNvj + '" ' + dFzAttr + '></div>' +
                            '</div></div>';
                }
                
        html += repUI + '</div>';

        html += '<div class="col-span-1 md:col-span-2 flex justify-between md:justify-center items-center"><span class="md:hidden text-[10px] font-black text-slate-400 uppercase tracking-widest">Photo</span><div class="flex flex-col items-center gap-1 w-24"><img id="' + uniqImgId + '" src="' + window.parseImgUrl(doorPhotoRaw) + '" class="w-20 h-20 rounded-lg object-cover border-2 border-slate-200 dark:border-slate-700 cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition hover:scale-110 shadow-sm" onclick="window.openLightbox(\'' + doorPhotoRaw + '\')"><button onclick="window.overrideRowPhoto(\'' + uniqImgId + '\')" class="text-[8px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800 transition w-full">Override</button><p class="text-[7px] text-center font-bold text-slate-400 uppercase leading-tight bg-slate-50 dark:bg-slate-800 p-1 rounded border border-slate-100 dark:border-slate-700 w-full mt-1">' + parsePDate(door.enterOn, door.enterBy) + '</p></div></div>' +
                '<div class="col-span-1 md:col-span-2 flex justify-between md:justify-center items-center"><span class="md:hidden text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</span><label class="flex items-center gap-2 cursor-pointer bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:border-emerald-200 dark:hover:border-emerald-800 transition"><input type="checkbox" onchange="window.toggleDoorQC(this, \'' + blockId + '\')" class="w-5 h-5 rounded text-emerald-600 dark:text-emerald-500 qc-door-chk" ' + isDoorChecked + '><span class="text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">Verify</span></label></div>' +
                '</div>';
        }

        html += '</div>' +
            '<div class="bg-slate-100 dark:bg-slate-900 p-4 md:p-6 border-t-2 border-slate-200 dark:border-slate-700 transition-colors">' +
            '<div class="qc-math-summary-card bg-indigo-50 dark:bg-indigo-900/20 border-2 border-indigo-100 dark:border-indigo-800 rounded-xl p-4 mb-4 flex flex-col md:flex-row gap-6 transition-colors">' +
            '<div class="flex-1"><p class="text-[10px] font-black uppercase tracking-widest mb-1 qc-math-label text-indigo-400 dark:text-indigo-500">Load To Van: Full Cans</p><p class="text-base font-black qc-math-text text-indigo-900 dark:text-indigo-300">Calculated: <span class="qc-sys-fulls text-xl">0</span> <span class="text-sm font-bold mx-2 text-indigo-300 dark:text-indigo-700">|</span> Driver Claim: <span class="qc-disp-b2vf text-xl">' + block.b2vFulls + '</span></p></div>' +
            '<div class="flex-1 border-t md:border-t-0 md:border-l border-indigo-200 dark:border-indigo-800 qc-math-divider pt-3 md:pt-0 md:pl-6"><p class="text-[10px] font-black uppercase tracking-widest mb-1 qc-math-label text-indigo-400 dark:text-indigo-500">Load To Van: Empty Cans</p><p class="text-base font-black qc-math-text text-indigo-900 dark:text-indigo-300">Calculated: <span class="qc-sys-empties text-xl">0</span> <span class="text-sm font-bold mx-2 text-indigo-300 dark:text-indigo-700">|</span> Driver Claim: <span class="qc-disp-b2ve text-xl">' + block.b2vEmpties + '</span></p></div>' +
            '</div>' +
            '<div class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">' +
            '<div><label class="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-widest">Excess Full</label><input type="number" class="w-full p-2.5 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-slate-700 dark:text-white outline-none color-scheme-dark qc-var-xf transition-colors" value="' + preXf + '"></div>' +
            '<div><label class="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-widest">Short Full</label><input type="number" class="w-full p-2.5 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-slate-700 dark:text-white outline-none color-scheme-dark qc-var-sf transition-colors" value="' + preSf + '"></div>' +
            '<div><label class="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-widest">Excess Empty</label><input type="number" class="w-full p-2.5 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-slate-700 dark:text-white outline-none color-scheme-dark qc-var-xe transition-colors" value="' + preXe + '"></div>' +
            '<div><label class="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-widest">Short Empty</label><input type="number" class="w-full p-2.5 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-slate-700 dark:text-white outline-none color-scheme-dark qc-var-se transition-colors" value="' + preSe + '"></div>' +
            '<div><label class="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-widest">Reason</label><input type="text" placeholder="Note..." class="w-full p-2.5 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-slate-700 dark:text-white outline-none color-scheme-dark qc-var-reason transition-colors" value="' + block.reason + '"></div>' +
            '</div>' +
            '<div class="flex flex-col md:flex-row justify-between items-center gap-3">' +
            '<button disabled class="w-full md:w-auto text-xs font-black text-slate-400 dark:text-slate-500 bg-slate-200 dark:bg-slate-800 cursor-not-allowed px-6 py-3 rounded-xl transition-colors">+ Walk-Up Delivery</button>' +
            '<button onclick="window.verifyBlockQC(\'' + blockId + '\')" class="w-full md:w-auto bg-emerald-600 dark:bg-emerald-700 hover:bg-emerald-700 dark:hover:bg-emerald-600 text-white font-black px-8 py-3 rounded-xl shadow active:scale-95 transition tracking-widest uppercase text-sm btn-verify-block">Verify Math</button>' +
            '</div></div></div>';
    }
    container.innerHTML = html;
};

window.openExceptionReview = function() {
    var modal = document.getElementById('admin-exception-modal');
    if (modal && modal.parentNode !== document.body) {
        document.body.appendChild(modal);
    }

    var container = document.getElementById('exception-table-container');
    var headerHTML = '<table class="w-full text-left border-collapse"><thead class="bg-amber-100 dark:bg-amber-900/80 text-amber-900 dark:text-amber-400 text-[10px] uppercase tracking-widest sticky top-0 shadow-sm z-10 transition-colors"><tr><th class="p-4 border-b border-amber-200 dark:border-amber-800">Location</th><th class="p-4 border-b border-amber-200 dark:border-amber-800 text-center">Ordered (Ord)</th><th class="p-4 border-b border-amber-200 dark:border-amber-800 text-center">Actual Delivered (Act)</th><th class="p-4 border-b border-amber-200 dark:border-amber-800 text-center">Shortage</th><th class="p-4 border-b border-amber-200 dark:border-amber-800">Driver Note / Exception</th><th class="p-4 border-b border-amber-200 dark:border-amber-800 text-center">Rollover / Status</th></tr></thead><tbody class="divide-y divide-slate-200 dark:divide-slate-700 text-xs transition-colors">';
    
    var varianceRowsHtml = '';
    var infoRowsHtml = '';
    var count = 0;
    var collisionCpns = []; 

    for (var blockId in window.cachedQCBlocksData) {
        var block = window.cachedQCBlocksData[blockId];
        block.doors.forEach(d => {
            var state = window.getDoorExceptionState(d);
            
            if (state.isException) {
                count++;
                var chk = d.rollover ? 'checked' : '';
                var actD = d.dvj + d.dnvj;
                var actE = d.evj + d.envj;
                
                var reqRep = d.replaceQty || 0;
                var actRep = (d.repVj || 0) + (d.repNvj || 0);
                
                var isZeroActualAndZeroOrdered = (d.ordD === 0 && actD === 0 && d.ordE === 0 && actE === 0 && reqRep === 0 && actRep === 0);
                var isCancelled = state.cleanComment.includes("[CANCELLED");

                var hasOrd2Collision = false;
                var ord2Details = null;

                var cleanCpn = String(d.cpn).trim().toUpperCase();

                if (state.isShort && d.rollover && window.existingOrd2Data && window.existingOrd2Data[cleanCpn]) {
                    hasOrd2Collision = true;
                    ord2Details = window.existingOrd2Data[cleanCpn];
                    if (!collisionCpns.includes(cleanCpn)) collisionCpns.push(cleanCpn);
                }

                var ordStr = '<span class="font-black text-slate-700 dark:text-slate-200 block">' + d.ordD + ' Full</span><span class="text-slate-500 dark:text-slate-400 font-bold block">' + d.ordE + ' Emp</span>';
                if (reqRep > 0) ordStr += '<span class="text-amber-600 dark:text-amber-500 font-black block mt-1">+' + reqRep + ' Rep</span>'; 

                var actStr = '';
                if (actD === 0 && actE === 0 && actRep === 0) {
                    actStr = '<span class="bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 px-2 py-0.5 rounded font-black inline-block">0 Delivered</span>';
                } else {
                    actStr = '<span class="font-black text-emerald-700 dark:text-emerald-400 block">' + actD + ' Full</span><span class="text-emerald-600 dark:text-emerald-500 font-bold block">' + actE + ' Emp</span>';
                    if (reqRep > 0 || actRep > 0) actStr += '<span class="text-amber-600 dark:text-amber-500 font-black block mt-1">+' + actRep + ' Rep</span>'; 
                }

                var shortageStr = '';
                if (d.ordD > actD) shortageStr += '<span class="text-rose-600 dark:text-rose-400 font-black block">-' + (d.ordD - actD) + ' Full</span>';
                if (d.ordE > actE) shortageStr += '<span class="text-rose-600 dark:text-rose-400 font-black block">-' + (d.ordE - actE) + ' Emp</span>';
                if (reqRep > actRep) shortageStr += '<span class="text-rose-600 dark:text-rose-400 font-black block">-' + (reqRep - actRep) + ' Rep</span>'; 
                if (!state.isShort) shortageStr = '<span class="text-slate-400 dark:text-slate-500 font-bold">None</span>';

                var cmtStr = state.cleanComment ? '<span class="bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-800 px-2 py-1.5 rounded text-[10px] font-black uppercase shadow-sm inline-block">' + state.cleanComment + '</span>' : '<span class="text-slate-400 dark:text-slate-500 italic">No note provided</span>';

                var actionCell = '';
                if (isZeroActualAndZeroOrdered) {
                    actionCell = '<span class="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700">Zero Activity</span>';
                } else if (isCancelled) {
                    actionCell = '<span class="text-[10px] font-bold text-rose-500 dark:text-rose-400 uppercase tracking-widest">Cancelled</span>';
                } else if (state.isShort) {
                    actionCell = '<label class="relative inline-flex items-center cursor-pointer" title="Toggle sending this shortage to tomorrow\'s route">' +
                                 '<input type="checkbox" class="sr-only peer" ' + chk + ' onchange="window.toggleRolloverLive(\'' + blockId + '\', \'' + d.uniqueNo + '\', this)">' +
                                 '<div class="w-11 h-6 bg-slate-300 dark:bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[\'\'] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 dark:after:border-slate-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>' +
                                 '</label>' +
                                 '<span class="block text-[8px] text-slate-400 dark:text-slate-500 mt-1.5 font-black uppercase tracking-widest h-3 save-status-' + d.uniqueNo + '"></span>';
                } else {
                    actionCell = '<span class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">No Shortage</span>';
                }

                var collisionBadge = '';
                if (hasOrd2Collision) {
                    collisionBadge = '<div id="badge-' + d.uniqueNo + '" class="mt-3 bg-rose-600 dark:bg-rose-700 text-white text-[10px] p-2 rounded uppercase font-black tracking-widest shadow-md border border-rose-800 dark:border-rose-900">⚠️ ORD2 CONFLICT<br><span class="text-[9px] font-bold text-rose-200">Pending Order: ' + ord2Details.ordD + 'F / ' + ord2Details.ordE + 'E</span><br>👉 DISABLE ROLLOVER</div>';
                }
                var rowClass = hasOrd2Collision ? 'bg-rose-100 dark:bg-rose-900/20 hover:bg-rose-200 dark:hover:bg-rose-900/40 border-l-4 border-rose-600 transition-colors' : 'hover:bg-amber-50/50 dark:hover:bg-amber-900/10 transition-colors';

                var rowHtml = '<tr id="exc-row-' + d.uniqueNo + '" class="' + rowClass + '">' +
                        '<td class="p-4 border-b border-slate-200/50 dark:border-slate-700/50"><p class="font-black text-slate-800 dark:text-white text-sm">' + block.apartment + ' - ' + block.blockName + '</p><p class="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest mt-1">Door ' + d.doorNo + ' • <span class="inline-flex items-center gap-1.5 px-1.5 py-0.5 ml-1 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/50 hover:shadow-sm active:scale-95 transition-all cursor-pointer group" onclick="window.openCustomer360(\'' + d.cpn + '\')">' + d.cpn + '</span></p>' + collisionBadge + '</td>' +
                        '<td class="p-4 text-center border-b border-slate-200/50 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/30">' + ordStr + '</td>' +
                        '<td class="p-4 text-center border-b border-slate-200/50 dark:border-slate-700/50">' + actStr + '</td>' +
                        '<td class="p-4 text-center border-b border-slate-200/50 dark:border-slate-700/50 bg-rose-50/30 dark:bg-rose-900/10">' + shortageStr + '</td>' +
                        '<td class="p-4 border-b border-slate-200/50 dark:border-slate-700/50">' + cmtStr + '</td>' +
                        '<td class="p-4 text-center border-b border-slate-200/50 dark:border-slate-700/50">' + actionCell + '</td>' +
                        '</tr>';

                if (state.hasVariance) varianceRowsHtml += rowHtml;
                else infoRowsHtml += rowHtml;
            }
        });
    }

    var footerHtml = '</tbody></table>';
    var topBanner = '';
    if (collisionCpns.length > 0) {
        topBanner = '<div class="bg-rose-100 dark:bg-rose-900/30 p-4 border-b-4 border-rose-300 dark:border-rose-800 flex items-start gap-4 z-20 shadow-sm relative"><div class="text-4xl animate-pulse">🚨</div><div><h4 class="font-black text-rose-800 dark:text-rose-400 text-lg uppercase tracking-widest leading-tight">Action Required: Rollover Conflicts Detected</h4><p class="text-rose-700 dark:text-rose-300 text-xs font-bold mt-1">The highlighted customers already have a pending order in ORD2. You must manually toggle their Rollover switch to <span class="bg-rose-200 dark:bg-rose-800 px-2 py-0.5 rounded text-rose-900 dark:text-rose-200 border border-rose-300 dark:border-rose-700">NO</span> below.</p></div></div>';
    }

    if (count === 0) {
        container.innerHTML = '<div class="p-16 text-center"><div class="text-5xl mb-4">🌟</div><p class="text-lg font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">No exceptions or shortages found</p></div>';
    } else {
        container.innerHTML = topBanner + headerHTML + varianceRowsHtml + infoRowsHtml + footerHtml;
    }
    
    // SPA Standard Modal Open
    if(typeof window.toggleScrollLock === 'function') window.toggleScrollLock(true);
    document.getElementById('admin-exception-modal').classList.remove('hidden');
};

window.closeExceptionReview = function () { 
    if(typeof window.toggleScrollLock === 'function') window.toggleScrollLock(false);
    document.getElementById('admin-exception-modal').classList.add('hidden'); 
};

window.toggleDoorQC = function (checkbox, blockId) {
    var row = checkbox.closest('.qc-door-row');
    var inputs = row.querySelectorAll('input[type="number"]');
    var rIdx = parseInt(row.getAttribute('data-row-idx')); 
    var bData = window.cachedQCBlocksData[blockId];
    
    if (checkbox.checked) {
        inputs.forEach(inp => { inp.disabled = true; inp.classList.add('bg-slate-200', 'dark:bg-slate-700', 'text-slate-400', 'dark:text-slate-500', 'border-slate-200', 'dark:border-slate-600'); });
        if (bData) {
            var d = bData.doors.find(x => x.dbId === rIdx);
            if (d) { d.isVerified = true; window.syncQCStateBatch(blockId, null, [d]); }
        }
    } else {
        inputs.forEach(inp => { inp.disabled = false; inp.classList.remove('bg-slate-200', 'dark:bg-slate-700', 'text-slate-400', 'dark:text-slate-500', 'border-slate-200', 'dark:border-slate-600'); });
        if (bData) {
            var d = bData.doors.find(x => x.dbId === rIdx);
            if (d) { d.isVerified = false; window.syncQCStateBatch(blockId, null, [d]); }
        }
        window.unverifyBlock(blockId, true);
    }
};

window.unverifyBlock = function (blockId, skipSync) {
    var blockGroup = document.querySelector('.qc-block-group[data-block-id="' + blockId + '"]');
    var blockStatus = blockGroup.querySelector('.qc-block-status');
    if (blockStatus.innerText === "PENDING") return;
    
    blockStatus.innerText = "PENDING";
    blockStatus.className = "qc-block-status bg-slate-600 dark:bg-slate-500 px-3 py-1 rounded font-bold text-xs text-white";
    blockGroup.querySelector('.block-transfer-chk').checked = false;
    blockGroup.querySelector('.block-transfer-chk').classList.replace('block', 'hidden');

    blockGroup.querySelectorAll('.qc-inp-v2bf, .qc-inp-b2vf, .qc-inp-b2ve').forEach(inp => {
        inp.disabled = false; inp.classList.remove('bg-slate-200', 'dark:bg-slate-700', 'text-slate-500', 'dark:text-slate-400', 'border-slate-300', 'dark:border-slate-600');
    });

    window.selectedBlocks = window.selectedBlocks.filter(id => id !== blockId);
    window.checkTransferReady();
    document.getElementById('qc-select-all-chk').checked = false;

    if (!skipSync) {
        var bData = window.cachedQCBlocksData[blockId];
        if (bData) window.supabase1.from('deliveries').update({ block_qc: "PENDING" }).eq('apartment', bData.apartment).eq('block', bData.blockName);
    }
    window.updateHeaderCounts();
    window.sortBlocks();
};

window.autoVerifyPerfectBlocks = function () {
    var blocks = document.querySelectorAll('.qc-block-group');
    var promises = [];
    var verifiedCount = 0;

    blocks.forEach(block => {
        if (block.querySelector('.qc-block-status').innerText === "VERIFIED") return;
        var blockId = block.getAttribute('data-block-id');
        window.updateBlockMath(blockId);

        var sysFulls = parseInt(block.querySelector('.qc-sys-fulls').innerText) || 0;
        var sysEmpties = parseInt(block.querySelector('.qc-sys-empties').innerText) || 0;
        var driverB2vF = parseInt(block.querySelector('.qc-inp-b2vf').value) || 0;
        var driverB2vE = parseInt(block.querySelector('.qc-inp-b2ve').value) || 0;

        if (sysFulls === driverB2vF && sysEmpties === driverB2vE) {
            var bData = window.cachedQCBlocksData[blockId];
            if (!bData) return;

            var doorsToUpdate = [];
            block.querySelectorAll('.qc-door-chk:not(:checked)').forEach(chk => {
                chk.checked = true;
                var row = chk.closest('.qc-door-row');
                row.querySelectorAll('input[type="number"]').forEach(inp => { inp.disabled = true; inp.classList.add('bg-slate-200', 'dark:bg-slate-700'); });
                var d = bData.doors.find(x => x.dbId === parseInt(row.getAttribute('data-row-idx')));
                if (d) { d.isVerified = true; doorsToUpdate.push(d); }
            });

            block.querySelector('.qc-var-xf').value = 0; block.querySelector('.qc-var-sf').value = 0;
            block.querySelector('.qc-var-xe').value = 0; block.querySelector('.qc-var-se').value = 0;
            block.querySelector('.qc-var-reason').value = "Auto-Verified Perfect Match";
            block.querySelector('.qc-block-status').innerText = "VERIFIED";
            block.querySelector('.qc-block-status').className = "qc-block-status bg-emerald-500 px-4 py-1.5 rounded-lg font-black text-xs tracking-widest shadow text-white";
            block.querySelectorAll('.qc-inp-v2bf, .qc-inp-b2vf, .qc-inp-b2ve').forEach(inp => { inp.disabled = true; inp.classList.add('bg-slate-200', 'dark:bg-slate-700'); });
            block.querySelector('.block-transfer-chk').classList.replace('hidden', 'block');
            block.querySelector('.block-transfer-chk').checked = true;

            if (!window.selectedBlocks.includes(blockId)) window.selectedBlocks.push(blockId);

            var bPayload = { apt: bData.apartment, blk: bData.blockName, fullVar: 0, empVar: 0, reason: "Auto-Verified Perfect Match", v2bF: parseInt(block.querySelector('.qc-inp-v2bf').value) || 0, b2vF: driverB2vF, b2vE: driverB2vE };
            promises.push(window.syncQCStateBatch(blockId, bPayload, doorsToUpdate));
            verifiedCount++;
        }
    });

    if (verifiedCount > 0) {
        window.startQCTimer('Auto-Verifying');
        Promise.all(promises).then(() => {
            window.stopQCTimer('Verified', false);
            if(window.showToast) window.showToast("⚡ Auto-Verified " + verifiedCount + " perfect blocks!", "success");
        });
        window.updateHeaderCounts(); window.checkTransferReady(); window.sortBlocks();
    } else {
        if(window.showToast) window.showToast("No perfect matches found.", "warning");
    }
};

window.populateQCFilters = function (blocksData) { 
    var aptSelect = document.getElementById('qc-flt-apt');
    var apts = new Set();
    for (var key in blocksData) apts.add(blocksData[key].apartment);
    var sortedApts = Array.from(apts).sort();
    aptSelect.innerHTML = '<option value="ALL">ALL APARTMENTS</option>';
    sortedApts.forEach(apt => aptSelect.innerHTML += '<option value="' + apt + '">' + apt + '</option>');
    window.updateQCBlockDropdown();
};

window.updateQCBlockDropdown = function () { 
    var selApt = document.getElementById('qc-flt-apt').value;
    var blkSelect = document.getElementById('qc-flt-blk');
    var blks = new Set();
    for (var key in window.cachedQCBlocksData) {
        if (selApt === "ALL" || window.cachedQCBlocksData[key].apartment === selApt) blks.add(window.cachedQCBlocksData[key].blockName);
    }
    var sortedBlks = Array.from(blks).sort();
    blkSelect.innerHTML = '<option value="ALL">ALL BLOCKS</option>';
    sortedBlks.forEach(blk => blkSelect.innerHTML += '<option value="' + blk + '">' + blk + '</option>');
    window.applyQCFilter();
};

window.setStatusFilter = function (status) { 
    window.currentStatusFilter = status;
    ['all', 'pend', 'fin'].forEach(id => document.getElementById('btn-flt-' + id).className = "flex-1 text-[10px] md:text-xs font-black py-2.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 transition tracking-widest uppercase");
    var activeId = status === 'ALL' ? 'all' : (status === 'PENDING' ? 'pend' : 'fin');
    document.getElementById('btn-flt-' + activeId).className = "flex-1 text-[10px] md:text-xs font-black py-2.5 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm transition tracking-widest uppercase";
    document.getElementById('qc-select-all-chk').checked = false;
    window.applyQCFilter();
};

window.applyQCFilter = function () { 
    var selApt = document.getElementById('qc-flt-apt').value;
    var selBlk = document.getElementById('qc-flt-blk').value;
    var selExc = document.getElementById('qc-flt-exc') ? document.getElementById('qc-flt-exc').value : "ALL";
    document.querySelectorAll('.qc-block-group').forEach(block => {
        var blockId = block.getAttribute('data-block-id');
        var bData = window.cachedQCBlocksData[blockId];
        var matchApt = (selApt === "ALL" || bData.apartment === selApt);
        var matchBlk = (selBlk === "ALL" || bData.blockName === selBlk);
        var matchStatus = true;
        if (window.currentStatusFilter === 'PENDING') matchStatus = !bData.isBlockVerified;
        if (window.currentStatusFilter === 'VERIFIED') matchStatus = bData.isBlockVerified;
        var matchExc = true;
        if (selExc === "EXCEPTIONS") {
            matchExc = false; 
            bData.doors.forEach(d => { if (window.getDoorExceptionState(d).isException) matchExc = true; });
        }
        if (matchApt && matchBlk && matchStatus && matchExc) block.style.display = "";
        else block.style.display = "none";
    });
};

window.sortBlocks = function () { 
    var container = document.getElementById('qc-blocks-container');
    var blocks = Array.from(container.querySelectorAll('.qc-block-group'));
    blocks.sort((a, b) => {
        var statusA = a.querySelector('.qc-block-status').innerText === "VERIFIED" ? 1 : 0;
        var statusB = b.querySelector('.qc-block-status').innerText === "VERIFIED" ? 1 : 0;
        return statusA - statusB;
    });
    blocks.forEach(block => container.appendChild(block));
};

window.toggleAllVerifiedBlocks = function (mainCheckbox) { 
    var isChecked = mainCheckbox.checked;
    document.querySelectorAll('.block-transfer-chk:not(.hidden)').forEach(chk => {
        var blockGroup = chk.closest('.qc-block-group');
        if (blockGroup.style.display !== 'none') {
            chk.checked = isChecked;
            var blockId = chk.value;
            if (isChecked) { if (!window.selectedBlocks.includes(blockId)) window.selectedBlocks.push(blockId); } 
            else window.selectedBlocks = window.selectedBlocks.filter(id => id !== blockId);
        }
    });
    window.checkTransferReady();
};

window.checkTransferReady = function () { 
    var transferBtn = document.getElementById('btn-transfer-sales');
    var count = window.selectedBlocks.length;
    if (count > 0) {
        transferBtn.disabled = false; transferBtn.classList.replace('bg-slate-400', 'bg-emerald-600'); transferBtn.classList.replace('dark:bg-slate-600', 'dark:bg-emerald-600'); transferBtn.classList.remove('cursor-not-allowed');
    } else {
        transferBtn.disabled = true; transferBtn.classList.replace('bg-emerald-600', 'bg-slate-400'); transferBtn.classList.replace('dark:bg-emerald-600', 'dark:bg-slate-600'); transferBtn.classList.add('cursor-not-allowed');
    }
    transferBtn.innerHTML = '<svg class="w-4 h-4 md:w-5 md:h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> Process <span class="hidden sm:inline">Selected</span> (' + count + ')';
};

window.toggleBlockSelection = function (checkbox, blockId) { 
    if (checkbox.checked) { if (!window.selectedBlocks.includes(blockId)) window.selectedBlocks.push(blockId); } 
    else window.selectedBlocks = window.selectedBlocks.filter(id => id !== blockId);
    window.checkTransferReady();
};

window.updateBlockMath = function (blockId, preventUnverify) { 
    var blockGroup = document.querySelector('.qc-block-group[data-block-id="' + blockId + '"]');
    var bData = window.cachedQCBlocksData[blockId]; 
    var driverV2bF = parseInt(blockGroup.querySelector('.qc-inp-v2bf').value) || 0;
    var driverB2vF = parseInt(blockGroup.querySelector('.qc-inp-b2vf').value) || 0;
    var driverB2vE = parseInt(blockGroup.querySelector('.qc-inp-b2ve').value) || 0;
    blockGroup.querySelector('.qc-disp-b2vf').innerText = driverB2vF;
    blockGroup.querySelector('.qc-disp-b2ve').innerText = driverB2vE;
    var sumActD = 0, sumActE = 0, sumRep = 0;
    blockGroup.querySelectorAll('.qc-door-row').forEach(row => {
        var rIdx = parseInt(row.getAttribute('data-row-idx')); 
        var dvj = parseInt(row.querySelector('.qc-inp-actd-vj').value) || 0;
        var dnvj = parseInt(row.querySelector('.qc-inp-actd-nvj').value) || 0;
        var evj = parseInt(row.querySelector('.qc-inp-acte-vj').value) || 0;
        var envj = parseInt(row.querySelector('.qc-inp-acte-nvj').value) || 0;
        var repVjInp = row.querySelector('.qc-inp-actrep-vj');
        var repNvjInp = row.querySelector('.qc-inp-actrep-nvj');
        var rvj = repVjInp ? parseInt(repVjInp.value) || 0 : 0;
        var rnvj = repNvjInp ? parseInt(repNvjInp.value) || 0 : 0;
        sumActD += (dvj + dnvj); sumActE += (evj + envj); sumRep += (rvj + rnvj);
        if (bData && rIdx > 0) {
            var cachedDoor = bData.doors.find(d => d.dbId === rIdx);
            if (cachedDoor) { cachedDoor.dvj = dvj; cachedDoor.dnvj = dnvj; cachedDoor.evj = evj; cachedDoor.envj = envj; cachedDoor.repVj = rvj; cachedDoor.repNvj = rnvj; }
        }
    });
    var sysFulls = driverV2bF - sumActD - sumRep;
    var sysEmpties = sumActE + sumRep;
    blockGroup.querySelector('.qc-sys-fulls').innerText = sysFulls;
    blockGroup.querySelector('.qc-sys-empties').innerText = sysEmpties;
    var card = blockGroup.querySelector('.qc-math-summary-card');
    var labels = card.querySelectorAll('.qc-math-label');
    var texts = card.querySelectorAll('.qc-math-text');
    var divider = card.querySelector('.qc-math-divider');
    if (sysFulls !== driverB2vF || sysEmpties !== driverB2vE) {
        card.className = "qc-math-summary-card bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-800 rounded-xl p-4 mb-4 flex flex-col md:flex-row gap-6 transition-colors shadow-inner";
        labels.forEach(l => l.className = "text-[10px] font-black uppercase tracking-widest mb-1 qc-math-label text-red-500 dark:text-red-400");
        texts.forEach(t => t.className = "text-base font-black qc-math-text text-red-900 dark:text-red-300");
        divider.className = "flex-1 border-t md:border-t-0 md:border-l border-red-200 dark:border-red-800 qc-math-divider pt-3 md:pt-0 md:pl-6";
    } else {
        card.className = "qc-math-summary-card bg-indigo-50 dark:bg-indigo-900/20 border-2 border-indigo-100 dark:border-indigo-800 rounded-xl p-4 mb-4 flex flex-col md:flex-row gap-6 transition-colors";
        labels.forEach(l => l.className = "text-[10px] font-black uppercase tracking-widest mb-1 qc-math-label text-indigo-400 dark:text-indigo-500");
        texts.forEach(t => t.className = "text-base font-black qc-math-text text-indigo-900 dark:text-indigo-300");
        divider.className = "flex-1 border-t md:border-t-0 md:border-l border-indigo-200 dark:border-indigo-800 qc-math-divider pt-3 md:pt-0 md:pl-6";
    }
    if (typeof window.updateExceptionBadge === "function") window.updateExceptionBadge();
    if (!preventUnverify) window.unverifyBlock(blockId);
};

window.initLightbox = function () {
    if (document.getElementById('qc-lightbox')) return;
    var lb = document.createElement('div');
    lb.id = 'qc-lightbox';
    lb.className = 'fixed inset-0 z-[200] bg-slate-900/95 hidden flex flex-col items-center justify-center backdrop-blur-sm transition-opacity opacity-0';
    lb.innerHTML = '<div class="absolute top-4 right-4 flex gap-4 z-50"><button onclick="window.resetZoom()" class="bg-white/10 text-white font-bold px-4 py-2 rounded-lg hover:bg-white/20 transition">Reset Zoom</button><button onclick="window.closeLightbox()" class="bg-red-500 text-white font-black px-4 py-2 rounded-lg hover:bg-red-600 transition shadow-lg">CLOSE [X]</button></div><div id="lb-img-container" class="relative w-full h-full overflow-hidden cursor-grab flex items-center justify-center touch-none"><img id="lb-img" class="max-w-full max-h-full object-contain transition-transform duration-75 origin-center select-none shadow-2xl"></div><p class="absolute bottom-6 text-slate-400 font-bold text-sm bg-slate-900/50 px-4 py-2 rounded-xl pointer-events-none">Pinch to Zoom &bull; Drag to Pan</p>';
    document.body.appendChild(lb);

    var container = document.getElementById('lb-img-container');
    window.lbScale = 1; window.lbPointX = 0; window.lbPointY = 0;
    var isDragging = false, startX, startY;
    var initialPinchDistance = null, initialScale = 1;

    container.onwheel = function (e) {
        e.preventDefault(); window.lbScale += (e.deltaY < 0 ? 1 : -1) * 0.1;
        if (window.lbScale < 0.5) window.lbScale = 0.5;
        if (window.lbScale > 5) window.lbScale = 5;
        window.applyZoomPan();
    };

    container.onmousedown = function (e) {
        e.preventDefault(); isDragging = true; container.classList.replace('cursor-grab', 'cursor-grabbing');
        startX = e.clientX - window.lbPointX; startY = e.clientY - window.lbPointY;
    };
    container.onmousemove = function (e) {
        if (!isDragging) return;
        window.lbPointX = e.clientX - startX; window.lbPointY = e.clientY - startY; window.applyZoomPan();
    };
    container.onmouseup = function (e) { isDragging = false; container.classList.replace('cursor-grabbing', 'cursor-grab'); };
    container.onmouseleave = function (e) { isDragging = false; container.classList.replace('cursor-grabbing', 'cursor-grab'); };

    container.ontouchstart = function (e) {
        if (e.touches.length === 1) {
            isDragging = true; startX = e.touches[0].clientX - window.lbPointX; startY = e.touches[0].clientY - window.lbPointY;
        } else if (e.touches.length === 2) {
            isDragging = false;
            initialPinchDistance = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
            initialScale = window.lbScale;
        }
    };

    container.ontouchmove = function (e) {
        e.preventDefault();
        if (isDragging && e.touches.length === 1) {
            window.lbPointX = e.touches[0].clientX - startX; window.lbPointY = e.touches[0].clientY - startY;
            window.applyZoomPan();
        } else if (e.touches.length === 2 && initialPinchDistance) {
            var currentDistance = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
            var zoomFactor = currentDistance / initialPinchDistance;
            window.lbScale = initialScale * zoomFactor;
            if (window.lbScale < 0.5) window.lbScale = 0.5;
            if (window.lbScale > 5) window.lbScale = 5;
            window.applyZoomPan();
        }
    };

    container.ontouchend = function (e) { isDragging = false; initialPinchDistance = null; };
};

window.applyZoomPan = function () {
    var img = document.getElementById('lb-img');
    if (img) img.style.transform = 'translate(' + window.lbPointX + 'px, ' + window.lbPointY + 'px) scale(' + window.lbScale + ')';
};

window.resetZoom = function () { window.lbScale = 1; window.lbPointX = 0; window.lbPointY = 0; window.applyZoomPan(); };

window.openLightbox = function (url) {
    if (!url || url.trim() === "") {
        if(window.showToast) window.showToast("No photo provided.", "warning");
        return;
    }
    
    // SPA FIX: Scroll Lock
    if(typeof window.toggleScrollLock === 'function') window.toggleScrollLock(true);
    
    window.initLightbox();
    document.getElementById('lb-img').src = window.parseImgUrl(url);
    window.resetZoom();
    var lb = document.getElementById('qc-lightbox');
    lb.classList.remove('hidden');
    setTimeout(function () { lb.classList.remove('opacity-0'); }, 10);
};

window.closeLightbox = function () {
    var lb = document.getElementById('qc-lightbox');
    lb.classList.add('opacity-0');
    setTimeout(function () { 
        lb.classList.add('hidden'); 
        // SPA FIX: Release Scroll Lock
        if(typeof window.toggleScrollLock === 'function') window.toggleScrollLock(false);
    }, 300);
};

document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
        var lb = document.getElementById('qc-lightbox');
        if (lb && !lb.classList.contains('hidden')) window.closeLightbox();
        
        var ex = document.getElementById('admin-exception-modal');
        if (ex && !ex.classList.contains('hidden')) window.closeExceptionReview();
    }
});

window.scrollAdminTo = function (pos) {
    var topVal = (pos === 'top') ? 0 : 999999;
    window.scrollTo({ top: topVal, behavior: 'smooth' });
    document.documentElement.scrollTo({ top: topVal, behavior: 'smooth' });
    document.body.scrollTo({ top: topVal, behavior: 'smooth' });
    var scrollables = document.querySelectorAll('main, .overflow-y-auto');
    scrollables.forEach(function (el) {
        el.scrollTo({ top: (pos === 'top') ? 0 : el.scrollHeight, behavior: 'smooth' });
    });
};

window.tabActions['tran-delivery'] = function(arg) { window.loadDeliveryQCData(arg); };