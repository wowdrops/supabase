// =====================================
  // ADVANCED LIVE ORDERS ENGINE (Supabase)
  // =====================================

  window.activeLiveOrdTimerInterval = null;
  window.liveOrdStartTime = 0;

  window.formatLiveOrdDateTime = function(isoStr) {
    if (!isoStr) return "-";
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    let hours = d.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12; 
    const mins = String(d.getMinutes()).padStart(2, '0');
    return String(d.getDate()).padStart(2, '0') + "-" + months[d.getMonth()] + " " + String(hours).padStart(2, '0') + ":" + mins + " " + ampm;
  };

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

  function buildTBody(id, text) { 
    var tb = document.getElementById(id); 
    tb.innerHTML = "<tr><td colspan='7' class='px-6 py-12 text-center text-slate-400 font-bold text-xl animate-pulse'>" + text + "</td></tr>"; 
    return tb; 
  }

  window.loadOrdersData = async function () {
    window.startLiveOrdTimer('Syncing');
    var tb = buildTBody('orders-tbody', "Syncing live orders from Supabase...");
    
    try {
      // 1. Fetch EVERYTHING in the orders table (since it only holds active orders)
      const { data: ordersData, error: ordersErr } = await supabase1
        .from('orders')
        .select('*')
        .order('id', { ascending: false }); // Sorts newest first

      if (ordersErr) throw ordersErr;

      if (!ordersData || ordersData.length === 0) {
        window.stopLiveOrdTimer('Loaded', false);
        document.getElementById('liveord-tot-d').innerText = "0";
        document.getElementById('liveord-tot-e').innerText = "0";
        document.getElementById('liveord-tot-p').innerText = "0";
        document.getElementById('liveord-tot-r').innerText = "0";
        document.getElementById('liveord-tot-amt').innerText = "₹0";
        return tb.innerHTML = "<tr><td colspan='7' class='px-6 py-12 text-center font-bold text-slate-400 text-xl'>No live orders found.</td></tr>";
      }

      // 2. Fetch Customer Names to populate UI
      const uniqueCpns = [...new Set(ordersData.map(r => r.cpn_no))].filter(Boolean);
      const { data: custData, error: custErr } = await supabase1
        .from('ac_customers')
        .select('cpn_no, poc1')
        .in('cpn_no', uniqueCpns);
        
      if (custErr) throw custErr;

      let custMap = {};
      (custData || []).forEach(c => custMap[c.cpn_no] = c.poc1);

      // 3. Render Table Data
      var h = '';
      var totD = 0, totE = 0, totP = 0, totR = 0, totAmt = 0;

      ordersData.forEach(r => {
        let cpn = (r.cpn_no || "-").toUpperCase();
        let name = custMap[cpn] || r.name || "Unknown";
        let dateStr = window.formatLiveOrdDateTime(r.order_entered_at || r.created_at || r.order_date);
        let oD = Number(r.ord_d) || 0;
        let oE = Number(r.ord_e) || 0;
        let pend = Number(r.pending_qty) || 0;
        let rep = Number(r.replace_qty) || 0;
        let amt = Number(r.amount) || 0;

        totD += oD; totE += oE; totP += pend; totR += rep; totAmt += amt;
        
        let reasonStr = r.replace_reason ? `<br><span class="text-[9px] text-rose-500 font-bold uppercase tracking-widest">${r.replace_reason}</span>` : '';
        
        // NEW Interactive CPN Badge
        let cpnBadgeHtml = `<span class="inline-flex items-center gap-1.5 px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-md hover:bg-blue-100 hover:shadow-sm active:scale-95 transition-all cursor-pointer group mt-1" onclick="window.openCustomer360('${cpn}')">
          ${cpn}
          <svg class="w-3.5 h-3.5 text-blue-400 group-hover:text-blue-700 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
        </span>`;

        h += `<tr class='hover:bg-slate-50 transition border-b border-slate-100'>
          <td class='px-6 py-4 font-bold text-slate-500 text-sm'>${dateStr}</td>
          <td class='px-6 py-4 font-black text-slate-800 text-lg'>${name}<br>${cpnBadgeHtml}</td>
          <td class='px-6 py-4 text-center font-black text-xl'>
            <span class="bg-slate-100 border border-slate-200 px-3 py-1 rounded-lg text-slate-700">${oD}</span>
          </td>
          <td class='px-6 py-4 text-center font-black text-xl'>
            <span class="bg-slate-100 border border-slate-200 px-3 py-1 rounded-lg text-slate-700">${oE}</span>
          </td>
          <td class='px-6 py-4 text-center font-black text-xl'>
            <span class="bg-amber-50 border border-amber-200 px-3 py-1 rounded-lg text-amber-700">${pend}</span>
          </td>
          <td class='px-6 py-4 text-center font-black text-xl leading-tight'>
            <span class="bg-rose-50 border border-rose-200 px-3 py-1 rounded-lg text-rose-700">${rep}</span>${reasonStr}
          </td>
          <td class='px-6 py-4 text-right font-black text-emerald-600 text-xl'>₹${amt.toLocaleString('en-IN')}</td>
        </tr>`;
      });
      
      tb.innerHTML = h;
      window.stopLiveOrdTimer('Loaded', false);
      
      document.getElementById('liveord-tot-d').innerText = totD;
      document.getElementById('liveord-tot-e').innerText = totE;
      document.getElementById('liveord-tot-p').innerText = totP;
      document.getElementById('liveord-tot-r').innerText = totR;
      document.getElementById('liveord-tot-amt').innerText = "₹" + totAmt.toLocaleString('en-IN');

    } catch (err) {
      console.error(err);
      window.stopLiveOrdTimer('Failed', true);
      tb.innerHTML = `<tr><td colspan='7' class='px-6 py-12 text-center text-red-500 font-bold text-xl'>Database Error: ${err.message}</td></tr>`;
    }
  };