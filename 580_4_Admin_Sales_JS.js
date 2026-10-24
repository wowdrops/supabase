// =====================================
// ADVANCED SALES HISTORY ENGINE (Supabase Native)
// =====================================

window.masterSalesData = [];
window.filteredSalesData = [];
window.salesDisplayCount = 50;

// Date Formatting Helpers
window.formatSalesDate = function(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return String(d.getDate()).padStart(2, '0') + "-" + months[d.getMonth()] + "-" + d.getFullYear();
};

window.formatSalesDateTime = function(isoStr) {
  if (!isoStr) return "-";
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr;
  let hours = d.getHours();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12; 
  const mins = String(d.getMinutes()).padStart(2, '0');
  return window.formatSalesDate(isoStr) + " " + String(hours).padStart(2, '0') + ":" + mins + " " + ampm;
};

window.activeShTimerInterval = null;
window.shStartTime = 0;

window.startShTimer = function(actionLabel) {
  var timerBadge = document.getElementById('sh-live-timer');
  if (!timerBadge) return;
  timerBadge.outerHTML = '<span id="sh-live-timer" class="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-300 font-black px-3 py-1.5 rounded-lg text-sm border-2 border-indigo-200 dark:border-indigo-800 shadow-inner flex items-center gap-1.5 min-w-max transition-colors"><svg class="w-4 h-4 animate-spin text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>' + actionLabel + ': <span id="sh-timer-sec">0.00</span>s</span>';
  document.getElementById('sh-live-timer').classList.remove('hidden');
  window.shStartTime = performance.now();
  if(window.activeShTimerInterval) clearInterval(window.activeShTimerInterval);
  window.activeShTimerInterval = setInterval(function() {
      var secEl = document.getElementById('sh-timer-sec');
      if(secEl) secEl.innerText = ((performance.now() - window.shStartTime) / 1000).toFixed(2);
  }, 50);
};

window.stopShTimer = function(successLabel, isError) {
  if(window.activeShTimerInterval) clearInterval(window.activeShTimerInterval);
  var finalTime = ((performance.now() - window.shStartTime) / 1000).toFixed(2);
  var badge = document.getElementById('sh-live-timer');
  if(badge) {
      if (isError) badge.outerHTML = '<span id="sh-live-timer" class="bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-400 font-bold px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-800 text-xs uppercase tracking-widest whitespace-nowrap shadow-sm min-w-max transition-colors">Failed</span>';
      else badge.outerHTML = '<span id="sh-live-timer" class="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-400 font-bold px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 text-xs uppercase tracking-widest whitespace-nowrap shadow-sm min-w-max transition-colors">' + successLabel + ' in ' + finalTime + 's</span>';
  }
};

window.toggleSalesHistoryHeader = function() {
  var col = document.getElementById('sh-header-collapsible');
  var icon = document.getElementById('sh-header-icon');
  if (col.classList.contains('hidden')) { col.classList.remove('hidden'); icon.classList.add('rotate-180'); } 
  else { col.classList.add('hidden'); icon.classList.remove('rotate-180'); }
};

window.loadSalesData = async function () {
  var startEl = document.getElementById('sales-start');
  var endEl = document.getElementById('sales-end');
  var targetCpnEl = document.getElementById('target-cpn');
  
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

  var tb = document.getElementById('sales-tbody');
  window.startShTimer('Fetching');
  tb.innerHTML = "<tr><td colspan='15' class='px-6 py-12 text-center text-indigo-500 font-bold text-xl animate-pulse'>Fetching sales history...</td></tr>";
  window.salesDisplayCount = 50;

  try {
    let query = window.supabase1.from('sales').select('*').gte('del_date', start).lte('del_date', end).order('del_date', { ascending: false });
    if (targetCpn) query = query.eq('cpn_no', targetCpn);
    const { data: salesData, error: salesErr } = await query;
    if (salesErr) throw salesErr;

    if (!salesData || salesData.length === 0) {
       window.stopShTimer('Fetched', false);
       tb.innerHTML = "<tr><td colspan='15' class='px-6 py-12 text-center font-bold text-slate-400 dark:text-slate-500 text-xl'>No sales found for this criteria.</td></tr>";
       ['rep-sales-d','rep-sales-e','rep-sales-rep','sh-tot-count'].forEach(id => document.getElementById(id).innerText = "0");
       document.getElementById('rep-sales-amt').innerText = "₹0";
       return;
    }

    const uniqueCpns = [...new Set(salesData.map(r => r.cpn_no))].filter(Boolean);
    const { data: custData, error: custErr } = await window.supabase1.from('ac_customers')
      .select('cpn_no, apartment, block, door, poc1, con1, final_status')
      .in('cpn_no', uniqueCpns);
    if (custErr) throw custErr;

    let custMap = {};
    (custData || []).forEach(c => custMap[c.cpn_no] = c);

    window.masterSalesData = salesData.map(row => {
      let prof = custMap[row.cpn_no] || {};
      return {
        uniqueNo: row.unique_no || String(row.id),
        cpn: (row.cpn_no || "-").toUpperCase(),
        delDate: window.formatSalesDate(row.del_date),
        apt: prof.apartment || "-",
        blk: prof.block || "-",
        door: prof.door || "-",
        name: prof.poc1 || "Unknown",
        contact: prof.con1 || "-",
        status: prof.final_status || "UNKNOWN",
        ordD: Number(row.ord_d) || 0,
        ordE: Number(row.ord_e) || 0,
        actD: Number(row.act_d) || 0,
        actE: Number(row.act_e) || 0,
        actDVJ: Number(row.act_d_vj) || 0,
        actDNVJ: Number(row.act_d_nvj) || 0,
        actEVJ: Number(row.act_e_vj) || 0,
        actENVJ: Number(row.act_e_nvj) || 0,
        repQty: Number(row.rep_qty) || 0,
        repVj: Number(row.rep_act_vj) || 0,
        repNvj: Number(row.rep_act_nvj) || 0,
        rate: Number(row.rate) || 0,
        amt: Number(row.amount) || 0,
        ordCmt: row.ord_comment || "",
        delCmt: row.delivery_comment || "",
        ordBy: row.order_entered_by || "-",
        ordOn: window.formatSalesDateTime(row.order_entered_at),
        delBy: row.delivery_entered_by || "-",
        delOn: window.formatSalesDateTime(row.delivery_entered_at),
        doorLink: row.door_delivery_link || "-",
        colFull: Number(row.collected_full) || 0,
        varFull: Number(row.variance_full) || 0,
        varEmp: Number(row.variance_empty) || 0,
        varRes: row.variance_reason || "",
        v2bLink: row.v2b_link || "-",
        b2vLink: row.b2v_link || "-",
        v2bFull: Number(row.v2b_full) || 0,
        b2vFull: Number(row.b2v_full) || 0,
        b2vEmp: Number(row.b2v_emp) || 0,
        unloadBy: row.unload_by || "-",
        unloadOn: window.formatSalesDateTime(row.unload_on),
        loadBy: row.load_by || "-",
        loadOn: window.formatSalesDateTime(row.load_on)
      };
    });

    window.stopShTimer('Fetched', false);
    window.populateSalesHistoryFilters();
    window.filterSalesHistoryData();

  } catch (err) {
    console.error(err);
    window.stopShTimer('Failed', true);
    tb.innerHTML = "<tr><td colspan='15' class='px-6 py-12 text-center font-bold text-rose-400 text-xl'>Database Error: " + err.message + "</td></tr>";
  }
};

window.populateSalesHistoryFilters = function() {
  var aptSelect = document.getElementById('sh-flt-apt');
  var apts = window.getUniqueArray(window.masterSalesData.map(r => r.apt)).sort();
  aptSelect.innerHTML = '<option value="ALL">ALL APARTMENTS</option>';
  apts.forEach(a => { if(a && a!=="-") aptSelect.innerHTML += '<option value="'+a+'">'+a+'</option>'; });
  window.updateSalesHistoryBlockDropdown();
};

window.updateSalesHistoryBlockDropdown = function() {
  var selApt = document.getElementById('sh-flt-apt').value;
  var blkSelect = document.getElementById('sh-flt-blk');
  var filteredForBlk = selApt === "ALL" ? window.masterSalesData : window.masterSalesData.filter(r => r.apt === selApt);
  var blks = window.getUniqueArray(filteredForBlk.map(r => r.blk)).sort();
  blkSelect.innerHTML = '<option value="ALL">ALL BLOCKS</option>';
  blks.forEach(b => { if(b && b!=="-") blkSelect.innerHTML += '<option value="'+b+'">'+b+'</option>'; });
  window.filterSalesHistoryData();
};

window.filterSalesHistoryData = function() {
  var q = document.getElementById('sh-search').value.toLowerCase().trim();
  var selApt = document.getElementById('sh-flt-apt').value;
  var selBlk = document.getElementById('sh-flt-blk').value;
  var selExc = document.getElementById('sh-flt-exc') ? document.getElementById('sh-flt-exc').value : "ALL";

  window.filteredSalesData = window.masterSalesData.filter(r => {
    var matchQ = !q || (r.cpn.toLowerCase().indexOf(q) > -1 || r.name.toLowerCase().indexOf(q) > -1 || r.contact.indexOf(q) > -1 || r.apt.toLowerCase().indexOf(q) > -1 || r.blk.toLowerCase().indexOf(q) > -1 || r.door.toLowerCase().indexOf(q) > -1);
    var matchApt = (selApt === "ALL" || r.apt === selApt);
    var matchBlk = (selBlk === "ALL" || r.blk === selBlk);
    
    var matchExc = true;
    if (selExc === "EXCEPTIONS") {
      var actD = r.actD; var actE = r.actE; var actRep = (r.repVj || 0) + (r.repNvj || 0);
      var hasVariance = (r.ordD !== actD) || (r.ordE !== actE) || (r.repQty !== actRep);
      var isZeroActual = (actD === 0 && actE === 0 && actRep === 0);
      var hasExceptionNote = (r.delCmt && (r.delCmt.includes("[DEFERRED") || r.delCmt.includes("[CANCELLED")));
      if (!hasVariance && !isZeroActual && !hasExceptionNote) matchExc = false;
    }
    return matchQ && matchApt && matchBlk && matchExc;
  });
  window.salesDisplayCount = 50; 
  window.renderSalesDOM();
};

window.renderSalesDOM = function () {
  var tb = document.getElementById('sales-tbody');
  var h = '', sumD = 0, sumE = 0, sumRep = 0, sumAmt = 0;
  var limit = Math.min(window.salesDisplayCount, window.filteredSalesData.length);

  for (var i = 0; i < window.filteredSalesData.length; i++) {
     sumD += window.filteredSalesData[i].actD; 
     sumE += window.filteredSalesData[i].actE; 
     sumRep += (window.filteredSalesData[i].repVj || 0) + (window.filteredSalesData[i].repNvj || 0);
     sumAmt += window.filteredSalesData[i].amt;
  }

  if (window.filteredSalesData.length === 0) {
    tb.innerHTML = "<tr><td colspan='15' class='px-6 py-12 text-center font-bold text-slate-400 dark:text-slate-500 text-xl'>No matching records.</td></tr>";
  } else {
    for (var i = 0; i < limit; i++) {
      var r = window.filteredSalesData[i]; 
      
      var detailBtn = `<button onclick="window.openSalesHistoryDetails('${r.uniqueNo}')" class="text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 hover:bg-slate-100 dark:hover:bg-slate-800 p-2 rounded-full transition-colors" title="View Details">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
      </button>`;

      var actRepTotal = (r.repVj || 0) + (r.repNvj || 0);
      var adminName = r.delBy.includes('@') ? r.delBy.split('@')[0] : r.delBy;
      var logStr = `<p class='text-xs font-bold text-slate-700 dark:text-slate-300 truncate max-w-[120px]' title='${r.delBy}'>${adminName}</p><p class='text-[9px] font-black text-slate-400 dark:text-slate-500 tracking-widest mt-0.5'>${r.delOn}</p>`;

      var photoUI = `<div class="h-10 w-10 mx-auto bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 border-dashed rounded-lg flex items-center justify-center text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase transition-colors">N/A</div>`;
      if (r.doorLink && r.doorLink !== "-") {
         var imgUrl = typeof window.parseImgUrl === 'function' ? window.parseImgUrl(r.doorLink) : r.doorLink;
         photoUI = `<img src="${imgUrl}" onclick="if(typeof window.openLightbox === 'function') { window.openLightbox('${r.doorLink}'); } else { window.open('${r.doorLink}', '_blank'); }" class="h-10 w-10 mx-auto object-cover rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-500 hover:scale-110 transition shadow-sm" title="View Photo">`;
      }

      h += "<tr class='hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-100 dark:border-slate-700/50'>" +
           "<td class='p-4 font-black text-indigo-600 dark:text-indigo-400 sticky left-0 z-10 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] dark:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)] text-lg transition-colors'>" + 
           "<span class='inline-flex items-center gap-1.5 px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/50 hover:shadow-sm active:scale-95 transition-all cursor-pointer group' onclick=\"window.openCustomer360('" + r.cpn + "')\">" + r.cpn + "<svg class='w-3.5 h-3.5 text-indigo-400 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path stroke-linecap='round' stroke-linejoin='round' stroke-width='3' d='M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14'></path></svg></span></td>" +
           "<td class='p-4 font-bold text-slate-600 dark:text-slate-400 text-xs'>" + r.delDate + "</td>" +
           "<td class='p-4'><p class='text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest'>" + r.apt + "</p><p class='text-slate-800 dark:text-white font-black text-sm'>" + r.blk + " / " + r.door + "</p></td>" +
           "<td class='p-4'><p class='font-black text-indigo-700 dark:text-indigo-400 text-sm max-w-[150px] truncate'>" + r.name + "</p><p class='text-[10px] text-slate-500 dark:text-slate-400 tracking-widest'>" + r.contact + "</p></td>" +
           "<td class='p-4 text-center'><span class='bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1 rounded text-sm font-bold text-slate-500 dark:text-slate-400 transition-colors'>" + r.ordD + "</span></td>" +
           "<td class='p-4 text-center'><span class='bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1 rounded text-sm font-bold text-slate-500 dark:text-slate-400 transition-colors'>" + r.ordE + "</span></td>" +
           "<td class='p-4 text-center'><span class='bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1 rounded text-sm font-bold text-slate-500 dark:text-slate-400 transition-colors'>" + r.repQty + "</span></td>" +
           "<td class='p-4 text-center'><span class='bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1 rounded-lg text-base font-black text-indigo-600 dark:text-indigo-400 transition-colors'>" + r.actD + "</span></td>" +
           "<td class='p-4 text-center'><span class='bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1 rounded-lg text-base font-black text-amber-600 dark:text-amber-500 transition-colors'>" + r.actE + "</span></td>" +
           "<td class='p-4 text-center'><span class='bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1 rounded-lg text-base font-black text-rose-500 dark:text-rose-400 transition-colors'>" + actRepTotal + "</span></td>" +
           "<td class='p-4 text-right text-sm'>₹" + r.rate + "</td>" +
           "<td class='p-4 text-right font-black text-emerald-600 dark:text-emerald-400 text-lg'>₹" + r.amt.toLocaleString('en-IN') + "</td>" +
           "<td class='p-4'>" + logStr + "</td>" +
           "<td class='p-4 text-center'>" + photoUI + "</td>" +
           "<td class='p-4 text-center'>" + detailBtn + "</td>" +
           "</tr>";
    }

    if (window.salesDisplayCount < window.filteredSalesData.length) {
      h += "<tr><td colspan='15' class='p-4 text-center'><button onclick='window.salesDisplayCount += 50; window.renderSalesDOM()' class='bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold px-6 py-3 rounded-xl hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors shadow-inner uppercase tracking-widest text-xs'>Load 50 More</button></td></tr>";
    }
    tb.innerHTML = h;
  }

  document.getElementById('sh-tot-count').innerText = window.filteredSalesData.length;
  document.getElementById('rep-sales-d').innerText = sumD;
  document.getElementById('rep-sales-e').innerText = sumE;
  document.getElementById('rep-sales-rep').innerText = sumRep;
  document.getElementById('rep-sales-amt').innerText = "₹" + sumAmt.toLocaleString('en-IN');
};

window.openSalesHistoryDetails = function(uniqueNo) {
  if (typeof window.toggleScrollLock === 'function') window.toggleScrollLock(true);

  var r = window.masterSalesData.find(x => x.uniqueNo === uniqueNo);
  if(!r) return alert("Record not found.");

  document.getElementById('sh-modal-subtitle').innerText = r.cpn + " - " + r.delDate;

  function buildPhoto(link) {
     if(!link || link === "-") return '<div class="h-20 w-20 bg-slate-100 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 border-dashed rounded-xl flex items-center justify-center text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest transition-colors">N/A</div>';
     var imgUrl = typeof window.parseImgUrl === 'function' ? window.parseImgUrl(link) : link;
     return `<img src="${imgUrl}" onclick="if(typeof window.openLightbox === 'function') { window.openLightbox('${link}'); } else { window.open('${link}', '_blank'); }" class="h-20 w-20 object-cover rounded-xl border-2 border-slate-200 dark:border-slate-700 cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-500 hover:scale-105 transition shadow-sm" title="Click to view full photo">`;
  }

  var html = `
    <div class="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm transition-colors">
      <h4 class="text-sm font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest border-b border-indigo-100 dark:border-indigo-900/50 pb-2 mb-4 flex items-center justify-between">Section 1: Delivery Intelligence <span class="text-[9px] text-slate-400 dark:text-slate-500 font-bold bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded">ID: ${r.uniqueNo}</span></h4>
      <div class="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div class="col-span-1 md:col-span-2 flex flex-col items-center justify-center gap-2">
          <span class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Door Photo</span>
          ${buildPhoto(r.doorLink)}
        </div>
        <div class="col-span-1 md:col-span-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700/50 flex flex-col justify-center transition-colors">
          <div class="flex justify-between text-sm mb-3 pb-2 border-b border-slate-200 dark:border-slate-700/50"><span class="font-bold text-slate-500 dark:text-slate-400">Ordered:</span><span class="font-black text-slate-800 dark:text-slate-200">${r.ordD} F / ${r.ordE} E ${r.repQty > 0 ? ' <span class="text-amber-500 dark:text-amber-400">+' + r.repQty + ' Rep</span>' : ''}</span></div>
          <div class="flex justify-between text-sm"><span class="font-bold text-slate-500 dark:text-slate-400">Act Fulls:</span><span class="font-black text-indigo-600 dark:text-indigo-400">${r.actD} <span class="text-[10px] text-slate-400 dark:text-slate-500 font-bold">(VJ:${r.actDVJ} / NVJ:${r.actDNVJ})</span></span></div>
          <div class="flex justify-between text-sm mt-2"><span class="font-bold text-slate-500 dark:text-slate-400">Act Emps:</span><span class="font-black text-amber-600 dark:text-amber-500">${r.actE} <span class="text-[10px] text-slate-400 dark:text-slate-500 font-bold">(VJ:${r.actEVJ} / NVJ:${r.actENVJ})</span></span></div>
          ${r.repQty > 0 ? '<div class="flex justify-between text-sm mt-2 pt-2 border-t border-slate-200 dark:border-slate-700/50"><span class="font-bold text-slate-500 dark:text-slate-400">Act Reps:</span><span class="font-black text-amber-600 dark:text-amber-500">' + ((r.repVj||0) + (r.repNvj||0)) + ' <span class="text-[10px] text-slate-400 dark:text-slate-500 font-bold">(VJ:' + (r.repVj||0) + ' / NVJ:' + (r.repNvj||0) + ')</span></span></div>' : ''}
        </div>
        <div class="col-span-1 md:col-span-6 grid grid-cols-2 gap-3 text-xs">
           <div class="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700/50 transition-colors"><span class="font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">Ord Comment</span><span class="font-bold text-slate-700 dark:text-slate-300">${r.ordCmt || '-'}</span></div>
           <div class="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700/50 transition-colors"><span class="font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">Del Comment</span><span class="font-bold text-slate-700 dark:text-slate-300">${r.delCmt || '-'}</span></div>
           <div class="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700/50 transition-colors"><span class="font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">Entered Order</span><span class="font-bold text-slate-700 dark:text-slate-300">${r.ordBy} <br><span class="text-[10px] font-normal text-slate-500">${r.ordOn}</span></span></div>
           <div class="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700/50 transition-colors"><span class="font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">Entered Delivery</span><span class="font-bold text-slate-700 dark:text-slate-300">${r.delBy} <br><span class="text-[10px] font-normal text-slate-500">${r.delOn}</span></span></div>
        </div>
      </div>
    </div>

    <div class="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm mt-4 transition-colors">
      <h4 class="text-sm font-black text-rose-500 dark:text-rose-400 uppercase tracking-widest border-b border-rose-100 dark:border-rose-900/50 pb-2 mb-4">Section 2: QC Variance</h4>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
        <div class="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700/50 transition-colors"><p class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Collected Full</p><p class="text-2xl font-black text-slate-800 dark:text-slate-200">${r.colFull}</p></div>
        <div class="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700/50 transition-colors"><p class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Variance Full</p><p class="text-2xl font-black ${r.varFull !== 0 ? 'text-rose-600 dark:text-rose-500' : 'text-slate-800 dark:text-slate-200'}">${r.varFull}</p></div>
        <div class="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700/50 transition-colors"><p class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Variance Empty</p><p class="text-2xl font-black ${r.varEmp !== 0 ? 'text-rose-600 dark:text-rose-500' : 'text-slate-800 dark:text-slate-200'}">${r.varEmp}</p></div>
        <div class="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700/50 flex flex-col justify-center transition-colors"><p class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Reason</p><p class="text-sm font-bold text-slate-700 dark:text-slate-300">${r.varRes || 'N/A'}</p></div>
      </div>
    </div>

    <div class="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm mt-4 transition-colors">
      <h4 class="text-sm font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-widest border-b border-emerald-100 dark:border-emerald-900/50 pb-2 mb-4">Section 3: Block & Fleet Tracking</h4>
      <div class="grid grid-cols-1 md:grid-cols-12 gap-6">
         <div class="col-span-1 md:col-span-4 flex justify-around bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700/50 transition-colors">
           <div class="text-center"><span class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-2">Unload (V2B)</span>${buildPhoto(r.v2bLink)}</div>
           <div class="text-center"><span class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-2">Load (B2V)</span>${buildPhoto(r.b2vLink)}</div>
         </div>
         <div class="col-span-1 md:col-span-4 grid grid-cols-2 gap-3 text-center">
           <div class="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700/50 flex flex-col justify-center transition-colors"><span class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">V2B Fulls</span><span class="font-black text-2xl text-slate-800 dark:text-slate-200">${r.v2bFull}</span></div>
           <div class="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700/50 flex flex-col justify-center transition-colors"><span class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">B2V Fulls</span><span class="font-black text-2xl text-emerald-600 dark:text-emerald-400">${r.b2vFull}</span></div>
           <div class="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700/50 flex flex-col justify-center col-span-2 transition-colors"><span class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">B2V Empties</span><span class="font-black text-2xl text-amber-600 dark:text-amber-500">${r.b2vEmp}</span></div>
         </div>
         <div class="col-span-1 md:col-span-4 grid grid-cols-1 gap-3 text-xs">
           <div class="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700/50 flex justify-between items-center transition-colors"><span class="font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Unload (V2B)</span><span class="font-bold text-right text-slate-700 dark:text-slate-300">${r.unloadBy}<br><span class="text-[10px] font-normal text-slate-500">${r.unloadOn}</span></span></div>
           <div class="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700/50 flex justify-between items-center transition-colors"><span class="font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Load (B2V)</span><span class="font-bold text-right text-slate-700 dark:text-slate-300">${r.loadBy}<br><span class="text-[10px] font-normal text-slate-500">${r.loadOn}</span></span></div>
         </div>
      </div>
    </div>
  `;

  document.getElementById('sales-details-body').innerHTML = html;
  document.getElementById('sales-details-modal').classList.remove('hidden');
};

window.closeSalesHistoryDetails = function() {
  document.getElementById('sales-details-modal').classList.add('hidden');
  if (typeof window.toggleScrollLock === 'function') window.toggleScrollLock(false);
};

// --- 360 CPN NATIVE SUPABASE INTEGRATION ---
window.activeSh360Timer = null;
window.openSh360 = async function(cpn) {
  if (typeof window.toggleScrollLock === 'function') window.toggleScrollLock(true);
  document.getElementById('sh-360-modal').classList.remove('hidden');
  var container = document.getElementById('sh-360-content');

  container.innerHTML = `
    <div class="p-6 bg-slate-800/40 border border-slate-800 rounded-2xl animate-pulse h-32"></div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="p-6 bg-slate-800/40 border border-slate-800 rounded-2xl animate-pulse h-40"></div>
      <div class="p-6 bg-slate-800/40 border border-slate-800 rounded-2xl animate-pulse h-40"></div>
    </div>
    <div class="p-6 bg-slate-800/40 border border-slate-800 rounded-2xl animate-pulse h-48"></div>
  `;

  var stTime = performance.now();
  if(window.activeSh360Timer) clearInterval(window.activeSh360Timer);
  window.activeSh360Timer = setInterval(function() {
    var badge = document.getElementById('sh-360-timer');
    if(badge) badge.innerText = ((performance.now() - stTime) / 1000).toFixed(2) + "s";
  }, 50);

  try {
    const [profRes, salesRes, paysRes] = await Promise.all([
      window.supabase1.from('ac_customers').select('*').eq('cpn_no', cpn).maybeSingle(),
      window.supabase1.from('sales').select('del_date, act_d, act_e, amount').eq('cpn_no', cpn).order('del_date', {ascending: false}).limit(5),
      window.supabase1.from('pays').select('payment_date, mode, amount').eq('cpn_no', cpn).order('payment_date', {ascending: false}).limit(5)
    ]);

    if (profRes.error) throw profRes.error;

    const pData = profRes.data || null;
    const profile = pData ? {
        name: pData.poc1, apt: pData.apartment, blk: pData.block, door: pData.door, 
        phone: pData.con1, status: pData.final_status, rate: pData.default_rate
    } : null;

    const liveData = pData ? { outstanding: Number(pData.os) || 0 } : { outstanding: 0 };
    
    const salesArr = (salesRes.data || []).map(s => ({
        date: window.formatSalesDate(s.del_date), actD: s.act_d, actE: s.act_e, amt: s.amount
    }));
    
    const paysArr = (paysRes.data || []).map(p => ({
        date: window.formatSalesDate(p.payment_date), mode: p.mode, amt: p.amount
    }));

    clearInterval(window.activeSh360Timer);
    document.getElementById('sh-360-timer').innerText = ((performance.now() - stTime) / 1000).toFixed(2) + "s";
    renderSh360UI(cpn, {profile, liveData}, {sales: salesArr, pays: paysArr}, []);

  } catch(err) {
    console.error(err);
    clearInterval(window.activeSh360Timer);
    container.innerHTML = '<p class="text-center text-rose-400 font-bold py-12">Error loading 360 view: ' + err.message + '</p>';
  }
};

window.closeSh360 = function() {
  if(window.activeSh360Timer) clearInterval(window.activeSh360Timer);
  document.getElementById('sh-360-modal').classList.add('hidden');
  if (typeof window.toggleScrollLock === 'function') window.toggleScrollLock(false);
};

function renderSh360UI(cpn, resProfile, resSalesPays, historyLogs) {
  var p = resProfile.profile;
  var container = document.getElementById('sh-360-content');
  
  if (!p) { container.innerHTML = '<p class="text-center text-rose-400 font-bold py-12">Profile missing for CPN: ' + cpn + '</p>'; return; }

  var html = `
    <div class="bg-slate-800/60 border border-slate-700/60 p-5 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div>
        <div class="flex items-center gap-3 mb-2">
           <span class="bg-indigo-900 text-indigo-300 font-black px-2.5 py-1 rounded-md text-xs">${cpn}</span>
           <span class="bg-slate-900 border border-slate-700 text-slate-300 font-black px-2.5 py-1 rounded-md text-xs uppercase tracking-widest">${p.status}</span>
        </div>
        <h4 class="text-2xl font-black text-white">${p.name}</h4>
        <p class="text-sm font-bold text-slate-400 mt-0.5">${p.apt} &bull; Block ${p.blk} &bull; Door ${p.door} &bull; Ph: ${p.phone}</p>
      </div>
      <div class="flex gap-4">
        <div class="bg-slate-900/80 border border-slate-800 p-3 rounded-xl text-right">
          <p class="text-[10px] uppercase font-black text-slate-500">Outstanding</p>
          <p class="text-lg font-black ${resProfile.liveData.outstanding > 0 ? 'text-rose-400' : 'text-emerald-400'}">₹${resProfile.liveData.outstanding.toLocaleString('en-IN')}</p>
        </div>
        <div class="bg-slate-900/80 border border-slate-800 p-3 rounded-xl text-right">
          <p class="text-[10px] uppercase font-black text-slate-500">Default Rate</p>
          <p class="text-lg font-black text-indigo-300">₹${p.rate}</p>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
      <div class="bg-slate-800/40 border border-slate-800 p-4 rounded-2xl">
        <h5 class="text-xs font-black uppercase tracking-widest text-slate-400 mb-3 border-b border-slate-800 pb-2">Recent Deliveries (Sales)</h5>
        <div class="space-y-2">`;
  
  if (resSalesPays.sales.length === 0) html += '<p class="text-xs text-slate-500 italic">No recent sales records.</p>';
  else {
    resSalesPays.sales.forEach(s => { html += `<div class="flex justify-between items-center bg-slate-900/50 p-2.5 rounded-xl border border-slate-800/80 text-xs"><div><span class="font-black text-slate-200">${s.date}</span> <span class="text-slate-400 ml-2">(${s.actD} Full / ${s.actE} Emp)</span></div><span class="font-black text-emerald-400">₹${s.amt}</span></div>`; });
  }

  html += `</div></div><div class="bg-slate-800/40 border border-slate-800 p-4 rounded-2xl"><h5 class="text-xs font-black uppercase tracking-widest text-slate-400 mb-3 border-b border-slate-800 pb-2">Payment History</h5><div class="space-y-2">`;

  if (resSalesPays.pays.length === 0) html += '<p class="text-xs text-slate-500 italic">No recent payments.</p>';
  else {
    resSalesPays.pays.forEach(pay => { html += `<div class="flex justify-between items-center bg-slate-900/50 p-2.5 rounded-xl border border-slate-800/80 text-xs"><div><span class="font-black text-slate-200">${pay.date}</span> <span class="bg-slate-800 px-1.5 py-0.5 rounded text-[9px] text-indigo-300 uppercase ml-2">${pay.mode}</span></div><span class="font-black text-emerald-400">₹${pay.amt}</span></div>`; });
  }

  html += `</div></div></div>`;
  container.innerHTML = html;
}

window.tabActions['sales'] = function(arg) { 
    // Safely set default dates every time the tab is opened
    var startEl = document.getElementById('sales-start');
    var endEl = document.getElementById('sales-end');
    
    if (startEl && !startEl.value) {
      var today = new Date(); 
      var lastWeek = new Date(); 
      lastWeek.setDate(today.getDate() - 7);
      
      // Adjust to local timezone to prevent date shifting
      var offset = today.getTimezoneOffset() * 60000;
      var localToday = (new Date(today - offset)).toISOString().split('T')[0];
      var localLastWeek = (new Date(lastWeek - offset)).toISOString().split('T')[0];
      
      startEl.value = localLastWeek;
      if (endEl) endEl.value = localToday;
    }
    
    if (!arg) window.loadSalesData(); 
  };