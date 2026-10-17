window.exportDormantPDF = function () {
    const element = document.getElementById('tab-dormant');
    const controls = document.getElementById('dormant-controls');
    const buttons = element.querySelectorAll('button');
    const tableContainer = element.querySelector('.overflow-hidden');

    if (controls) controls.style.display = 'none';
    buttons.forEach(btn => btn.style.display = 'none');
    if (tableContainer) tableContainer.classList.remove('overflow-hidden');

    const opt = { margin: 0.5, filename: 'Dormant_Customers_Report.pdf', image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' } };

    html2pdf().set(opt).from(element).save().then(() => {
        if (controls) controls.style.display = '';
        buttons.forEach(btn => btn.style.display = '');
        if (tableContainer) tableContainer.classList.add('overflow-hidden');
    });
};

window.toggleDormantControls = function () {
    var c = document.getElementById('dormant-controls');
    var i = document.getElementById('dormant-icon');
    c.classList.toggle('hidden');
    i.classList.toggle('rotate-180');
};

window.loadDormantData = async function (minDays, maxDays, sortText) {
    if (minDays === undefined) return;

    if (!window.currentDormantStatus) {
        window.loadDormantStatuses();
        return setTimeout(function() { window.loadDormantData(minDays, maxDays, sortText); }, 500);
    }

    if (typeof sortText !== 'undefined' && sortText !== '') {
        minDays = window.dormantMinDays;
        maxDays = window.dormantMaxDays;
    }

    var rangeBtns = document.querySelectorAll('.dorm-range-btn');
    for (var j = 0; j < rangeBtns.length; j++) rangeBtns[j].classList.remove('ring-4', 'ring-indigo-600', 'ring-offset-2', 'scale-105');
    
    var activeBtn = document.getElementById('btn-dorm-' + minDays + '-' + maxDays);
    if (activeBtn) activeBtn.classList.add('ring-4', 'ring-indigo-600', 'ring-offset-2', 'scale-105');

    var tb = document.getElementById('dormant-tbody');
    tb.innerHTML = '<tr><td colspan="6" class="text-center p-12 font-bold text-slate-500 animate-pulse">Loading data...</td></tr>';
    document.getElementById('selectAllDormant').checked = false;
    
    try {
        const { data: customers, error: custErr } = await supabase1
            .from('ac_customers')
            .select('*')
            .eq('final_status', window.currentDormantStatus.toUpperCase());
            
        if (custErr) throw custErr;
        
        var activeCpns = {};
        if (customers) {
            customers.forEach(c => {
                activeCpns[c.cpn_no.toUpperCase()] = {
                    name: c.poc1, contact: c.con1, apt: c.apartment, blk: c.block, door: c.door, lastOrderTs: 0
                };
            });
        }

        const { data: salesData, error: salesErr } = await supabase1.from('sales').select('cpn_no, del_date');
        if (salesErr) throw salesErr;

        if (salesData) {
            salesData.forEach(s => {
                var rowCpn = (s.cpn_no || "").toUpperCase();
                if (activeCpns.hasOwnProperty(rowCpn) && s.del_date) {
                    var tstamp = new Date(s.del_date).getTime();
                    if (tstamp > activeCpns[rowCpn].lastOrderTs) activeCpns[rowCpn].lastOrderTs = tstamp;
                }
            });
        }

        var results = [];
        var nowTS = new Date().getTime();
        var oneDay = 86400000;

        for (var key in activeCpns) {
            var user = activeCpns[key];
            var daysSince = (nowTS - user.lastOrderTs) / oneDay;
            
            if (daysSince >= 3 || user.lastOrderTs === 0) {
                user.cpn = key;
                user.lastDateStr = (user.lastOrderTs === 0) ? "Never Ordered" : new Date(user.lastOrderTs).toLocaleDateString('en-IN', {day: '2-digit', month: 'short', year: 'numeric'});
                user.daysDormant = (user.lastOrderTs === 0) ? 999 : Math.floor(daysSince); 
                user.status = window.currentDormantStatus.toUpperCase();
                results.push(user);
            }
        }

        var filtered = results.filter(u => u.daysDormant >= minDays && u.daysDormant <= maxDays);
        window.currentDormantData = filtered;
        window.dormantMinDays = minDays;
        window.dormantMaxDays = maxDays;

        if (typeof sortText !== 'undefined' && sortText !== '') window.sortDormantData(sortText);

        document.getElementById('dormant-total-count').innerText = filtered.length + " Total";

        if (filtered.length === 0) return tb.innerHTML = "<tr><td colspan='6' class='text-center p-10 font-black text-slate-400'>No customers match this range/status.</td></tr>";

        var h = '';
        for (var i = 0; i < filtered.length; i++) {
            var u = filtered[i];
            var dColor = (u.daysDormant > 14) ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800";
            var dispDays = u.daysDormant === 999 ? ">30" : u.daysDormant;
            
            h += "<tr><td class='px-6 py-5 text-center'><input type='checkbox' class='dormant-cb w-5 h-5 cursor-pointer rounded text-indigo-600 border-slate-300' value='" + u.cpn + "'></td>" +
            "<td class='px-6 py-5'><p class='font-black text-lg'>" + u.name + "</p><p class='text-xs text-blue-600'>" + u.cpn + "</p></td>" +
            "<td class='px-6 py-5 text-sm font-bold'>" + u.apt + " " + u.blk + "</td>" +
            "<td class='px-6 py-5 font-bold'>" + u.lastDateStr + "</td>" +
            "<td class='px-6 py-5 text-center'><span class='px-3 py-1 rounded-lg font-black " + dColor + "'>" + dispDays + "</span></td>" +
            "<td class='px-6 py-5 text-center'>" + u.status + "</td></tr>";
        }
        tb.innerHTML = h;

    } catch(err) {
        tb.innerHTML = "<tr><td colspan='6' class='text-center p-10'>Error: " + err.message + "</td></tr>";
    }
};

window.sortDormantData = function (key) {
    if (!window.currentDormantData || window.currentDormantData.length === 0) return;
    window.sortDirection = !window.sortDirection;
    
    window.currentDormantData.sort(function (a, b) {
        var valA = a[key], valB = b[key];
        if (key === 'daysDormant') {
            valA = String(a.daysDormant).includes(">") ? 999 : parseFloat(a.daysDormant || 0);
            valB = String(b.daysDormant).includes(">") ? 999 : parseFloat(b.daysDormant || 0);
        } else if (key === 'lastOrder') {
            valA = a.lastOrderTs || 0;
            valB = b.lastOrderTs || 0;
        }

        if (valA < valB) return window.sortDirection ? -1 : 1;
        if (valA > valB) return window.sortDirection ? 1 : -1;
        return 0;
    });
};

window.currentDormantStatus = null;

window.toggleAllDormant = function(source) {
    var checkboxes = document.querySelectorAll('.dormant-cb');
    for (var i = 0; i < checkboxes.length; i++) checkboxes[i].checked = source.checked;
};

window.loadDormantStatuses = async function() {
    try {
        const { data, error } = await supabase1.from('setup').select('value').eq('key', 'final_status_options').maybeSingle();
        var statuses = ['Active'];
        if (data && data.value) statuses = data.value.split(',').map(s => s.trim());
        
        if (!window.currentDormantStatus) window.currentDormantStatus = statuses[0]; 
        
        var container = document.getElementById('dormant-status-filters');
        var html = '<span class="text-xs font-black text-slate-400 uppercase tracking-widest w-full mb-1">Filter by Status</span>';
        
        for(var i = 0; i < statuses.length; i++) {
            var s = statuses[i];
            var safeId = s.replace(/\s+/g, '-');
            var isActive = (s === window.currentDormantStatus);
            var btnClass = isActive ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50";
            html += '<button onclick="window.setDormantStatusFilter(\'' + s + '\')" id="btn-status-' + safeId + '" class="status-filter-btn px-4 py-1.5 rounded-lg text-sm font-bold border-2 transition-colors ' + btnClass + '">' + s + '</button>';
        }
        container.innerHTML = html;
    } catch(e) {
        console.error("Error fetching statuses: ", e.message);
    }
};

window.setDormantStatusFilter = function(status) {
    window.currentDormantStatus = status;
    var buttons = document.querySelectorAll('.status-filter-btn');
    for(var i = 0; i < buttons.length; i++) buttons[i].className = "status-filter-btn px-4 py-1.5 rounded-lg text-sm font-bold border-2 transition-colors bg-white text-slate-600 border-slate-200 hover:bg-slate-50";
    
    var activeBtn = document.getElementById('btn-status-' + status.replace(/\s+/g, '-'));
    if (activeBtn) activeBtn.className = "status-filter-btn px-4 py-1.5 rounded-lg text-sm font-bold border-2 transition-colors bg-indigo-600 text-white border-indigo-600";
    
    window.loadDormantData(window.dormantMinDays, window.dormantMaxDays);
};

window.fetchCustomDormantRange = function() {
    var fromInput = document.getElementById('custom-dormant-from').value;
    var toInput = document.getElementById('custom-dormant-to').value;
    if (fromInput === "" || toInput === "") return alert("Please enter values in both 'From' and 'To' fields.");
    var fromVal = parseInt(fromInput), toVal = parseInt(toInput);
    if (fromVal < 3) return alert("Dormant days must be 3 or greater.");
    if (toVal > 999) return alert("The maximum limit allowed is 999 days.");
    if (fromVal > toVal) return alert("The 'From' day cannot be greater than the 'To' day.");

    var rangeBtns = document.querySelectorAll('.dorm-range-btn');
    for (var j = 0; j < rangeBtns.length; j++) rangeBtns[j].classList.remove('ring-4', 'ring-indigo-600', 'ring-offset-2', 'scale-105');
    window.loadDormantData(fromVal, toVal);
};

window.exportDormantCSV = function () {
    if (!window.currentDormantData || window.currentDormantData.length === 0) return alert("No data to export.");
    var csv = "Name,CPN,Apt,Block,Days Inactive,Status\n";
    window.currentDormantData.forEach(u => csv += u.name + "," + u.cpn + "," + u.apt + "," + u.blk + "," + u.daysDormant + "," + u.status + "\n");
    var blob = new Blob([csv], { type: 'text/csv' });
    var url = window.URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'Dormant_Report_' + new Date().toISOString().split('T')[0] + '.csv';
    a.click();
};

window.pushDormantListToCRM = async function() {
    var checkboxes = document.querySelectorAll('.dormant-cb:checked');
    if (checkboxes.length === 0) return alert("Select at least one customer to push.");

    var selectedCpns = Array.from(checkboxes).map(cb => cb.value);
    var payload = window.currentDormantData.filter(cust => selectedCpns.includes(String(cust.cpn))).map(cust => ({
        cpn: cust.cpn, name: cust.name, phone: cust.contact || "No Number", days: cust.daysDormant || 0, currentStatus: cust.status || "ACTIVE"
    }));

    var forcePush = document.getElementById('force-push-crm').checked;
    if (!payload.length) return alert("No dormant customers currently loaded to push.");
    
    var btn = document.getElementById('btn-push-crm');
    var originalText = btn.innerText; btn.innerText = "Pushing to CRM..."; btn.disabled = true;

    try {
        const { data: setupData } = await supabase1.from('setup').select('value').eq('key', 'wip_statuses').maybeSingle();
        var wipStatuses = setupData && setupData.value ? setupData.value.split(',').map(s => s.trim().toUpperCase()) : [];

        const { data: existingData, error: extErr } = await supabase1.from('crm_dormant_call_logs').select('cpn_no, call_status');
        if (extErr) throw extErr;

        var activeCPNs = {};
        if (existingData) {
            existingData.forEach(row => {
                var callStatus = (row.call_status || "").trim().toUpperCase();
                if (callStatus === "" || callStatus === "PENDING" || wipStatuses.includes(callStatus)) {
                    activeCPNs[(row.cpn_no || "").trim().toUpperCase()] = true;
                }
            });
        }

        var timestamp = new Date();
        var newRows = [];
        var skippedCount = 0;

        payload.forEach(c => {
            var cleanCpn = String(c.cpn).trim().toUpperCase();
            if (!forcePush && activeCPNs[cleanCpn]) { skippedCount++; return; }

            var dateSuffix = timestamp.toLocaleDateString('en-IN', {year:'2-digit', month:'2-digit', day:'2-digit'}).replace(/\//g, '');
            var logId = "DORM-" + dateSuffix + "-" + Math.floor(1000 + Math.random() * 9000);
            var currentUser = window.activeAdminSession ? window.activeAdminSession.username : 'Admin';

            newRows.push({
                log_id: logId, cpn_no: cleanCpn, customer_name: c.name || "Unknown", phone: c.phone || "N/A", days_dormant: c.days || 0,
                call_status: "Pending", action_taken_by: "Admin", created_by: currentUser, created_at: timestamp.toISOString(), last_updated: timestamp.toISOString()
            });
        });

        if (newRows.length > 0) {
            const { error: insErr } = await supabase1.from('crm_dormant_call_logs').insert(newRows);
            if (insErr) throw insErr;
        }
        alert(newRows.length + " customers pushed. " + skippedCount + " skipped (already active in queue).");
    } catch(err) {
        alert("Error pushing to CRM: " + err.message);
    } finally {
        btn.innerText = originalText; btn.disabled = false;
    }
};