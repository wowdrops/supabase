
    (function () {
        // --- 1. LOCAL OFFLINE STORAGE ENGINE (Unchanged) ---
        window.initDB = function () { return new Promise(function (resolve, reject) { var req = indexedDB.open("WOWDROPS_Ops", 2); req.onupgradeneeded = function (e) { window.db = e.target.result; if (!window.db.objectStoreNames.contains("deliveries")) window.db.createObjectStore("deliveries", { keyPath: "uniqueNo" }); if (!window.db.objectStoreNames.contains("unloads")) window.db.createObjectStore("unloads", { keyPath: "blockId" }); if (!window.db.objectStoreNames.contains("loads")) window.db.createObjectStore("loads", { keyPath: "blockId" }); }; req.onsuccess = function (e) { window.db = e.target.result; resolve(); }; req.onerror = function (e) { reject(e); }; }); };
        window.saveToDB = function (store, data) { return new Promise(function (resolve) { var txn = window.db.transaction(store, "readwrite"); txn.objectStore(store).put(data); txn.oncomplete = function () { window.updateSyncCount(); window.calculateDashboardStats(); resolve(); }; }); };
        window.getFromDB = function (store) { return new Promise(function (resolve) { var req = window.db.transaction(store, "readonly").objectStore(store).getAll(); req.onsuccess = function () { resolve(req.result); }; }); };
        
        window.compressImage = function (file) { return new Promise(function (resolve, reject) { if (!file) { resolve(null); return; } var locationText = "GPS: Fetching..."; var processImage = function () { var reader = new FileReader(); reader.readAsDataURL(file); reader.onload = function (e) { var img = new Image(); img.src = e.target.result; img.onload = function () { var canvas = document.createElement('canvas'); canvas.width = 800; canvas.height = img.height * (800 / img.width); var ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, canvas.width, canvas.height); var now = new Date(); var timeString = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + " | " + now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); var watermark1 = "Date: " + timeString; var watermark2 = locationText; ctx.fillStyle = "rgba(0, 0, 0, 0.65)"; ctx.fillRect(0, canvas.height - 75, canvas.width, 75); ctx.font = "bold 20px sans-serif"; ctx.fillStyle = "#ffffff"; ctx.shadowColor = "rgba(0, 0, 0, 0.8)"; ctx.shadowBlur = 4; ctx.shadowOffsetX = 1; ctx.shadowOffsetY = 1; ctx.fillText(watermark1, 20, canvas.height - 45); ctx.fillText(watermark2, 20, canvas.height - 18); resolve(canvas.toDataURL('image/jpeg', 0.6)); }; }; reader.onerror = function (e) { reject(e); }; }; if (navigator.geolocation) { navigator.geolocation.getCurrentPosition(function (position) { var lat = position.coords.latitude.toFixed(6); var lng = position.coords.longitude.toFixed(6); var acc = Math.round(position.coords.accuracy); locationText = "GPS: " + lat + ", " + lng + " (±" + acc + "m)"; processImage(); }, function (error) { if (error.code === error.PERMISSION_DENIED) { locationText = "GPS: Permission Denied by User"; } else if (error.code === error.POSITION_UNAVAILABLE) { locationText = "GPS: Signal Unavailable (Indoors?)"; } else if (error.code === error.TIMEOUT) { locationText = "GPS: Request Timed Out"; } else { locationText = "GPS: Unknown Error"; } processImage(); }, { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }); } else { locationText = "GPS: Not Supported by Browser"; processImage(); } }); };

        // --- NEW: CLOUD IMAGE UPLOAD API (ImgBB) ---
        window.uploadImageToCloud = async function(base64Data) {
            if (!base64Data || base64Data.length < 10) return "";
            try {
                
                
                let b64 = base64Data.split(',')[1] || base64Data;
                let formData = new FormData();
                formData.append("image", b64);
                
                let res = await fetch("https://api.imgbb.com/1/upload?key=" + IMGBB_API_KEY, {
                    method: "POST",
                    body: formData
                });
                let json = await res.json();
                if (json.success) return json.data.url;
                return "";
            } catch (e) {
                console.error("Image upload failed:", e);
                return "";
            }
        };

        window.loadLocalData = function () {
            var lData = localStorage.getItem('wd_pending_data');
            var aData = localStorage.getItem('wd_all_data');
            var sData = localStorage.getItem('wd_server_summary');
            var cData = localStorage.getItem('wd_sys_config');
            
            if (cData) { try { window.APP_CONFIG.VJ_PRICE = JSON.parse(cData).vjPrice; } catch (e) { } }

            if (lData) {
                try { window.pendingData = JSON.parse(lData); } catch (e) { window.pendingData = {}; }
                try { window.allData = JSON.parse(aData); } catch (e) { window.allData = {}; }
                try { window.serverSummary = JSON.parse(sData); } catch (e) { window.serverSummary = null; }
                document.getElementById('dash-last-sync').innerText = localStorage.getItem('wd_last_sync_ts') || 'Unknown';
                window.populateApts(); window.calculateDashboardStats();
            }
        };

        // --- 3. SUPABASE SYNC ENGINE ---
        window.syncData = async function () {
            if (!navigator.onLine) { window.showToast("No Internet Connection.", false); return; }

            if (!window.currentUser || !window.currentUser.username) {
                window.showToast("Session error. Please log out and log back in.", false);
                return;
            }

            try {
                var d = await window.getFromDB('deliveries');
                var u = await window.getFromDB('unloads');
                var l = await window.getFromDB('loads');

                if (d.length === 0 && u.length === 0 && l.length === 0) return;

                window.showLoader('Syncing to Cloud...');
                var bBtn = document.getElementById('banner-sync-btn');
                if (bBtn) { bBtn.innerText = 'Syncing...'; bBtn.disabled = true; }
                var sBtn = document.getElementById('btn-sync');
                if (sBtn) { sBtn.innerText = 'Syncing...'; sBtn.disabled = true; sBtn.style.opacity = '0.7'; }

                const supa = window.supabase1;
                const ts = new Date().toISOString();
                const todayStr = new Date().toISOString().split('T')[0];
                const userEmail = window.currentUser.username;

                // 1. Process Unloads (Van to Block)
                for (let i = 0; i < u.length; i++) {
                    let photoUrl = await window.uploadImageToCloud(u[i].photoBase64);
                    await supa.from('deliveries').update({
                        van_to_block_link: photoUrl,
                        van_to_block_full_can_count: u[i].fullCount,
                        unload_on: ts,
                        unload_by: userEmail
                    }).eq('apartment', u[i].apt).eq('block', u[i].blk);
                }

                // 2. Process Loads (Block to Van)
                for (let i = 0; i < l.length; i++) {
                    let photoUrl = await window.uploadImageToCloud(l[i].photoBase64);
                    await supa.from('deliveries').update({
                        block_to_van_link: photoUrl,
                        block_to_van_full_count: l[i].fullCount,
                        block_to_van_empty_count: l[i].emptyCount,
                        load_on: ts,
                        load_by: userEmail
                    }).eq('apartment', l[i].apt).eq('block', l[i].blk);
                }

                // 3. Process Door Deliveries
                for (let i = 0; i < d.length; i++) {
                    let photoUrl = "";
                    if (d[i].photoBase64 && d[i].photoBase64.length > 10) {
                        photoUrl = await window.uploadImageToCloud(d[i].photoBase64);
                    }
                    
                    await supa.from('deliveries').update({
                        act_d: d[i].actD,
                        act_e: d[i].actE,
                        del_date: todayStr, 
                        act_d_vj: d[i].actDVj,
                        act_d_nvj: d[i].actDNvj,
                        act_e_vj: d[i].actEVj,
                        act_e_nvj: d[i].actENvj,
                        replace_act_vj: d[i].repActVj,
                        replace_act_nvj: d[i].repActNvj,
                        delivery_comment: d[i].comment,
                        door_delivery_link: photoUrl,
                        delivery_entered_at: ts,
                        delivery_entered_by: userEmail,
                        status: 'DELIVERED',
                        door_qc: 'PASS' // Automatically clears QC if Driver completes it
                    }).eq('unique_no', d[i].uniqueNo);
                }

                // Clear Local DB
                var txn = window.db.transaction(["deliveries", "unloads", "loads"], "readwrite");
                txn.objectStore("deliveries").clear();
                txn.objectStore("unloads").clear();
                txn.objectStore("loads").clear();

                txn.oncomplete = function () {
                    if (bBtn) { bBtn.innerText = 'SYNC NOW'; bBtn.disabled = false; }
                    if (sBtn) { sBtn.innerHTML = 'SYNC NOW'; sBtn.disabled = false; sBtn.style.opacity = '1'; }
                    
                    window.hideLoader();
                    window.updateSyncCount();
                    window.showToast("Synced successfully!", true);
                    window.fetchOrdersFromServer(); // Refresh Route
                };

            } catch (err) {
                window.hideLoader();
                var bBtn = document.getElementById('banner-sync-btn'); if (bBtn) { bBtn.innerText = 'SYNC NOW'; bBtn.disabled = false; }
                var sBtn = document.getElementById('btn-sync'); if (sBtn) { sBtn.innerHTML = 'SYNC NOW'; sBtn.disabled = false; sBtn.style.opacity = '1'; }
                window.showToast("Sync Error: " + err.message, false);
            }
        };

        // --- 4. SUPABASE HISTORICAL PROCESSED QUERY ---
        window.loadProcessedHistoryFromArchive = async function () {
            var start = document.getElementById('filter-start-date').value; 
            var end = document.getElementById('filter-end-date').value;
            var cpn = document.getElementById('filter-cpn-input').value.trim(); 
            var container = document.getElementById('processed-list-container');
            
            if (!start || !end) { window.showToast("Please input date constraints", false); return; }
            window.showLoader('Searching Database...'); 
            container.innerHTML = '';

            try {
                let query = window.supabase1
                    .from('sales') // Archive ledger
                    .select('*')
                    .eq('delivery_entered_by', window.currentUser.username)
                    .gte('del_date', start)
                    .lte('del_date', end)
                    .order('del_date', { ascending: false })
                    .limit(200);

                if (cpn) query = query.eq('cpn_no', cpn.toUpperCase());

                const { data, error } = await query;
                if (error) throw error;

                // Format data exactly as UI expects
                let formattedData = (data || []).map(row => ({
                    apartment: row.apartment || "",
                    block: row.block || "",
                    door: row.door || "",
                    cpnno: row.cpn_no || "",
                    delDate: row.del_date || "",
                    actDVj: row.act_d_vj || 0,
                    actDNvj: row.act_d_nvj || 0,
                    actEVj: row.act_e_vj || 0,
                    actENvj: row.act_e_nvj || 0,
                    replaceQty: row.replace_qty || 0,
                    replaceReason: row.replace_reason || "",
                    repActVj: row.replace_act_vj || 0,
                    repActNvj: row.replace_act_nvj || 0,
                    doorLink: row.door_delivery_link || "",
                    vanToBlockLink: row.van_to_block_link || "",
                    blockToVanLink: row.block_to_van_link || "",
                    ordComment: row.order_comment || ""
                }));

                window.hideLoader();
                window.renderHistoryCardsMarkup(container, formattedData, "No historical entries match selection filters.");
            } catch (err) {
                window.hideLoader();
                container.innerHTML = '<p class="text-center text-red-500 font-bold p-4">Server Error: ' + err.message + '</p>';
            }
        };

        // =========================================================
        // PRESERVED UI RENDERING FUNCTIONS (Do not modify logic)
        // =========================================================

        window.calculateDashboardStats = function () {
            window.pendingData = window.pendingData || {};
            var tApts = Object.keys(window.pendingData).length;
            var tBlocks = 0, pBlocks = 0, tDoors = 0, pDoors = 0;
            var tgtD = 0, tgtD_rep = 0, tgtE = 0, cmpD = 0, cmpD_rep = 0, cmpE = 0;
            var tUnloadCans = 0, tUnloadCans_rep = 0, pUnloadCans = 0, pUnloadCans_rep = 0;
            var tLoadCans = 0, tLoadCans_rep = 0, pLoadCans = 0, pLoadCans_rep = 0;

            var oOrdDVj = 0, oOrdDNvj = 0, oOrdE = 0;
            var oActDVj = 0, oActDNvj = 0, oActEVj = 0, oActENvj = 0;
            var oPendDVj = 0, oPendDNvj = 0, oPendE = 0;
            var oLocallyCompBlocks = 0, oLocallyCompDoors = 0;

            if (window.serverSummary) {
                oOrdDVj = window.serverSummary.totalOrdDVj || 0;
                oOrdDNvj = window.serverSummary.totalOrdDNvj || 0;
                oOrdE = window.serverSummary.totalOrdE || 0;

                oActDVj = window.serverSummary.actualDVj; oActDNvj = window.serverSummary.actualDNvj;
                oActEVj = window.serverSummary.actualEVj; oActENvj = window.serverSummary.actualENvj;
                oPendDVj = window.serverSummary.pendingDVj; oPendDNvj = window.serverSummary.pendingDNvj;
                oPendE = window.serverSummary.pendingE;
            }

            window.getFromDB('deliveries').then(function (savedDels) {
                window.getFromDB('unloads').then(function (savedUnloads) {
                    window.getFromDB('loads').then(function (savedLoads) {

                        for (var apt in window.pendingData) {
                            for (var blk in window.pendingData[apt]) {
                                tBlocks++;
                                var blockId = apt + '_' + blk;
                                var doors = window.pendingData[apt][blk];

                                var isUnloadedLocally = false; for (var u = 0; u < savedUnloads.length; u++) { if (savedUnloads[u].blockId === blockId) isUnloadedLocally = true; }
                                var isLoadedLocally = false; for (var l = 0; l < savedLoads.length; l++) { if (savedLoads[l].blockId === blockId) isLoadedLocally = true; }

                                if (!isUnloadedLocally && !doors[0].v2bDone) pBlocks++;

                                var blockCompleteLocally = (isUnloadedLocally || doors[0].v2bDone) && (isLoadedLocally || doors[0].b2vDone);
                                var allDoorsDone = true;

                                for (var i = 0; i < doors.length; i++) {
                                    var d = doors[i]; tDoors++;
                                    var rQty = d.replaceQty || 0;

                                    tgtD += d.ordD;
                                    tgtD_rep += rQty;
                                    tgtE += d.ordE;

                                    tUnloadCans += d.ordD;
                                    tUnloadCans_rep += rQty;

                                    if (!isUnloadedLocally && !doors[0].v2bDone) {
                                        pUnloadCans += d.ordD;
                                        pUnloadCans_rep += rQty;
                                    }

                                    tLoadCans += d.ordE;
                                    tLoadCans_rep += rQty;
                                    if (!isLoadedLocally && !doors[0].b2vDone) {
                                        pLoadCans += d.ordE;
                                        pLoadCans_rep += rQty;
                                    }

                                    var localDoor = null; for (var j = 0; j < savedDels.length; j++) { if (String(savedDels[j].uniqueNo) === String(d.uniqueNo)) localDoor = savedDels[j]; }

                                    if (localDoor) {
                                        cmpD += (localDoor.actDVj || 0) + (localDoor.actDNvj || 0);
                                        cmpD_rep += (localDoor.repActVj || 0) + (localDoor.repActNvj || 0);
                                        cmpE += (localDoor.actEVj || 0) + (localDoor.actENvj || 0);

                                        if (!d.doorDone && window.serverSummary) {
                                            oLocallyCompDoors++;
                                            var evj = d.expVj;
                                            oPendDVj -= evj; oPendDNvj -= d.expNvj; oPendE -= d.ordE;

                                            oActDVj += (localDoor.actDVj || 0); oActDNvj += (localDoor.actDNvj || 0);
                                            oActEVj += (localDoor.actEVj || 0); oActENvj += (localDoor.actENvj || 0);
                                        }
                                    }
                                    else if (d.doorDone) {
                                        cmpD += (d.actDVj || 0) + (d.actDNvj || 0);
                                        cmpD_rep += (d.replaceActVj || 0) + (d.replaceActNvj || 0);
                                        cmpE += (d.actEVj || 0) + (d.actENvj || 0);
                                    }
                                    else { pDoors++; allDoorsDone = false; }
                                }

                                if (blockCompleteLocally && allDoorsDone) oLocallyCompBlocks++;
                            }
                        }

                        document.getElementById('stat-drv-blk-tot').innerText = tBlocks;
                        document.getElementById('stat-drv-blk-pend').innerText = pBlocks;

                        document.getElementById('stat-drv-unl-tot').innerHTML = (tUnloadCans + tUnloadCans_rep) + '<span class="block text-[10px] font-bold text-blue-500 mt-1 tracking-wide">' + tUnloadCans + ' Reg | ' + tUnloadCans_rep + ' Rep</span>';
                        document.getElementById('stat-drv-unl-pend').innerHTML = (pUnloadCans + pUnloadCans_rep) + '<span class="block text-[10px] font-bold text-rose-400 mt-1 tracking-wide">' + pUnloadCans + ' Reg | ' + pUnloadCans_rep + ' Rep</span>';

                        document.getElementById('stat-drv-ld-tot').innerHTML = (tLoadCans + tLoadCans_rep) + '<span class="block text-[10px] font-bold text-emerald-500 mt-1 tracking-wide">' + tLoadCans + ' Emp | ' + tLoadCans_rep + ' Rep</span>';
                        document.getElementById('stat-drv-ld-pend').innerHTML = (pLoadCans + pLoadCans_rep) + '<span class="block text-[10px] font-bold text-rose-400 mt-1 tracking-wide">' + pLoadCans + ' Emp | ' + pLoadCans_rep + ' Rep</span>';

                        document.getElementById('stat-del-apts').innerText = tApts;
                        document.getElementById('stat-del-blks').innerText = tBlocks;
                        document.getElementById('stat-del-doors').innerText = tDoors + " (Pend: " + pDoors + ")";

                        document.getElementById('stat-del-tgt-d').innerHTML = (tgtD + tgtD_rep) + ' <span class="text-[10px] text-slate-400 font-bold ml-1">(' + tgtD + ' Reg | ' + tgtD_rep + ' Rep)</span>';
                        document.getElementById('stat-del-tgt-e').innerText = tgtE;

                        document.getElementById('stat-del-cmp-d').innerHTML = (cmpD + cmpD_rep) + ' <span class="text-[10px] text-emerald-400 font-bold ml-1">(' + cmpD + ' Reg | ' + cmpD_rep + ' Rep)</span>';
                        document.getElementById('stat-del-cmp-e').innerText = cmpE;

                        var pendReg = Math.max(0, tgtD - cmpD);
                        var pendRep = Math.max(0, tgtD_rep - cmpD_rep);

                        document.getElementById('stat-del-pnd-d').innerHTML = (pendReg + pendRep) + ' <span class="text-[10px] text-rose-400 font-bold ml-1">(' + pendReg + ' Reg | ' + pendRep + ' Rep)</span>';
                        document.getElementById('stat-del-pnd-e').innerText = Math.max(0, tgtE - cmpE);

                        if (window.serverSummary) {
                            var finalPendBlocks = Math.max(0, (window.serverSummary.pendingBlocks || 0) - oLocallyCompBlocks);
                            var finalCompBlocks = (window.serverSummary.totalBlocks || 0) - finalPendBlocks;
                            var elSumBlkTot = document.getElementById('stat-sum-blocks-tot'); if (elSumBlkTot) elSumBlkTot.innerText = window.serverSummary.totalBlocks || 0;
                            var elSumBlkCmp = document.getElementById('stat-sum-blocks-cmp'); if (elSumBlkCmp) elSumBlkCmp.innerText = finalCompBlocks;
                            var elSumBlkPend = document.getElementById('stat-sum-blocks-pend'); if (elSumBlkPend) elSumBlkPend.innerText = finalPendBlocks;

                            var finalPendDoors = Math.max(0, (window.serverSummary.pendingDoors || 0) - oLocallyCompDoors);
                            var finalCompDoors = (window.serverSummary.totalDoors || 0) - finalPendDoors;
                            var elSumDrTot = document.getElementById('stat-sum-doors-tot'); if (elSumDrTot) elSumDrTot.innerText = window.serverSummary.totalDoors || 0;
                            var elSumDrCmp = document.getElementById('stat-sum-doors-cmp'); if (elSumDrCmp) elSumDrCmp.innerText = finalCompDoors;
                            var elSumDrPend = document.getElementById('stat-sum-doors-pend'); if (elSumDrPend) elSumDrPend.innerText = finalPendDoors;

                            var elUnlVj = document.getElementById('sum-unl-vj');
                            if (elUnlVj) {
                                elUnlVj.parentElement.innerHTML = '<span id="sum-unl-vj" class="text-sm">' + oOrdDVj + '</span> VJ | <span id="sum-unl-nvj" class="text-sm">' + oOrdDNvj + '</span> NVJ <span class="block text-[10px] font-black text-amber-600 mt-1 uppercase">+' + tgtD_rep + ' Replacements</span>';
                            }

                            var elActDVj = document.getElementById('sum-act-d-vj'); if (elActDVj) elActDVj.innerText = oActDVj;
                            var elActDNvj = document.getElementById('sum-act-d-nvj'); if (elActDNvj) elActDNvj.innerText = oActDNvj;
                            var elActEVj = document.getElementById('sum-act-e-vj'); if (elActEVj) elActEVj.innerText = oActEVj;
                            var elActENvj = document.getElementById('sum-act-e-nvj'); if (elActENvj) elActENvj.innerText = oActENvj;

                            var elPendDVj = document.getElementById('sum-pend-d-vj'); if (elPendDVj) elPendDVj.innerText = Math.max(0, oPendDVj);
                            var elPendDNvj = document.getElementById('sum-pend-d-nvj'); if (elPendDNvj) elPendDNvj.innerText = Math.max(0, oPendDNvj);
                            var elPendE = document.getElementById('sum-pend-e'); if (elPendE) elPendE.innerText = Math.max(0, oPendE);

                            var globalOrdDVj = 0, globalOrdDNvj = 0, globalOrdRep = 0;
                            var globalUnloaded = 0, globalActD = 0, globalRepActTotal = 0;
                            var globalActEVj = 0, globalActENvj = 0;
                            var globalRepActVj = 0, globalRepActNvj = 0;
                            var globalEodE = 0;

                            for (var apt in window.allData) {
                                for (var blk in window.allData[apt]) {
                                    var allDoors = window.allData[apt][blk];
                                    var bId = apt + '_' + blk;

                                    var effDelD = 0; var effDelE = 0; var effRepCol = 0; var ordDWithReps = 0;
                                    var bActEVj = 0, bActENvj = 0, bRepActVj = 0, bRepActNvj = 0;

                                    for (var k = 0; k < allDoors.length; k++) {
                                        var ad = allDoors[k];

                                        globalOrdDVj += ad.expVj;
                                        globalOrdDNvj += ad.expNvj;
                                        globalOrdRep += (ad.replaceQty || 0);

                                        ordDWithReps += (ad.ordD + (ad.replaceQty || 0));

                                        var dMatch = null;
                                        for (var m = 0; m < savedDels.length; m++) {
                                            if (String(savedDels[m].uniqueNo) === String(ad.uniqueNo)) dMatch = savedDels[m];
                                        }

                                        if (dMatch) {
                                            effDelD += (dMatch.actDVj || 0) + (dMatch.actDNvj || 0);
                                            effDelE += (dMatch.actEVj || 0) + (dMatch.actENvj || 0);

                                            bActEVj += (dMatch.actEVj || 0);
                                            bActENvj += (dMatch.actENvj || 0);
                                            bRepActVj += (dMatch.repActVj || 0);
                                            bRepActNvj += (dMatch.repActNvj || 0);
                                            effRepCol += (dMatch.repActVj || 0) + (dMatch.repActNvj || 0);
                                        } else if (ad.doorDone) {
                                            effDelD += (ad.actDVj || 0) + (ad.actDNvj || 0);
                                            effDelE += (ad.actEVj || 0) + (ad.actENvj || 0);

                                            bActEVj += (ad.actEVj || 0);
                                            bActENvj += (ad.actENvj || 0);
                                            bRepActVj += (ad.replaceActVj || 0);
                                            bRepActNvj += (ad.replaceActNvj || 0);
                                            effRepCol += (ad.replaceActVj || 0) + (ad.replaceActNvj || 0);
                                        }
                                    }

                                    var uMatch = null;
                                    for (var u = 0; u < savedUnloads.length; u++) {
                                        if (savedUnloads[u].blockId === bId) uMatch = savedUnloads[u];
                                    }

                                    var actUnl = 0;
                                    if (uMatch) {
                                        actUnl = uMatch.fullCount;
                                    } else if (allDoors[0].v2bDone) {
                                        actUnl = (allDoors[0].v2bFulls !== undefined && allDoors[0].v2bFulls > 0) ? allDoors[0].v2bFulls : ordDWithReps;
                                    } else {
                                        actUnl = ordDWithReps;
                                    }

                                    globalUnloaded += actUnl;
                                    globalActD += effDelD;
                                    globalRepActTotal += effRepCol;

                                    globalActEVj += bActEVj;
                                    globalActENvj += bActENvj;
                                    globalRepActVj += bRepActVj;
                                    globalRepActNvj += bRepActNvj;
                                    
                                    globalEodE += (effDelE + effRepCol);
                                }
                            }

                            var globalEodF = Math.max(0, globalUnloaded - globalActD - globalRepActTotal);
                            
                            var elUnlVj = document.getElementById('sum-unl-vj');
                            if (elUnlVj) {
                                elUnlVj.parentElement.innerHTML = '<span id="sum-unl-vj" class="text-sm">' + globalOrdDVj + '</span> VJ | <span id="sum-unl-nvj" class="text-sm">' + globalOrdDNvj + '</span> NVJ <span class="block text-[10px] font-black text-amber-600 mt-1 uppercase">+' + globalOrdRep + ' Replacements</span>';
                            }

                            var elLdFvj = document.getElementById('sum-ld-f-vj');
                            if (elLdFvj) {
                                elLdFvj.parentElement.innerHTML = '<span class="text-2xl font-black text-indigo-800">' + globalEodF + '</span> Total <span class="block text-[9px] font-bold text-slate-500 mt-1.5 leading-tight">(' + globalUnloaded + ' Unloaded - ' + globalActD + ' Delivered - ' + globalRepActTotal + ' Reps)</span>';
                            }

                            var elLdEvj = document.getElementById('sum-ld-e-vj');
                            if (elLdEvj) {
                                elLdEvj.parentElement.innerHTML = '<span class="text-2xl font-black text-indigo-800">' + globalEodE + '</span> Total ' +
                                    '<div class="mt-1.5 text-[9px] font-bold text-slate-500 leading-tight">' +
                                    '<span class="block">Regular: ' + globalActEVj + ' VJ | ' + globalActENvj + ' NVJ</span>' +
                                    '<span class="block mt-0.5">Replace: ' + globalRepActVj + ' VJ | ' + globalRepActNvj + ' NVJ</span>' +
                                    '</div>';
                            }
                        }
                    });
                });
            });
        };

        window.populateApts = function () {
            var sel = document.getElementById('sel-apt'); sel.innerHTML = '<option value="">Select Apartment</option>';
            var keys = Object.keys(window.pendingData).sort(function (a, b) { return a.localeCompare(b, undefined, { numeric: true }); });
            for (var i = 0; i < keys.length; i++) { sel.innerHTML += '<option value="' + keys[i] + '">' + keys[i] + '</option>'; }
        };

        window.populateBlocks = function () {
            window.selectedApt = document.getElementById('sel-apt').value;
            var sel = document.getElementById('sel-block'); sel.innerHTML = '<option value="">Select Block</option>';
            if (window.selectedApt && window.pendingData[window.selectedApt]) {
                var keys = Object.keys(window.pendingData[window.selectedApt]).sort(function (a, b) { return a.localeCompare(b, undefined, { numeric: true }); });
                for (var i = 0; i < keys.length; i++) { sel.innerHTML += '<option value="' + keys[i] + '">' + keys[i] + '</option>'; }
            }
        };

        window.startOperations = function () {
            window.selectedApt = document.getElementById('sel-apt').value; window.selectedBlock = document.getElementById('sel-block').value;
            if (!window.selectedApt || !window.selectedBlock) { window.showToast("Select Apt & Block", false); return; }
            document.getElementById('current-location-title').innerText = window.selectedApt + " - " + window.selectedBlock;

            var r = window.currentUser.role.toUpperCase();
            if (r === window.APP_CONFIG.ROLE_DRIVER || r === window.APP_CONFIG.ROLE_BOTH || r === window.APP_CONFIG.ROLE_BOTH_ADMIN) { window.renderUnloadState(); window.renderLoadState(); }
            if (r === window.APP_CONFIG.ROLE_DELIVERY || r === window.APP_CONFIG.ROLE_BOTH || r === window.APP_CONFIG.ROLE_BOTH_ADMIN) { window.renderDoors(); }
            window.switchView('view-operations');
        };

        window.adjustQty = function (id, d) {
            var el = document.getElementById(id);
            if (el) { el.value = Math.max(0, (parseInt(el.value) || 0) + d); if (id.startsWith('inp-load')) window.checkLoadVariance(); }
        };

        window.renderUnloadState = function () {
            window.getFromDB('unloads').then(function (unloads) {
                var bId = window.selectedApt + '_' + window.selectedBlock; var savedMatch = null;
                for (var i = 0; i < unloads.length; i++) { if (unloads[i].blockId === bId) savedMatch = unloads[i]; }
                var doneInDB = window.pendingData[window.selectedApt][window.selectedBlock][0].v2bDone;

                if (savedMatch || doneInDB) {
                    document.getElementById('form-unload').classList.add('hidden'); document.getElementById('done-unload').classList.remove('hidden');
                    document.getElementById('badge-unload').className = "text-[10px] bg-emerald-500 px-2 py-1 rounded shadow-inner text-white font-black";
                    document.getElementById('badge-unload').innerText = doneInDB && !savedMatch ? "DB SYNCED" : "SAVED LOCAL";

                    var photoHTML = savedMatch && savedMatch.photoBase64 ? '<div class="mt-4 flex justify-center"><img src="' + savedMatch.photoBase64 + '" onclick="window.openLightbox(\'' + savedMatch.photoBase64 + '\')" class="h-32 rounded-lg border border-emerald-200 shadow-sm bg-white p-1 cursor-pointer hover:scale-105 transition"></div>' : '';
                    document.getElementById('done-unload').innerHTML = '<span class="text-4xl block mb-2">✅</span><p class="text-sm font-black text-emerald-800">Unload Saved</p>' + photoHTML + '<button onclick="window.editOperation(\'unload\')" class="text-xs font-bold text-slate-500 mt-4 hover:text-slate-700 underline transition">Edit Entry</button>';
                } else {
                    document.getElementById('form-unload').classList.remove('hidden'); document.getElementById('done-unload').classList.add('hidden');
                    document.getElementById('badge-unload').className = "text-[10px] bg-slate-700 px-2 py-1 rounded shadow-inner text-white";
                    document.getElementById('badge-unload').innerText = "PENDING";

                    var blockTotalD = 0, blockVj = 0, blockNvj = 0;
                    var doors = window.pendingData[window.selectedApt][window.selectedBlock];
                    for (var j = 0; j < doors.length; j++) {
                        var rQty = doors[j].replaceQty || 0;
                        blockTotalD += (doors[j].ordD + rQty);
                        blockVj += (doors[j].expVj + rQty);
                        blockNvj += doors[j].expNvj;
                    }

                    document.getElementById('inp-unload-full').value = blockTotalD;
                    var splitEl = document.getElementById('unload-target-split');
                    if (splitEl) splitEl.innerText = 'TARGET: ' + blockVj + ' VJ | ' + blockNvj + ' NVJ';
                    document.getElementById('photo-unload').value = '';
                }
            });
        };

        window.saveUnloadData = function () {
            var count = document.getElementById('inp-unload-full').value; var photo = document.getElementById('photo-unload');
            if (!photo.files || photo.files.length === 0) { window.showToast("Photo is required.", false); return; }
            window.showLoader('Compressing...');
            window.compressImage(photo.files[0]).then(function (b64) {
                window.saveToDB("unloads", { blockId: window.selectedApt + '_' + window.selectedBlock, apt: window.selectedApt, blk: window.selectedBlock, fullCount: parseInt(count) || 0, photoBase64: b64 }).then(function () {
                    window.hideLoader(); window.showToast("Unload data saved.", true); window.renderUnloadState();
                });
            });
        };

        window.checkLoadVariance = function () {
            window.getFromDB('deliveries').then(function (savedDels) {
                window.getFromDB('unloads').then(function (savedUnloads) {
                    var bId = window.selectedApt + '_' + window.selectedBlock;
                    var doors = window.pendingData[window.selectedApt][window.selectedBlock];

                    var unloadedFulls = 0; var unlMatch = null;
                    for (var i = 0; i < savedUnloads.length; i++) { if (savedUnloads[i].blockId === bId) unlMatch = savedUnloads[i]; }

                    if (unlMatch) { unloadedFulls = unlMatch.fullCount; }
                    else { for (var j = 0; j < doors.length; j++) { unloadedFulls += (doors[j].ordD + (doors[j].replaceQty || 0)); } }

                    var effDelD = 0; var effDelE = 0; var effRepCollected = 0;
                    for (var k = 0; k < doors.length; k++) {
                        var d = doors[k]; var localMatch = null;
                        for (var m = 0; m < savedDels.length; m++) { if (String(savedDels[m].uniqueNo) === String(d.uniqueNo)) localMatch = savedDels[m]; }
                        
                        if (localMatch) {
                            effDelD += (localMatch.actDVj || 0) + (localMatch.actDNvj || 0);
                            effDelE += (localMatch.actEVj || 0) + (localMatch.actENvj || 0);
                            effRepCollected += (localMatch.repActVj || 0) + (localMatch.repActNvj || 0);
                        }
                        else if (d.doorDone) {
                            effDelD += (d.actDVj || 0) + (d.actDNvj || 0);
                            effDelE += (d.actEVj || 0) + (d.actENvj || 0);
                            effRepCollected += (d.replaceActVj || 0) + (d.replaceActNvj || 0);
                        }
                    }

                    var unusedFulls = unloadedFulls - effDelD;
                    if (unusedFulls < 0) unusedFulls = 0;

                    var reps = effRepCollected;
                    var expFulls = Math.max(0, unusedFulls - reps);
                    var expEmpties = effDelE + reps;

                    var eCount = parseInt(document.getElementById('inp-load-empty').value);
                    if (isNaN(eCount)) eCount = 0;
                    var fCount = parseInt(document.getElementById('inp-load-full').value);
                    if (isNaN(fCount)) fCount = 0;

                    var warnDiv = document.getElementById('load-variance-warning'); if (!warnDiv) return;
                    warnDiv.classList.remove('hidden');

                    var fullsText = 'EXPECTED FULLS: <span class="text-lg">' + expFulls + '</span> <br><span class="text-[9px] text-slate-500 font-black tracking-widest">( ' + unusedFulls + ' Unused &nbsp;-&nbsp; ' + reps + ' Reps Given )</span>';
                    var emptiesText = 'EXPECTED EMPTIES: <span class="text-lg">' + expEmpties + '</span> <br><span class="text-[9px] text-slate-500 font-black tracking-widest">( ' + effDelE + ' Regular &nbsp;+&nbsp; ' + reps + ' Faulty Reps )</span>';

                    if (eCount === expEmpties && fCount === expFulls) {
                        warnDiv.innerHTML = '<div class="text-emerald-700 uppercase tracking-widest mb-3">✅ Perfect Match</div><div class="bg-white p-2 rounded-lg border border-emerald-100 shadow-sm mb-3">' + fullsText + '</div><div class="bg-white p-2 rounded-lg border border-emerald-100 shadow-sm">' + emptiesText + '</div>';
                        warnDiv.className = 'text-xs font-bold bg-emerald-50 p-3 rounded-xl text-center mt-3 shadow-inner border border-emerald-200';
                    } else {
                        warnDiv.innerHTML = '<div class="text-rose-700 uppercase tracking-widest mb-2">⚠️ Variance Detected</div><div class="text-[10px] text-rose-600 mb-3 font-black bg-rose-100 py-1 rounded">You entered: ' + fCount + ' Fulls, ' + eCount + ' Empties</div><div class="bg-white p-2 rounded-lg border border-rose-100 shadow-sm mb-3">' + fullsText + '</div><div class="bg-white p-2 rounded-lg border border-rose-100 shadow-sm">' + emptiesText + '</div>';
                        warnDiv.className = 'text-xs font-bold bg-rose-50 p-3 rounded-xl text-center mt-3 border border-rose-200 shadow-inner leading-relaxed';
                    }
                });
            });
        };

        window.renderLoadState = function () {
            Promise.all([window.getFromDB('loads'), window.getFromDB('unloads'), window.getFromDB('deliveries')]).then(function (res) {
                var loads = res[0], unloads = res[1], savedDels = res[2];
                var bId = window.selectedApt + '_' + window.selectedBlock; var savedMatch = null;
                for (var i = 0; i < loads.length; i++) { if (loads[i].blockId === bId) savedMatch = loads[i]; }
                var doneInDB = window.pendingData[window.selectedApt][window.selectedBlock][0].b2vDone;

                if (savedMatch || doneInDB) {
                    document.getElementById('form-load').classList.add('hidden'); document.getElementById('done-load').classList.remove('hidden');
                    document.getElementById('badge-load').className = "text-[10px] bg-emerald-500 px-2 py-1 rounded shadow-inner text-white font-black";
                    document.getElementById('badge-load').innerText = doneInDB && !savedMatch ? "DB SYNCED" : "SAVED LOCAL";

                    var photoHTML = savedMatch && savedMatch.photoBase64 ? '<div class="mt-4 flex justify-center"><img src="' + savedMatch.photoBase64 + '" onclick="window.openLightbox(\'' + savedMatch.photoBase64 + '\')" class="h-32 rounded-lg border border-emerald-200 shadow-sm bg-white p-1 cursor-pointer hover:scale-105 transition"></div>' : '';
                    document.getElementById('done-load').innerHTML = '<span class="text-4xl block mb-2">✅</span><p class="text-sm font-black text-emerald-800">Load Saved</p>' + photoHTML + '<button onclick="window.editOperation(\'load\')" class="text-xs font-bold text-slate-500 mt-4 hover:text-slate-700 underline transition">Edit Entry</button>';
                } else {
                    var doors = window.pendingData[window.selectedApt][window.selectedBlock];
                    var unloadedFulls = 0; var unlMatch = null;
                    for (var i = 0; i < unloads.length; i++) { if (unloads[i].blockId === bId) unlMatch = unloads[i]; }
                    if (unlMatch) unloadedFulls = unlMatch.fullCount;
                    else doors.forEach(function (d) { unloadedFulls += (d.ordD + (d.replaceQty || 0)); });

                    var effDelD = 0; var effDelE = 0; var effRepCol = 0;
                    doors.forEach(function (d) {
                        var localMatch = null;
                        for (var m = 0; m < savedDels.length; m++) { if (String(savedDels[m].uniqueNo) === String(d.uniqueNo)) localMatch = savedDels[m]; }

                        if (localMatch) {
                            effDelD += (localMatch.actDVj || 0) + (localMatch.actDNvj || 0);
                            effDelE += (localMatch.actEVj || 0) + (localMatch.actENvj || 0);
                            effRepCol += (localMatch.repActVj || 0) + (localMatch.repActNvj || 0);
                        } else if (d.doorDone) {
                            effDelD += (d.actDVj || 0) + (d.actDNvj || 0);
                            effDelE += (d.actEVj || 0) + (d.actENvj || 0);
                            effRepCol += (d.replaceActVj || 0) + (d.replaceActNvj || 0);
                        }
                    });
                    
                    var expF = Math.max(0, unloadedFulls - effDelD - effRepCol);

                    document.getElementById('form-load').classList.remove('hidden'); document.getElementById('done-load').classList.add('hidden');
                    document.getElementById('badge-load').className = "text-[10px] bg-slate-700 px-2 py-1 rounded shadow-inner text-white";
                    document.getElementById('badge-load').innerText = "PENDING";

                    document.getElementById('inp-load-empty').value = effDelE + effRepCol;
                    document.getElementById('inp-load-full').value = expF;
                    document.getElementById('photo-load').value = '';
                    window.checkLoadVariance();
                }
            });
        };

        window.saveLoadData = function () {
            var eCount = document.getElementById('inp-load-empty').value; var fCount = document.getElementById('inp-load-full').value;
            var photo = document.getElementById('photo-load');
            if (!photo.files || photo.files.length === 0) { window.showToast("Photo is required.", false); return; }
            window.showLoader('Compressing...');
            window.compressImage(photo.files[0]).then(function (b64) {
                window.saveToDB("loads", { blockId: window.selectedApt + '_' + window.selectedBlock, apt: window.selectedApt, blk: window.selectedBlock, emptyCount: parseInt(eCount) || 0, fullCount: parseInt(fCount) || 0, photoBase64: b64 }).then(function () {
                    window.hideLoader(); window.showToast("Load data saved.", true); window.renderLoadState();
                });
            });
        };

        window.editOperation = function (type) {
            var txn = window.db.transaction(type + "s", "readwrite"); txn.objectStore(type + "s").delete(String(window.selectedApt + '_' + window.selectedBlock));
            txn.oncomplete = function () { if (type === 'unload') window.renderUnloadState(); else window.renderLoadState(); window.updateSyncCount(); window.calculateDashboardStats(); };
        };

        window.activeExceptionUno = null;

        window.openExceptionModal = function (uNo) {
            window.activeExceptionUno = uNo;
            var modal = document.getElementById('modal-exception');
            if (modal) modal.classList.remove('hidden');
        };

        window.closeExceptionModal = function () {
            window.activeExceptionUno = null;
            var modal = document.getElementById('modal-exception');
            if (modal) modal.classList.add('hidden');
        };

        window.applyExceptionOption = function (type) {
            var uNo = window.activeExceptionUno;
            if (!uNo) return;

            var actDVjEl = document.getElementById('actDVj-' + uNo);
            var actDNvjEl = document.getElementById('actDNvj-' + uNo);
            var actEVjEl = document.getElementById('actEVj-' + uNo);
            var actENvjEl = document.getElementById('actENvj-' + uNo);
            var cmtEl = document.getElementById('comment-' + uNo);
            var photoInp = document.getElementById('photo-' + uNo);

            if (type === 'LIFT_ISSUE') {
                actDVjEl.value = 0; actDNvjEl.value = 0; actEVjEl.value = 0; actENvjEl.value = 0;
                cmtEl.value = "[DEFERRED: LIFT ISSUE]";
                if (photoInp) photoInp.required = true;
                window.showToast("Marked as Lift Issue. Photo required.", true);
            }
            else if (type === 'EMPTY_MISSING') {
                actDVjEl.value = 0; actDNvjEl.value = 0; actEVjEl.value = 0; actENvjEl.value = 0;
                cmtEl.value = "[DEFERRED: EMPTY MISSING]";
                if (photoInp) photoInp.required = true;
                window.showToast("Marked as Empty Missing. Photo required.", true);
            }
            else if (type === 'CANCEL_BY_CUSTOMER') {
                actDVjEl.value = 0; actDNvjEl.value = 0; actEVjEl.value = 0; actENvjEl.value = 0;
                cmtEl.value = "[CANCELLED: BY CUSTOMER]";
                if (photoInp) photoInp.required = false;
                window.showToast("Marked as Cancelled By Customer.", true);
            }
            else if (type === 'SHORT_STOCK') {
                cmtEl.value = "[DEFERRED: SHORT STOCK]";
                if (photoInp) photoInp.required = true;
                window.showToast("Marked as Short Stock / Partial. Photo required.", true);
            }

            window.closeExceptionModal();
        };

        window.renderDoors = function () {
            var container = document.getElementById('doors-container'); container.innerHTML = '';
            window.getFromDB('deliveries').then(function (savedDels) {
                var doors = window.pendingData[window.selectedApt][window.selectedBlock];
                if (!doors) return;
                var sortedDoors = doors.slice().sort(function (a, b) { return String(a.door).localeCompare(String(b.door), undefined, { numeric: true }); });

                for (var i = 0; i < sortedDoors.length; i++) {
                    var d = sortedDoors[i]; var savedItem = null;
                    for (var j = 0; j < savedDels.length; j++) { if (String(savedDels[j].uniqueNo) === String(d.uniqueNo)) savedItem = savedDels[j]; }
                    var isSaved = !!savedItem; var doneInDB = d.doorDone;

                    var expVj = d.expVj; var expNvj = d.expNvj;

                    var rQty = d.replaceQty || 0;
                    var rReason = d.replaceReason || "";
                    var recRepVj = isSaved ? (savedItem.repActVj || 0) : (d.replaceActVj || 0);
                    var recRepNvj = isSaved ? (savedItem.repActNvj || 0) : (d.replaceActNvj || 0);

                    var card = document.createElement('div');
                    card.className = "bg-white border border-slate-200 rounded-2xl p-4 shadow-sm relative mb-4";

                    var html = '<div class="flex justify-between items-center mb-3 border-b border-slate-100 pb-2"><h4 class="font-black text-xl text-slate-800">' + (i + 1) + '. Door ' + d.door + '</h4><div class="flex gap-1"><span class="bg-slate-100 text-slate-600 px-2 py-1 rounded text-[10px] font-bold tracking-widest border border-slate-200 shadow-sm">' + d.cpnno + '</span><span class="bg-indigo-50 text-indigo-700 px-2 py-1 rounded text-[10px] font-bold tracking-widest border border-indigo-200 shadow-sm">DEP: ₹' + d.advance + '</span></div></div>';

                    if (isSaved || doneInDB) {
                        var photoHtml = (isSaved && savedItem.photoBase64) ? '<div class="mt-3 pt-3 border-t border-emerald-200 flex justify-center"><img src="' + savedItem.photoBase64 + '" onclick="window.openLightbox(\'' + savedItem.photoBase64 + '\')" class="h-32 object-contain rounded-xl shadow-sm border border-emerald-200 bg-white p-1 cursor-pointer hover:scale-105 transition"></div>' : '';

                        var recDVj = isSaved ? (savedItem.actDVj || 0) : d.actDVj;
                        var recDNvj = isSaved ? (savedItem.actDNvj || 0) : d.actDNvj;
                        var recEVj = isSaved ? (savedItem.actEVj || 0) : d.actEVj;
                        var recENvj = isSaved ? (savedItem.actENvj || 0) : d.actENvj;
                        var recCmt = isSaved ? (savedItem.comment || '') : (d.delComment || '');

                        html += '<div class="bg-emerald-50 text-emerald-900 p-3 rounded-xl text-xs font-bold border border-emerald-100 shadow-inner mb-3 space-y-1">' +
                            '<div class="flex justify-between"><span>Delivered Fulls:</span><span class="font-black">' + recDVj + ' VJ | ' + recDNvj + ' NVJ</span></div>' +
                            '<div class="flex justify-between"><span>Collected Empties:</span><span class="font-black">' + recEVj + ' VJ | ' + recENvj + ' NVJ</span></div>' +
                            (recCmt ? '<div class="text-[10px] text-emerald-700 border-t border-emerald-200/60 pt-1 mt-1">Note: ' + recCmt + '</div>' : '') +
                            '</div>' + photoHtml;
                        if (rQty > 0) {
                            html += '<div class="bg-amber-50 text-amber-900 p-3 rounded-xl text-xs font-bold border border-amber-200 shadow-inner mb-3 space-y-1">' +
                                '<div class="text-amber-800 uppercase mb-1 border-b border-amber-200/60 pb-1">📦 Replacement: ' + rQty + ' requested (' + rReason + ')</div>' +
                                '<div class="flex justify-between"><span>Collected Replacements:</span><span class="font-black">' + recRepVj + ' VJ | ' + recRepNvj + ' NVJ</span></div>' +
                                '</div>';
                        }

                        html += '<button onclick="window.editDoor(\'' + d.uniqueNo + '\')" class="w-full bg-white text-slate-600 font-black p-2.5 rounded-xl text-xs border border-slate-200 hover:bg-slate-50 mt-3">Edit Entry</button>';
                    } else {
                        html += '<div class="bg-blue-50 border border-blue-100 rounded-lg p-2.5 mb-3 shadow-inner"><p class="text-[10px] font-black text-blue-700 uppercase tracking-widest mb-1.5 border-b border-blue-100 pb-1">ORDER</p><div class="flex justify-between items-center"><div class="text-[11px] font-black text-blue-900 pr-2 border-r border-blue-200">ORD FULL: ' + expVj + ' VJ | ' + expNvj + ' NVJ</div><div class="text-[11px] font-black text-blue-900 pl-2">ORD EMPTY: ' + d.ordE + ' Total</div></div></div>';

                        html += '<div class="grid grid-cols-2 gap-2 mb-2"><div class="bg-slate-50 p-1.5 rounded-xl border border-slate-200"><label class="text-[9px] font-black text-slate-500 block mb-1 text-center">ACT D - VJ</label><div class="flex items-center"><button onclick="window.adjustQty(\'actDVj-' + d.uniqueNo + '\', -1)" class="px-3 font-black text-lg">-</button><input type="number" id="actDVj-' + d.uniqueNo + '" value="' + expVj + '" class="w-full text-center font-black text-lg outline-none bg-transparent"><button onclick="window.adjustQty(\'actDVj-' + d.uniqueNo + '\', 1)" class="px-3 font-black text-lg">+</button></div></div><div class="bg-slate-50 p-1.5 rounded-xl border border-slate-200"><label class="text-[9px] font-black text-slate-500 block mb-1 text-center">ACT E - VJ</label><div class="flex items-center"><button onclick="window.adjustQty(\'actEVj-' + d.uniqueNo + '\', -1)" class="px-3 font-black text-lg">-</button><input type="number" id="actEVj-' + d.uniqueNo + '" value="0" class="w-full text-center font-black text-lg outline-none bg-transparent"><button onclick="window.adjustQty(\'actEVj-' + d.uniqueNo + '\', 1)" class="px-3 font-black text-lg">+</button></div></div></div>';

                        html += '<div class="grid grid-cols-2 gap-2 mb-3"><div class="bg-slate-50 p-1.5 rounded-xl border border-slate-200"><label class="text-[9px] font-black text-slate-500 block mb-1 text-center">ACT D - NVJ</label><div class="flex items-center"><button onclick="window.adjustQty(\'actDNvj-' + d.uniqueNo + '\', -1)" class="px-3 font-black text-lg">-</button><input type="number" id="actDNvj-' + d.uniqueNo + '" value="' + expNvj + '" class="w-full text-center font-black text-lg outline-none bg-transparent"><button onclick="window.adjustQty(\'actDNvj-' + d.uniqueNo + '\', 1)" class="px-3 font-black text-lg">+</button></div></div><div class="bg-slate-50 p-1.5 rounded-xl border border-slate-200"><label class="text-[9px] font-black text-slate-500 block mb-1 text-center">ACT E - NVJ</label><div class="flex items-center"><button onclick="window.adjustQty(\'actENvj-' + d.uniqueNo + '\', -1)" class="px-3 font-black text-lg">-</button><input type="number" id="actENvj-' + d.uniqueNo + '" value="' + d.ordE + '" class="w-full text-center font-black text-lg outline-none bg-transparent"><button onclick="window.adjustQty(\'actENvj-' + d.uniqueNo + '\', 1)" class="px-3 font-black text-lg">+</button></div></div></div>';

                        if (rQty > 0) {
                            html += '<div class="bg-amber-50 border border-amber-200 rounded-lg p-2.5 mb-3 shadow-inner"><p class="text-[10px] font-black text-amber-800 uppercase tracking-widest mb-1.5 border-b border-amber-200 pb-1">📦 REPLACEMENT REQUESTED: ' + rQty + ' Cans (' + rReason + ')</p>' +
                                '<div class="grid grid-cols-2 gap-2 mt-2"><div class="bg-white p-1.5 rounded-xl border border-slate-200"><label class="text-[9px] font-black text-slate-500 block mb-1 text-center">COLLECT VJ</label><div class="flex items-center"><button onclick="window.adjustQty(\'repActVj-' + d.uniqueNo + '\', -1)" class="px-3 font-black text-lg">-</button><input type="number" id="repActVj-' + d.uniqueNo + '" value="' + recRepVj + '" class="w-full text-center font-black text-lg outline-none bg-transparent" data-max="' + rQty + '"><button onclick="window.adjustQty(\'repActVj-' + d.uniqueNo + '\', 1)" class="px-3 font-black text-lg">+</button></div></div><div class="bg-white p-1.5 rounded-xl border border-slate-200"><label class="text-[9px] font-black text-slate-500 block mb-1 text-center">COLLECT NVJ</label><div class="flex items-center"><button onclick="window.adjustQty(\'repActNvj-' + d.uniqueNo + '\', -1)" class="px-3 font-black text-lg">-</button><input type="number" id="repActNvj-' + d.uniqueNo + '" value="' + recRepNvj + '" class="w-full text-center font-black text-lg outline-none bg-transparent" data-max="' + rQty + '"><button onclick="window.adjustQty(\'repActNvj-' + d.uniqueNo + '\', 1)" class="px-3 font-black text-lg">+</button></div></div></div>' +
                                '<p class="text-[9px] text-amber-700 font-bold mt-1.5 text-center">Do not collect more than ' + rQty + ' cans total.</p></div>';
                        }

                        html += '<input type="file" id="photo-' + d.uniqueNo + '" accept="image/*" capture="environment" class="text-xs block w-full border border-slate-200 p-1.5 rounded-lg bg-slate-50 mb-2">';
                        html += '<input type="text" id="comment-' + d.uniqueNo + '" placeholder="Optional Note..." class="w-full text-xs font-bold p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none mb-3 shadow-inner">';

                        html += '<div class="flex gap-2"><button onclick="window.openExceptionModal(\'' + d.uniqueNo + '\')" class="w-1/3 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl border border-amber-200 text-[10px] font-black uppercase shadow-sm flex items-center justify-center gap-1 p-2 active:scale-95 transition"><span>⚠️</span><span>Exception</span></button><button onclick="window.saveDoor(\'' + d.uniqueNo + '\')" id="btn-save-' + d.uniqueNo + '" class="w-2/3 bg-emerald-600 text-white font-black p-3.5 rounded-xl hover:bg-emerald-700 shadow-lg text-sm uppercase tracking-wide active:scale-95 transition">Save Delivery</button></div>';
                    }
                    card.innerHTML = html; container.appendChild(card);
                }
            });
        };

        window.editDoor = function (uNo) {
            var txn = window.db.transaction("deliveries", "readwrite"); txn.objectStore("deliveries").delete(String(uNo));
            txn.oncomplete = function () {
                window.renderDoors();
                window.updateSyncCount();
                window.calculateDashboardStats();
                window.checkLoadVariance();
            };
        };

        window.saveDoor = function (uNo) {
            var aDVj = parseInt(document.getElementById('actDVj-' + uNo).value) || 0;
            var aDNvj = parseInt(document.getElementById('actDNvj-' + uNo).value) || 0;
            var aEVj = parseInt(document.getElementById('actEVj-' + uNo).value) || 0;
            var aENvj = parseInt(document.getElementById('actENvj-' + uNo).value) || 0;
            var cmt = document.getElementById('comment-' + uNo).value;
            var photo = document.getElementById('photo-' + uNo);

            var elRVj = document.getElementById('repActVj-' + uNo);
            var elRNvj = document.getElementById('repActNvj-' + uNo);
            var rActVj = elRVj ? parseInt(elRVj.value) || 0 : 0;
            var rActNvj = elRNvj ? parseInt(elRNvj.value) || 0 : 0;

            var doorData = window.pendingData[window.selectedApt][window.selectedBlock].find(function (d) { return d.uniqueNo === uNo; });
            if (doorData && doorData.replaceQty > 0) {
                if ((rActVj + rActNvj) > doorData.replaceQty) {
                    window.showToast("Cannot collect more than " + doorData.replaceQty + " replacements.", false);
                    return;
                }
            }

            var isCancelled = cmt.includes("[CANCELLED: BY CUSTOMER]");
            if (!isCancelled && (!photo.files || photo.files.length === 0)) {
                window.showToast("Door Photo is required.", false); return;
            }

            var totD = aDVj + aDNvj;
            var totE = aEVj + aENvj;

            window.showLoader('Saving Door...');

            var proceedSave = function (b64) {
                window.saveToDB("deliveries", {
                    uniqueNo: uNo, apt: window.selectedApt, blk: window.selectedBlock,
                    actD: Number(totD) || 0, actE: Number(totE) || 0,
                    actDVj: Number(aDVj) || 0, actDNvj: Number(aDNvj) || 0,
                    actEVj: Number(aEVj) || 0, actENvj: Number(aENvj) || 0,
                    repActVj: Number(rActVj) || 0, repActNvj: Number(rActNvj) || 0,
                    comment: cmt, photoBase64: b64, timestamp: new Date().getTime()
                }).then(function () {
                    window.hideLoader();
                    window.showToast("Door saved.", true);
                    window.renderDoors();
                    window.renderLoadState();
                });
            };

            if (photo.files && photo.files.length > 0) {
                window.compressImage(photo.files[0]).then(proceedSave);
            } else {
                proceedSave("");
            }
        };

        window.updateSyncCount = function () {
            if (!window.db) return;
            window.getFromDB('deliveries').then(function (d) {
                window.getFromDB('unloads').then(function (u) {
                    window.getFromDB('loads').then(function (l) {
                        var total = d.length + u.length + l.length;
                        var syncLabel = document.getElementById('sync-count'); if (syncLabel) syncLabel.innerText = total + ' items';
                        var btn = document.getElementById('btn-sync'); var banner = document.getElementById('sync-reminder-banner');
                        if (btn && banner) {
                            if (total > 0) {
                                btn.classList.add('bg-emerald-600', 'text-white'); btn.classList.remove('bg-slate-100', 'text-slate-500');
                                if (navigator.onLine) banner.classList.remove('hidden'); else banner.classList.add('hidden');
                            } else {
                                btn.classList.remove('bg-emerald-600', 'text-white'); btn.classList.add('bg-slate-100', 'text-slate-500');
                                banner.classList.add('hidden');
                            }
                        }
                    });
                });
            });
        };

        window.openLiveRouteMasterReport = function () {
            window.switchView('view-report-master');
            var container = document.getElementById('report-master-list');
            container.innerHTML = '<p class="text-center text-sm font-bold text-slate-500 py-10 animate-pulse">Building master route view...</p>';

            Promise.all([window.getFromDB('deliveries'), window.getFromDB('unloads'), window.getFromDB('loads')]).then(function (results) {
                var savedDels = results[0]; var savedUnloads = results[1]; var savedLoads = results[2];
                var html = '';
                var sortedApts = Object.keys(window.allData).sort(function (a, b) { return a.localeCompare(b, undefined, { numeric: true }); });

                for (var a = 0; a < sortedApts.length; a++) {
                    var apt = sortedApts[a];
                    var sortedBlocks = Object.keys(window.allData[apt]).sort(function (a, b) { return a.localeCompare(b, undefined, { numeric: true }); });

                    for (var b = 0; b < sortedBlocks.length; b++) {
                        var blk = sortedBlocks[b];
                        var doors = window.allData[apt][blk];
                        var sortedDoors = doors.slice().sort(function (x, y) { return String(x.door).localeCompare(String(y.door), undefined, { numeric: true }); });
                        var bId = apt + '_' + blk;

                        var uMatch = null; for (var u = 0; u < savedUnloads.length; u++) { if (savedUnloads[u].blockId === bId) uMatch = savedUnloads[u]; }
                        var lMatch = null; for (var l = 0; l < savedLoads.length; l++) { if (savedLoads[l].blockId === bId) lMatch = savedLoads[l]; }

                        var bActVj = 0, bActNvj = 0, bPendVj = 0, bPendNvj = 0;
                        for (var k = 0; k < doors.length; k++) {
                            var dd = doors[k]; var dMat = null;
                            for (var m = 0; m < savedDels.length; m++) { if (savedDels[m].uniqueNo === dd.uniqueNo) dMat = savedDels[m]; }
                            if (dMat) { bActVj += (dMat.actDVj || 0); bActNvj += (dMat.actDNvj || 0); }
                            else if (dd.doorDone) { bActVj += dd.actDVj; bActNvj += dd.actDNvj; }
                            else { bPendVj += dd.expVj; bPendNvj += dd.expNvj; }
                        }

                        html += '<div class="bg-white p-5 rounded-[2rem] mb-5 shadow-sm border border-slate-200">';

                        html += '<h3 class="font-black text-xl text-slate-800 mb-4 uppercase text-center tracking-widest">' + apt + ' - ' + blk + '</h3>';
                        html += '<div class="flex justify-between items-center border border-slate-200 rounded-xl mb-6 divide-x divide-slate-200"><div class="flex-1 p-2 text-center"><p class="text-[9px] font-black text-slate-500 uppercase mb-0.5">Delivered</p><p class="text-xs font-black text-emerald-700">' + bActVj + ' VJ | ' + bActNvj + ' NVJ</p></div><div class="flex-1 p-2 text-center"><p class="text-[9px] font-black text-slate-500 uppercase mb-0.5">Pending</p><p class="text-xs font-black text-rose-600">' + bPendVj + ' VJ | ' + bPendNvj + ' NVJ</p></div></div>';

                        var unlStamp = doors[0].unloadOn ? '<div class="border border-slate-200 text-slate-400 text-[10px] font-bold px-2 py-0.5 rounded-lg uppercase bg-white">TS: ' + doors[0].unloadOn + ' (' + doors[0].unloadBy + ')</div>' : '';
                        var unlStatus = uMatch ? 'SAVED LOCAL' : (doors[0].v2bDone ? 'SYNCED' : 'PENDING');
                        var unlColor = uMatch ? 'text-amber-600 bg-amber-50 px-1.5 rounded' : (doors[0].v2bDone ? 'text-emerald-600 bg-emerald-50 px-1.5 rounded' : 'text-rose-500 bg-rose-50 px-1.5 rounded');

                        html += '<div class="mb-5"><div class="flex justify-between items-center mb-3"><div class="flex items-center gap-2"><h4 class="text-[10px] font-black uppercase tracking-widest text-slate-500">1. Unload</h4><span class="text-[9px] font-black ' + unlColor + '">' + unlStatus + '</span></div>' + unlStamp + '</div>';

                        html += '<div class="flex gap-4 items-center">';
                        if (uMatch && uMatch.photoBase64) html += '<img src="' + uMatch.photoBase64 + '" onclick="window.openLightbox(\'' + uMatch.photoBase64 + '\')" class="w-16 h-16 object-cover rounded-xl shadow-sm border border-slate-200 cursor-pointer hover:scale-105 transition">';
                        else if (doors[0].v2bDone && doors[0].v2bLink) html += '<img src="' + window.parseImgUrl(doors[0].v2bLink) + '" onclick="window.openLightbox(\'' + doors[0].v2bLink + '\')" class="w-16 h-16 object-cover rounded-xl shadow-sm border border-slate-200 cursor-pointer hover:scale-105 transition">';
                        else html += '<div class="w-16 h-16 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center text-2xl opacity-20">🖼️</div>';

                        var uClaim = uMatch ? uMatch.fullCount : (doors[0].v2bDone ? (doors[0].v2bFulls !== undefined ? doors[0].v2bFulls : 0) : '-');
                        if (uClaim !== '-') html += '<div class="bg-slate-50 px-3 py-2 rounded-lg border border-slate-200"><p class="text-[9px] font-black text-slate-500 uppercase mb-0.5">Driver Claim</p><p class="text-sm font-black text-slate-800">' + uClaim + ' Fulls</p></div>';
                        html += '</div></div>';

                        html += '<div class="mb-5"><h4 class="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">2. Door Deliveries</h4><div class="space-y-2">';
                        for (var i = 0; i < sortedDoors.length; i++) {
                            var d = sortedDoors[i];
                            var dMatch = null; for (var m = 0; m < savedDels.length; m++) { if (String(savedDels[m].uniqueNo) === String(d.uniqueNo)) dMatch = savedDels[m]; }
                            var dStatus = dMatch ? 'SAVED LOCAL' : (d.doorDone ? 'SYNCED' : 'PENDING');
                            var dBadge = dMatch ? 'bg-amber-50 text-amber-800' : (d.doorDone ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800');
                            var dStamp = d.delOn ? '<p class="text-[8px] text-slate-400 font-bold uppercase mt-1">' + d.delOn + ' (' + d.delBy + ')</p>' : '';

                            var txtOrdF = d.expVj + ' VJ | ' + d.expNvj + ' NVJ';
                            var txtOrdE = d.ordE + ' Total';

                            var txtActF = dMatch ? ((dMatch.actDVj || 0) + ' VJ | ' + (dMatch.actDNvj || 0) + ' NVJ') : (d.doorDone ? (d.actDVj + ' VJ | ' + d.actDNvj + ' NVJ') : '---');
                            var txtActE = dMatch ? ((dMatch.actEVj || 0) + ' VJ | ' + (dMatch.actENvj || 0) + ' NVJ') : (d.doorDone ? (d.actEVj + ' VJ | ' + d.actENvj + ' NVJ') : '---');

                            html += '<div class="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between">';
                            html += '<div><p class="font-black text-sm text-slate-800">Door ' + d.door + ' <span class="text-[10px] text-slate-400 font-bold bg-white px-1.5 py-0.5 border rounded ml-1">' + d.cpnno + '</span></p><p class="text-[9px] font-black mt-1"><span class="px-1.5 py-0.5 rounded shadow-sm border border-slate-200 ' + dBadge + '">' + dStatus + '</span></p>' + dStamp + '</div>';

                            html += '<div class="text-right px-2 space-y-0.5">' +
                                '<p class="text-[9px] font-black text-slate-500 uppercase">FULLS &bull; Ord: <span class="text-slate-700">' + txtOrdF + '</span> | Act: <span class="text-emerald-700">' + txtActF + '</span></p>' +
                                '<p class="text-[9px] font-black text-slate-500 uppercase">EMPTIES &bull; Ord: <span class="text-slate-700">' + txtOrdE + '</span> | Act: <span class="text-emerald-700">' + txtActE + '</span></p>' +
                                '</div>';

                            if (dMatch && dMatch.photoBase64) html += '<img src="' + dMatch.photoBase64 + '" onclick="window.openLightbox(\'' + dMatch.photoBase64 + '\')" class="w-12 h-12 object-cover rounded-lg shadow-sm border border-slate-200 cursor-pointer hover:scale-110 transition">';
                            else if (d.doorDone && d.doorLink) html += '<img src="' + window.parseImgUrl(d.doorLink) + '" onclick="window.openLightbox(\'' + d.doorLink + '\')" class="w-12 h-12 object-cover rounded-lg shadow-sm border border-slate-200 cursor-pointer hover:scale-110 transition">';
                            else html += '<div class="w-12 h-12 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-xl opacity-20">🖼️</div>';
                            html += '</div>';
                        }
                        html += '</div></div>';

                        var ldStamp = doors[0].loadOn ? '<div class="border border-slate-200 text-slate-400 text-[10px] font-bold px-2 py-0.5 rounded-lg uppercase bg-white">TS: ' + doors[0].loadOn + ' (' + doors[0].loadBy + ')</div>' : '';
                        var ldStatus = lMatch ? 'SAVED LOCAL' : (doors[0].b2vDone ? 'SYNCED' : 'PENDING');
                        var ldColor = lMatch ? 'text-amber-600 bg-amber-50 px-1.5 rounded' : (doors[0].b2vDone ? 'text-emerald-600 bg-emerald-50 px-1.5 rounded' : 'text-rose-500 bg-rose-50 px-1.5 rounded');

                        html += '<div><div class="flex justify-between items-center mb-3"><div class="flex items-center gap-2"><h4 class="text-[10px] font-black uppercase tracking-widest text-slate-500">3. Load</h4><span class="text-[9px] font-black ' + ldColor + '">' + ldStatus + '</span></div>' + ldStamp + '</div>';

                        html += '<div class="flex gap-4 items-center">';
                        if (lMatch && lMatch.photoBase64) html += '<img src="' + lMatch.photoBase64 + '" onclick="window.openLightbox(\'' + lMatch.photoBase64 + '\')" class="w-16 h-16 object-cover rounded-xl shadow-sm border border-slate-200 cursor-pointer hover:scale-105 transition">';
                        else if (doors[0].b2vDone && doors[0].b2vLink) html += '<img src="' + window.parseImgUrl(doors[0].b2vLink) + '" onclick="window.openLightbox(\'' + doors[0].b2vLink + '\')" class="w-16 h-16 object-cover rounded-xl shadow-sm border border-slate-200 cursor-pointer hover:scale-105 transition">';
                        else html += '<div class="w-16 h-16 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center text-2xl opacity-20">🖼️</div>';

                        var ldF = lMatch ? lMatch.fullCount : (doors[0].b2vDone ? (doors[0].b2vFulls !== undefined ? doors[0].b2vFulls : 0) : '-');
                        var ldE = lMatch ? lMatch.emptyCount : (doors[0].b2vDone ? (doors[0].b2vEmpties !== undefined ? doors[0].b2vEmpties : 0) : '-');
                        if (ldF !== '-' && ldE !== '-') html += '<div class="bg-slate-50 px-3 py-2 rounded-lg border border-slate-200"><p class="text-[9px] font-black text-slate-500 uppercase mb-0.5">Driver Claim</p><p class="text-sm font-black text-slate-800">' + ldF + ' Fulls | ' + ldE + ' Empties</p></div>';
                        html += '</div></div>';

                        html += '</div>';
                    }
                }
                if (html === '') html = '<div class="text-center py-10"><span class="text-4xl">📭</span><p class="text-sm font-bold text-slate-500 mt-3">No route data loaded.</p></div>';
                container.innerHTML = html;
            });
        };

        window.openDoorVarianceReport = function () {
            window.switchView('view-report-door-variance');
            var container = document.getElementById('report-door-variance-list');
            container.innerHTML = '<p class="text-center text-sm font-bold text-slate-500 py-10 animate-pulse">Scanning deliveries...</p>';

            window.getFromDB('deliveries').then(function (savedDels) {
                var html = '';
                for (var apt in window.allData) {
                    for (var blk in window.allData[apt]) {
                        var doors = window.allData[apt][blk];
                        for (var k = 0; k < doors.length; k++) {
                            var d = doors[k]; var lMatch = null;
                            for (var m = 0; m < savedDels.length; m++) { if (String(savedDels[m].uniqueNo) === String(d.uniqueNo)) lMatch = savedDels[m]; }

                            var actDVj = lMatch ? (lMatch.actDVj || 0) : (d.doorDone ? (d.actDVj || 0) : null);
                            var actDNvj = lMatch ? (lMatch.actDNvj || 0) : (d.doorDone ? (d.actDNvj || 0) : null);
                            var actE = lMatch ? lMatch.actE : (d.doorDone ? d.actE : null);

                            if (actDVj !== null && (actDVj !== d.expVj || actDNvj !== d.expNvj || actE !== d.ordE)) {
                                html += '<div class="bg-white p-4 rounded-2xl mb-4 shadow-sm border border-rose-200 border-l-4 border-l-rose-500">' +
                                    '<h4 class="font-black text-slate-800 text-sm mb-2">' + apt + ' - ' + blk + ' <span class="text-rose-600 ml-2">Door ' + d.door + '</span></h4>' +
                                    '<div class="grid grid-cols-2 gap-2 text-[10px] font-bold bg-slate-50 p-2 rounded-xl">' +
                                    '<div>Fulls: Ord (' + d.expVj + ' VJ | ' + d.expNvj + ' NVJ) &rarr; <span class="text-rose-600 font-black">' + actDVj + ' VJ | ' + actDNvj + ' NVJ</span></div>' +
                                    '<div>Empties: Ord ' + d.ordE + ' &rarr; <span class="text-rose-600 font-black">' + actE + ' Total</span></div>' +
                                    '</div></div>';
                            }
                        }
                    }
                }
                if (html === '') html = '<div class="text-center py-10"><span class="text-4xl">🎉</span><p class="text-sm font-bold text-emerald-600 mt-2">Perfect match! No door variances found.</p></div>';
                container.innerHTML = html;
            });
        };

        window.openDriverReport = function () {
            window.switchView('view-report-driver');
            var container = document.getElementById('report-driver-list'); container.innerHTML = '<p class="text-center text-sm font-bold text-slate-500 py-10 animate-pulse">Loading live data...</p>';

            window.getFromDB('unloads').then(function (savedUnloads) {
                window.getFromDB('loads').then(function (savedLoads) {
                    var html = ''; 
                    for (var apt in window.allData) {
                        for (var blk in window.allData[apt]) {
                            var doors = window.allData[apt][blk]; var bId = apt + '_' + blk;
                            var tVj = 0, tNvj = 0, tEmpty = 0, tRep = 0;
                            for (var k = 0; k < doors.length; k++) {
                                tVj += doors[k].expVj; tNvj += doors[k].expNvj; tEmpty += doors[k].ordE;
                                tRep += (doors[k].replaceQty || 0);
                            }

                            var unlMatch = false; for (var u = 0; u < savedUnloads.length; u++) { if (savedUnloads[u].blockId === bId) unlMatch = true; }
                            var ldMatch = false; for (var l = 0; l < savedLoads.length; l++) { if (savedLoads[l].blockId === bId) ldMatch = true; }

                            var unlDB = doors[0].v2bDone; var ldDB = doors[0].b2vDone;

                            var unlStr = unlMatch ? 'Pending Sync' : (unlDB ? 'Completed' : 'Pending');
                            var unlClass = unlMatch ? 'bg-amber-100 text-amber-800' : (unlDB ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800');
                            var ldStr = ldMatch ? 'Pending Sync' : (ldDB ? 'Completed' : 'Pending');
                            var ldClass = ldMatch ? 'bg-amber-100 text-amber-800' : (ldDB ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800');

                            var unlStamp = doors[0].unloadOn ? '<p class="text-[9px] text-slate-400 mt-1 uppercase">' + doors[0].unloadOn + ' (' + doors[0].unloadBy + ')</p>' : '';
                            var ldStamp = doors[0].loadOn ? '<p class="text-[9px] text-slate-400 mt-1 uppercase">' + doors[0].loadOn + ' (' + doors[0].loadBy + ')</p>' : '';

                            html += '<div class="driver-report-card bg-white p-4 rounded-2xl mb-4 shadow-sm border border-slate-200">' +
                                '<h4 class="font-black text-lg text-slate-800 mb-3">' + apt + ' - ' + blk + '</h4>' +
                                '<div class="space-y-2">' +
                                '<div class="flex justify-between items-center bg-slate-50 p-2 rounded-xl border border-slate-100"><div class="text-xs font-bold text-slate-600">Unload Target: <span class="text-slate-800 font-black">' + tVj + ' VJ | ' + tNvj + ' NVJ</span><span class="text-[9px] text-amber-600 font-black ml-1">+' + tRep + ' Reps</span>' + unlStamp + '</div><span class="text-[9px] px-2 py-1 rounded font-bold ' + unlClass + '">' + unlStr + '</span></div>' +
                                '<div class="flex justify-between items-center bg-slate-50 p-2 rounded-xl border border-slate-100"><div class="text-xs font-bold text-slate-600">Load Target: <span class="text-slate-800 font-black">' + tEmpty + ' Emp | ' + tRep + ' Reps</span>' + ldStamp + '</div><span class="text-[9px] px-2 py-1 rounded font-bold ' + ldClass + '">' + ldStr + '</span></div>' +
                                '</div></div>';
                        }
                    }
                    if (html === '') html = '<p class="text-center text-sm font-bold text-slate-500 py-10">No active blocks in route.</p>';
                    container.innerHTML = html;
                });
            });
        };

        window.exportDriverReportPDF = function () {
            const container = document.getElementById('report-driver-list');
            if (!container || container.innerHTML.includes('No active blocks')) return alert("No data to export.");

            const dateHeader = document.createElement('div');
            dateHeader.className = 'text-center mb-6'; 
            const dateString = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });
            dateHeader.innerHTML = `<h3 class="text-2xl font-black text-slate-800">WOW DROPS</h3><h2 class="text-2xl font-black text-slate-800">Driver Load/Unload Report</h2><p class="text-sm font-bold text-slate-500 uppercase tracking-wider">${dateString}</p>`;
            container.prepend(dateHeader);

            const originalMaxHeight = container.style.maxHeight;
            const originalOverflowY = container.style.overflowY;
            container.style.maxHeight = 'none';
            container.style.overflowY = 'visible';

            const opt = {
                margin: 0.5,
                filename: 'Driver_Load_Unload_Report_' + new Date().toISOString().split('T')[0] + '.pdf',
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
                pagebreak: { avoid: '.driver-report-card' }
            };

            html2pdf().set(opt).from(container).save().then(() => {
                container.style.maxHeight = originalMaxHeight;
                container.style.overflowY = originalOverflowY;
            });
        };

        window.openDeliveryReport = function () {
            window.switchView('view-report-delivery');
            var container = document.getElementById('report-delivery-list'); container.innerHTML = '<p class="text-center text-sm font-bold text-slate-500 py-10 animate-pulse">Loading live data...</p>';

            window.getFromDB('deliveries').then(function (savedDels) {
                var html = '';
                for (var apt in window.allData) {
                    for (var blk in window.allData[apt]) {
                        var doors = window.allData[apt][blk];
                        for (var i = 0; i < doors.length; i++) {
                            var d = doors[i]; var localMatch = null;
                            for (var j = 0; j < savedDels.length; j++) { if (String(savedDels[j].uniqueNo) === String(d.uniqueNo)) localMatch = savedDels[j]; }

                            var statusStr = ''; var statusClass = '';
                            if (localMatch) { statusStr = 'Pending Sync'; statusClass = 'bg-amber-100 text-amber-800 border border-amber-200'; }
                            else if (d.doorDone) { statusStr = 'Completed'; statusClass = 'bg-emerald-100 text-emerald-800 border border-emerald-200'; }
                            else { statusStr = 'Pending'; statusClass = 'bg-rose-100 text-rose-800 border border-rose-200'; }

                            var actDVj = localMatch ? (localMatch.actDVj || 0) : (d.doorDone ? (d.actDVj || 0) : '-');
                            var actDNvj = localMatch ? (localMatch.actDNvj || 0) : (d.doorDone ? (d.actDNvj || 0) : '-');
                            var actEVj = localMatch ? (localMatch.actEVj || 0) : (d.doorDone ? (d.actEVj || 0) : '-');
                            var actENvj = localMatch ? (localMatch.actENvj || 0) : (d.doorDone ? (d.actENvj || 0) : '-');

                            var imgHtml = localMatch && localMatch.photoBase64 ? '<div class="mt-3 border-t border-slate-100 pt-3"><img src="' + localMatch.photoBase64 + '" onclick="window.openLightbox(\'' + localMatch.photoBase64 + '\')" class="w-16 h-16 object-cover rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:scale-105 transition"></div>' : '';

                            html += '<div class="bg-white p-4 rounded-2xl mb-4 shadow-sm border border-slate-200">' +
                                '<div class="flex justify-between items-start mb-3">' +
                                '<div><span class="font-black text-lg text-slate-800 block leading-tight">' + apt + ' - ' + blk + '</span> <span class="text-xs font-bold text-emerald-700">Door ' + d.door + '</span></div>' +
                                '<span class="text-[9px] px-2 py-1 rounded font-black shadow-sm ' + statusClass + '">' + statusStr + '</span>' +
                                '</div>' +
                                '<div class="grid grid-cols-2 gap-2 text-[10px] bg-slate-50 p-2.5 rounded-xl font-bold border border-slate-100 shadow-inner">' +
                                '<div>Act Fulls: <span class="font-black text-emerald-800">' + actDVj + ' VJ | ' + actDNvj + ' NVJ</span></div>' +
                                '<div>Act Empties: <span class="font-black text-emerald-800">' + actEVj + ' VJ | ' + actENvj + ' NVJ</span></div>' +
                                '</div>' + imgHtml + '</div>';
                        }
                    }
                }
                if (html === '') html = '<p class="text-center text-sm font-bold text-slate-500 py-10">No deliveries in route.</p>';
                container.innerHTML = html;
            });
        };

        window.openBlockVarianceReport = function () {
            window.switchView('view-report-block-variance');
            var container = document.getElementById('report-block-variance-list');
            container.innerHTML = '<p class="text-center text-sm font-bold text-slate-500 py-10 animate-pulse">Calculating variances...</p>';

            window.getFromDB('deliveries').then(function (savedDels) {
                window.getFromDB('unloads').then(function (savedUnloads) {
                    window.getFromDB('loads').then(function (savedLoads) {
                        var html = '';
                        for (var apt in window.allData) {
                            for (var blk in window.allData[apt]) {
                                var doors = window.allData[apt][blk]; var bId = apt + '_' + blk;
                                var ordDSum = 0; var effDelD = 0; var effDelE = 0; var effRepCol = 0;

                                for (var k = 0; k < doors.length; k++) {
                                    var d = doors[k]; ordDSum += d.ordD;
                                    var lMatch = null; for (var m = 0; m < savedDels.length; m++) { if (String(savedDels[m].uniqueNo) === String(d.uniqueNo)) lMatch = savedDels[m]; }
                                    
                                    if (lMatch) {
                                        effDelD += (lMatch.actDVj || 0) + (lMatch.actDNvj || 0);
                                        effDelE += (lMatch.actEVj || 0) + (lMatch.actENvj || 0);
                                        effRepCol += (lMatch.repActVj || 0) + (lMatch.repActNvj || 0);
                                    }
                                    else if (d.doorDone) {
                                        effDelD += (d.actDVj || 0) + (d.actDNvj || 0);
                                        effDelE += (d.actEVj || 0) + (d.actENvj || 0);
                                        effRepCol += (d.replaceActVj || 0) + (d.replaceActNvj || 0);
                                    }
                                    else {
                                        effDelD += d.ordD; effDelE += d.ordE;
                                    }
                                }

                                var uMatch = null; for (var u = 0; u < savedUnloads.length; u++) { if (savedUnloads[u].blockId === bId) uMatch = savedUnloads[u]; }
                                var actUnload = uMatch ? uMatch.fullCount : (doors[0].v2bDone ? ordDSum : ordDSum);

                                var lMatch2 = null; for (var l = 0; l < savedLoads.length; l++) { if (savedLoads[l].blockId === bId) lMatch2 = savedLoads[l]; }

                                var expFulls = Math.max(0, actUnload - effDelD - effRepCol);
                                var expEmpties = effDelE + effRepCol;

                                var actLoadF = lMatch2 ? lMatch2.fullCount : (doors[0].b2vDone ? expFulls : null);
                                var actLoadE = lMatch2 ? lMatch2.emptyCount : (doors[0].b2vDone ? expEmpties : null);

                                if (actLoadF !== null && actLoadE !== null) {
                                    var diffF = actLoadF - expFulls; var diffE = actLoadE - expEmpties;
                                    var statStr = (diffF === 0 && diffE === 0) ? '<span class="text-[9px] px-2 py-1 rounded font-black bg-emerald-100 text-emerald-800">BALANCED</span>' : '<span class="text-[9px] px-2 py-1 rounded font-black bg-rose-100 text-rose-800 border border-rose-200">VARIANCE</span>';

                                    html += '<div class="bg-white p-4 rounded-2xl mb-4 shadow-sm border border-slate-200">' +
                                        '<div class="flex justify-between items-center border-b border-slate-100 pb-2 mb-3"><h4 class="font-black text-slate-800 text-sm">' + apt + ' - ' + blk + '</h4>' + statStr + '</div>' +
                                        '<div class="text-[11px] space-y-2 font-bold">' +
                                        '<div class="flex justify-between bg-slate-50 p-2 rounded-lg border border-slate-100"><span class="text-slate-500">Exp Fulls: ' + expFulls + '</span><span class="text-slate-800">Actual: <span class="text-sm font-black text-emerald-700">' + actLoadF + '</span> ' + (diffF !== 0 ? '<span class="text-rose-600">(' + (diffF > 0 ? '+' + diffF : diffF) + ')</span>' : '') + '</span></div>' +
                                        '<div class="flex justify-between bg-slate-50 p-2 rounded-lg border border-slate-100"><span class="text-slate-500">Exp Empties: ' + expEmpties + '</span><span class="text-slate-800">Actual: <span class="text-sm font-black text-emerald-700">' + actLoadE + '</span> ' + (diffE !== 0 ? '<span class="text-rose-600">(' + (diffE > 0 ? '+' + diffE : diffE) + ')</span>' : '') + '</span></div>' +
                                        '</div></div>';
                                } else {
                                    html += '<div class="bg-slate-50 p-4 rounded-2xl mb-4 border border-slate-200 text-slate-400 text-xs text-center font-bold">' + apt + ' - ' + blk + '<br>Block Loading Not Completed Yet</div>';
                                }
                            }
                        }
                        if (html === '') html = '<p class="text-center text-sm font-bold text-slate-500 py-10">No block data available.</p>';
                        container.innerHTML = html;
                    });
                });
            });
        };

        window.openPendingAudit = function () {
            window.switchView('view-report-pending-audit');
            var container = document.getElementById('report-pending-audit-list');
            container.innerHTML = '<p class="text-center text-sm font-bold text-slate-500 py-10 animate-pulse">Auditing tasks...</p>';

            window.getFromDB('deliveries').then(function (savedDels) {
                window.getFromDB('unloads').then(function (savedUnloads) {
                    window.getFromDB('loads').then(function (savedLoads) {
                        var html = '';
                        for (var apt in window.allData) {
                            for (var blk in window.allData[apt]) {
                                var doors = window.allData[apt][blk]; var bId = apt + '_' + blk;
                                var issues = [];

                                var uMatch = false; for (var u = 0; u < savedUnloads.length; u++) { if (savedUnloads[u].blockId === bId) uMatch = true; }
                                if (!uMatch && !doors[0].v2bDone) issues.push('Missing ' + window.APP_CONFIG.LBL_VAN_TO_BLOCK);

                                var lMatch = false; for (var l = 0; l < savedLoads.length; l++) { if (savedLoads[l].blockId === bId) lMatch = true; }
                                if (!lMatch && !doors[0].b2vDone) issues.push('Missing ' + window.APP_CONFIG.LBL_BLOCK_TO_VAN);

                                var pendingDoors = [];
                                for (var k = 0; k < doors.length; k++) {
                                    var d = doors[k]; var dMatch = false;
                                    for (var m = 0; m < savedDels.length; m++) { if (String(savedDels[m].uniqueNo) === String(d.uniqueNo)) dMatch = true; }
                                    if (!dMatch && !d.doorDone) pendingDoors.push(d.door);
                                }
                                if (pendingDoors.length > 0) issues.push('Pending Doors: ' + pendingDoors.join(', '));

                                if (issues.length > 0) {
                                    var liStr = ''; for (var x = 0; x < issues.length; x++) liStr += '<li class="bg-amber-50 p-2 rounded-lg border border-amber-100">• ' + issues[x] + '</li>';
                                    html += '<div class="bg-white p-4 rounded-2xl mb-4 shadow-sm border border-amber-200 border-l-4 border-l-amber-500">' +
                                        '<h4 class="font-black text-amber-900 text-sm mb-2">' + apt + ' - ' + blk + '</h4>' +
                                        '<ul class="text-xs font-bold text-amber-800 space-y-1.5">' + liStr + '</ul></div>';
                                }
                            }
                        }
                        if (html === '') html = '<div class="text-center py-10"><span class="text-4xl">🌟</span><p class="text-sm font-bold text-emerald-600 mt-2">All tasks complete! Clear to close.</p></div>';
                        container.innerHTML = html;
                    });
                });
            });
        };

        window.openExceptionsReport = function () {
            window.switchView('view-report-exceptions');
            var container = document.getElementById('report-exceptions-list');
            container.innerHTML = '<p class="text-center text-sm font-bold text-slate-500 py-10 animate-pulse">Scanning exceptions...</p>';

            window.getFromDB('deliveries').then(function (savedDels) {
                var html = '';
                var count = 0;
                for (var apt in window.allData) {
                    for (var blk in window.allData[apt]) {
                        var doors = window.allData[apt][blk];
                        for (var k = 0; k < doors.length; k++) {
                            var d = doors[k];
                            var lMatch = null;
                            for (var m = 0; m < savedDels.length; m++) { if (String(savedDels[m].uniqueNo) === String(d.uniqueNo)) lMatch = savedDels[m]; }

                            var cmt = lMatch ? (lMatch.comment || "") : (d.delComment || "");
                            
                            var actD = d.ordD;
                            if (lMatch) {
                                actD = (lMatch.actDVj || 0) + (lMatch.actDNvj || 0);
                            } else if (d.doorDone) {
                                actD = (d.actDVj || 0) + (d.actDNvj || 0);
                            }

                            if (cmt.includes("[DEFERRED") || cmt.includes("[CANCELLED") || (d.doorDone && actD < d.ordD) || (lMatch && actD < d.ordD)) {
                                count++;
                                var shortF = Math.max(0, d.ordD - actD);
                                var badgeColor = cmt.includes("CANCELLED") ? "rose" : "amber";
                                var cleanCmt = cmt.replace(/\[.*?\]/g, "").trim() || cmt;

                                html += '<div class="bg-white p-4 rounded-2xl mb-4 shadow-sm border border-' + badgeColor + '-200 border-l-4 border-l-' + badgeColor + '-500">' +
                                    '<div class="flex justify-between items-start mb-2">' +
                                    '<div><h4 class="font-black text-slate-800 text-sm">' + apt + ' - ' + blk + '</h4><p class="text-xs font-bold text-slate-500">Door ' + d.door + '</p></div>' +
                                    '<span class="text-[10px] bg-' + badgeColor + '-50 text-' + badgeColor + '-700 px-2 py-1 rounded font-black uppercase shadow-sm border border-' + badgeColor + '-100">Cans Kept: ' + shortF + '</span>' +
                                    '</div>' +
                                    '<p class="text-[11px] font-bold text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 mt-2">Reason: ' + (cleanCmt || "Short Delivery / Rollover") + '</p>' +
                                    '</div>';
                            }
                        }
                    }
                }
                if (count === 0) html = '<div class="text-center py-10"><span class="text-4xl">🌟</span><p class="text-sm font-bold text-emerald-600 mt-3">No exceptions today.<br>All expected cans were delivered!</p></div>';
                container.innerHTML = html;
            });
        };

        window.openEodReport = function () {
            window.switchView('view-report-eod');
            var container = document.getElementById('report-eod-content');
            container.innerHTML = '<p class="text-center text-sm font-bold text-slate-500 py-10 animate-pulse">Tallying truck inventory...</p>';

            window.getFromDB('deliveries').then(function (savedDels) {
                window.getFromDB('loads').then(function (savedLoads) {
                    window.getFromDB('unloads').then(function (savedUnloads) {
                        var eodF = 0; var eodE = 0;
                        for (var apt in window.allData) {
                            for (var blk in window.allData[apt]) {
                                var doors = window.allData[apt][blk]; var bId = apt + '_' + blk;

                                var lMatch = null; for (var l = 0; l < savedLoads.length; l++) { if (savedLoads[l].blockId === bId) lMatch = savedLoads[l]; }
                                if (lMatch) {
                                    eodF += lMatch.fullCount; eodE += lMatch.emptyCount;
                                } else if (doors[0].b2vDone) {
                                    var b2vF = (doors[0].b2vFulls !== undefined) ? doors[0].b2vFulls : 0;
                                    var b2vE = (doors[0].b2vEmpties !== undefined) ? doors[0].b2vEmpties : 0;
                                    eodF += b2vF; eodE += b2vE;
                                } else {
                                    var effDelD = 0; var effDelE = 0; var effRepCol = 0; var ordDSum = 0;
                                    for (var k = 0; k < doors.length; k++) {
                                        var d = doors[k]; ordDSum += d.ordD;
                                        var dMatch = null;
                                        for (var m = 0; m < savedDels.length; m++) { if (String(savedDels[m].uniqueNo) === String(d.uniqueNo)) dMatch = savedDels[m]; }
                                        
                                        if (dMatch) {
                                            effDelD += (dMatch.actDVj || 0) + (dMatch.actDNvj || 0);
                                            effDelE += (dMatch.actEVj || 0) + (dMatch.actENvj || 0);
                                            effRepCol += (dMatch.repActVj || 0) + (dMatch.repActNvj || 0);
                                        } else if (d.doorDone) {
                                            effDelD += (d.actDVj || 0) + (d.actDNvj || 0);
                                            effDelE += (d.actEVj || 0) + (d.actENvj || 0);
                                            effRepCol += (d.replaceActVj || 0) + (d.replaceActNvj || 0);
                                        } else {
                                            effDelD += d.ordD; effDelE += d.ordE;
                                        }
                                    }
                                    var uMatch = null; for (var u = 0; u < savedUnloads.length; u++) { if (savedUnloads[u].blockId === bId) uMatch = savedUnloads[u]; }
                                    var actUnl = uMatch ? uMatch.fullCount : (doors[0].v2bDone ? ordDSum : ordDSum);

                                    var projF = Math.max(0, actUnl - effDelD - effRepCol);
                                    eodF += projF; eodE += (effDelE + effRepCol);
                                }
                            }
                        }

                        var html = '<div class="bg-white border border-slate-200 rounded-3xl p-6 shadow-xl text-center mt-6">' +
                            '<div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4"><svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"></path></svg></div>' +
                            '<h2 class="text-xl font-black text-slate-800 mb-6 uppercase tracking-widest">Final Truck Inventory</h2>' +
                            '<div class="grid grid-cols-2 gap-4">' +
                            '<div class="bg-blue-50 p-4 rounded-2xl border border-blue-100"><p class="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">Total Fulls<br>To Return</p><p class="text-4xl font-black text-blue-700">' + eodF + '</p></div>' +
                            '<div class="bg-emerald-50 p-4 rounded-2xl border border-emerald-100"><p class="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Total Empties<br>Collected</p><p class="text-4xl font-black text-emerald-700">' + eodE + '</p></div>' +
                            '</div><p class="text-xs text-slate-400 font-bold mt-6 bg-slate-50 p-3 rounded-xl border border-slate-100">Calculated from loaded and projected completed blocks</p></div>';
                        container.innerHTML = html;
                    });
                });
            });
        };
        
        // ==========================================
        // PROCESSED HISTORY REPORT VIEWS
        // ==========================================
        
        window.openProcessedDeliveries = function() {
            window.switchView('view-processed');
            var startInput = document.getElementById('filter-start-date');
            var endInput = document.getElementById('filter-end-date');
            var today = new Date().toISOString().split('T')[0];
            
            // Set default dates to today if empty
            if (!startInput.value) startInput.value = today;
            if (!endInput.value) endInput.value = today;
            
            var container = document.getElementById('processed-list-container');
            if (container) {
                container.innerHTML = '<div class="text-center py-10"><span class="text-4xl text-slate-300">📅</span><p class="text-sm font-bold text-slate-500 mt-3">Select dates and click "Execute Query" to view history.</p></div>';
            }
        };

        window.renderHistoryCardsMarkup = function(container, dataArray, emptyMsg) {
            if (!dataArray || dataArray.length === 0) {
                container.innerHTML = '<div class="text-center py-10"><span class="text-4xl">📭</span><p class="text-sm font-bold text-slate-500 mt-3">' + emptyMsg + '</p></div>';
                return;
            }
            
            var html = '';
            dataArray.forEach(function(d) {
                var actD = (d.actDVj || 0) + (d.actDNvj || 0);
                var actE = (d.actEVj || 0) + (d.actENvj || 0);
                var rep = (d.repActVj || 0) + (d.repActNvj || 0);
                
                var imgHtml = d.doorLink ? '<div class="mt-2"><img src="' + window.parseImgUrl(d.doorLink) + '" onclick="window.openLightbox(\'' + d.doorLink + '\')" class="w-12 h-12 object-cover rounded-lg border border-slate-200 shadow-sm cursor-pointer hover:scale-105 transition"></div>' : '';
                
                var displayDate = d.delDate;
                if (displayDate.includes('T')) {
                    displayDate = new Date(displayDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                }

                html += `
                <div class="bg-white p-4 rounded-2xl mb-4 shadow-sm border border-slate-200 hover:shadow-md transition">
                    <div class="flex justify-between items-start mb-2 border-b border-slate-100 pb-2">
                        <div>
                            <span class="font-black text-slate-800 text-sm block tracking-wide">${d.apartment} - ${d.block}</span>
                            <span class="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mt-0.5">Door ${d.door} &bull; <span class="bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-slate-600">${d.cpnno}</span></span>
                        </div>
                        <span class="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-1 rounded font-black shadow-sm uppercase tracking-widest">${displayDate}</span>
                    </div>
                    <div class="grid grid-cols-2 gap-2 text-[10px] bg-slate-50 p-2.5 rounded-xl font-bold border border-slate-100 shadow-inner mt-2">
                        <div>Delivered: <span class="font-black text-emerald-700">${actD} Fulls</span></div>
                        <div>Collected: <span class="font-black text-emerald-700">${actE} Empties</span></div>
                        ${rep > 0 ? `<div class="col-span-2 text-amber-700 border-t border-amber-100 pt-1 mt-1">Replacements: ${rep} (${d.replaceReason})</div>` : ''}
                        ${d.ordComment ? `<div class="col-span-2 text-slate-500 italic border-t border-slate-200 pt-1 mt-1">Note: ${d.ordComment}</div>` : ''}
                    </div>
                    ${imgHtml}
                </div>`;
            });
            container.innerHTML = html;
        };

    })();
