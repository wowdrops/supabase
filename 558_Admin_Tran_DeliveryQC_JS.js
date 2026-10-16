window.selectedBlocks = [];
window.cachedQCBlocksData = {};
window.currentStatusFilter = 'ALL';
window.existingOrd2Data = {};
window.activeQCTimerInterval = null;
window.qcStartTime = 0;

window.startQCTimer = function(actionLabel) {
    var timerBadge = document.getElementById('qc-live-timer');
    if (!timerBadge) return;
    timerBadge.outerHTML = '<span id="qc-live-timer" class="bg-indigo-100 text-indigo-800 font-black px-3 py-1.5 rounded-lg text-sm border-2 border-indigo-200 shadow-inner flex items-center gap-1.5 min-w-max"><svg class="w-4 h-4 animate-spin text-indigo-600" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>' + actionLabel + ': <span id="qc-timer-sec">0.00</span>s</span>';
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
            ? '<span id="qc-live-timer" class="bg-red-100 text-red-800 font-bold px-3 py-1.5 rounded-lg border border-red-200 text-xs uppercase tracking-widest whitespace-nowrap shadow-sm min-w-max">Failed</span>'
            : '<span id="qc-live-timer" class="bg-emerald-100 text-emerald-800 font-bold px-3 py-1.5 rounded-lg border border-emerald-200 text-xs uppercase tracking-widest whitespace-nowrap shadow-sm min-w-max">' + successLabel + ' in ' + finalTime + 's</span>';
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

// --- DATA FETCHING (DELIVERIES + ORDERS FOR COLLISION CHECK) ---
window.loadDeliveryQCData = async function () {
    window.startQCTimer('Loading');
    document.getElementById('qc-blocks-container').innerHTML = '<div class="text-center p-8 font-bold text-slate-500 animate-pulse">Loading Pending Deliveries...</div>';
    window.selectedBlocks = [];
    document.getElementById('qc-select-all-chk').checked = false;

    try {
        // 1. Fetch Pending Orders (For Rollover Collisions)
        const { data: ordData, error: ordErr } = await supabase1.from('orders').select('cpn_no, ord_d, ord_e').eq('status', 'PENDING');
        if (ordErr) throw ordErr;
        
        window.existingOrd2Data = {};
        if (ordData) {
            ordData.forEach(o => {
                if (o.cpn_no) window.existingOrd2Data[o.cpn_no.toUpperCase()] = { ordD: o.ord_d || 0, ordE: o.ord_e || 0 };
            });
        }

        // 2. Fetch Active Deliveries
        const { data: delData, error: delErr } = await supabase1.from('deliveries').select('*').order('apartment', { ascending: true }).order('block', { ascending: true }).order('door', { ascending: true });
        if (delErr) throw delErr;

        var blocksData = {};
        var counts = { total: 0, finished: 0, pending: 0 };

        if (!delData || delData.length === 0) {
            window.stopQCTimer('Loaded', false);
            document.getElementById('qc-count-total').innerText = '0';
            document.getElementById('qc-count-finished').innerText = '0';
            document.getElementById('qc-count-pending').innerText = '0';
            document.getElementById('qc-blocks-container').innerHTML = '<div class="text-center p-8 font-black text-xl text-slate-400">No active deliveries found.</div>';
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
        window.stopQCTimer('Loaded', false);

    } catch (err) {
        window.stopQCTimer('Failed', true);
        document.getElementById('qc-blocks-container').innerHTML = '<div class="text-center p-8 font-black text-red-500">Error: ' + err.message + '</div>';
    }
};

window.requestEodPin = async function() {
    var btn = document.getElementById('btn-generate-otp');
    var originalText = btn.innerHTML;
    btn.innerHTML = '⏳ Generating...'; btn.disabled = true;
    
    if (!window.activeAdminSession || !window.activeAdminSession.mailid) return alert("Session error: No active admin email.");
    window.startQCTimer('Generating PIN');

    try {
        var newPin = Math.floor(1000 + Math.random() * 9000).toString();
        const { error } = await supabase1.from('users').update({ pin: newPin }).eq('mail_id', window.activeAdminSession.mailid);
        if (error) throw error;
        
        window.stopQCTimer('Generated', false);
        alert("🔐 EOD Handshake PIN generated:\n\n" + newPin + "\n\nProvide this single-use PIN to the driver to complete their shift.");
    } catch(err) {
        window.stopQCTimer('Failed', true);
        alert("Server Error: " + err.message);
    } finally {
        btn.innerHTML = originalText; btn.disabled = false;
    }
};

window.toggleRolloverLive = async function (blockId, uniqueNo, checkbox) {
    var isChecked = checkbox.checked;
    var statusEl = document.querySelector('.save-status-' + uniqueNo);
    statusEl.innerText = 'SAVING...';
    statusEl.className = 'block text-[8px] text-amber-600 mt-1.5 font-black uppercase tracking-widest h-3 animate-pulse save-status-' + uniqueNo;
    checkbox.disabled = true;

    try {
        var bData = window.cachedQCBlocksData[blockId];
        var door = bData.doors.find(d => d.uniqueNo === uniqueNo);
        var cmt = door.delComment.replace(/\[ROLLOVER: YES\]/g, "").replace(/\[ROLLOVER: NO\]/g, "").trim();
        cmt += (isChecked ? " [ROLLOVER: YES]" : " [ROLLOVER: NO]");

        const { error } = await supabase1.from('deliveries').update({ delivery_comment: cmt.trim() }).eq('unique_no', uniqueNo);
        if (error) throw error;

        door.rollover = isChecked;
        door.delComment = cmt.trim();
        statusEl.innerText = 'SAVED';
        statusEl.className = 'block text-[8px] text-emerald-600 mt-1.5 font-black uppercase tracking-widest h-3 save-status-' + uniqueNo;
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
        statusEl.className = 'block text-[8px] text-rose-600 mt-1.5 font-black uppercase tracking-widest h-3 save-status-' + uniqueNo;
    } finally {
        checkbox.disabled = false;
    }
};

window.syncQCStateBatch = async function (blockId, blockData, doorsArray) {
    try {
        var promises = [];
        if (blockData) {
            promises.push(supabase1.from('deliveries').update({
                block_qc: "VERIFIED", variance_full: blockData.fullVar, variance_empty: blockData.empVar,
                variance_reason: blockData.reason, van_to_block_full_can_count: blockData.v2bF,
                block_to_van_full_count: blockData.b2vF, block_to_van_empty_count: blockData.b2vE
            }).eq('apartment', blockData.apt).eq('block', blockData.blk));
        }

        doorsArray.forEach(d => {
            var actD = d.dvj + d.dnvj;
            var actE = d.evj + d.envj;
            promises.push(supabase1.from('deliveries').update({
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
    if (blockGroup.querySelectorAll('.qc-door-chk:not(:checked)').length > 0) return alert("Verify all doors first.");

    var driverB2vF = parseInt(blockGroup.querySelector('.qc-inp-b2vf').value) || 0;
    var driverB2vE = parseInt(blockGroup.querySelector('.qc-inp-b2ve').value) || 0;
    var xF = parseInt(blockGroup.querySelector('.qc-var-xf').value) || 0;
    var sF = parseInt(blockGroup.querySelector('.qc-var-sf').value) || 0;
    var xE = parseInt(blockGroup.querySelector('.qc-var-xe').value) || 0;
    var sE = parseInt(blockGroup.querySelector('.qc-var-se').value) || 0;

    var finalF = (parseInt(blockGroup.querySelector('.qc-sys-fulls').innerText) || 0) + xF - sF;
    var finalE = (parseInt(blockGroup.querySelector('.qc-sys-empties').innerText) || 0) + xE - sE;

    if (finalF !== driverB2vF || finalE !== driverB2vE) return alert("Math Error! Use Variance boxes to balance discrepancies.");

    blockGroup.querySelector('.qc-block-status').innerText = "VERIFIED";
    blockGroup.querySelector('.qc-block-status').className = "qc-block-status bg-emerald-500 px-4 py-1.5 rounded-lg font-black text-xs tracking-widest shadow text-white";
    blockGroup.querySelector('.block-transfer-chk').classList.replace('hidden', 'block');
    blockGroup.querySelector('.block-transfer-chk').checked = true;

    blockGroup.querySelectorAll('.qc-inp-v2bf, .qc-inp-b2vf, .qc-inp-b2ve').forEach(inp => {
        inp.disabled = true; inp.classList.add('bg-slate-200', 'text-slate-500', 'border-slate-300');
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
    if (window.selectedBlocks.length === 0) return alert("Select at least one verified block.");
    if (!confirm("Execute batch sync for " + window.selectedBlocks.length + " selected block(s)?")) return;

    btn.innerText = "Syncing..."; btn.disabled = true;
    window.startQCTimer('Syncing');

    try {
        // 1. VERIFY EOD HANDSHAKE
        var uniqueDrivers = new Set();
        var allDeliveriesToMigrate = [];
        
        window.selectedBlocks.forEach(blockId => {
            var block = document.querySelector('.qc-block-group[data-block-id="' + blockId + '"]');
            var bData = window.cachedQCBlocksData[blockId];
            bData.doors.forEach(d => {
                if (d.enterBy) uniqueDrivers.add(d.enterBy.trim().toLowerCase());
                d.runtimeVars = {
                    v2bF: parseInt(block.querySelector('.qc-inp-v2bf').value) || 0,
                    b2vF: parseInt(block.querySelector('.qc-inp-b2vf').value) || 0,
                    b2vE: parseInt(block.querySelector('.qc-inp-b2ve').value) || 0,
                    fullVar: (parseInt(block.querySelector('.qc-var-xf').value) || 0) - (parseInt(block.querySelector('.qc-var-sf').value) || 0),
                    empVar: (parseInt(block.querySelector('.qc-var-xe').value) || 0) - (parseInt(block.querySelector('.qc-var-se').value) || 0),
                    reason: block.querySelector('.qc-var-reason').value || "Verified"
                };
                allDeliveriesToMigrate.push(d);
            });
        });

        const todayStart = new Date(); todayStart.setHours(0,0,0,0);
        const { data: eodLogs } = await supabase1.from('eod_log').select('driver_mail_id').eq('status', 'Completed').gte('timestamp', todayStart.toISOString());
        var verifiedDrivers = eodLogs ? eodLogs.map(l => l.driver_mail_id.toLowerCase()) : [];
        var pendingDrivers = Array.from(uniqueDrivers).filter(d => !verifiedDrivers.includes(d));

        if (pendingDrivers.length > 0) {
            throw new Error("TRANSFER BLOCKED: Missing EOD Handshake for: " + pendingDrivers.join(', '));
        }

        // 2. CHECK LIVE ORD2 COLLISIONS
        const { data: ordData } = await supabase1.from('orders').select('cpn_no').eq('status', 'PENDING');
        var currentOrders = ordData ? ordData.map(o => o.cpn_no.toUpperCase()) : [];
        var liveCollisions = false;

        allDeliveriesToMigrate.forEach(d => {
            if (d.rollover && currentOrders.includes(d.cpn.toUpperCase())) liveCollisions = true;
        });

        if (liveCollisions) {
            window.loadDeliveryQCData(); // Reload to fetch fresh ORD2
            throw new Error("LIVE COLLISION DETECTED! A customer placed a new order while you were reviewing. Please disable Rollover for highlighted exceptions.");
        }

        // 3. PREPARE INSERTS & DELETES
        var salesBatch = [];
        var ordersBatch = [];
        var deliveryIdsToDelete = [];
        var timeNow = new Date().toISOString();

        allDeliveriesToMigrate.forEach(d => {
            var actD = d.dvj + d.dnvj;
            var actE = d.evj + d.envj;
            var reqRep = d.replaceQty || 0;
            var actRep = d.repVj + d.repNvj;

            salesBatch.push({
                unique_no: d.uniqueNo, cpn_no: d.cpn, apartment: d.apartment, block: d.block, door: d.doorNo,
                order_date: d.delDate, ord_d: d.ordD, ord_e: d.ordE, del_date: d.delDate,
                act_d: actD, act_e: actE, rate: d.rate, amount: actD * d.rate,
                order_entered_at: d.enterOn, order_entered_by: d.enterBy,
                delivery_entered_at: d.enterOn, delivery_entered_by: d.enterBy,
                status: "DELIVERED", chkbox_reserved5: false,
                door_qc: "TRUE", block_qc: "VERIFIED",
                variance_full: d.runtimeVars.fullVar, variance_empty: d.runtimeVars.empVar, variance_reason: d.runtimeVars.reason,
                van_to_block_full_can_count: d.runtimeVars.v2bF, block_to_van_full_count: d.runtimeVars.b2vF, block_to_van_empty_count: d.runtimeVars.b2vE,
                act_d_vj: d.dvj, act_d_nvj: d.dnvj, act_e_vj: d.evj, act_e_nvj: d.envj,
                replace_qty: d.replaceQty, replace_reason: d.replaceReason, replace_act_vj: d.repVj, replace_act_nvj: d.repNvj,
                delivery_comment: d.delComment, created_at: timeNow, created_by: window.activeAdminSession ? window.activeAdminSession.username : 'ADMIN'
            });

            deliveryIdsToDelete.push(d.dbId);

            // 4. ROLLOVER LOGIC
            if (d.rollover) {
                var diffD = Math.max(0, d.ordD - actD);
                var diffE = Math.max(0, d.ordE - actE);
                var diffRep = Math.max(0, reqRep - actRep);

                if (diffD > 0 || diffE > 0 || diffRep > 0) {
                    var pushReason = "[ADMIN ROLLED: SHORTAGE]";
                    if (d.delComment.includes("[DEFERRED")) pushReason = d.delComment.replace("[DEFERRED", "[AUTO-DEFERRED");
                    
                    ordersBatch.push({
                        unique_no: d.uniqueNo + ((actD > 0 || actE > 0) ? "-P1" : "-R1"),
                        cpn_no: d.cpn, apartment: d.apartment, block: d.block, door: d.doorNo,
                        order_date: timeNow.split('T')[0], ord_d: diffD, ord_e: diffE, rate: d.rate, amount: diffD * d.rate,
                        order_comment: pushReason, status: "PENDING", pending_qty: diffD,
                        replace_qty: diffRep, replace_reason: d.replaceReason,
                        created_at: timeNow, created_by: window.activeAdminSession ? window.activeAdminSession.username : 'ADMIN'
                    });
                }
            }
        });

        // 5. EXECUTE SUPABASE TRANSACTIONS
        const { error: salesErr } = await supabase1.from('sales').insert(salesBatch);
        if (salesErr) throw salesErr;

        if (ordersBatch.length > 0) {
            const { error: ordInsErr } = await supabase1.from('orders').insert(ordersBatch);
            if (ordInsErr) throw ordInsErr;
        }

        const { error: delErr } = await supabase1.from('deliveries').delete().in('id', deliveryIdsToDelete);
        if (delErr) throw delErr;

        window.stopQCTimer('Synced', false);
        alert("Batch Sync Successful!");
        window.loadDeliveryQCData();

    } catch(err) {
        window.stopQCTimer('Blocked', true);
        if (err.message.includes("LIVE COLLISION")) window.openExceptionReview();
        alert(err.message);
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
                
                // Return base64 string
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
                // 1. Compress Image
                var b64String = await window.compressAdminImage(file);
                
                // 2. Upload to ImgBB
                document.getElementById('admin-qc-upload-text').innerText = "Uploading to ImgBB...";
                let formData = new FormData();
                formData.append("image", b64String.split(',')[1]); // Strip the data uri prefix
                
                let res = await fetch("https://api.imgbb.com/1/upload?key=" + IMGBB_API_KEY, { method: "POST", body: formData });
                let json = await res.json();
                
                if (!json.success) throw new Error("ImgBB Upload Failed.");
                var finalUrl = json.data.url;

                // 3. Update Supabase Database
                var updatePayload = {};
                if (payload.type === 'v2b') updatePayload.van_to_block_link = finalUrl;
                else if (payload.type === 'b2v') updatePayload.block_to_van_link = finalUrl;
                else updatePayload.door_delivery_link = finalUrl;

                var query = supabase1.from('deliveries').update(updatePayload);
                if (payload.type === 'door') query = query.eq('unique_no', payload.doorUniqueNo);
                else query = query.eq('apartment', payload.apt).eq('block', payload.blk);
                
                const { error: dbErr } = await query;
                if (dbErr) throw dbErr;

                // 4. Update UI
                var imgEl = document.getElementById(payload.imgId);
                imgEl.src = finalUrl;
                imgEl.setAttribute('onclick', 'window.openLightbox("' + finalUrl + '")');
                
                if (payload.type === 'door') imgEl.closest('.qc-door-row').setAttribute('data-photo-url', finalUrl);
                else if (payload.type === 'v2b') window.cachedQCBlocksData[payload.blockId].v2bPhoto = finalUrl;
                else window.cachedQCBlocksData[payload.blockId].b2vPhoto = finalUrl;

            } catch(err) {
                alert("Upload Error: " + err.message);
            } finally {
                window.hideAdminUploadLoader();
                e.target.value = '';
            }
        });
    }
});

// Utility UI Functions
window.toggleDoorQC = function (checkbox, blockId) {
    var row = checkbox.closest('.qc-door-row');
    var inputs = row.querySelectorAll('input[type="number"]');
    var rIdx = parseInt(row.getAttribute('data-row-idx'));
    var bData = window.cachedQCBlocksData[blockId];
    
    if (checkbox.checked) {
        inputs.forEach(inp => { inp.disabled = true; inp.classList.add('bg-slate-200', 'text-slate-400', 'border-slate-200'); });
        if (bData) {
            var d = bData.doors.find(x => x.sheetRow === rIdx);
            if (d) { d.isVerified = true; window.syncQCStateBatch(blockId, null, [d]); }
        }
    } else {
        inputs.forEach(inp => { inp.disabled = false; inp.classList.remove('bg-slate-200', 'text-slate-400', 'border-slate-200'); });
        if (bData) {
            var d = bData.doors.find(x => x.sheetRow === rIdx);
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
    blockStatus.className = "qc-block-status bg-slate-600 px-3 py-1 rounded font-bold text-xs";
    blockGroup.querySelector('.block-transfer-chk').checked = false;
    blockGroup.querySelector('.block-transfer-chk').classList.replace('block', 'hidden');

    blockGroup.querySelectorAll('.qc-inp-v2bf, .qc-inp-b2vf, .qc-inp-b2ve').forEach(inp => {
        inp.disabled = false; inp.classList.remove('bg-slate-200', 'text-slate-500', 'border-slate-300');
    });

    window.selectedBlocks = window.selectedBlocks.filter(id => id !== blockId);
    window.checkTransferReady();
    document.getElementById('qc-select-all-chk').checked = false;

    if (!skipSync) {
        var bData = window.cachedQCBlocksData[blockId];
        if (bData) supabase1.from('deliveries').update({ block_qc: "PENDING" }).eq('apartment', bData.apartment).eq('block', bData.blockName);
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
                row.querySelectorAll('input[type="number"]').forEach(inp => { inp.disabled = true; inp.classList.add('bg-slate-200'); });
                var d = bData.doors.find(x => x.sheetRow === parseInt(row.getAttribute('data-row-idx')));
                if (d) { d.isVerified = true; doorsToUpdate.push(d); }
            });

            block.querySelector('.qc-var-xf').value = 0; block.querySelector('.qc-var-sf').value = 0;
            block.querySelector('.qc-var-xe').value = 0; block.querySelector('.qc-var-se').value = 0;
            block.querySelector('.qc-var-reason').value = "Auto-Verified Perfect Match";
            block.querySelector('.qc-block-status').innerText = "VERIFIED";
            block.querySelector('.qc-block-status').className = "qc-block-status bg-emerald-500 px-4 py-1.5 rounded-lg font-black text-xs tracking-widest shadow text-white";
            block.querySelectorAll('.qc-inp-v2bf, .qc-inp-b2vf, .qc-inp-b2ve').forEach(inp => { inp.disabled = true; inp.classList.add('bg-slate-200'); });
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
            alert("⚡ Auto-Verified " + verifiedCount + " perfect blocks!");
        });
        window.updateHeaderCounts(); window.checkTransferReady(); window.sortBlocks();
    } else alert("No perfect matches found.");
};

window.populateQCFilters = function (blocksData) { /* Retained exactly as original */
    var aptSelect = document.getElementById('qc-flt-apt');
    var apts = new Set();
    for (var key in blocksData) apts.add(blocksData[key].apartment);
    var sortedApts = Array.from(apts).sort();
    aptSelect.innerHTML = '<option value="ALL">ALL APARTMENTS</option>';
    sortedApts.forEach(apt => aptSelect.innerHTML += '<option value="' + apt + '">' + apt + '</option>');
    window.updateQCBlockDropdown();
};
window.updateQCBlockDropdown = function () { /* Retained exactly as original */
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
window.setStatusFilter = function (status) { /* Retained exactly as original */
    window.currentStatusFilter = status;
    ['all', 'pend', 'fin'].forEach(id => document.getElementById('btn-flt-' + id).className = "flex-1 text-[10px] md:text-xs font-black py-2.5 rounded-lg text-slate-500 hover:text-slate-800 transition tracking-widest uppercase");
    var activeId = status === 'ALL' ? 'all' : (status === 'PENDING' ? 'pend' : 'fin');
    document.getElementById('btn-flt-' + activeId).className = "flex-1 text-[10px] md:text-xs font-black py-2.5 rounded-lg bg-white text-slate-800 shadow-sm transition tracking-widest uppercase";
    document.getElementById('qc-select-all-chk').checked = false;
    window.applyQCFilter();
};
window.applyQCFilter = function () { /* Retained exactly as original */
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
window.sortBlocks = function () { /* Retained exactly as original */
    var container = document.getElementById('qc-blocks-container');
    var blocks = Array.from(container.querySelectorAll('.qc-block-group'));
    blocks.sort((a, b) => {
        var statusA = a.querySelector('.qc-block-status').innerText === "VERIFIED" ? 1 : 0;
        var statusB = b.querySelector('.qc-block-status').innerText === "VERIFIED" ? 1 : 0;
        return statusA - statusB;
    });
    blocks.forEach(block => container.appendChild(block));
};
window.toggleAllVerifiedBlocks = function (mainCheckbox) { /* Retained exactly as original */
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
window.checkTransferReady = function () { /* Retained exactly as original */
    var transferBtn = document.getElementById('btn-transfer-sales');
    var count = window.selectedBlocks.length;
    if (count > 0) {
        transferBtn.disabled = false; transferBtn.classList.replace('bg-slate-400', 'bg-emerald-600'); transferBtn.classList.remove('cursor-not-allowed');
    } else {
        transferBtn.disabled = true; transferBtn.classList.replace('bg-emerald-600', 'bg-slate-400'); transferBtn.classList.add('cursor-not-allowed');
    }
    transferBtn.innerHTML = '<svg class="w-4 h-4 md:w-5 md:h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> Process <span class="hidden sm:inline">Selected</span> (' + count + ')';
};
window.toggleBlockSelection = function (checkbox, blockId) { /* Retained exactly as original */
    if (checkbox.checked) { if (!window.selectedBlocks.includes(blockId)) window.selectedBlocks.push(blockId); } 
    else window.selectedBlocks = window.selectedBlocks.filter(id => id !== blockId);
    window.checkTransferReady();
};
window.updateBlockMath = function (blockId, preventUnverify) { /* Retained exactly as original */
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
            var cachedDoor = bData.doors.find(d => d.sheetRow === rIdx);
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
        card.className = "qc-math-summary-card bg-red-50 border-2 border-red-300 rounded-xl p-4 mb-4 flex flex-col md:flex-row gap-6 transition-colors shadow-inner";
        labels.forEach(l => l.className = "text-[10px] font-black uppercase tracking-widest mb-1 qc-math-label text-red-500");
        texts.forEach(t => t.className = "text-base font-black qc-math-text text-red-900");
        divider.className = "flex-1 border-t md:border-t-0 md:border-l border-red-200 qc-math-divider pt-3 md:pt-0 md:pl-6";
    } else {
        card.className = "qc-math-summary-card bg-indigo-50 border-2 border-indigo-100 rounded-xl p-4 mb-4 flex flex-col md:flex-row gap-6 transition-colors";
        labels.forEach(l => l.className = "text-[10px] font-black uppercase tracking-widest mb-1 qc-math-label text-indigo-400");
        texts.forEach(t => t.className = "text-base font-black qc-math-text text-indigo-900");
        divider.className = "flex-1 border-t md:border-t-0 md:border-l border-indigo-200 qc-math-divider pt-3 md:pt-0 md:pl-6";
    }
    if (typeof window.updateExceptionBadge === "function") window.updateExceptionBadge();
    if (!preventUnverify) window.unverifyBlock(blockId);
};