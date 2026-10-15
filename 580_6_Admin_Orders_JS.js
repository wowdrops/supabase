
  window.activeLiveOrdTimerInterval = null;
  window.liveOrdStartTime = 0;

  window.startLiveOrdTimer = function(actionLabel) {
    var timerBadge = document.getElementById('liveord-live-timer');
    if (!timerBadge) return;
    timerBadge.outerHTML = '<span id="liveord-live-timer" class="bg-blue-100 text-blue-800 font-black px-3 py-1.5 rounded-lg text-sm border-2 border-blue-200 shadow-inner flex items-center gap-1.5 min-w-max"><svg class="w-4 h-4 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>' + actionLabel + ': <span id="liveord-timer-sec">0.00</span>s</span>';
    document.getElementById('liveord-live-timer').classList.remove('hidden');
    window.liveOrdStartTime = performance.now();
    if(window.activeLiveOrdTimerInterval) clearInterval(window.activeLiveOrdTimerInterval);
    window.activeLiveOrdTimerInterval = setInterval(function() {
        var curr = ((performance.now() - window.liveOrdStartTime) / 1000).toFixed(2);
        var secEl = document.getElementById('liveord-timer-sec');
        if(secEl) secEl.innerText = curr;
    }, 50);
  };

  window.stopLiveOrdTimer = function(successLabel, isError) {
    if(window.activeLiveOrdTimerInterval) clearInterval(window.activeLiveOrdTimerInterval);
    var finalTime = ((performance.now() - window.liveOrdStartTime) / 1000).toFixed(2);
    var badge = document.getElementById('liveord-live-timer');
    if(badge) {
        if (isError) badge.outerHTML = '<span id="liveord-live-timer" class="bg-red-100 text-red-800 font-bold px-3 py-1.5 rounded-lg border border-red-200 text-xs uppercase tracking-widest whitespace-nowrap shadow-sm min-w-max">Failed</span>';
        else badge.outerHTML = '<span id="liveord-live-timer" class="bg-emerald-100 text-emerald-800 font-bold px-3 py-1.5 rounded-lg border border-emerald-200 text-xs uppercase tracking-widest whitespace-nowrap shadow-sm min-w-max">' + successLabel + ' in ' + finalTime + 's</span>';
    }
  };

  window.toggleLiveOrdHeader = function() {
    var col = document.getElementById('liveord-header-collapsible');
    var icon = document.getElementById('liveord-header-icon');
    if (col.classList.contains('hidden')) { col.classList.remove('hidden'); icon.classList.add('rotate-180'); } 
    else { col.classList.add('hidden'); icon.classList.remove('rotate-180'); }
  };

  function buildTBody(id, text) { var tb = document.getElementById(id); tb.innerHTML = "<tr><td colspan='7' class='px-6 py-12 text-center text-slate-400 font-bold text-xl animate-pulse'>" + text + "</td></tr>"; return tb; }

  window.loadOrdersData = function () {
    window.startLiveOrdTimer('Syncing');
    var tb = buildTBody('orders-tbody', "Syncing live orders...");
    
    google.script.run.withSuccessHandler(function (res) {
      window.stopLiveOrdTimer('Loaded', !res.success);
      if (!res.success || res.data.length === 0) return tb.innerHTML = "<tr><td colspan='7' class='px-6 py-12 text-center font-bold text-slate-400 text-xl'>No live orders found.</td></tr>";
      
      var h = '';
      var totD = 0, totE = 0, totP = 0, totR = 0, totAmt = 0;

      for (var i = 0; i < res.data.length; i++) {
        var r = res.data[i];
        totD += r.ordD; totE += r.ordE; totP += r.pend; totR += r.rep; totAmt += r.amt;
        
        let reasonStr = r.repReason ? `<br><span class="text-[9px] text-rose-500 font-bold uppercase tracking-widest">${r.repReason}</span>` : '';

        h += `<tr class='hover:bg-slate-50 transition border-b border-slate-100'>
          <td class='px-6 py-4 font-bold text-slate-500 text-sm'>${r.date}</td>
          <td class='px-6 py-4 font-black text-slate-800 text-lg'>${r.name} <p class='text-[10px] font-bold tracking-widest uppercase text-blue-600'>${r.cpn}</p></td>
          <td class='px-6 py-4 text-center font-black text-xl'>
            <span class="bg-slate-100 border border-slate-200 px-3 py-1 rounded-lg text-slate-700">${r.ordD}</span>
          </td>
          <td class='px-6 py-4 text-center font-black text-xl'>
            <span class="bg-slate-100 border border-slate-200 px-3 py-1 rounded-lg text-slate-700">${r.ordE}</span>
          </td>
          <td class='px-6 py-4 text-center font-black text-xl'>
            <span class="bg-amber-50 border border-amber-200 px-3 py-1 rounded-lg text-amber-700">${r.pend}</span>
          </td>
          <td class='px-6 py-4 text-center font-black text-xl leading-tight'>
            <span class="bg-rose-50 border border-rose-200 px-3 py-1 rounded-lg text-rose-700">${r.rep}</span>${reasonStr}
          </td>
          <td class='px-6 py-4 text-right font-black text-emerald-600 text-xl'>₹${r.amt.toLocaleString('en-IN')}</td>
        </tr>`;
      }
      tb.innerHTML = h;
      
      document.getElementById('liveord-tot-d').innerText = totD;
      document.getElementById('liveord-tot-e').innerText = totE;
      document.getElementById('liveord-tot-p').innerText = totP;
      document.getElementById('liveord-tot-r').innerText = totR;
      document.getElementById('liveord-tot-amt').innerText = "₹" + totAmt.toLocaleString('en-IN');
      
    }).withFailureHandler(function(err){
       window.stopLiveOrdTimer('Failed', true);
       tb.innerHTML = `<tr><td colspan='7' class='px-6 py-12 text-center text-red-500 font-bold text-xl'>Network Error: ${err.message}</td></tr>`;
    }).fetchOrdersDetailedReport();
  };
