// =====================================
// ADVANCED PAYS ENGINE (Supabase Native)
// =====================================

window.masterPaysData = [];
window.filteredPaysData = [];
window.paysDisplayCount = 50;
window.paysSortCol = 'timestamp';
window.paysSortAsc = false;

// Date Formatting Helper ("2026-10-18" -> "18-Oct-2026")
window.formatPaysDate = function(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return String(d.getDate()).padStart(2, '0') + "-" + months[d.getMonth()] + "-" + d.getFullYear();
};

window.formatPaysDateTime = function(isoStr) {
  if (!isoStr) return "-";
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr;
  let hours = d.getHours();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; 
  const mins = String(d.getMinutes()).padStart(2, '0');
  return window.formatPaysDate(isoStr) + " " + String(hours).padStart(2, '0') + ":" + mins + " " + ampm;
};

// Timer Engine
window.activePaysTimerInterval = null;
window.paysStartTime = 0;

window.startPaysTimer = function(actionLabel) {
  var timerBadge = document.getElementById('pays-live-timer');
  if (!timerBadge) return;
  timerBadge.outerHTML = '<span id="pays-live-timer" class="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-400 font-black px-3 py-1.5 rounded-lg text-sm border-2 border-emerald-200 dark:border-emerald-800 shadow-inner flex items-center gap-1.5 min-w-max transition-colors"><svg class="w-4 h-4 animate-spin text-emerald-600 dark:text-emerald-500" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>' + actionLabel + ': <span id="pays-timer-sec">0.00</span>s</span>';
  document.getElementById('pays-live-timer').classList.remove('hidden');
  window.paysStartTime = performance.now();
  if(window.activePaysTimerInterval) clearInterval(window.activePaysTimerInterval);
  window.activePaysTimerInterval = setInterval(function() {
      var secEl = document.getElementById('pays-timer-sec');
      if(secEl) secEl.innerText = ((performance.now() - window.paysStartTime) / 1000).toFixed(2);
  }, 50);
};

window.stopPaysTimer = function(successLabel, isError) {
  if(window.activePaysTimerInterval) clearInterval(window.activePaysTimerInterval);
  var finalTime = ((performance.now() - window.paysStartTime) / 1000).toFixed(2);
  var badge = document.getElementById('pays-live-timer');
  if(badge) {
      if (isError) badge.outerHTML = '<span id="pays-live-timer" class="bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-400 font-bold px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-800 text-xs uppercase tracking-widest whitespace-nowrap shadow-sm min-w-max transition-colors">Failed</span>';
      else badge.outerHTML = '<span id="pays-live-timer" class="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-400 font-bold px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 text-xs uppercase tracking-widest whitespace-nowrap shadow-sm min-w-max transition-colors">' + successLabel + ' in ' + finalTime + 's</span>';
  }
};

window.togglePaysHeader = function() {
  var col = document.getElementById('pays-header-collapsible');
  var icon = document.getElementById('pays-header-icon');
  if (col.classList.contains('hidden')) { col.classList.remove('hidden'); icon.classList.add('rotate-180'); } 
  else { col.classList.add('hidden'); icon.classList.remove('rotate-180'); }
};

window.loadPaysData = async function () {
  var startEl = document.getElementById('pays-start');
  var endEl = document.getElementById('pays-end');
  var targetCpnEl = document.getElementById('target-pays-cpn');
  
  var start = startEl.value;
  var end = endEl.value;
  var targetCpn = targetCpnEl ? targetCpnEl.value.trim().toUpperCase() : "";

  if (!start || !end) return alert("Please select both start and end dates.");

  // SMART DATE AUTO-CORRECTION
  var dStart = new Date(start);
  var dEnd = new Date(end);
  var diffDays = Math.ceil((dEnd.getTime() - dStart.getTime()) / (1000 * 60 * 60 * 24));
  var limitDays = targetCpn ? 185 : 35; 

  if (diffDays > limitDays) {
    var correctedStart = new Date(dEnd);
    correctedStart.setDate(correctedStart.getDate() - limitDays);
    start = correctedStart.toISOString().split('T')[0];
    startEl.value = start; 
    
    var msg = targetCpn 
      ? "CPN specific searches are optimized for 6 months (185 days). Your start date was auto-adjusted." 
      : "Global searches are optimized for 1 month (35 days). Your start date was auto-adjusted.";
    if (window.showToast) window.showToast(msg, "warning"); else alert(msg);
  }

  var tb = document.getElementById('pays-tbody');
  window.startPaysTimer('Fetching');
  tb.innerHTML = "<tr><td colspan='7' class='px-6 py-12 text-center text-emerald-500 font-bold text-xl animate-pulse'>Fetching payment history...</td></tr>";
  window.paysDisplayCount = 50;

  try {
    let query = window.supabase1.from('pays').select('*').gte('payment_date', start).lte('payment_date', end);
    if (targetCpn) { query = query.eq('cpn_no', targetCpn); }
    
    const { data, error } = await query;
    if (error) throw error;

    if (!data || data.length === 0) {
       window.stopPaysTimer('Fetched', false);
       tb.innerHTML = "<tr><td colspan='7' class='px-6 py-12 text-center font-bold text-slate-400 dark:text-slate-500 text-xl'>No payments found for this criteria.</td></tr>";
       document.getElementById('rep-pays-amt').innerText = "₹0"; 
       document.getElementById('pays-tot-count').innerText = "0";
       return;
    }

    window.masterPaysData = data.map(row => ({
        cpn: (row.cpn_no || "-").toUpperCase(),
        date: window.formatPaysDate(row.payment_date),
        time: row.time_24hr || "-",
        timestamp: new Date(row.created_at || row.payment_date).getTime(),
        amt: Number(row.amount) || 0,
        mode: (row.mode || "ONLINE").toUpperCase(),
        refNo: row.ref_no || "-",
        bank: row.upi_bank || "-",
        comment: row.comment || "-",
        uniqueNo: row.unique_no || String(row.id),
        enterOn: window.formatPaysDateTime(row.created_at),
        enterBy: row.created_by || "Admin",
        entryFrom: "Supabase App"
    }));

    window.stopPaysTimer('Fetched', false);
    window.filterPaysData();

  } catch (err) {
    console.error(err);
    window.stopPaysTimer('Failed', true);
    tb.innerHTML = "<tr><td colspan='7' class='px-6 py-12 text-center font-bold text-rose-400 text-xl'>Database Error: " + err.message + "</td></tr>";
  }
};

window.filterPaysData = function() {
  var q = document.getElementById('pays-search').value.toLowerCase().trim();
  
  window.filteredPaysData = window.masterPaysData.filter(r => {
    return !q || 
           (r.cpn.toLowerCase().indexOf(q) > -1) || 
           (r.refNo.toLowerCase().indexOf(q) > -1) || 
           (r.bank.toLowerCase().indexOf(q) > -1) || 
           (r.comment.toLowerCase().indexOf(q) > -1) ||
           (r.mode.toLowerCase().indexOf(q) > -1);
  });
  
  window.paysDisplayCount = 50; 
  window.sortPays(window.paysSortCol, true);
};

window.sortPays = function(key, keepDirection) {
  if (!keepDirection) {
      if (window.paysSortCol === key) window.paysSortAsc = !window.paysSortAsc;
      else { window.paysSortCol = key; window.paysSortAsc = true; }
  }

  window.filteredPaysData.sort(function(a, b) {
    var valA = a[key] === undefined ? "" : a[key];
    var valB = b[key] === undefined ? "" : b[key];
    
    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();

    if (valA < valB) return window.paysSortAsc ? -1 : 1;
    if (valA > valB) return window.paysSortAsc ? 1 : -1;
    return 0;
  });

  window.renderPaysDOM();
};

window.renderPaysDOM = function () {
  var tb = document.getElementById('pays-tbody');
  var h = '', sumAmt = 0;
  var limit = Math.min(window.paysDisplayCount, window.filteredPaysData.length);

  for (var i = 0; i < window.filteredPaysData.length; i++) {
     sumAmt += window.filteredPaysData[i].amt;
  }

  if (window.filteredPaysData.length === 0) {
    tb.innerHTML = "<tr><td colspan='7' class='px-6 py-12 text-center font-bold text-slate-400 dark:text-slate-500 text-xl'>No matching records.</td></tr>";
  } else {
    for (var i = 0; i < limit; i++) {
      var r = window.filteredPaysData[i]; 
      
      var detailBtn = `<button onclick="window.openPaysDetails('${r.uniqueNo}')" class="text-emerald-500 dark:text-emerald-400 hover:text-emerald-400 dark:hover:text-emerald-300 hover:bg-slate-100 dark:hover:bg-slate-800 p-2 rounded-full transition-colors" title="View Details">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
      </button>`;

      var bankDisplay = (r.bank && r.bank !== "-") ? `<br><span class='text-[10px] text-slate-400 dark:text-slate-500 tracking-widest'>${r.bank}</span>` : '';
      var refDisplay = r.refNo || '-';

      h += "<tr class='hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-100 dark:border-slate-700/50'>" +
           "<td class='p-4 font-black text-emerald-600 dark:text-emerald-500 sticky left-0 z-10 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] dark:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)] text-lg transition-colors'>" + 
           "<span class='inline-flex items-center gap-1.5 px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/50 hover:shadow-sm active:scale-95 transition-all cursor-pointer group' onclick=\"window.openCustomer360('" + r.cpn + "')\">" + r.cpn + "<svg class='w-3.5 h-3.5 text-indigo-400 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path stroke-linecap='round' stroke-linejoin='round' stroke-width='3' d='M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14'></path></svg></span></td>" +
           "<td class='p-4 font-bold text-slate-600 dark:text-slate-400'>" + r.date + "<br><span class='text-[10px] font-black text-slate-400 dark:text-slate-500'>" + r.time + "</span></td>" +
           "<td class='p-4 text-center'><span class='bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1 rounded-lg text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest transition-colors'>" + r.mode + "</span></td>" +
           "<td class='p-4 text-right font-black text-emerald-600 dark:text-emerald-400 text-lg'>₹" + r.amt.toLocaleString('en-IN') + "</td>" +
           "<td class='p-4 font-bold text-indigo-700 dark:text-indigo-400 text-sm truncate max-w-[150px]'>" + refDisplay + bankDisplay + "</td>" +
           "<td class='p-4 text-sm text-slate-500 dark:text-slate-400 truncate max-w-[200px]'>" + (r.comment || '-') + "</td>" +
           "<td class='p-4 text-center'>" + detailBtn + "</td>" +
           "</tr>";
    }

    if (window.paysDisplayCount < window.filteredPaysData.length) {
      h += "<tr><td colspan='7' class='p-4 text-center'><button onclick='window.paysDisplayCount += 50; window.renderPaysDOM()' class='bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold px-6 py-3 rounded-xl hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors shadow-inner uppercase tracking-widest text-xs'>Load 50 More</button></td></tr>";
    }
    tb.innerHTML = h;
  }

  document.getElementById('pays-tot-count').innerText = window.filteredPaysData.length;
  document.getElementById('rep-pays-amt').innerText = "₹" + sumAmt.toLocaleString('en-IN');
};

window.openPaysDetails = function(uniqueNo) {
  if (typeof window.toggleScrollLock === 'function') window.toggleScrollLock(true);

  var r = window.masterPaysData.find(x => x.uniqueNo === uniqueNo);
  if(!r) return alert("Record not found.");

  var modalEl = document.getElementById('pays-details-modal');
  if (modalEl) { document.body.appendChild(modalEl); }

  document.getElementById('pays-modal-subtitle').innerText = r.cpn + " - " + r.date;

  var html = `
    <div class="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm transition-colors">
      <h4 class="text-sm font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-widest border-b border-emerald-100 dark:border-emerald-900/50 pb-2 mb-4 flex items-center justify-between">Section 1: Transaction Intelligence <span class="text-[9px] text-slate-400 dark:text-slate-500 font-bold bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded">ID: ${r.uniqueNo || '-'}</span></h4>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700/50 text-center transition-colors">
          <p class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Amount Paid</p>
          <p class="text-3xl font-black text-emerald-600 dark:text-emerald-400">₹${r.amt.toLocaleString('en-IN')}</p>
        </div>
        <div class="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700/50 text-center flex flex-col justify-center transition-colors">
          <p class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Payment Mode</p>
          <p class="text-xl font-black text-slate-700 dark:text-slate-300 uppercase">${r.mode}</p>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-4 mt-4 text-xs">
        <div class="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700/50 transition-colors"><span class="font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">Ref No</span><span class="font-bold text-slate-700 dark:text-slate-300">${r.refNo || '-'}</span></div>
        <div class="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700/50 transition-colors"><span class="font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">Bank / App</span><span class="font-bold text-slate-700 dark:text-slate-300">${r.bank || '-'}</span></div>
        <div class="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700/50 col-span-2 transition-colors"><span class="font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">Transaction Comment</span><span class="font-bold text-slate-700 dark:text-slate-300">${r.comment || '-'}</span></div>
      </div>
    </div>

    <div class="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm mt-6 transition-colors">
      <h4 class="text-sm font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest border-b border-indigo-100 dark:border-indigo-900/50 pb-2 mb-4">Section 2: Audit Trail</h4>
      <div class="grid grid-cols-2 gap-4 text-xs">
        <div class="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700/50 transition-colors"><span class="font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">Entered By</span><span class="font-bold text-slate-700 dark:text-slate-300">${r.enterBy || '-'}</span></div>
        <div class="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700/50 transition-colors"><span class="font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">Entered On</span><span class="font-bold text-slate-700 dark:text-slate-300">${r.enterOn || '-'}</span></div>
        <div class="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700/50 col-span-2 transition-colors"><span class="font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">Entry Origin</span><span class="font-bold text-slate-700 dark:text-slate-300">${r.entryFrom || '-'}</span></div>
      </div>
    </div>
  `;

  document.getElementById('pays-details-body').innerHTML = html;
  modalEl.classList.remove('hidden');
};

window.closePaysDetails = function() {
  document.getElementById('pays-details-modal').classList.add('hidden');
  if (typeof window.toggleScrollLock === 'function') window.toggleScrollLock(false);
};

window.tabActions['pays'] = function(arg) { 
  var startEl = document.getElementById('pays-start');
  var endEl = document.getElementById('pays-end');
  
  if (startEl && !startEl.value) {
    var today = new Date(); 
    var lastWeek = new Date(); 
    lastWeek.setDate(today.getDate() - 7);
    
    var offset = today.getTimezoneOffset() * 60000;
    var localToday = (new Date(today - offset)).toISOString().split('T')[0];
    var localLastWeek = (new Date(lastWeek - offset)).toISOString().split('T')[0];
    
    startEl.value = localLastWeek;
    if (endEl) endEl.value = localToday;
  }
  
  if (!arg) window.loadPaysData(); 
};