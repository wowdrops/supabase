
  window.masterSalesData = [];
  window.filteredSalesData = [];
  window.salesDisplayCount = 50;

  // Initialize Dates Safely
  var startEl = document.getElementById('sales-start');
  if (startEl) {
    var today = new Date(); var lastWeek = new Date(); lastWeek.setDate(today.getDate() - 7);
    startEl.value = lastWeek.toISOString().split('T')[0];
    var endEl = document.getElementById('sales-end');
    if (endEl) endEl.value = today.toISOString().split('T')[0];
  }

  // Timer Engine
  window.activeShTimerInterval = null;
  window.shStartTime = 0;

  window.startShTimer = function(actionLabel) {
    var timerBadge = document.getElementById('sh-live-timer');
    if (!timerBadge) return;
    timerBadge.outerHTML = '<span id="sh-live-timer" class="bg-indigo-100 text-indigo-800 font-black px-3 py-1.5 rounded-lg text-sm border-2 border-indigo-200 shadow-inner flex items-center gap-1.5 min-w-max"><svg class="w-4 h-4 animate-spin text-indigo-600" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>' + actionLabel + ': <span id="sh-timer-sec">0.00</span>s</span>';
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
        if (isError) badge.outerHTML = '<span id="sh-live-timer" class="bg-red-100 text-red-800 font-bold px-3 py-1.5 rounded-lg border border-red-200 text-xs uppercase tracking-widest whitespace-nowrap shadow-sm min-w-max">Failed</span>';
        else badge.outerHTML = '<span id="sh-live-timer" class="bg-emerald-100 text-emerald-800 font-bold px-3 py-1.5 rounded-lg border border-emerald-200 text-xs uppercase tracking-widest whitespace-nowrap shadow-sm min-w-max">' + successLabel + ' in ' + finalTime + 's</span>';
    }
  };

  window.toggleSalesHistoryHeader = function() {
    var col = document.getElementById('sh-header-collapsible');
    var icon = document.getElementById('sh-header-icon');
    if (col.classList.contains('hidden')) { col.classList.remove('hidden'); icon.classList.add('rotate-180'); } 
    else { col.classList.add('hidden'); icon.classList.remove('rotate-180'); }
  };

  window.loadSalesData = function () {
    var startEl = document.getElementById('sales-start');
    var endEl = document.getElementById('sales-end');
    var targetCpnEl = document.getElementById('target-cpn');
    
    var start = startEl.value;
    var end = endEl.value;
    var targetCpn = targetCpnEl ? targetCpnEl.value.trim().toUpperCase() : "";

    if (!start || !end) return alert("Please select both start and end dates.");

    // --- SMART DATE AUTO-CORRECTION ---
    var dStart = new Date(start);
    var dEnd = new Date(end);
    
    // Calculate difference in days
    var diffTime = dEnd.getTime() - dStart.getTime();
    var diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Define limits based on whether a CPN is targeted
    var limitDays = targetCpn ? 185 : 35; 

    if (diffDays > limitDays) {
      // Auto-correct the start date based on the end date
      var correctedStart = new Date(dEnd);
      correctedStart.setDate(correctedStart.getDate() - limitDays);
      start = correctedStart.toISOString().split('T')[0];
      startEl.value = start; // Update the UI instantly
      
      var msg = targetCpn 
        ? "CPN specific searches are optimized for 6 months (185 days). Your start date was auto-adjusted." 
        : "Global searches are optimized for 1 month (35 days). Your start date was auto-adjusted.";
      alert(msg);
    }
    // ----------------------------------

    var tb = document.getElementById('sales-tbody');
    window.startShTimer('Fetching');
    tb.innerHTML = "<tr><td colspan='9' class='px-6 py-12 text-center text-indigo-500 font-bold text-xl animate-pulse'>Fetching sales history...</td></tr>";
    window.salesDisplayCount = 50;

    // Pass the new targetCpn parameter to the backend
    google.script.run.withSuccessHandler(function (res) {
      window.stopShTimer('Fetched', !res.success);
      if (!res.success || res.data.length === 0) {
         tb.innerHTML = "<tr><td colspan='9' class='px-6 py-12 text-center font-bold text-slate-400 text-xl'>No sales found for this criteria.</td></tr>";
         document.getElementById('rep-sales-d').innerText = "0"; 
         document.getElementById('rep-sales-e').innerText = "0"; 
         document.getElementById('rep-sales-amt').innerText = "₹0"; 
         document.getElementById('sh-tot-count').innerText = "0";
         return;
      }
      window.masterSalesData = res.data;
      window.populateSalesHistoryFilters();
      window.filterSalesHistoryData();
    }).fetchSalesDetailedReport(start, end, targetCpn);
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
      
      // --- UPDATED: STRICT EXCEPTION FILTER LOGIC ---
      var matchExc = true;
      if (selExc === "EXCEPTIONS") {
        var actD = r.actD; 
        var actE = r.actE; 
        var actRep = (r.repVj || 0) + (r.repNvj || 0);
        
        var hasVariance = (r.ordD !== actD) || (r.ordE !== actE) || (r.repQty !== actRep);
        var isZeroActual = (actD === 0 && actE === 0 && actRep === 0);
        var hasExceptionNote = (r.delCmt && (r.delCmt.includes("[DEFERRED") || r.delCmt.includes("[CANCELLED")));
        
        if (!hasVariance && !isZeroActual && !hasExceptionNote) matchExc = false;
      }
      // ----------------------------------------------

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
      tb.innerHTML = "<tr><td colspan='15' class='px-6 py-12 text-center font-bold text-slate-400 text-xl'>No matching records.</td></tr>";
    } else {
      for (var i = 0; i < limit; i++) {
        var r = window.filteredSalesData[i]; 
        
        var detailBtn = `<button onclick="window.openSalesHistoryDetails('${r.uniqueNo}')" class="text-indigo-400 hover:text-indigo-300 hover:bg-slate-800 p-2 rounded-full transition" title="View Details">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
        </button>`;

        var actRepTotal = (r.repVj || 0) + (r.repNvj || 0);
        var adminName = r.delBy.includes('@') ? r.delBy.split('@')[0] : r.delBy;
        var logStr = `<p class='text-xs font-bold text-slate-700 truncate max-w-[120px]' title='${r.delBy}'>${adminName}</p><p class='text-[9px] font-black text-slate-400 tracking-widest mt-0.5'>${r.delOn}</p>`;

        var photoUI = `<div class="h-10 w-10 mx-auto bg-slate-100 border border-slate-200 border-dashed rounded-lg flex items-center justify-center text-[8px] font-bold text-slate-400 uppercase">N/A</div>`;
        if (r.doorLink && r.doorLink !== "-") {
           var imgUrl = typeof window.parseImgUrl === 'function' ? window.parseImgUrl(r.doorLink) : r.doorLink;
           photoUI = `<img src="${imgUrl}" onclick="if(typeof window.openLightbox === 'function') { window.openLightbox('${r.doorLink}'); } else { window.open('${r.doorLink}', '_blank'); }" class="h-10 w-10 mx-auto object-cover rounded-lg border border-slate-200 cursor-pointer hover:border-indigo-400 hover:scale-110 transition shadow-sm" title="View Photo">`;
        }

        h += "<tr class='hover:bg-slate-50 transition border-b border-slate-100'>" +
             "<td class='p-4 font-black text-indigo-600 sticky left-0 z-10 bg-white border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-lg'><span class='hover:underline cursor-pointer' onclick=\"window.openSh360('"+r.cpn+"')\">" + r.cpn + "</span></td>" +
             "<td class='p-4 font-bold text-slate-600 text-xs'>" + r.delDate + "</td>" +
             "<td class='p-4'><p class='text-[10px] text-slate-400 font-bold uppercase tracking-widest'>" + r.apt + "</p><p class='text-slate-800 font-black text-sm'>" + r.blk + " / " + r.door + "</p></td>" +
             "<td class='p-4'><p class='font-black text-indigo-700 text-sm max-w-[150px] truncate'>" + r.name + "</p><p class='text-[10px] text-slate-500 tracking-widest'>" + r.contact + "</p></td>" +
             "<td class='p-4 text-center'><span class='bg-slate-100 border border-slate-200 px-3 py-1 rounded text-sm font-bold text-slate-500'>" + r.ordD + "</span></td>" +
             "<td class='p-4 text-center'><span class='bg-slate-100 border border-slate-200 px-3 py-1 rounded text-sm font-bold text-slate-500'>" + r.ordE + "</span></td>" +
             "<td class='p-4 text-center'><span class='bg-slate-100 border border-slate-200 px-3 py-1 rounded text-sm font-bold text-slate-500'>" + (r.repQty || 0) + "</span></td>" +
             "<td class='p-4 text-center'><span class='bg-slate-100 border border-slate-200 px-3 py-1 rounded-lg text-base font-black text-indigo-600'>" + r.actD + "</span></td>" +
             "<td class='p-4 text-center'><span class='bg-slate-100 border border-slate-200 px-3 py-1 rounded-lg text-base font-black text-amber-600'>" + r.actE + "</span></td>" +
             "<td class='p-4 text-center'><span class='bg-slate-100 border border-slate-200 px-3 py-1 rounded-lg text-base font-black text-rose-500'>" + actRepTotal + "</span></td>" +
             "<td class='p-4 text-right text-sm'>₹" + r.rate + "</td>" +
             "<td class='p-4 text-right font-black text-emerald-600 text-lg'>₹" + r.amt.toLocaleString('en-IN') + "</td>" +
             "<td class='p-4'>" + logStr + "</td>" +
             "<td class='p-4 text-center'>" + photoUI + "</td>" +
             "<td class='p-4 text-center'>" + detailBtn + "</td>" +
             "</tr>";
      }

      if (window.salesDisplayCount < window.filteredSalesData.length) {
        h += "<tr><td colspan='15' class='p-4 text-center'><button onclick='window.salesDisplayCount += 50; window.renderSalesDOM()' class='bg-slate-200 text-slate-700 font-bold px-6 py-3 rounded-xl hover:bg-slate-300 transition shadow-inner uppercase tracking-widest text-xs'>Load 50 More</button></td></tr>";
      }
      tb.innerHTML = h;
    }

    document.getElementById('sh-tot-count').innerText = window.filteredSalesData.length;
    document.getElementById('rep-sales-d').innerText = sumD;
    document.getElementById('rep-sales-e').innerText = sumE;
    document.getElementById('rep-sales-rep').innerText = sumRep;
    document.getElementById('rep-sales-amt').innerText = "₹" + sumAmt.toLocaleString('en-IN');
  };

  // --- DETAILS MODAL ---
  window.openSalesHistoryDetails = function(uniqueNo) {
    var r = window.masterSalesData.find(x => x.uniqueNo === uniqueNo);
    if(!r) return alert("Record not found.");

    document.getElementById('sh-modal-subtitle').innerText = r.cpn + " - " + r.delDate;

    // --- NEW: LIGHTNING FAST LIGHTBOX INTEGRATION ---
    function buildPhoto(link) {
       if(!link || link === "-") return '<div class="h-20 w-20 bg-slate-100 border-2 border-slate-200 border-dashed rounded-xl flex items-center justify-center text-[9px] font-bold text-slate-400 uppercase tracking-widest">N/A</div>';
       var imgUrl = typeof window.parseImgUrl === 'function' ? window.parseImgUrl(link) : link;
       return `<img src="${imgUrl}" onclick="if(typeof window.openLightbox === 'function') { window.openLightbox('${link}'); } else { window.open('${link}', '_blank'); }" class="h-20 w-20 object-cover rounded-xl border-2 border-slate-200 cursor-pointer hover:border-indigo-400 hover:scale-105 transition shadow-sm" title="Click to view full photo">`;
    }
    // ------------------------------------------------

    var html = `
      <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <h4 class="text-sm font-black text-indigo-600 uppercase tracking-widest border-b border-indigo-100 pb-2 mb-4 flex items-center justify-between">Section 1: Delivery Intelligence <span class="text-[9px] text-slate-400 font-bold bg-slate-100 px-2 py-1 rounded">ID: ${r.uniqueNo}</span></h4>
        <div class="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div class="col-span-1 md:col-span-2 flex flex-col items-center justify-center gap-2">
            <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Door Photo</span>
            ${buildPhoto(r.doorLink)}
          </div>
          <div class="col-span-1 md:col-span-4 bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col justify-center">
            <div class="flex justify-between text-sm mb-3 pb-2 border-b border-slate-200"><span class="font-bold text-slate-500">Ordered:</span><span class="font-black text-slate-800">${r.ordD} F / ${r.ordE} E ${r.repQty > 0 ? ' <span class="text-amber-500">+' + r.repQty + ' Rep</span>' : ''}</span></div>
            <div class="flex justify-between text-sm"><span class="font-bold text-slate-500">Act Fulls:</span><span class="font-black text-indigo-600">${r.actD} <span class="text-[10px] text-slate-400 font-bold">(VJ:${r.actDVJ} / NVJ:${r.actDNVJ})</span></span></div>
            <div class="flex justify-between text-sm mt-2"><span class="font-bold text-slate-500">Act Emps:</span><span class="font-black text-amber-600">${r.actE} <span class="text-[10px] text-slate-400 font-bold">(VJ:${r.actEVJ} / NVJ:${r.actENVJ})</span></span></div>
            ${r.repQty > 0 ? '<div class="flex justify-between text-sm mt-2 pt-2 border-t border-slate-200"><span class="font-bold text-slate-500">Act Reps:</span><span class="font-black text-amber-600">' + ((r.repVj||0) + (r.repNvj||0)) + ' <span class="text-[10px] text-slate-400 font-bold">(VJ:' + (r.repVj||0) + ' / NVJ:' + (r.repNvj||0) + ')</span></span></div>' : ''}
          </div>
          <div class="col-span-1 md:col-span-6 grid grid-cols-2 gap-3 text-xs">
             <div class="bg-slate-50 p-3 rounded-xl border border-slate-100"><span class="font-black text-slate-400 uppercase tracking-widest block mb-1">Ord Comment</span><span class="font-bold text-slate-700">${r.ordCmt || '-'}</span></div>
             <div class="bg-slate-50 p-3 rounded-xl border border-slate-100"><span class="font-black text-slate-400 uppercase tracking-widest block mb-1">Del Comment</span><span class="font-bold text-slate-700">${r.delCmt || '-'}</span></div>
             <div class="bg-slate-50 p-3 rounded-xl border border-slate-100"><span class="font-black text-slate-400 uppercase tracking-widest block mb-1">Entered Order</span><span class="font-bold text-slate-700">${r.ordBy} <br><span class="text-[10px] font-normal">${r.ordOn}</span></span></div>
             <div class="bg-slate-50 p-3 rounded-xl border border-slate-100"><span class="font-black text-slate-400 uppercase tracking-widest block mb-1">Entered Delivery</span><span class="font-bold text-slate-700">${r.delBy} <br><span class="text-[10px] font-normal">${r.delOn}</span></span></div>
          </div>
        </div>
      </div>

      <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <h4 class="text-sm font-black text-rose-500 uppercase tracking-widest border-b border-rose-100 pb-2 mb-4">Section 2: QC Variance</h4>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div class="bg-slate-50 p-4 rounded-xl border border-slate-100"><p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Collected Full</p><p class="text-2xl font-black text-slate-800">${r.colFull}</p></div>
          <div class="bg-slate-50 p-4 rounded-xl border border-slate-100"><p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Variance Full</p><p class="text-2xl font-black ${r.varFull !== 0 ? 'text-rose-600' : 'text-slate-800'}">${r.varFull}</p></div>
          <div class="bg-slate-50 p-4 rounded-xl border border-slate-100"><p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Variance Empty</p><p class="text-2xl font-black ${r.varEmp !== 0 ? 'text-rose-600' : 'text-slate-800'}">${r.varEmp}</p></div>
          <div class="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col justify-center"><p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Reason</p><p class="text-sm font-bold text-slate-700">${r.varRes || 'N/A'}</p></div>
        </div>
      </div>

      <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <h4 class="text-sm font-black text-emerald-600 uppercase tracking-widest border-b border-emerald-100 pb-2 mb-4">Section 3: Block & Fleet Tracking</h4>
        <div class="grid grid-cols-1 md:grid-cols-12 gap-6">
           <div class="col-span-1 md:col-span-4 flex justify-around bg-slate-50 p-4 rounded-xl border border-slate-100">
             <div class="text-center"><span class="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Unload (V2B)</span>${buildPhoto(r.v2bLink)}</div>
             <div class="text-center"><span class="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Load (B2V)</span>${buildPhoto(r.b2vLink)}</div>
           </div>
           <div class="col-span-1 md:col-span-4 grid grid-cols-2 gap-3 text-center">
             <div class="bg-slate-50 p-3 rounded-xl border border-slate-100 flex flex-col justify-center"><span class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">V2B Fulls</span><span class="font-black text-2xl text-slate-800">${r.v2bFull}</span></div>
             <div class="bg-slate-50 p-3 rounded-xl border border-slate-100 flex flex-col justify-center"><span class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">B2V Fulls</span><span class="font-black text-2xl text-emerald-600">${r.b2vFull}</span></div>
             <div class="bg-slate-50 p-3 rounded-xl border border-slate-100 flex flex-col justify-center col-span-2"><span class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">B2V Empties</span><span class="font-black text-2xl text-amber-600">${r.b2vEmp}</span></div>
           </div>
           <div class="col-span-1 md:col-span-4 grid grid-cols-1 gap-3 text-xs">
             <div class="bg-slate-50 p-3 rounded-xl border border-slate-100 flex justify-between items-center"><span class="font-black text-slate-400 uppercase tracking-widest">Unload (V2B)</span><span class="font-bold text-right text-slate-700">${r.unloadBy}<br><span class="text-[10px] font-normal">${r.unloadOn}</span></span></div>
             <div class="bg-slate-50 p-3 rounded-xl border border-slate-100 flex justify-between items-center"><span class="font-black text-slate-400 uppercase tracking-widest">Load (B2V)</span><span class="font-bold text-right text-slate-700">${r.loadBy}<br><span class="text-[10px] font-normal">${r.loadOn}</span></span></div>
           </div>
        </div>
      </div>
    `;

    document.getElementById('sales-details-body').innerHTML = html;
    document.getElementById('sales-details-modal').classList.remove('hidden');
  };

  // --- 360 CPN NATIVE INTEGRATION ---
  window.activeSh360Timer = null;
  window.openSh360 = function(cpn) {
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

    var jobsCompleted = 0;
    var profileData = null, salesPaysData = null, historyData = null;

    function checkComplete() {
      jobsCompleted++;
      if (jobsCompleted === 3) {
        clearInterval(window.activeSh360Timer);
        document.getElementById('sh-360-timer').innerText = ((performance.now() - stTime) / 1000).toFixed(2) + "s";
        renderSh360UI(cpn, profileData, salesPaysData, historyData);
      }
    }

    google.script.run.withSuccessHandler(function(res) { profileData = res; checkComplete(); }).getProfileAndAlerts(cpn);
    google.script.run.withSuccessHandler(function(res) { salesPaysData = res; checkComplete(); }).getSalesAndPays(cpn);
    google.script.run.withSuccessHandler(function(res) { historyData = res; checkComplete(); }).getCRMHistory(cpn);
  };

  window.closeSh360 = function() {
    if(window.activeSh360Timer) clearInterval(window.activeSh360Timer);
    document.getElementById('sh-360-modal').classList.add('hidden');
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

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
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

    html += `</div></div></div>
      <div class="bg-slate-800/40 border border-slate-800 p-4 rounded-2xl">
          <h5 class="text-xs font-black uppercase tracking-widest text-slate-400 mb-3 border-b border-slate-800 pb-2">CRM Interaction Logs</h5>
          <div class="space-y-2 max-h-40 overflow-y-auto hide-scrollbar">`;

    if (historyLogs.length === 0) html += '<p class="text-xs text-slate-500 italic">No interactions logged.</p>';
    else {
      historyLogs.forEach(log => { html += `<div class="bg-slate-900/50 p-3 rounded-xl border border-slate-800/80 text-xs mb-2"><div class="flex justify-between border-b border-slate-800 pb-2 mb-2"><span class="font-black text-slate-300">${log.date} - ${log.status}</span><span class="font-bold text-slate-500">${log.lastUpdated} by ${log.actionBy}</span></div><div class="grid grid-cols-2 gap-3 mb-2"><p><span class="text-slate-500 font-bold uppercase text-[9px] tracking-widest">Change</span> <br><span class="font-black text-indigo-400">${log.prevStatus} &rarr; ${log.newStatus}</span></p><p><span class="text-slate-500 font-bold uppercase text-[9px] tracking-widest">Reason</span> <br><span class="font-bold text-slate-300">${log.reason}</span></p></div><div class="bg-slate-950 p-2 rounded-lg border border-slate-800/50"><p class="font-medium text-slate-400">${log.remark}</p></div></div>`; });
    }
    html += `</div></div>`;
    container.innerHTML = html;
  }
