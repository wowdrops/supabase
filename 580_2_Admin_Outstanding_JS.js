// =====================================
  // OUTSTANDING LOGIC (Supabase Native + Waivers)
  // =====================================
  window.trimMonth = function(str) {
    if(!str) return "";
    return str.length > 5 ? str.substring(0, 3) : str;
  };
  
  window.getUniqueArray = function(arr) {
    return [...new Set(arr)];
  };

  window.onGlobalPayTypeChange = function () {
    window.renderDashboardCards();
    window.renderDetailTable();
  };

  window.loadOutstandingData = async function () {
    document.getElementById('outstanding-tbody').innerHTML = "<tr><td colspan='10' class='px-6 py-12 text-center text-slate-500 dark:text-slate-400 font-black text-2xl animate-pulse'>Syncing outstanding ledger & waivers...</td></tr>";
    document.getElementById('apartment-dashboard-grid').innerHTML = "<p class='text-slate-400 text-2xl font-bold animate-pulse'>Building visual dashboard...</p>";
    
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const now = new Date();
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const olderMonth = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      
      const mHeaders = {
        m1: olderMonth.toLocaleString('default', { month: 'long', year: 'numeric' }) + " (Older)",
        m2: olderMonth.toLocaleString('default', { month: 'long', year: 'numeric' }),
        m3: prevMonth.toLocaleString('default', { month: 'long', year: 'numeric' }), 
        m4: now.toLocaleString('default', { month: 'long', year: 'numeric' })        
      };

      const [outRes, custRes] = await Promise.all([
        window.supabase1.from('v_customer_outstanding').select('*'),
        window.supabase1.from('ac_customers').select('cpn_no, waiver_request, waiver_date, overdue_waiver')
      ]);

      if (outRes.error) throw outRes.error;
      if (custRes.error) throw custRes.error;

      const custWaiverMap = {};
      (custRes.data || []).forEach(c => {
         if (c.cpn_no) custWaiverMap[c.cpn_no.toUpperCase()] = c;
      });

      const reportData = [];
      (outRes.data || []).forEach(row => {
          const p1 = Number(row.old_pending) || 0;
          const p2 = Number(row.m2_pending) || 0;
          const p3 = Number(row.m1_pending) || 0;
          const p4 = Number(row.current_month_pending) || 0;
          const depositAdv = Number(row.advance_amount) || 0;

          const totalOutstanding = p1 + p2 + p3 + p4 + depositAdv;
          if (totalOutstanding === 0) return;

          const cpn = String(row.cpn_no || "").trim().toUpperCase();
          const cust = custWaiverMap[cpn];

          reportData.push({
            apartment: String(row.apartment || "").trim(),
            block: String(row.block || "").trim(),
            door: String(row.door || "").trim(),
            name: String(row.customer_name || "").trim(),
            cpn: cpn,
            pend1: p1,
            pend2: p2,
            pend3: p3,
            pend4: p4,
            cans: Number(row.cans) || 0,
            advance: depositAdv,
            payType: String(row.pay_type || "").trim().toUpperCase(),
            waiverReq: cust ? (cust.waiver_request === true || cust.waiver_request === 'TRUE') : false,
            waiverDate: cust ? (Number(cust.waiver_date) || 15) : 15,
            overdueWaiver: cust ? (cust.overdue_waiver === true || cust.overdue_waiver === 'TRUE') : false
          });
      });

      window.masterOutstandingData = reportData;
      window.monthHeadersConfig = mHeaders;

      document.getElementById('lbl-flt-m1').innerText = window.monthHeadersConfig.m1; 
      document.getElementById('lbl-tgl-m1').innerText = window.trimMonth(window.monthHeadersConfig.m1); 
      document.getElementById('lbl-kpi-m1').innerText = window.monthHeadersConfig.m1;
      
      document.getElementById('lbl-flt-m2').innerText = window.monthHeadersConfig.m2; 
      document.getElementById('lbl-tgl-m2').innerText = window.trimMonth(window.monthHeadersConfig.m2); 
      document.getElementById('lbl-kpi-m2').innerText = window.monthHeadersConfig.m2;
      
      document.getElementById('lbl-flt-m3').innerText = window.monthHeadersConfig.m3; 
      document.getElementById('lbl-tgl-m3').innerText = window.trimMonth(window.monthHeadersConfig.m3); 
      document.getElementById('lbl-kpi-m3').innerText = window.monthHeadersConfig.m3;
      
      document.getElementById('lbl-tgl-m4').innerText = window.trimMonth(window.monthHeadersConfig.m4); 
      document.getElementById('lbl-kpi-m4').innerText = window.monthHeadersConfig.m4;

      window.populateFilters(); 
      window.renderDashboardCards(); 
      window.renderDetailTable();

    } catch(err) {
      alert("Database error syncing outstanding ledger: " + err.message);
    }
  };

  window.kpiFilterClick = function (monthKey) {
    var aptDrop = document.getElementById('filter-apt');
    if (aptDrop) aptDrop.value = 'ALL';
    window.updateBlockDropdown();
    window.setRowMonthFilter(monthKey);
    document.getElementById('outstanding-tbody').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  window.setRowMonthFilter = function (filterKey) {
    window.activeRowMonthFilter = filterKey; 
    var keys = ['ALL', 'm1', 'm2', 'm3'];
    
    for (var i = 0; i < keys.length; i++) {
      var btn = document.getElementById("flt-row-" + keys[i]);
      if (btn) {
        if (keys[i] === filterKey) btn.className = "shrink-0 px-6 py-3 rounded-full text-sm md:text-lg font-black border-2 transition-colors bg-slate-800 dark:bg-slate-600 text-white border-slate-800 dark:border-slate-600";
        else btn.className = "shrink-0 px-6 py-3 rounded-full text-sm md:text-lg font-black border-2 transition-colors bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700";
      }
      
      var kpiRow = document.getElementById("kpi-row-" + keys[i]);
      if (kpiRow) {
        if (keys[i] === filterKey) kpiRow.className = "flex justify-between items-center cursor-pointer transition-colors p-2 -mx-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 border-2 border-indigo-300 dark:border-indigo-700 shadow-sm";
        else kpiRow.className = "flex justify-between items-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors p-2 -mx-2 rounded-lg border-2 border-transparent";
      }
    }
    
    window.renderDashboardCards();
    window.renderDetailTable();
  };
  
  window.toggleColumn = function (colKey) {
    window.visCols[colKey] = !window.visCols[colKey]; var btn = document.getElementById("tgl-col-" + colKey);
    if (window.visCols[colKey]) { 
        btn.classList.add('bg-emerald-100', 'dark:bg-emerald-900/40', 'text-emerald-800', 'dark:text-emerald-400', 'border-emerald-300', 'dark:border-emerald-700'); 
        btn.classList.remove('bg-white', 'dark:bg-slate-800', 'text-slate-400', 'dark:text-slate-500', 'border-slate-300', 'dark:border-slate-600', 'line-through'); 
    }
    else { 
        btn.classList.remove('bg-emerald-100', 'dark:bg-emerald-900/40', 'text-emerald-800', 'dark:text-emerald-400', 'border-emerald-300', 'dark:border-emerald-700'); 
        btn.classList.add('bg-white', 'dark:bg-slate-800', 'text-slate-400', 'dark:text-slate-500', 'border-slate-300', 'dark:border-slate-600', 'line-through'); 
    }
    window.renderDetailTable();
  };
  
  window.populateFilters = function () {
    var aptSelect = document.getElementById('filter-apt'), allAptsRaw = [];
    for (var i = 0; i < window.masterOutstandingData.length; i++) allAptsRaw.push(window.masterOutstandingData[i].apartment);
    var apartments = window.getUniqueArray(allAptsRaw).sort();
    aptSelect.innerHTML = '<option value="ALL">ALL APARTMENTS</option>';
    for (var j = 0; j < apartments.length; j++) aptSelect.innerHTML += "<option value='" + apartments[j] + "'>" + apartments[j] + "</option>";
    window.updateBlockDropdown();
  };

  window.updateBlockDropdown = function () {
    var selectedApt = document.getElementById('filter-apt').value, blkSelect = document.getElementById('filter-blk'), filteredData = window.masterOutstandingData;
    if (selectedApt !== "ALL") { filteredData = []; for (var i = 0; i < window.masterOutstandingData.length; i++) { if (window.masterOutstandingData[i].apartment === selectedApt) filteredData.push(window.masterOutstandingData[i]); } }
    var allBlksRaw = []; for (var j = 0; j < filteredData.length; j++) allBlksRaw.push(filteredData[j].block);
    var blocks = window.getUniqueArray(allBlksRaw).sort();
    blkSelect.innerHTML = '<option value="ALL">ALL BLOCKS</option>';
    for (var k = 0; k < blocks.length; k++) blkSelect.innerHTML += "<option value='" + blocks[k] + "'>" + blocks[k] + "</option>";
  };

 window.renderDashboardCards = function () {
    var aptGroups = {}, grandTotalPend = 0, grandTotalAdv = 0, grandM1 = 0, grandM2 = 0, grandM3 = 0, grandM4 = 0;
    var payFilter = document.getElementById('global-filter-pay') ? document.getElementById('global-filter-pay').value : 'ALL';
    var activeApt = document.getElementById('filter-apt') ? document.getElementById('filter-apt').value : 'ALL';
    var activeBlk = document.getElementById('filter-blk') ? document.getElementById('filter-blk').value : 'ALL';

    var openAccordions = [];
    var existingAccordions = document.querySelectorAll('.accordion-content.open');
    for (var a = 0; a < existingAccordions.length; a++) openAccordions.push(existingAccordions[a].id);

    for (var i = 0; i < window.masterOutstandingData.length; i++) {
      var row = window.masterOutstandingData[i]; 
      
      if (payFilter !== 'ALL' && row.payType !== payFilter) continue;
      rowPend = row.pend1 + row.pend2 + row.pend3 + row.pend4;
      
      grandTotalPend += rowPend; grandTotalAdv += row.advance; grandM1 += row.pend1; grandM2 += row.pend2; grandM3 += row.pend3; grandM4 += row.pend4;
      
      if (!aptGroups[row.apartment]) aptGroups[row.apartment] = { totalPend: 0, blocks: {} };
      
      var filteredPend = 0;
      if (window.activeRowMonthFilter === 'ALL') filteredPend = rowPend;
      else if (window.activeRowMonthFilter === 'm1') filteredPend = row.pend1;
      else if (window.activeRowMonthFilter === 'm2') filteredPend = row.pend2;
      else if (window.activeRowMonthFilter === 'm3') filteredPend = row.pend3;
      
      aptGroups[row.apartment].totalPend += filteredPend;

      if (row.block) {
        if (!aptGroups[row.apartment].blocks[row.block]) aptGroups[row.apartment].blocks[row.block] = { p1: 0, p2: 0, p3: 0 };
        aptGroups[row.apartment].blocks[row.block].p1 += row.pend1;
        aptGroups[row.apartment].blocks[row.block].p2 += row.pend2;
        aptGroups[row.apartment].blocks[row.block].p3 += row.pend3;
      }
    }

    document.getElementById('kpi-total-pend').innerText = "₹" + grandTotalPend.toLocaleString('en-IN');
    document.getElementById('val-kpi-m1').innerText = "₹" + grandM1.toLocaleString('en-IN');
    document.getElementById('val-kpi-m2').innerText = "₹" + grandM2.toLocaleString('en-IN');
    document.getElementById('val-kpi-m3').innerText = "₹" + grandM3.toLocaleString('en-IN');
    document.getElementById('val-kpi-m4').innerText = "₹" + grandM4.toLocaleString('en-IN');
    document.getElementById('val-kpi-adv').innerText = "₹" + grandTotalAdv.toLocaleString('en-IN');

    var grid = document.getElementById('apartment-dashboard-grid');
    var htmlOutput = '';
    var aptKeys = Object.keys(aptGroups).sort();

    var showM1 = window.activeRowMonthFilter === 'ALL' || window.activeRowMonthFilter === 'm1';
    var showM2 = window.activeRowMonthFilter === 'ALL' || window.activeRowMonthFilter === 'm2';
    var showM3 = window.activeRowMonthFilter === 'ALL' || window.activeRowMonthFilter === 'm3';

    var dueLabel = "TOTAL DUE";
    if (window.activeRowMonthFilter === 'm1') dueLabel = window.trimMonth(window.monthHeadersConfig.m1) + " DUE";
    else if (window.activeRowMonthFilter === 'm2') dueLabel = window.trimMonth(window.monthHeadersConfig.m2) + " DUE";
    else if (window.activeRowMonthFilter === 'm3') dueLabel = window.trimMonth(window.monthHeadersConfig.m3) + " DUE";

    for (var j = 0; j < aptKeys.length; j++) {
      var apt = aptKeys[j], aptData = aptGroups[apt], uniqueId = "dash-apt-" + j, blockHtml = '', blockKeys = Object.keys(aptData.blocks).sort();

      if (blockKeys.length > 0) {
        blockHtml = "<div class='mt-3 pt-3 md:mt-4 md:pt-4 border-t-2 border-slate-700/50 space-y-2 md:space-y-3'>";
        for (var k = 0; k < blockKeys.length; k++) {
          var blk = blockKeys[k], bD = aptData.blocks[blk];
          var isActiveBlock = (apt === activeApt && blk === activeBlk);
          var blockBgClass = isActiveBlock ? "bg-slate-700 ring-2 ring-indigo-400" : "bg-slate-900 border-2 border-transparent hover:bg-slate-800";
          var m1Bg = (isActiveBlock && window.activeRowMonthFilter === 'm1') ? "bg-indigo-900/80 shadow-inner ring-2 ring-indigo-400" : "hover:bg-slate-700/80";
          var m2Bg = (isActiveBlock && window.activeRowMonthFilter === 'm2') ? "bg-indigo-900/80 shadow-inner ring-2 ring-indigo-400" : "hover:bg-slate-700/80";
          var m3Bg = (isActiveBlock && window.activeRowMonthFilter === 'm3') ? "bg-indigo-900/80 shadow-inner ring-2 ring-indigo-400" : "hover:bg-slate-700/80";

          blockHtml += "<div class='flex justify-between items-center p-2.5 md:p-4 rounded-xl cursor-pointer transition-colors " + blockBgClass + "' onclick=\"window.applyFilterFromCard('" + apt + "', '" + blk + "', 'ALL')\">" +
            "<span class='text-slate-300 font-black text-sm md:text-lg w-10 md:w-16 shrink-0 pointer-events-none'>B: " + blk + "</span>" +
            "<div class='flex flex-1 justify-between text-right px-1 md:px-2 gap-1 md:gap-2'>";

          if (showM1) blockHtml += "<div onclick=\"event.stopPropagation(); window.applyFilterFromCard('" + apt + "', '" + blk + "', 'm1')\" class='flex flex-col flex-1 p-1.5 rounded-lg transition cursor-pointer " + m1Bg + "'><span class='text-slate-500 text-[9px] md:text-xs font-bold tracking-widest pointer-events-none'>" + window.trimMonth(window.monthHeadersConfig.m1) + "</span><span class='pointer-events-none " + (bD.p1 > 0 ? 'text-red-400 font-black text-sm md:text-lg' : 'text-slate-500 text-sm md:text-lg') + "'>₹" + bD.p1 + "</span></div>";
          if (showM2) blockHtml += "<div onclick=\"event.stopPropagation(); window.applyFilterFromCard('" + apt + "', '" + blk + "', 'm2')\" class='flex flex-col flex-1 p-1.5 rounded-lg transition cursor-pointer " + m2Bg + " " + (showM1 ? "border-l-2 border-slate-700" : "") + "'><span class='text-slate-500 text-[9px] md:text-xs font-bold tracking-widest pointer-events-none'>" + window.trimMonth(window.monthHeadersConfig.m2) + "</span><span class='pointer-events-none " + (bD.p2 > 0 ? 'text-amber-400 font-black text-sm md:text-lg' : 'text-slate-500 text-sm md:text-lg') + "'>₹" + bD.p2 + "</span></div>";
          if (showM3) blockHtml += "<div onclick=\"event.stopPropagation(); window.applyFilterFromCard('" + apt + "', '" + blk + "', 'm3')\" class='flex flex-col flex-1 p-1.5 rounded-lg transition cursor-pointer " + m3Bg + " " + ((showM1 || showM2) ? "border-l-2 border-slate-700" : "") + "'><span class='text-slate-500 text-[9px] md:text-xs font-bold tracking-widest pointer-events-none'>" + window.trimMonth(window.monthHeadersConfig.m3) + "</span><span class='pointer-events-none " + (bD.p3 > 0 ? 'text-amber-100 font-black text-sm md:text-lg' : 'text-slate-500 text-sm md:text-lg') + "'>₹" + bD.p3 + "</span></div>";

          blockHtml += "</div></div>";
        }
        blockHtml += "</div>";
      }

      htmlOutput += "<div class='bg-slate-800 border-4 border-slate-700 hover:border-slate-500 transition-colors rounded-2xl md:rounded-3xl p-4 md:p-6 flex flex-col shadow-lg'>" +
        "<div class='flex justify-between items-center cursor-pointer' onclick=\"window.toggleAccordion('" + uniqueId + "', 'icon-" + uniqueId + "')\">" +
        "<div><h4 class='text-xl md:text-2xl font-black text-white leading-tight'>" + apt + "</h4>" +
        "<p class='text-xs md:text-sm text-slate-400 uppercase tracking-widest mt-1'><span class='text-red-400 font-bold'>" + dueLabel + ": ₹" + aptData.totalPend.toLocaleString('en-IN') + "</span></p></div>" +
        (blockKeys.length > 0 ? "<svg id='icon-" + uniqueId + "' class='w-6 h-6 md:w-8 md:h-8 shrink-0 ml-2 text-slate-400 transition-transform duration-200' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path stroke-linecap='round' stroke-linejoin='round' stroke-width='3' d='M19 9l-7 7-7-7'></path></svg>" : "") +
        "</div>" +
        "<div id='" + uniqueId + "' class='accordion-content'><div class='overflow-hidden'>" + blockHtml + "</div></div>" +
        "</div>";
    }
    
    grid.innerHTML = htmlOutput;
    
    for (var b = 0; b < openAccordions.length; b++) {
       var acc = document.getElementById(openAccordions[b]);
       if (acc) { 
           acc.classList.add('open'); 
           var icon = document.getElementById('icon-' + openAccordions[b]); 
           if (icon) icon.classList.add('rotate-180'); 
       }
    }
  };

  window.applyFilterFromCard = function (apt, blk, monthKey) { 
    var aptDrop = document.getElementById('filter-apt');
    if (aptDrop) aptDrop.value = apt; 
    window.updateBlockDropdown(); 
    
    var blkDrop = document.getElementById('filter-blk');
    if (blkDrop) blkDrop.value = blk; 
    
    window.setRowMonthFilter(monthKey || 'ALL'); 
    document.getElementById('outstanding-tbody').scrollIntoView({ behavior: 'smooth', block: 'start' }); 
  };
  
  window.renderDetailTable = function () {
    var apt = document.getElementById('filter-apt').value;
    var blk = document.getElementById('filter-blk').value;
    var payFilter = document.getElementById('global-filter-pay') ? document.getElementById('global-filter-pay').value : 'ALL';
    var thead = document.getElementById('outstanding-thead');
    var tbody = document.getElementById('outstanding-tbody');

    var filtered = [];
    var sumM1 = 0, sumM2 = 0, sumM3 = 0, sumM4 = 0, sumTotal = 0, sumAdv = 0, sumCans = 0;

    for (var i = 0; i < window.masterOutstandingData.length; i++) {
      var d = window.masterOutstandingData[i]; 
      var matchApt = (apt === "ALL" || d.apartment === apt); 
      var matchBlk = (blk === "ALL" || d.block === blk); 
      var matchPay = (payFilter === "ALL" || d.payType === payFilter);
      var matchQF = true;
      if (window.activeRowMonthFilter === 'm1') matchQF = d.pend1 > 0; 
      if (window.activeRowMonthFilter === 'm2') matchQF = d.pend2 > 0; 
      if (window.activeRowMonthFilter === 'm3') matchQF = d.pend3 > 0;

      if (matchApt && matchBlk && matchQF && matchPay) {
          filtered.push(d);
          sumM1 += (d.pend1 || 0); sumM2 += (d.pend2 || 0); sumM3 += (d.pend3 || 0); sumM4 += (d.pend4 || 0);
          sumTotal += ((d.pend1 || 0) + (d.pend2 || 0) + (d.pend3 || 0) + (d.pend4 || 0));
          sumAdv += (d.advance || 0); sumCans += (d.cans || 0);
      }
    }

    if (filtered.length === 0) { 
        thead.innerHTML = "";
        return tbody.innerHTML = "<tr><td colspan='10' class='px-6 py-12 text-center text-slate-400 dark:text-slate-500 font-bold text-2xl'>No records found.</td></tr>"; 
    }

    var headHtml = "<tr class='bg-slate-800 text-white shadow-md'>";
    headHtml += "<th colspan='2' class='px-6 py-4 border-r border-slate-700'><div class='flex items-center gap-3'>";
    headHtml += "<div class='text-xs font-bold tracking-widest text-slate-400'>FILTERED: <span class='text-white bg-slate-700 px-2 py-1 rounded-md'>" + filtered.length + "</span></div>";
    headHtml += "<button onclick='window.exportOutstandingCSV()' class='px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded text-xs font-black tracking-widest transition'>CSV</button>";
    headHtml += "<button onclick='window.exportOutstandingPDF()' class='px-3 py-1.5 bg-rose-600 hover:bg-rose-500 rounded text-xs font-black tracking-widest transition'>PDF</button>";
    headHtml += "</div></th>";
    
    if (window.visCols.m1) headHtml += "<th class='px-6 py-4 text-right text-red-400 font-black text-xl border-r border-slate-700'>₹" + sumM1.toLocaleString('en-IN') + "</th>";
    if (window.visCols.m2) headHtml += "<th class='px-6 py-4 text-right text-red-400 font-black text-xl border-r border-slate-700'>₹" + sumM2.toLocaleString('en-IN') + "</th>";
    if (window.visCols.m3) headHtml += "<th class='px-6 py-4 text-right text-red-400 font-black text-xl border-r border-slate-700'>₹" + sumM3.toLocaleString('en-IN') + "</th>";
    if (window.visCols.m4) headHtml += "<th class='px-6 py-4 text-right text-red-400 font-black text-xl border-r border-slate-700'>₹" + sumM4.toLocaleString('en-IN') + "</th>";
    
    headHtml += "<th class='px-6 py-4 text-right text-white font-black text-2xl drop-shadow-md border-r border-slate-700'>₹" + sumTotal.toLocaleString('en-IN') + "</th>";
    if (window.visCols.adv) headHtml += "<th class='px-6 py-4 text-right text-emerald-400 font-black text-xl border-r border-slate-700'>₹" + sumAdv.toLocaleString('en-IN') + "</th>";
    headHtml += "<th class='px-6 py-4 text-center text-blue-400 font-black text-xl border-r border-slate-700'>" + sumCans + "</th>";
    headHtml += "<th class='px-6 py-4'></th></tr>";

    headHtml += "<tr>";
    headHtml += "<th class='px-6 py-5 bg-slate-100 dark:bg-slate-900 border-b-4 border-slate-200 dark:border-slate-700 transition-colors'>Apt / Blk / Door</th>";
    headHtml += "<th class='px-6 py-5 bg-slate-100 dark:bg-slate-900 border-b-4 border-slate-200 dark:border-slate-700 transition-colors'>Customer Profile</th>";
    if (window.visCols.m1) headHtml += "<th class='px-6 py-5 text-right text-red-600 dark:text-red-400 bg-red-50/50 dark:bg-red-900/10 border-b-4 border-slate-200 dark:border-slate-700 transition-colors'>" + window.monthHeadersConfig.m1 + "</th>";
    if (window.visCols.m2) headHtml += "<th class='px-6 py-5 text-right text-red-600 dark:text-red-400 bg-slate-100 dark:bg-slate-900 border-b-4 border-slate-200 dark:border-slate-700 transition-colors'>" + window.monthHeadersConfig.m2 + "</th>";
    if (window.visCols.m3) headHtml += "<th class='px-6 py-5 text-right text-red-600 dark:text-red-400 bg-slate-100 dark:bg-slate-900 border-b-4 border-slate-200 dark:border-slate-700 transition-colors'>" + window.monthHeadersConfig.m3 + "</th>";
    if (window.visCols.m4) headHtml += "<th class='px-6 py-5 text-right text-red-600 dark:text-red-400 bg-slate-100 dark:bg-slate-900 border-b-4 border-slate-200 dark:border-slate-700 transition-colors'>" + window.monthHeadersConfig.m4 + "</th>";
    headHtml += "<th class='px-6 py-5 text-right text-slate-900 dark:text-slate-100 bg-slate-200/90 dark:bg-slate-800 border-b-4 border-slate-300 dark:border-slate-600 transition-colors'>Total Due</th>";
    if (window.visCols.adv) headHtml += "<th class='px-6 py-5 text-right text-emerald-600 dark:text-emerald-400 bg-slate-100 dark:bg-slate-900 border-b-4 border-slate-200 dark:border-slate-700 transition-colors'>Advance</th>";
    headHtml += "<th class='px-6 py-5 text-center text-blue-600 dark:text-blue-400 bg-slate-100 dark:bg-slate-900 border-b-4 border-slate-200 dark:border-slate-700 transition-colors'>Cans</th>";
    headHtml += "<th class='px-6 py-5 text-center text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 border-b-4 border-slate-200 dark:border-slate-700 transition-colors'>Waivers</th></tr>";
    
    thead.innerHTML = headHtml;

    var html = '';
    for (var j = 0; j < filtered.length; j++) {
      var r = filtered[j], totalDue = r.pend1 + r.pend2 + r.pend3 + r.pend4;
      var advBadge = r.advance > 0 ? "<span class='bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-400 px-4 py-2 rounded-xl border-2 border-emerald-300 dark:border-emerald-700 text-xl font-black transition-colors'>₹" + r.advance + "</span>" : "<span class='text-slate-300 dark:text-slate-600 font-bold'>-</span>";
      var totalDueHtml = totalDue > 0 ? "<span class='font-black text-red-600 dark:text-red-400 text-2xl md:text-3xl transition-colors'>₹" + totalDue.toLocaleString('en-IN') + "</span>" : "<span class='text-slate-400 dark:text-slate-500 font-bold text-xl transition-colors'>₹0</span>";
      
      var waiverBadge = '';
      if (r.overdueWaiver) waiverBadge += '<span class="bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400 px-1.5 py-0.5 rounded text-[9px] font-black mr-1 uppercase shadow-sm transition-colors">M2 ON</span>';
      if (r.waiverReq) waiverBadge += '<span class="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 px-1.5 py-0.5 rounded text-[9px] font-black uppercase shadow-sm transition-colors">M1 ON</span>';
      if (!r.overdueWaiver && !r.waiverReq) waiverBadge = '<span class="text-slate-300 dark:text-slate-600 font-bold text-[10px] uppercase transition-colors">None Active</span>';

      var rowHtml = "<tr class='hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors border-b-4 border-slate-50 dark:border-slate-800/30'>" +
        "<td class='px-6 py-5'><div class='text-lg font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest'>" + r.apartment + "</div><div class='font-black text-slate-800 dark:text-white text-2xl md:text-3xl'>" + (r.block || '-') + " / " + (r.door || '-') + "</div></td>" +
        "<td class='px-6 py-5'><div class='font-black text-slate-800 dark:text-white text-2xl md:text-3xl truncate max-w-[250px]'>" + r.name + "</div><div class='text-xl text-blue-600 dark:text-blue-400 font-black tracking-widest cursor-pointer hover:underline' onclick='window.openCustomer360(\"" + r.cpn + "\")'>" + r.cpn + "</div></td>";
      
      if (window.visCols.m1) rowHtml += "<td class='px-6 py-5 text-right bg-red-50/30 dark:bg-red-900/10 text-2xl md:text-3xl font-black transition-colors " + (r.pend1 > 0 ? 'text-red-500 dark:text-red-400' : 'text-slate-300 dark:text-slate-600') + "'>" + (r.pend1 || '-') + "</td>";
      if (window.visCols.m2) rowHtml += "<td class='px-6 py-5 text-right text-2xl md:text-3xl font-black transition-colors " + (r.pend2 > 0 ? 'text-red-500 dark:text-red-400' : 'text-slate-300 dark:text-slate-600') + "'>" + (r.pend2 || '-') + "</td>";
      if (window.visCols.m3) rowHtml += "<td class='px-6 py-5 text-right text-2xl md:text-3xl font-black transition-colors " + (r.pend3 > 0 ? 'text-red-500 dark:text-red-400' : 'text-slate-300 dark:text-slate-600') + "'>" + (r.pend3 || '-') + "</td>";
      if (window.visCols.m4) rowHtml += "<td class='px-6 py-5 text-right text-2xl md:text-3xl font-black transition-colors " + (r.pend4 > 0 ? 'text-red-500 dark:text-red-400' : 'text-slate-300 dark:text-slate-600') + "'>" + (r.pend4 || '-') + "</td>";
      
      rowHtml += "<td class='px-6 py-5 text-right bg-slate-50 dark:bg-slate-800/30 transition-colors'>" + totalDueHtml + "</td>";
      if (window.visCols.adv) rowHtml += "<td class='px-6 py-5 text-right'>" + advBadge + "</td>";
      rowHtml += "<td class='px-6 py-5 text-center'><span class='inline-flex items-center justify-center w-14 h-14 rounded-2xl text-2xl transition-colors " + (r.cans > 0 ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-400 font-black border-4 border-blue-200 dark:border-blue-700' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 font-bold') + "'>" + r.cans + "</span></td>";
      
      rowHtml += "<td class='px-6 py-5 text-center'>" +
                 "<div class='mb-2 flex justify-center gap-1'>" + waiverBadge + "</div>" +
                 "<button onclick='window.openWaiverModal(\"" + r.cpn + "\")' class='bg-white dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-sm transition-colors border-2 border-slate-200 dark:border-slate-600 active:scale-95'>⚙️ Manage</button>" +
                 "</td></tr>";
      
      html += rowHtml;
    }
    tbody.innerHTML = html;
  };

  window.openWaiverModal = function(cpn) {
    if (typeof window.toggleScrollLock === 'function') window.toggleScrollLock(true);

    var modal = document.getElementById('waiver-modal');
    if (modal && modal.parentNode !== document.body) {
        document.body.appendChild(modal);
    }

    const data = window.masterOutstandingData.find(d => d.cpn === cpn);
    if (!data) return;

    document.getElementById('waiver-cpn').innerText = data.cpn;
    document.getElementById('waiver-name').innerText = data.name;
    document.getElementById('waiver-loc').innerText = `${data.apartment} / ${data.block} / Door ${data.door}`;

    const m1Debt = data.pend3; 
    const m2PlusDebt = data.pend1 + data.pend2; 
    const totDebt = m1Debt + m2PlusDebt + data.pend4;

    document.getElementById('waiver-m1-debt').innerText = "₹" + m1Debt.toLocaleString('en-IN');
    document.getElementById('waiver-m2-debt').innerText = "₹" + m2PlusDebt.toLocaleString('en-IN');
    document.getElementById('waiver-tot-debt').innerText = "₹" + totDebt.toLocaleString('en-IN');

    const reqToggle = document.getElementById('inp-waiver-req');
    const dateInp = document.getElementById('inp-waiver-date');
    const overToggle = document.getElementById('inp-overdue-waiver');

    reqToggle.checked = data.waiverReq;
    dateInp.value = data.waiverDate || 15;
    dateInp.disabled = !data.waiverReq;
    overToggle.checked = data.overdueWaiver;

    modal.classList.remove('hidden');
  };

  window.closeWaiverModal = function() {
    document.getElementById('waiver-modal').classList.add('hidden');
    if (typeof window.toggleScrollLock === 'function') window.toggleScrollLock(false);
  };

  window.toggleWaiverDate = function(checkbox) {
    document.getElementById('inp-waiver-date').disabled = !checkbox.checked;
  };

  window.saveWaiverSettings = async function() {
    const btn = document.getElementById('btn-save-waiver');
    const cpn = document.getElementById('waiver-cpn').innerText;
    const req = document.getElementById('inp-waiver-req').checked;
    let date = parseInt(document.getElementById('inp-waiver-date').value) || 1;
    const over = document.getElementById('inp-overdue-waiver').checked;

    if (date < 1) date = 1;
    if (date > 28) date = 28;

    btn.disabled = true;
    btn.innerText = "Saving...";

    try {
        const { error } = await window.supabase1
            .from('ac_customers')
            .update({
                waiver_request: req,
                waiver_date: date,
                overdue_waiver: over
            })
            .eq('cpn_no', cpn);

        if (error) throw error;

        const data = window.masterOutstandingData.find(d => d.cpn === cpn);
        if (data) {
            data.waiverReq = req;
            data.waiverDate = date;
            data.overdueWaiver = over;
        }

        window.renderDetailTable();
        window.closeWaiverModal();
        if(typeof window.showToast === 'function') window.showToast("Waiver updated securely.", "success");

    } catch (err) {
        alert("Error updating waivers: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "Save Settings";
    }
  };

  window.exportOutstandingCSV = function () {
    var apt = document.getElementById('filter-apt').value;
    var blk = document.getElementById('filter-blk').value;
    var payFilter = document.getElementById('global-filter-pay') ? document.getElementById('global-filter-pay').value : 'ALL';
    var filtered = [];
    
    for (var i = 0; i < window.masterOutstandingData.length; i++) {
      var d = window.masterOutstandingData[i]; 
      var matchApt = (apt === "ALL" || d.apartment === apt); 
      var matchBlk = (blk === "ALL" || d.block === blk); 
      var matchPay = (payFilter === "ALL" || d.payType === payFilter);
      var matchQF = true;
      if (window.activeRowMonthFilter === 'm1') matchQF = d.pend1 > 0; 
      if (window.activeRowMonthFilter === 'm2') matchQF = d.pend2 > 0; 
      if (window.activeRowMonthFilter === 'm3') matchQF = d.pend3 > 0;
      if (matchApt && matchBlk && matchQF && matchPay) filtered.push(d);
    }
    
    if (filtered.length === 0) return alert("No records to export.");
    
    var csv = "Apartment,Block,Door,Name,CPN,";
    if (window.visCols.m1) csv += window.monthHeadersConfig.m1 + ",";
    if (window.visCols.m2) csv += window.monthHeadersConfig.m2 + ",";
    if (window.visCols.m3) csv += window.monthHeadersConfig.m3 + ",";
    if (window.visCols.m4) csv += window.monthHeadersConfig.m4 + ",";
    csv += "Total Due,";
    if (window.visCols.adv) csv += "Advance,";
    csv += "Cans With Customer,Waiver M1,Waiver M2\n";

    filtered.forEach(function (r) {
      var totalDue = (r.pend1 || 0) + (r.pend2 || 0) + (r.pend3 || 0) + (r.pend4 || 0);
      var cleanApt = String(r.apartment || "").replace(/,/g, ' ');
      var cleanName = String(r.name || "").replace(/,/g, ' ');
      
      csv += cleanApt + "," + (r.block || "") + "," + (r.door || "") + "," + cleanName + "," + r.cpn + ",";
      if (window.visCols.m1) csv += (r.pend1 || 0) + ",";
      if (window.visCols.m2) csv += (r.pend2 || 0) + ",";
      if (window.visCols.m3) csv += (r.pend3 || 0) + ",";
      if (window.visCols.m4) csv += (r.pend4 || 0) + ",";
      csv += totalDue + ",";
      if (window.visCols.adv) csv += (r.advance || 0) + ",";
      csv += (r.cans || 0) + ",";
      csv += (r.waiverReq ? "ON" : "OFF") + ",";
      csv += (r.overdueWaiver ? "ON" : "OFF") + "\n";
    });
    
    var blob = new Blob([csv], { type: 'text/csv' });
    var url = window.URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; 
    a.download = 'Outstanding_Ledger_' + new Date().toISOString().split('T')[0] + '.csv';
    a.click();
  };

  window.exportOutstandingPDF = function () {
    const tableContainer = document.querySelector('#outstanding-tbody').closest('.overflow-x-auto');
    const thead = document.getElementById('outstanding-thead');
    
    const originalMaxHeight = tableContainer.style.maxHeight;
    const originalOverflowY = tableContainer.style.overflowY;
    const originalOverflowX = tableContainer.style.overflowX;

    tableContainer.style.maxHeight = 'none';
    tableContainer.style.overflowY = 'visible';
    tableContainer.style.overflowX = 'visible';
    thead.classList.remove('sticky');

    const opt = {
      margin: 0.5,
      filename: 'Outstanding_Ledger_' + new Date().toISOString().split('T')[0] + '.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2, 
        useCORS: true, 
        windowWidth: tableContainer.scrollWidth 
      },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' }
    };

    html2pdf().set(opt).from(tableContainer).save().then(() => {
       tableContainer.style.maxHeight = originalMaxHeight;
       tableContainer.style.overflowY = originalOverflowY;
       tableContainer.style.overflowX = originalOverflowX;
       thead.classList.add('sticky');
    });
  };

  window.tabActions['outstanding'] = window.loadOutstandingData;