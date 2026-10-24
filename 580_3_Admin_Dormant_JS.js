window.exportDormantPDF = function () {
  const element = document.getElementById('tab-dormant');
  const controls = document.getElementById('dormant-controls');
  const buttons = element.querySelectorAll('button');
  const tableContainer = element.querySelector('.overflow-x-auto');

  if (controls) controls.style.display = 'none';
  buttons.forEach(btn => btn.style.display = 'none');
  
  const opt = { margin: 0.5, filename: 'Dormant_Customers_Report.pdf', image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' } };

  window.html2pdf().set(opt).from(element).save().then(() => {
    if (controls) controls.style.display = '';
    buttons.forEach(btn => btn.style.display = '');
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
    for (var j = 0; j < rangeBtns.length; j++) {
        rangeBtns[j].classList.remove('ring-4', 'ring-indigo-600', 'dark:ring-indigo-500', 'ring-offset-2', 'dark:ring-offset-slate-900', 'scale-105');
    }
    
    var activeBtn = document.getElementById('btn-dorm-' + minDays + '-' + maxDays);
    if (activeBtn) activeBtn.classList.add('ring-4', 'ring-indigo-600', 'dark:ring-indigo-500', 'ring-offset-2', 'dark:ring-offset-slate-900', 'scale-105');

    var tb = document.getElementById('dormant-tbody');
    tb.innerHTML = '<tr><td colspan="6" class="text-center p-12 font-bold text-slate-500 dark:text-slate-400 animate-pulse">Loading data...</td></tr>';
    document.getElementById('selectAllDormant').checked = false;
    
    try {
        const { data: customers, error: custErr } = await window.supabase1
            .from('ac_customers')
            .select('cpn_no, poc1, con1, apartment, block, door, final_status')
            .ilike('final_status', window.currentDormantStatus);
            
        if (custErr) throw custErr;
        
        var activeCpns = {};
        if (customers) {
            customers.forEach(c => {
                activeCpns[c.cpn_no.toUpperCase()] = {
                    name: c.poc1, contact: c.con1, apt: c.apartment, blk: c.block, door: c.door, lastOrderTs: 0
                };
            });
        }

        const { data: salesData, error: salesErr } = await window.supabase1.from('sales').select('cpn_no, del_date');
        if (salesErr) throw salesErr;

        if (salesData) {
            salesData.forEach(s => {
                var rowCpn = (s.cpn_no || "").toUpperCase();
                if (activeCpns.hasOwnProperty(rowCpn) && s.del_date) {
                    var tstamp = new Date(s.del_date + "T00:00:00").getTime();
                    if (tstamp > activeCpns[rowCpn].lastOrderTs) activeCpns[rowCpn].lastOrderTs = tstamp;
                }
            });
        }

        var results = [];
        var today = new Date();
        today.setHours(0,0,0,0);
        var nowTS = today.getTime();
        var oneDay = 86400000;

        for (var key in activeCpns) {
            var user = activeCpns[key];
            var daysSince = 999;
            
            if (user.lastOrderTs !== 0) {
                var lastOrderDate = new Date(user.lastOrderTs);
                lastOrderDate.setHours(0,0,0,0);
                daysSince = Math.floor((nowTS - lastOrderDate.getTime()) / oneDay);
            }
            
            if (daysSince >= 3 || user.lastOrderTs === 0) {
                user.cpn = key;
                user.lastDateStr = (user.lastOrderTs === 0) ? "Never Ordered" : new Date(user.lastOrderTs).toLocaleDateString('en-IN', {day: '2-digit', month: 'short', year: 'numeric'});
                user.daysDormant = daysSince; 
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

        if (filtered.length === 0) {
            tb.innerHTML = "<tr><td colspan='6' class='text-center p-10 font-black text-slate-400 dark:text-slate-500'>No customers match this range/status.</td></tr>";
            return;
        }

        var h = '';
        for (var i = 0; i < filtered.length; i++) {
            var u = filtered[i];
            var dColor = (u.daysDormant > 14) ? "bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-400" : "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-400";
            var dispDays = u.daysDormant === 999 ? ">30" : u.daysDormant;
            
            // SPA Standard: Interactive Customer 360 Badge
            var cpnBadge = "<span class='inline-flex items-center gap-1.5 px-2 py-0.5 mt-1 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/50 hover:shadow-sm active:scale-95 transition-all cursor-pointer group' onclick='window.openCustomer360(\"" + u.cpn + "\")'>" + u.cpn + "<svg class='w-3.5 h-3.5 text-indigo-400 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path stroke-linecap='round' stroke-linejoin='round' stroke-width='3' d='M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14'></path></svg></span>";
            
            h += "<tr class='hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors'>" +
            "<td class='px-6 py-5 text-center'><input type='checkbox' class='dormant-cb w-5 h-5 cursor-pointer rounded text-indigo-600 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600' value='" + u.cpn + "'></td>" +
            "<td class='px-6 py-5'><p class='font-black text-lg text-slate-800 dark:text-white'>" + u.name + "</p>" + cpnBadge + "</td>" +
            "<td class='px-6 py-5 text-sm font-bold text-slate-700 dark:text-slate-300'>" + u.apt + " " + u.blk + " - " + u.door + "</td>" +
            "<td class='px-6 py-5 font-bold text-slate-700 dark:text-slate-300'>" + u.lastDateStr + "</td>" +
            "<td class='px-6 py-5 text-center'><span class='px-3 py-1 rounded-lg font-black " + dColor + "'>" + dispDays + "</span></td>" +
            "<td class='px-6 py-5 text-center text-slate-700 dark:text-slate-300'>" + u.status + "</td></tr>";
        }
        tb.innerHTML = h;

    } catch(err) {
        tb.innerHTML = "<tr><td colspan='6' class='text-center p-10 font-bold text-red-500'>Error: " + err.message + "</td></tr>";
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

window.toggleAllDormant = function (source) {
  var checkboxes = document.querySelectorAll('.dormant-cb');
  for (var i = 0; i < checkboxes.length; i++) checkboxes[i].checked = source.checked;
};

window.loadDormantStatuses = async function () {
  try {
    const { data, error } = await window.supabase1.from('setup').select('value').eq('key', 'final_status_options').maybeSingle();
    var statuses = ['Active'];
    if (data && data.value) statuses = data.value.split(',').map(s => s.trim());

    if (!window.currentDormantStatus) window.currentDormantStatus = statuses[0];

    var container = document.getElementById('dormant-status-filters');
    var html = '<span class="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest w-full mb-1">Filter by Status</span>';

    for (var i = 0; i < statuses.length; i++) {
      var s = statuses[i];
      var safeId = s.replace(/\s+/g, '-');
      var isActive = (s === window.currentDormantStatus);
      var btnClass = isActive ? "bg-indigo-600 dark:bg-indigo-700 text-white border-indigo-600 dark:border-indigo-700" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700";
      html += '<button onclick="window.setDormantStatusFilter(\'' + s + '\')" id="btn-status-' + safeId + '" class="status-filter-btn px-4 py-1.5 rounded-lg text-sm font-bold border-2 transition-colors ' + btnClass + '">' + s + '</button>';
    }
    container.innerHTML = html;
  } catch (e) {
    console.error("Error fetching statuses: ", e.message);
  }
};

window.setDormantStatusFilter = function (status) {
  window.currentDormantStatus = status;
  var buttons = document.querySelectorAll('.status-filter-btn');
  for (var i = 0; i < buttons.length; i++) buttons[i].className = "status-filter-btn px-4 py-1.5 rounded-lg text-sm font-bold border-2 transition-colors bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700";

  var activeBtn = document.getElementById('btn-status-' + status.replace(/\s+/g, '-'));
  if (activeBtn) activeBtn.className = "status-filter-btn px-4 py-1.5 rounded-lg text-sm font-bold border-2 transition-colors bg-indigo-600 dark:bg-indigo-700 text-white border-indigo-600 dark:border-indigo-700";

  window.loadDormantData(window.dormantMinDays, window.dormantMaxDays);
};

window.fetchCustomDormantRange = function () {
  var fromInput = document.getElementById('custom-dormant-from').value;
  var toInput = document.getElementById('custom-dormant-to').value;
  if (fromInput === "" || toInput === "") return alert("Please enter values in both 'From' and 'To' fields.");
  var fromVal = parseInt(fromInput), toVal = parseInt(toInput);
  if (fromVal < 3) return alert("Dormant days must be 3 or greater.");
  if (toVal > 999) return alert("The maximum limit allowed is 999 days.");
  if (fromVal > toVal) return alert("The 'From' day cannot be greater than the 'To' day.");

  var rangeBtns = document.querySelectorAll('.dorm-range-btn');
  for (var j = 0; j < rangeBtns.length; j++) rangeBtns[j].classList.remove('ring-4', 'ring-indigo-600', 'dark:ring-indigo-500', 'ring-offset-2', 'dark:ring-offset-slate-900', 'scale-105');
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
    var originalText = btn.innerText; btn.innerText = "Pushing..."; btn.disabled = true;

    try {
        const { data: setupData } = await window.supabase1.from('setup').select('value').eq('key', 'wip_statuses').maybeSingle();
        var wipStatuses = setupData && setupData.value ? setupData.value.split(',').map(s => s.trim().toUpperCase()) : [];

        const { data: existingData, error: extErr } = await window.supabase1.from('crm_dormant_call_logs').select('cpn_no, call_status');
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
                log_id: logId, 
                date_added: timestamp.toISOString().split('T')[0],
                cpn_no: cleanCpn, 
                customer_name: c.name || "Unknown", 
                phone: c.phone || "N/A", 
                days_dormant: c.days || 0,
                call_status: "Pending", 
                action_taken_by: "Admin", 
                created_by: currentUser, 
                created_at: timestamp.toISOString(), 
                last_updated: timestamp.toISOString()
            });
        });

        if (newRows.length > 0) {
            const { error: insErr } = await window.supabase1.from('crm_dormant_call_logs').insert(newRows);
            if (insErr) throw insErr;
        }
        
        if (typeof window.showToast === 'function') {
            window.showToast(newRows.length + " pushed. " + skippedCount + " skipped.", "success");
        } else {
            alert(newRows.length + " customers pushed. " + skippedCount + " skipped (already active in queue).");
        }
    } catch(err) {
        alert("Error pushing to CRM: " + err.message);
    } finally {
        btn.innerText = originalText; btn.disabled = false;
        document.getElementById('selectAllDormant').checked = false;
        var inputs = document.querySelectorAll('.dormant-cb:checked');
        for (var k = 0; k < inputs.length; k++) inputs[k].checked = false;
    }
};

window.tabActions['dormant'] = function(filterArg) {
    if (filterArg) {
        var parts = filterArg.split(',');
        if (parts.length === 2) {
            window.loadDormantData(parseInt(parts[0]), parseInt(parts[1]));
        }
    } else {
        window.loadDormantData(7, 10);
    }
};