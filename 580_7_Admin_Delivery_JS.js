window.switchDelTab = function (id) {
    document.getElementById('del-ledger').classList.add('hidden'); 
    document.getElementById('del-visual').classList.add('hidden');
    document.getElementById('del-driver').classList.add('hidden');

    var inactiveClass = "flex-1 md:flex-none px-6 py-2.5 rounded-lg text-sm md:text-lg font-black text-slate-500 hover:text-slate-800 transition";
    document.getElementById('btn-del-ledger').className = inactiveClass;
    document.getElementById('btn-del-visual').className = inactiveClass;
    document.getElementById('btn-del-driver').className = inactiveClass;

    document.getElementById(id).classList.remove('hidden');
    document.getElementById('btn-' + id).className = "flex-1 md:flex-none px-6 py-2.5 rounded-lg text-sm md:text-lg font-black bg-white shadow-sm text-cyan-700 transition";
  };

  window.toggleDelHeader = function() {
    var col = document.getElementById('del-header-collapsible');
    var icon = document.getElementById('del-header-icon');
    if (col.classList.contains('hidden')) { col.classList.remove('hidden'); icon.classList.add('rotate-180'); } 
    else { col.classList.add('hidden'); icon.classList.remove('rotate-180'); }
  };

  // --- DELIVERY SPECIFIC TIMER ---
  window.activeDelTimerInterval = null;
  window.delStartTime = 0;

  window.formatDeliveryDateTime = function(isoStr) {
    if (!isoStr) return "";
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    let hours = d.getHours();
    const mins = String(d.getMinutes()).padStart(2, '0');
    return String(d.getDate()).padStart(2, '0') + "-" + months[d.getMonth()] + " " + String(hours).padStart(2, '0') + ":" + mins;
  };

  window.formatDeliveryDateOnly = function(isoStr) {
    if (!isoStr) return "";
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return String(d.getDate()).padStart(2, '0') + "-" + months[d.getMonth()] + "-" + d.getFullYear();
  };

  window.startDelTimer = function(actionLabel) {
    var timerBadge = document.getElementById('del-live-timer');
    if (!timerBadge) return;
    
    timerBadge.outerHTML = '<span id="del-live-timer" class="bg-cyan-100 text-cyan-800 font-black px-3 py-1.5 rounded-lg text-sm border-2 border-cyan-200 shadow-inner flex items-center gap-1.5 min-w-max"><svg class="w-4 h-4 animate-spin text-cyan-600" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>' + actionLabel + ': <span id="del-timer-sec">0.00</span>s</span>';
    
    var badge = document.getElementById('del-live-timer');
    badge.classList.remove('hidden');

    window.delStartTime = performance.now();
    if(window.activeDelTimerInterval) clearInterval(window.activeDelTimerInterval);
    
    window.activeDelTimerInterval = setInterval(function() {
        var curr = ((performance.now() - window.delStartTime) / 1000).toFixed(2);
        var secEl = document.getElementById('del-timer-sec');
        if(secEl) secEl.innerText = curr;
    }, 50);
  };

  window.stopDelTimer = function(successLabel, isError) {
    if(window.activeDelTimerInterval) clearInterval(window.activeDelTimerInterval);
    var finalTime = ((performance.now() - window.delStartTime) / 1000).toFixed(2);
    var badge = document.getElementById('del-live-timer');
    if(badge) {
        if (isError) {
            badge.outerHTML = '<span id="del-live-timer" class="bg-red-100 text-red-800 font-bold px-3 py-1.5 rounded-lg border border-red-200 text-xs uppercase tracking-widest whitespace-nowrap shadow-sm min-w-max">Failed</span>';
        } else {
            badge.outerHTML = '<span id="del-live-timer" class="bg-emerald-100 text-emerald-800 font-bold px-3 py-1.5 rounded-lg border border-emerald-200 text-xs uppercase tracking-widest whitespace-nowrap shadow-sm min-w-max">' + successLabel + ' in ' + finalTime + 's</span>';
        }
    }
  };

  window.loadDeliveryData = async function (filterArg) {
    window.startDelTimer('Syncing');

    var tb = document.getElementById('delivery-tbody');
    tb.innerHTML = "<tr><td colspan='41' class='px-6 py-12 text-center text-cyan-600 font-bold text-xl animate-pulse'>Scanning live routes from Supabase...</td></tr>";
    document.getElementById('del-visual').innerHTML = "<p class='text-center py-12 font-black text-slate-400 text-3xl animate-pulse'>Generating Visual Map...</p>";
    
    var searchInput = document.getElementById('search-live-delivery');
    if (searchInput) searchInput.value = '';
    window.filteredDeliveryLedger = []; 
    
    try {
      // 1. Fetch EVERYTHING in deliveries table
      const { data: rawDelData, error: delErr } = await supabase1.from('deliveries').select('*');
      if (delErr) throw delErr;

      // 2. Fetch Customer Details
      const uniqueCpns = [...new Set((rawDelData || []).map(r => r.cpn_no))].filter(Boolean);
      const { data: custData, error: custErr } = await supabase1
        .from('ac_customers')
        .select('cpn_no, apartment, block, door, poc1, con1')
        .in('cpn_no', uniqueCpns);
      if (custErr) throw custErr;

      let custMap = {};
      (custData || []).forEach(c => custMap[c.cpn_no] = c);

      // 3. Process the payload to exactly match the old GAS structure
      var results = { ledger: [], unloadsPending: 0, loadsPending: 0, visualMap: {}, totalOrdD: 0 };

      (rawDelData || []).forEach(row => {
          let prof = custMap[row.cpn_no] || {};
          let cpn = (row.cpn_no || "").toUpperCase();
          if (!cpn) return;

          let delEnterOn = row.delivery_entered_at ? window.formatDeliveryDateTime(row.delivery_entered_at) : "";
          let isDelivered = (delEnterOn !== "");
          
          let rate = Number(row.rate) || 0;
          let actD = Number(row.act_d) || 0;
          let rowAmt = Number(row.amount) || 0;
          if (!rowAmt && actD && rate) rowAmt = actD * rate;

          let v2bLink = row.v2b_link || "";
          let b2vLink = row.b2v_link || "";
          let doorLink = row.door_delivery_link || "";
          let apt = prof.apartment || "-";
          let blk = prof.block || "-";

          results.ledger.push({
              apt: apt, 
              blk: blk, 
              door: prof.door || "-",
              name: prof.poc1 || "Unknown",
              contact: prof.con1 || "-",
              cpn: cpn,
              ordDate: window.formatDeliveryDateOnly(row.order_date),
              ordD: Number(row.ord_d) || 0,
              ordE: Number(row.ord_e) || 0,
              pend: Number(row.pending_qty) || 0,
              rep: Number(row.replace_qty) || 0,
              repReason: row.replace_reason || "",
              delDate: window.formatDeliveryDateOnly(row.del_date),
              actD: actD,
              actE: Number(row.act_e) || 0,
              rate: rate,
              ordComment: row.order_comment || "",
              delComment: row.delivery_comment || "",
              amt: rowAmt,
              uniqueNo: row.unique_no || String(row.id),
              ordEnterOn: window.formatDeliveryDateTime(row.order_entered_at),
              ordEnterBy: row.order_entered_by || "",
              delEnterOn: delEnterOn,
              delEnterBy: row.delivery_entered_by || "",
              doorQC: row.door_qc || "",
              colFull: Number(row.collected_full) || 0,
              varFull: Number(row.variance_full) || 0,
              varEmpty: Number(row.variance_empty) || 0,
              varReason: row.variance_reason || "",
              unloadOn: window.formatDeliveryDateTime(row.unload_on),
              unloadBy: row.unload_by || "",
              loadOn: window.formatDeliveryDateTime(row.load_on),
              loadBy: row.load_by || "",
              advAmt: Number(row.advance_amount) || 0,
              actDVJ: Number(row.act_d_vj) || 0,
              actDNVJ: Number(row.act_d_nvj) || 0,
              actEVJ: Number(row.act_e_vj) || 0,
              actENVJ: Number(row.act_e_nvj) || 0,
              v2bFull: Number(row.v2b_full) || 0,
              b2vFull: Number(row.b2v_full) || 0,
              b2vEmpty: Number(row.b2v_emp) || 0,
              status: isDelivered ? 'DELIVERED' : 'PENDING'
          });

          if(!results.visualMap[apt]) results.visualMap[apt] = { blocks: {} };
          if(!results.visualMap[apt].blocks[blk]) { results.visualMap[apt].blocks[blk] = { v2bLink: "", b2vLink: "", doors: [] }; }
          if (v2bLink) results.visualMap[apt].blocks[blk].v2bLink = v2bLink;
          if (b2vLink) results.visualMap[apt].blocks[blk].b2vLink = b2vLink;
          results.totalOrdD += (Number(row.ord_d) || 0);
          
          results.visualMap[apt].blocks[blk].doors.push({ door: prof.door || "-", isDelivered: isDelivered, link: doorLink });
      });

      for (var a in results.visualMap) {
        for (var b in results.visualMap[a].blocks) {
          if (!results.visualMap[a].blocks[b].v2bLink) results.unloadsPending++;
          if (!results.visualMap[a].blocks[b].b2vLink) results.loadsPending++;
        }
      }

      window.stopDelTimer('Synced', false);
      window.activeReportData.delivery = results.ledger;
      
      document.getElementById('rep-del-cust').innerText = results.ledger.length;
      document.getElementById('rep-del-ord').innerText = results.totalOrdD || 0; 
      
      var tAmt = 0; 
      for (var i = 0; i < results.ledger.length; i++) tAmt += results.ledger[i].amt;
      document.getElementById('rep-del-amt').innerText = "₹" + tAmt.toLocaleString('en-IN');
      
      document.getElementById('rep-del-unloads').innerText = results.unloadsPending; 
      document.getElementById('rep-del-loads').innerText = results.loadsPending;
      
      window.filterDelLedger(filterArg || 'ALL'); 
      window.buildVisualDeliveryMap(results.visualMap);
      window.buildDriverView(results.ledger);

    } catch (err) {
      console.error(err);
      window.stopDelTimer('Failed', true);
      alert("Database error: " + err.message);
    }
  };

  // Live Delivery State Variables
  window.filteredDeliveryLedger = []; 
  window.currentDeliveryFilterStatus = 'ALL';
  window.delSortCol = '';
  window.delSortAsc = true;

  window.searchLiveDelivery = function() {
    var query = document.getElementById('search-live-delivery').value.toLowerCase().trim();
    var allData = window.activeReportData.delivery || [];
    
    if (!query) {
      window.filteredDeliveryLedger = allData;
    } else {
      window.filteredDeliveryLedger = allData.filter(function(r) {
        return (r.cpn.toLowerCase().indexOf(query) > -1) ||
               (r.name.toLowerCase().indexOf(query) > -1) ||
               (r.apt.toLowerCase().indexOf(query) > -1) ||
               (r.blk.toLowerCase().indexOf(query) > -1) ||
               (r.contact.toLowerCase().indexOf(query) > -1);
      });
    }
    window.filterDelLedger(window.currentDeliveryFilterStatus);
  };

  window.sortLiveDelivery = function(key) {
    if (window.delSortCol === key) {
      window.delSortAsc = !window.delSortAsc; 
    } else {
      window.delSortCol = key;
      window.delSortAsc = true;
    }

    var allData = window.activeReportData.delivery || [];
    
    allData.sort(function(a, b) {
      var valA = a[key] === undefined || a[key] === null ? "" : a[key];
      var valB = b[key] === undefined || b[key] === null ? "" : b[key];
      
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return window.delSortAsc ? -1 : 1;
      if (valA > valB) return window.delSortAsc ? 1 : -1;
      return 0;
    });

    window.searchLiveDelivery();
  };

  window.filterDelLedger = function (status) {
    window.currentDeliveryFilterStatus = status;

    // Highlight Buttons
    var keys = ['ALL', 'DELIVERED', 'PENDING'];
    var idMap = { 'ALL': 'flt-del-all', 'DELIVERED': 'flt-del-done', 'PENDING': 'flt-del-pend' };
    for (var k = 0; k < keys.length; k++) {
      document.getElementById(idMap[keys[k]]).className = "shrink-0 px-6 py-3 rounded-xl text-sm font-black bg-white border-2 border-slate-200 text-slate-500 hover:bg-slate-50 transition";
    }
    document.getElementById(idMap[status]).className = "shrink-0 px-6 py-3 rounded-xl text-sm font-black bg-slate-800 text-white shadow-md transition";
    
    var sourceData = window.filteredDeliveryLedger.length > 0 || document.getElementById('search-live-delivery').value.trim() !== "" 
      ? window.filteredDeliveryLedger 
      : (window.activeReportData.delivery || []);

    var tb = document.getElementById('delivery-tbody');
    var html = '';

    for (var i = 0; i < sourceData.length; i++) {
      var r = sourceData[i]; 
      if (status !== 'ALL' && r.status !== status) continue;

      // CPN Interactive Badge
      let cpnBadgeHtml = `<span class="inline-flex items-center gap-1.5 px-2 py-0.5 bg-cyan-50 border border-cyan-200 text-cyan-700 rounded-md hover:bg-cyan-100 hover:shadow-sm active:scale-95 transition-all cursor-pointer group" onclick="window.openCustomer360('${r.cpn}')">
        ${r.cpn}
        <svg class="w-3.5 h-3.5 text-cyan-400 group-hover:text-cyan-700 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
      </span>`;
      
      html += "<tr class='hover:bg-slate-50 transition group'>" +
        "<td class='px-4 py-3 font-black sticky left-0 z-10 bg-white group-hover:bg-slate-50 border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]'>" + cpnBadgeHtml + "</td>" +
        "<td class='px-4 py-3 font-bold text-slate-800'>" + r.apt + "</td>" +
        "<td class='px-4 py-3 font-bold text-slate-800'>" + r.blk + "</td>" +
        "<td class='px-4 py-3 font-bold text-slate-800'>" + r.door + "</td>" +
        "<td class='px-4 py-3 text-slate-800'>" + r.name + "</td>" +
        "<td class='px-4 py-3'>" + r.contact + "</td>" +
        "<td class='px-4 py-3'>" + r.ordDate + "</td>" +
        "<td class='px-4 py-3 text-center bg-indigo-50 font-bold'>" + r.ordD + "</td>" +
        "<td class='px-4 py-3 text-center bg-amber-50 font-bold'>" + r.ordE + "</td>" +
        "<td class='px-4 py-3 text-center bg-amber-50 font-black text-amber-600'>" + r.pend + "</td>" +
        "<td class='px-4 py-3 text-center bg-rose-50 font-black text-rose-600'>" + r.rep + "</td>" +
        "<td class='px-4 py-3 text-xs text-rose-500 max-w-[100px] truncate' title='" + r.repReason + "'>" + r.repReason + "</td>" +
        "<td class='px-4 py-3'>" + r.delDate + "</td>" +
        "<td class='px-4 py-3 text-center font-black bg-indigo-100 text-indigo-700'>" + r.actD + "</td>" +
        "<td class='px-4 py-3 text-center font-black bg-amber-100 text-amber-700'>" + r.actE + "</td>" +
        "<td class='px-4 py-3 text-right font-bold'>₹" + r.rate + "</td>" +
        "<td class='px-4 py-3 truncate max-w-[150px]' title='" + r.ordComment + "'>" + r.ordComment + "</td>" +
        "<td class='px-4 py-3 truncate max-w-[150px]' title='" + r.delComment + "'>" + r.delComment + "</td>" +
        "<td class='px-4 py-3 text-right font-black text-emerald-600'>₹" + r.amt + "</td>" +
        "<td class='px-4 py-3 text-xs text-slate-400'>" + r.uniqueNo + "</td>" +
        "<td class='px-4 py-3 text-xs'>" + r.ordEnterOn + "</td>" +
        "<td class='px-4 py-3 text-xs'>" + r.ordEnterBy + "</td>" +
        "<td class='px-4 py-3 text-xs'>" + r.delEnterOn + "</td>" +
        "<td class='px-4 py-3 text-xs'>" + r.delEnterBy + "</td>" +
        "<td class='px-4 py-3'>" + r.doorQC + "</td>" +
        "<td class='px-4 py-3 text-center'>" + r.colFull + "</td>" +
        "<td class='px-4 py-3 text-center text-red-500 font-bold'>" + r.varFull + "</td>" +
        "<td class='px-4 py-3 text-center text-red-500 font-bold'>" + r.varEmpty + "</td>" +
        "<td class='px-4 py-3 truncate max-w-[150px]'>" + r.varReason + "</td>" +
        "<td class='px-4 py-3 text-xs'>" + r.unloadOn + "</td>" +
        "<td class='px-4 py-3 text-xs'>" + r.unloadBy + "</td>" +
        "<td class='px-4 py-3 text-xs'>" + r.loadOn + "</td>" +
        "<td class='px-4 py-3 text-xs'>" + r.loadBy + "</td>" +
        "<td class='px-4 py-3 text-right font-bold text-emerald-500'>₹" + r.advAmt + "</td>" +
        "<td class='px-4 py-3 text-center'>" + r.actDVJ + "</td>" +
        "<td class='px-4 py-3 text-center'>" + r.actDNVJ + "</td>" +
        "<td class='px-4 py-3 text-center'>" + r.actEVJ + "</td>" +
        "<td class='px-4 py-3 text-center'>" + r.actENVJ + "</td>" +
        "<td class='px-4 py-3 text-center font-black bg-slate-100'>" + r.v2bFull + "</td>" +
        "<td class='px-4 py-3 text-center font-black bg-slate-100'>" + r.b2vFull + "</td>" +
        "<td class='px-4 py-3 text-center font-black bg-slate-100'>" + r.b2vEmpty + "</td>" +
        "</tr>";
    }
    tb.innerHTML = html || "<tr><td colspan='41' class='px-6 py-12 text-center font-bold text-slate-400 text-xl'>No doors match filter.</td></tr>";
  };

  window.buildVisualDeliveryMap = function (mapData) {
    var container = document.getElementById('del-visual'), html = '';
    for (var apt in mapData) {
      html += "<div class='bg-white p-8 rounded-3xl border-4 border-slate-200 shadow-xl mb-8'><h3 class='text-3xl font-black text-slate-800 uppercase tracking-widest border-b-4 border-slate-100 pb-4 mb-6'>" + apt + "</h3>";
      for (var blk in mapData[apt].blocks) {
        var bData = mapData[apt].blocks[blk];
        var unloadIcon = bData.v2bLink ? "<a href='" + bData.v2bLink + "' target='_blank' class='inline-block bg-emerald-100 p-3 rounded-xl border-2 border-emerald-300 shadow hover:scale-105 transition' title='View Unloading'><svg class='w-8 h-8 text-emerald-600' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z'></path></svg></a>" : "<div class='inline-block bg-rose-50 p-3 rounded-xl border-2 border-rose-200 border-dashed opacity-50'><svg class='w-8 h-8 text-rose-400' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M6 18L18 6M6 6l12 12'></path></svg></div>";
        var loadIcon = bData.b2vLink ? "<a href='" + bData.b2vLink + "' target='_blank' class='inline-block bg-emerald-100 p-3 rounded-xl border-2 border-emerald-300 shadow hover:scale-105 transition' title='View Loading'><svg class='w-8 h-8 text-emerald-600' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z'></path></svg></a>" : "<div class='inline-block bg-amber-50 p-3 rounded-xl border-2 border-amber-200 border-dashed opacity-50'><svg class='w-8 h-8 text-amber-400' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M6 18L18 6M6 6l12 12'></path></svg></div>";
        html += "<div class='bg-slate-50 rounded-2xl p-4 border-2 border-slate-200 mb-6'><div class='flex items-center gap-4 mb-4 bg-slate-200 p-4 rounded-xl'>" + unloadIcon + "<div class='flex-1 text-center font-black text-2xl text-slate-700 uppercase tracking-widest'>BLOCK " + blk + "</div>" + loadIcon + "</div><div class='grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4'>";
        for (var d = 0; d < bData.doors.length; d++) {
          var door = bData.doors[d], boxClass = door.isDelivered ? "bg-emerald-100 border-emerald-400 text-emerald-800" : "bg-rose-100 border-rose-400 text-rose-800";
          var doorPhoto = door.link ? "<a href='" + door.link + "' target='_blank' class='block mt-2 bg-white/50 rounded-lg p-2 hover:bg-white transition'><svg class='w-6 h-6 mx-auto text-emerald-700' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z'></path></svg></a>" : "";
          html += "<div class='border-4 rounded-2xl p-4 text-center " + boxClass + "'><p class='font-black text-2xl'>" + door.door + "</p>" + doorPhoto + "</div>";
        }
        html += "</div></div>";
      }
      html += "</div>";
    }
    container.innerHTML = html || "<p class='text-center py-12 font-black text-3xl text-slate-400'>No active deliveries mapped.</p>";
  };

  window.buildDriverView = function(deliveryData) {
    const container = document.getElementById('del-driver');
    
    if (!deliveryData || deliveryData.length === 0) {
        container.innerHTML = '<div class="p-6 text-center text-slate-400 font-bold">No delivery data found.</div>';
        return;
    }

    const grouped = {};
    let grandTotalD = 0;
    let grandTotalE = 0;
    let grandTotalP = 0;
    let grandTotalR = 0;

    deliveryData.forEach(item => {
        const apt = item.apt || 'Unknown Apartment';
        const block = item.blk || 'Unknown Block';
        const d = Number(item.ordD) || 0;
        const e = Number(item.ordE) || 0;
        const p = Number(item.pend) || 0;
        const r = Number(item.rep) || 0;

        if (!grouped[apt]) grouped[apt] = {};
        if (!grouped[apt][block]) grouped[apt][block] = { items: [], subD: 0, subE: 0, subP: 0, subR: 0 };
        
        grouped[apt][block].items.push(item);
        grouped[apt][block].subD += d;
        grouped[apt][block].subE += e;
        grouped[apt][block].subP += p;
        grouped[apt][block].subR += r;
        
        grandTotalD += d;
        grandTotalE += e;
        grandTotalP += p;
        grandTotalR += r;
    });

    let html = `
    <div class="max-w-4xl mx-auto flex justify-end gap-2 mb-4">
      <button onclick="window.exportDoorViewCSV()" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-400 text-white font-bold rounded-xl shadow transition text-sm tracking-widest uppercase">CSV DOOR</button>
      <button onclick="window.exportDriverViewCSV()" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow transition text-sm tracking-widest uppercase">CSV BLOCK</button>
      <button onclick="window.exportDriverViewPDF()" class="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow transition text-sm tracking-widest uppercase">PDF</button>
    </div>
    
    <div id="driver-table-wrapper" class="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto overflow-y-auto max-h-[60vh] 2xl:max-h-[70vh]">
        <table class="w-full text-left text-sm text-slate-700 whitespace-nowrap">
            <thead id="driver-table-thead" class="sticky top-0 bg-yellow-300 text-slate-900 border-b-2 border-slate-400 z-10 shadow-sm">
                <tr>
                    <th class="py-3 px-4 font-black">Door</th>
                    <th class="py-3 px-4 font-black text-center w-24">D</th>
                    <th class="py-3 px-4 font-black text-center w-24">E</th>
                    <th class="py-3 px-4 font-black text-center w-24">P</th>
                    <th class="py-3 px-4 font-black text-center w-24">R</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-slate-200">
    `;

    for (const apt in grouped) {
        for (const block in grouped[apt]) {
            const blockData = grouped[apt][block];
            
            html += `
            <tr class="bg-yellow-100 border-y border-slate-300">
                <td colspan="3" class="py-2 px-4 font-black text-slate-800 uppercase tracking-wide text-xs">
                    ${apt} — Block ${block}
                </td>
            </tr>
            `;

            blockData.items.sort((a, b) => (a.door || '').localeCompare(b.door || ''));
            blockData.items.forEach(item => {
                html += `
                <tr class="hover:bg-slate-50 transition">
                    <td class="py-2 px-4 font-bold text-slate-600 pl-6">${item.door || '-'}</td>
                    <td class="py-2 px-4 font-bold text-center ${item.ordD ? 'text-indigo-600' : 'text-slate-300'}">${item.ordD || 0}</td>
                    <td class="py-2 px-4 font-bold text-center ${item.ordE ? 'text-teal-600' : 'text-slate-300'}">${item.ordE || 0}</td>
                    <td class="py-2 px-4 font-bold text-center ${item.pend ? 'text-teal-600' : 'text-slate-300'}">${item.pend || 0}</td>
                    <td class="py-2 px-4 font-bold text-center ${item.rep ? 'text-teal-600' : 'text-slate-300'}">${item.rep || 0}</td>
                </tr>
                `;
            });

            html += `
            <tr class="bg-slate-100 border-t border-slate-300">
                <td class="py-2 px-4 font-black text-right text-slate-500 text-xs uppercase tracking-wide">Subtotal (${block}):</td>
                <td class="py-2 px-4 font-black text-center text-indigo-700 bg-indigo-50/50">${blockData.subD}</td>
                <td class="py-2 px-4 font-black text-center text-teal-700 bg-teal-50/50">${blockData.subE}</td>
                <td class="py-2 px-4 font-black text-center text-indigo-700 bg-teal-50/50">${blockData.subP}</td>
                <td class="py-2 px-4 font-black text-center text-teal-700 bg-indigo-50/50">${blockData.subR}</td>
            </tr>
            `;
        }
    }

    html += `
        </tbody>
        <tfoot id="driver-table-tfoot" class="sticky bottom-0 bg-yellow-300 border-t-2 border-slate-400 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
            <tr>
                <td class="py-3 px-4 font-black text-right text-slate-900 uppercase">Grand Total:</td>
                <td class="py-3 px-4 font-black text-center text-slate-900 text-lg">${grandTotalD}</td>
                <td class="py-3 px-4 font-black text-center text-slate-900 text-lg">${grandTotalE}</td>
                <td class="py-3 px-4 font-black text-center text-slate-900 text-lg">${grandTotalP}</td>
                <td class="py-3 px-4 font-black text-center text-slate-900 text-lg">${grandTotalR}</td>
            </tr>
        </tfoot>
    </table>
    `;

    container.innerHTML = html;
  };

  window.exportDoorViewCSV = function () {
    const data = window.activeReportData?.delivery || [];
    if (data.length === 0) return alert("No data to export.");

    let csv = "Apartment,Block,Door,D,E,P,R\n";

    const sortedData = [...data].sort((a, b) => {
        const aptA = (a.apt || '').localeCompare(b.apt || '');
        if (aptA !== 0) return aptA;
        const blkA = (a.blk || '').localeCompare(b.blk || '');
        if (blkA !== 0) return blkA;
        return (a.door || '').localeCompare(b.door || '');
    });

    sortedData.forEach(c => {
        const cleanApt = String(c.apt || "Unknown").replace(/,/g, ' ');
        const cleanBlock = String(c.blk || "Unknown").replace(/,/g, ' ');
        const cleanDoor = String(c.door || "").replace(/,/g, ' ');
        csv += `${cleanApt},${cleanBlock},${cleanDoor},${c.ordD || 0},${c.ordE || 0},${c.pend || 0},${c.rep || 0}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Driver_Delivery_View_' + new Date().toISOString().split('T')[0] + '.csv';
    a.click();
  };

  window.exportDriverViewCSV = function () {
    const data = window.activeReportData?.delivery || [];
    if (data.length === 0) return alert("No data to export.");

    let csv = "Apartment,Block,D,E,P,R\n";
    const grouped = {};
    let grandTotalD = 0, grandTotalE = 0, grandTotalP = 0, grandTotalR = 0;

    data.forEach(item => {
        const apt = String(item.apt || "Unknown").replace(/,/g, ' ');
        const block = String(item.blk || "Unknown").replace(/,/g, ' ');
        const d = Number(item.ordD) || 0, e = Number(item.ordE) || 0;
        const p = Number(item.pend) || 0, r = Number(item.rep) || 0;

        if (!grouped[apt]) grouped[apt] = {};
        if (!grouped[apt][block]) grouped[apt][block] = { subD: 0, subE: 0, subP: 0 , subR: 0};
        
        grouped[apt][block].subD += d; grouped[apt][block].subE += e;
        grouped[apt][block].subP += p; grouped[apt][block].subR += r;
        
        grandTotalD += d; grandTotalE += e; grandTotalP += p; grandTotalR += r;
    });

    Object.keys(grouped).sort().forEach(apt => {
        Object.keys(grouped[apt]).sort().forEach(block => {
            const bd = grouped[apt][block];
            csv += `${apt},${block},${bd.subD},${bd.subE},${bd.subP},${bd.subR}\n`;
        });
    });

    csv += `GRAND TOTAL,,${grandTotalD},${grandTotalE},${grandTotalP},${grandTotalR}\n`;

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Driver_Block_View_' + new Date().toISOString().split('T')[0] + '.csv';
    a.click();
  };

  window.exportDriverViewPDF = function () {
    const tableContainer = document.getElementById('driver-table-wrapper');
    const thead = document.getElementById('driver-table-thead');
    const tfoot = document.getElementById('driver-table-tfoot');
    
    if (!tableContainer) return;

    const originalMaxHeight = tableContainer.style.maxHeight;
    tableContainer.style.maxHeight = 'none';
    tableContainer.style.overflowY = 'visible';
    thead.classList.remove('sticky');
    tfoot.classList.remove('sticky');

    const opt = {
        margin: 0.5,
        filename: 'Driver_Delivery_View_' + new Date().toISOString().split('T')[0] + '.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
        pagebreak: { avoid: 'tr' }
    };

    html2pdf().set(opt).from(tableContainer).save().then(() => {
        tableContainer.style.maxHeight = originalMaxHeight;
        tableContainer.style.overflowY = 'auto';
        thead.classList.add('sticky');
        tfoot.classList.add('sticky');
    });
  };