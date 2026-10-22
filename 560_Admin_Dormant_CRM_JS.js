window.crmReportMasterData = null;
window.crmActiveCategory = null;

window.switchCRMDashTab = function (tabNum) {
    document.getElementById('crm-dash-content-1').classList.add('hidden');
    document.getElementById('crm-dash-content-2').classList.add('hidden');

    document.getElementById('btn-crm-tab-1').className = "flex-1 px-3 md:px-6 py-3 rounded-xl text-base md:text-xl font-black bg-white text-slate-500 hover:bg-slate-100 transition text-center whitespace-nowrap";
    document.getElementById('btn-crm-tab-2').className = "flex-1 px-3 md:px-6 py-3 rounded-xl text-base md:text-xl font-black bg-white text-slate-500 hover:bg-slate-100 transition text-center whitespace-nowrap";

    document.getElementById('crm-dash-content-' + tabNum).classList.remove('hidden');
    document.getElementById('btn-crm-tab-' + tabNum).className = "flex-1 px-3 md:px-6 py-3 rounded-xl text-base md:text-xl font-black bg-slate-800 text-white shadow-md transition text-center whitespace-nowrap";

    if (tabNum === 2 && !window.crmReportMasterData) {
        window.fetchCRMDashboardStats();
    }
};

window.fetchCRMDashboardStats = async function (days) {
    days = parseInt(days) || 7;

    var btns = document.querySelectorAll('.crm-days-btn');
    for (var i = 0; i < btns.length; i++) btns[i].className = "crm-days-btn px-6 py-2.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl text-sm font-black transition-all";

    var activeBtn = document.getElementById('btn-crm-days-' + days);
    if (activeBtn) {
        activeBtn.className = "crm-days-btn px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-black shadow-md transition-all";
        document.getElementById('crm-custom-days').value = "";
    }

    var badges = document.querySelectorAll('.crm-days-badge');
    for (var j = 0; j < badges.length; j++) badges[j].innerText = "LAST " + days + " DAYS";

    document.getElementById('crm-dash-loading').classList.remove('hidden');

    try {
        // Fetch CRM Setup Statuses
        const { data: setupData } = await supabase1.from('setup').select('key, value').in('key', ['wip_statuses', 'completed_statuses']);
        var wipStatuses = [];
        var compStatuses = [];
        if (setupData) {
            setupData.forEach(s => {
                if (s.key === 'wip_statuses' && s.value) wipStatuses = s.value.split(',').map(x => x.trim().toUpperCase());
                if (s.key === 'completed_statuses' && s.value) compStatuses = s.value.split(',').map(x => x.trim().toUpperCase());
            });
        }

        // Calculate cutoff date
        var cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        var cutoffIso = cutoff.toISOString();

        // Fetch logs
        const { data: logs, error } = await supabase1
            .from('crm_dormant_call_logs')
            .select('*')
            .gte('last_updated', cutoffIso)
            .order('last_updated', { ascending: false });

        if (error) throw error;

        var payload = {
            inactive: { total: 0, splits: {}, rows: [] },
            retained: { total: 0, splits: {}, rows: [] },
            wip: { total: 0, splits: {}, rows: [] },
            completed: { total: 0, splits: {}, rows: [] },
            escalated: { total: 0, splits: {}, rows: [] }
        };

        if (logs) {
            logs.forEach(row => {
                var callStatus = (row.call_status || "").trim().toUpperCase();
                var prevStatus = (row.previous_customer_status || "").trim().toUpperCase();
                var newStatus = (row.new_customer_status || "").trim().toUpperCase();
                var reason = (row.reason_for_dormancy || "Unspecified").trim();
                var tcRemark = row.telecaller_feedback || "";

                var formatDt = dt => dt ? new Date(dt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : "N/A";

                var record = {
                    logId: row.log_id,
                    enterDate: formatDt(row.created_at),
                    lastUpdateDate: formatDt(row.last_updated),
                    cpn: row.cpn_no, name: row.customer_name, callStatus: row.call_status, prevStatus: row.previous_customer_status, newStatus: row.new_customer_status,
                    reason: reason, custRemark: row.customer_remark, tcRemark: row.telecaller_feedback, actionBy: row.action_taken_by, ts: new Date(row.last_updated).getTime()
                };

                // 1. LOST (Active -> Inactive)
                if (prevStatus === "ACTIVE" && newStatus === "INACTIVE") {
                    payload.inactive.total++;
                    payload.inactive.splits[reason] = (payload.inactive.splits[reason] || 0) + 1;
                    payload.inactive.rows.push(record);
                }

                // 2. RETAINED / SAVED 
                else if (prevStatus === "ACTIVE" && (newStatus === "ACTIVE" || newStatus === "ACTIVE RANDOM")) {
                    payload.retained.total++;
                    payload.retained.splits[newStatus] = (payload.retained.splits[newStatus] || 0) + 1;
                    payload.retained.rows.push(record);
                }

                // 3. WIP / PENDING
                var isPending = (callStatus === "" || callStatus === "PENDING");
                var isWIP = wipStatuses.includes(callStatus);
                if (isPending || isWIP) {
                    var splitKeyWip = isPending ? "Pending" : row.call_status.trim();
                    payload.wip.total++;
                    payload.wip.splits[splitKeyWip] = (payload.wip.splits[splitKeyWip] || 0) + 1;
                    payload.wip.rows.push(record);
                }

                // 4. COMPLETED
                var isCompleted = compStatuses.includes(callStatus);
                if (isCompleted) {
                    payload.completed.total++;
                    payload.completed.splits[reason] = (payload.completed.splits[reason] || 0) + 1;
                    payload.completed.rows.push(record);
                }

                // 5. ESCALATED
                if (tcRemark.includes("⚠️ [ADMIN REVIEW REQUESTED]")) {
                    var caller = row.action_taken_by || "Unknown";
                    payload.escalated.total++;
                    payload.escalated.splits[caller] = (payload.escalated.splits[caller] || 0) + 1;
                    payload.escalated.rows.push(record);
                }
            });
        }

        window.crmReportMasterData = payload;

        function formatClickableSplit(splitObj, filterTarget) {
            var arr = [];
            for (var k in splitObj) {
                var safeKey = String(k).replace(/'/g, "\\'");
                arr.push("<button onclick=\"window.filterCRMByKeyword('" + filterTarget + "', '" + safeKey + "')\" class='bg-slate-100 hover:bg-indigo-100 hover:text-indigo-800 px-2 rounded cursor-pointer transition shadow-sm'>" + k + ": " + splitObj[k] + "</button>");
            }
            return arr.length > 0 ? arr.join("") : "No activity";
        }

        var cInactive = document.getElementById('crm-card-inactive'); if (cInactive) cInactive.innerText = payload.inactive.total;
        var sInactive = document.getElementById('crm-split-inactive'); if (sInactive) sInactive.innerHTML = formatClickableSplit(payload.inactive.splits, 'REASON');

        var cRetained = document.getElementById('crm-card-retained'); if (cRetained) cRetained.innerText = payload.retained.total;
        var sRetained = document.getElementById('crm-split-retained'); if (sRetained) sRetained.innerHTML = formatClickableSplit(payload.retained.splits, 'STATUS');

        var cWip = document.getElementById('crm-card-wip'); if (cWip) cWip.innerText = payload.wip.total;
        var sWip = document.getElementById('crm-split-wip'); if (sWip) sWip.innerHTML = formatClickableSplit(payload.wip.splits, 'STATUS');

        var cCompleted = document.getElementById('crm-card-completed'); if (cCompleted) cCompleted.innerText = payload.completed.total;
        var sCompleted = document.getElementById('crm-split-completed'); if (sCompleted) sCompleted.innerHTML = formatClickableSplit(payload.completed.splits, 'REASON');

        var cEscalated = document.getElementById('crm-card-escalated'); if (cEscalated) cEscalated.innerText = payload.escalated.total;
        var sEscalated = document.getElementById('crm-split-escalated'); if (sEscalated) sEscalated.innerHTML = formatClickableSplit(payload.escalated.splits, 'REASON');

        if (!document.getElementById('crm-detailed-report').classList.contains('hidden')) {
            window.renderCRMTable();
        }

    } catch (err) {
        alert("CRM Sync Error: " + err.message);
    } finally {
        document.getElementById('crm-dash-loading').classList.add('hidden');
    }
};

window.fetchDormantSummaryCards = async function () {
    var c7 = document.getElementById('dormant-7');
    if (c7) c7.classList.add('animate-pulse');

    try {
        // FIX: Case-insensitive match using .ilike
        const { data: customers, error: custErr } = await supabase1.from('ac_customers').select('cpn_no').ilike('final_status', 'ACTIVE');
        if (custErr) throw custErr;
        
        var activeCpns = {};
        if (customers) {
            customers.forEach(c => activeCpns[c.cpn_no.toUpperCase()] = 0);
        }

        const { data: salesData, error: salesErr } = await supabase1.from('sales').select('cpn_no, del_date');
        if (salesErr) throw salesErr;

        if (salesData) {
            salesData.forEach(s => {
                var rowCpn = (s.cpn_no || "").toUpperCase();
                if (activeCpns.hasOwnProperty(rowCpn) && s.del_date) {
                    var tstamp = new Date(s.del_date + "T00:00:00").getTime();
                    if (tstamp > activeCpns[rowCpn]) activeCpns[rowCpn] = tstamp;
                }
            });
        }

        var counts = { exactly7: 0, days7to10: 0, days10to15: 0, days15to30: 0 };
        
        var today = new Date();
        today.setHours(0,0,0,0);
        var nowTS = today.getTime();
        var oneDay = 86400000;

        for (var key in activeCpns) {
            var days = 999;
            if (activeCpns[key] !== 0) {
                var lastDt = new Date(activeCpns[key]);
                lastDt.setHours(0,0,0,0);
                days = Math.floor((nowTS - lastDt.getTime()) / oneDay);
            }
            
            if (days === 7) counts.exactly7++;
            if (days >= 7 && days <= 10) counts.days7to10++;
            if (days > 10 && days <= 15) counts.days10to15++;
            if (days > 15 && days <= 30) counts.days15to30++;
        }

        document.getElementById('dormant-7').innerText = counts.exactly7;
        document.getElementById('dormant-10').innerText = counts.days7to10;
        document.getElementById('dormant-15').innerText = counts.days10to15;
        document.getElementById('dormant-30').innerText = counts.days15to30;

    } catch (err) {
        console.error("Dormant Card Error: ", err.message);
    } finally {
        if (c7) c7.classList.remove('animate-pulse');
    }
};

window.filterCRMByKeyword = function (filterTarget, keyword) {
    event.stopPropagation();
    document.getElementById('crm-flt-status').value = "";
    document.getElementById('crm-flt-reason').value = "";
    if (filterTarget === 'STATUS') document.getElementById('crm-flt-status').value = keyword;
    else document.getElementById('crm-flt-reason').value = keyword;
    window.renderCRMTable();
};

window.loadCRMReportData = function (categoryType) {
    if (!window.crmReportMasterData) return;
    window.crmActiveCategory = categoryType;
    document.getElementById('crm-detailed-report').classList.remove('hidden');

    var titles = {
        'INACTIVE': 'Lost Customers (Active -> Inactive)',
        'RETAINED': 'Retained / Saved (Active -> Active/Random)',
        'WIP': 'Pending & WIP Queue',
        'COMPLETED': 'Closed / Resolved Calls',
        'ESCALATED': 'Admin Escalations Required'
    };
    document.getElementById('crm-report-title').innerText = titles[categoryType];

    var allCards = document.querySelectorAll('.crm-kpi-card');
    for (var c = 0; c < allCards.length; c++) allCards[c].classList.remove('ring-4', 'ring-indigo-600', 'ring-offset-2', 'scale-[1.02]');

    var activeCard = document.getElementById('crm-card-container-' + categoryType);
    if (activeCard) activeCard.classList.add('ring-4', 'ring-indigo-600', 'ring-offset-2', 'scale-[1.02]');

    document.getElementById('crm-flt-cpn').value = "";
    document.getElementById('crm-flt-status').value = "";
    document.getElementById('crm-flt-reason').value = "";
    document.getElementById('crm-flt-date').value = "";

    window.renderCRMTable();
    // Smooth scroll with a visual focus flash
    setTimeout(function() {
        var repDiv = document.getElementById('crm-detailed-report');
        repDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
        repDiv.classList.add('ring-4', 'ring-indigo-400', 'ring-offset-4', 'transition-all', 'duration-500');
        
        setTimeout(function() {
            repDiv.classList.remove('ring-4', 'ring-indigo-400', 'ring-offset-4');
        }, 800);
    }, 50);
    
};

window.renderCRMTable = function () {
    if (!window.crmActiveCategory || !window.crmReportMasterData) return;

    var keyMap = { 'INACTIVE': 'inactive', 'RETAINED': 'retained', 'WIP': 'wip', 'COMPLETED': 'completed', 'ESCALATED': 'escalated' };
    var sourceData = window.crmReportMasterData[keyMap[window.crmActiveCategory]].rows;

    var fCpn = document.getElementById('crm-flt-cpn').value.trim().toUpperCase();
    var fStat = document.getElementById('crm-flt-status').value.trim().toUpperCase();
    var fReas = document.getElementById('crm-flt-reason').value.trim().toUpperCase();
    var fDate = document.getElementById('crm-flt-date').value;

    var filtered = [];
    for (var i = 0; i < sourceData.length; i++) {
        var r = sourceData[i];

        var matchCpn = fCpn === "" || String(r.cpn).toUpperCase().indexOf(fCpn) > -1 || String(r.name).toUpperCase().indexOf(fCpn) > -1;

        var rCallStat = String(r.callStatus).trim().toUpperCase();
        if (rCallStat === "") rCallStat = "PENDING";
        var rNewStat = String(r.newStatus).trim().toUpperCase();
        var matchStat = fStat === "" || rCallStat.indexOf(fStat) > -1 || rNewStat.indexOf(fStat) > -1;

        var matchReas = fReas === "" || String(r.reason).toUpperCase().indexOf(fReas) > -1 || String(r.tcRemark).toUpperCase().indexOf(fReas) > -1 || String(r.actionBy).toUpperCase().indexOf(fReas) > -1;

        var matchDate = true;
        if (fDate) {
            var fParts = fDate.split('-');
            if (fParts.length === 3) {
                var rowDateObj = new Date(r.ts);
                var rowDateStr = rowDateObj.getFullYear() + "-" + String(rowDateObj.getMonth() + 1).padStart(2, '0') + "-" + String(rowDateObj.getDate()).padStart(2, '0');
                if (rowDateStr !== fDate) matchDate = false;
            }
        }

        if (matchCpn && matchStat && matchReas && matchDate) filtered.push(r);
    }

    var tb = document.getElementById('crm-detailed-tbody');
    var countBadge = document.getElementById('crm-table-count');

    if (filtered.length === 0) {
        countBadge.innerText = "0 Records";
        countBadge.className = "bg-rose-100 border border-rose-300 text-rose-800 px-3 py-1 rounded-lg text-sm font-black tracking-widest hidden sm:inline-block";
        tb.innerHTML = "<tr><td colspan='6' class='text-center p-8 font-bold text-slate-400'>No records match the current filters.</td></tr>";
        return;
    }

    countBadge.innerText = filtered.length + " Record" + (filtered.length > 1 ? "s" : "");
    countBadge.className = "bg-indigo-100 border border-indigo-300 text-indigo-800 px-3 py-1 rounded-lg text-sm font-black tracking-widest hidden sm:inline-block";

    var h = "";
    for (var j = 0; j < filtered.length; j++) {
        var r = filtered[j];
        var escalateBadge = String(r.tcRemark || "").indexOf("⚠️") > -1 ? "bg-rose-100 border-rose-300" : "bg-white";
        var dispCallStatus = String(r.callStatus).trim() === "" ? "PENDING" : r.callStatus;

        h += "<tr class='hover:bg-slate-50 border-b border-slate-100 " + escalateBadge + "'>" +
            "<td class='px-4 py-3 whitespace-normal'><span class='font-bold text-slate-800 block'>" + r.enterDate + "</span><span class='text-xs text-slate-400'>" + r.logId + "</span></td>" +
            "<td class='px-4 py-3 whitespace-normal'><span class='font-black text-indigo-600 block'>" + r.cpn + "</span><span class='text-sm text-slate-600 font-bold'>" + r.name + "</span></td>" +
            "<td class='px-4 py-3 whitespace-normal'><span class='line-through text-slate-400 text-xs'>" + r.prevStatus + "</span><br/><span class='font-bold text-emerald-600'>" + r.newStatus + "</span></td>" +
            "<td class='px-4 py-3'><span class='bg-slate-100 px-3 py-1 rounded-full text-xs font-black uppercase border border-slate-200'>" + dispCallStatus + "</span></td>" +
            "<td class='px-4 py-3 whitespace-normal min-w-[200px]'><p class='text-sm font-bold text-indigo-600'>" + r.reason + "</p><p class='text-xs font-bold text-slate-700 mt-1'>" + r.tcRemark + "</p></td>" +
            "<td class='px-4 py-3 whitespace-normal'><span class='text-sm font-black text-slate-800 block'>" + r.actionBy + "</span><span class='text-xs font-bold text-emerald-600'>" + r.lastUpdateDate + "</span></td>" +
            "</tr>";
    }
    tb.innerHTML = h;
};

window.tabActions['dormant-crm'] = function() { 
    if(typeof window.switchCRMDashTab === 'function') window.switchCRMDashTab(1); 
    var d7 = document.getElementById('dormant-7');
    if (d7 && d7.innerText === '0') { 
        if (typeof window.fetchDormantSummaryCards === 'function') window.fetchDormantSummaryCards(); 
        if (typeof window.fetchCRMDashboardStats === 'function') window.fetchCRMDashboardStats(); 
    } 
};