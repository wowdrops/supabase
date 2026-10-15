
// =====================================
  // OUTSTANDING LOGIC
  // =====================================
  window.onGlobalPayTypeChange = function () {
    window.renderDashboardCards();
    window.renderDetailTable();
  };

  window.loadOutstandingData = function () {
    document.getElementById('outstanding-tbody').innerHTML = "<tr><td colspan='9' class='px-6 py-12 text-center text-slate-500 font-black text-2xl animate-pulse'>Syncing outstanding ledger...</td></tr>";
    document.getElementById('apartment-dashboard-grid').innerHTML = "<p class='text-slate-400 text-2xl font-bold animate-pulse'>Building visual dashboard...</p>";
    google.script.run.withSuccessHandler(function (res) {
      if (!res.success) { alert("Error: " + res.message); return; }
      window.masterOutstandingData = res.data; window.monthHeadersConfig = res.headers;
      document.getElementById('lbl-flt-m1').innerText = window.monthHeadersConfig.m1; document.getElementById('lbl-tgl-m1').innerText = window.trimMonth(window.monthHeadersConfig.m1); document.getElementById('lbl-kpi-m1').innerText = window.monthHeadersConfig.m1;
      document.getElementById('lbl-flt-m2').innerText = window.monthHeadersConfig.m2; document.getElementById('lbl-tgl-m2').innerText = window.trimMonth(window.monthHeadersConfig.m2); document.getElementById('lbl-kpi-m2').innerText = window.monthHeadersConfig.m2;
      document.getElementById('lbl-flt-m3').innerText = window.monthHeadersConfig.m3; document.getElementById('lbl-tgl-m3').innerText = window.trimMonth(window.monthHeadersConfig.m3); document.getElementById('lbl-kpi-m3').innerText = window.monthHeadersConfig.m3;
      document.getElementById('lbl-tgl-m4').innerText = window.trimMonth(window.monthHeadersConfig.m4); document.getElementById('lbl-kpi-m4').innerText = window.monthHeadersConfig.m4;
      window.populateFilters(); window.renderDashboardCards(); window.renderDetailTable();
    }).getOutstandingReportData();
  };

  window.kpiFilterClick = function (monthKey) {
    // Force reset the dropdowns to "ALL" so they don't block the global KPI filter
    var aptDrop = document.getElementById('filter-apt');
    if (aptDrop) aptDrop.value = 'ALL';
    window.updateBlockDropdown();
    
    // Now apply the month filter
    window.setRowMonthFilter(monthKey);
  };

  window.setRowMonthFilter = function (filterKey) {
    window.activeRowMonthFilter = filterKey; 
    var keys = ['ALL', 'm1', 'm2', 'm3'];
    
    for (var i = 0; i < keys.length; i++) {
      // 1. Highlight Bottom Buttons
      var btn = document.getElementById("flt-row-" + keys[i]);
      if (btn) {
        if (keys[i] === filterKey) btn.className = "shrink-0 px-6 py-3 rounded-full text-sm md:text-lg font-black border-2 transition bg-slate-800 text-white border-slate-800";
        else btn.className = "shrink-0 px-6 py-3 rounded-full text-sm md:text-lg font-black border-2 transition bg-white text-slate-600 border-slate-300 hover:bg-slate-100";
      }
      
      // 2. Highlight Top KPI Rows
      var kpiRow = document.getElementById("kpi-row-" + keys[i]);
      if (kpiRow) {
        if (keys[i] === filterKey) kpiRow.className = "flex justify-between items-center cursor-pointer transition p-2 -mx-2 rounded-lg bg-indigo-50 border-2 border-indigo-300 shadow-sm";
        else kpiRow.className = "flex justify-between items-center cursor-pointer hover:bg-slate-100 transition p-2 -mx-2 rounded-lg border-2 border-transparent";
      }
    }
    
    // Re-render dashboard to update black card highlights, then render table
    window.renderDashboardCards();
    window.renderDetailTable();
  };
  
  window.toggleColumn = function (colKey) {
    window.visCols[colKey] = !window.visCols[colKey]; var btn = document.getElementById("tgl-col-" + colKey);
    if (window.visCols[colKey]) { btn.classList.add('bg-emerald-100', 'text-emerald-800', 'border-emerald-300'); btn.classList.remove('bg-white', 'text-slate-400', 'border-slate-300', 'line-through'); }
    else { btn.classList.remove('bg-emerald-100', 'text-emerald-800', 'border-emerald-300'); btn.classList.add('bg-white', 'text-slate-400', 'border-slate-300', 'line-through'); }
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

    // Read Global Pay Filter
    var payFilter = document.getElementById('global-filter-pay') ? document.getElementById('global-filter-pay').value : 'ALL';
    
    // Check current active filters for highlighting
    var activeApt = document.getElementById('filter-apt') ? document.getElementById('filter-apt').value : 'ALL';
    var activeBlk = document.getElementById('filter-blk') ? document.getElementById('filter-blk').value : 'ALL';

    // Save Open Accordion States before re-rendering
    var openAccordions = [];
    var existingAccordions = document.querySelectorAll('.accordion-content.open');
    for (var a = 0; a < existingAccordions.length; a++) openAccordions.push(existingAccordions[a].id);

    // 1. Calculate Totals
    for (var i = 0; i < window.masterOutstandingData.length; i++) {
      var row = window.masterOutstandingData[i]; 
      
      // APPLY GLOBAL PAY TYPE FILTER
      if (payFilter !== 'ALL' && row.payType !== payFilter) continue;
      
      rowPend = row.pend1 + row.pend2 + row.pend3 + row.pend4;
      
      // Global KPIs must always calculate total universe
      grandTotalPend += rowPend; grandTotalAdv += row.advance; grandM1 += row.pend1; grandM2 += row.pend2; grandM3 += row.pend3; grandM4 += row.pend4;
      
      if (!aptGroups[row.apartment]) aptGroups[row.apartment] = { totalPend: 0, blocks: {} };
      
      // NEW: Calculate Apartment Total based ONLY on the clicked month filter
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

    // 2. Update KPI Cards Values
    document.getElementById('kpi-total-pend').innerText = "₹" + grandTotalPend.toLocaleString('en-IN');
    document.getElementById('val-kpi-m1').innerText = "₹" + grandM1.toLocaleString('en-IN');
    document.getElementById('val-kpi-m2').innerText = "₹" + grandM2.toLocaleString('en-IN');
    document.getElementById('val-kpi-m3').innerText = "₹" + grandM3.toLocaleString('en-IN');
    document.getElementById('val-kpi-m4').innerText = "₹" + grandM4.toLocaleString('en-IN');
    document.getElementById('val-kpi-adv').innerText = "₹" + grandTotalAdv.toLocaleString('en-IN');

    // 3. Render Responsive Black Cards
    var grid = document.getElementById('apartment-dashboard-grid');
    var htmlOutput = '';
    var aptKeys = Object.keys(aptGroups).sort();

    var showM1 = window.activeRowMonthFilter === 'ALL' || window.activeRowMonthFilter === 'm1';
    var showM2 = window.activeRowMonthFilter === 'ALL' || window.activeRowMonthFilter === 'm2';
    var showM3 = window.activeRowMonthFilter === 'ALL' || window.activeRowMonthFilter === 'm3';

    // NEW: Generate Dynamic Label based on Filter (e.g. "JAN DUE" vs "TOTAL DUE")
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
          
          // DYNAMIC HIGHLIGHT LOGIC
          var isActiveBlock = (apt === activeApt && blk === activeBlk);
          var blockBgClass = isActiveBlock ? "bg-slate-700 ring-2 ring-indigo-400" : "bg-slate-900 border-2 border-transparent hover:bg-slate-800";
          
          var m1Bg = (isActiveBlock && window.activeRowMonthFilter === 'm1') ? "bg-indigo-900/80 shadow-inner ring-2 ring-indigo-400" : "hover:bg-slate-700/80";
          var m2Bg = (isActiveBlock && window.activeRowMonthFilter === 'm2') ? "bg-indigo-900/80 shadow-inner ring-2 ring-indigo-400" : "hover:bg-slate-700/80";
          var m3Bg = (isActiveBlock && window.activeRowMonthFilter === 'm3') ? "bg-indigo-900/80 shadow-inner ring-2 ring-indigo-400" : "hover:bg-slate-700/80";

          blockHtml += "<div class='flex justify-between items-center p-2.5 md:p-4 rounded-xl cursor-pointer transition " + blockBgClass + "' onclick=\"window.applyFilterFromCard('" + apt + "', '" + blk + "', 'ALL')\">" +
            "<span class='text-slate-300 font-black text-sm md:text-lg w-10 md:w-16 shrink-0 pointer-events-none'>B: " + blk + "</span>" +
            "<div class='flex flex-1 justify-between text-right px-1 md:px-2 gap-1 md:gap-2'>";

          if (showM1) blockHtml += "<div onclick=\"event.stopPropagation(); window.applyFilterFromCard('" + apt + "', '" + blk + "', 'm1')\" class='flex flex-col flex-1 p-1.5 rounded-lg transition cursor-pointer " + m1Bg + "'><span class='text-slate-500 text-[9px] md:text-xs font-bold tracking-widest pointer-events-none'>" + window.trimMonth(window.monthHeadersConfig.m1) + "</span><span class='pointer-events-none " + (bD.p1 > 0 ? 'text-red-400 font-black text-sm md:text-lg' : 'text-slate-500 text-sm md:text-lg') + "'>₹" + bD.p1 + "</span></div>";
          if (showM2) blockHtml += "<div onclick=\"event.stopPropagation(); window.applyFilterFromCard('" + apt + "', '" + blk + "', 'm2')\" class='flex flex-col flex-1 p-1.5 rounded-lg transition cursor-pointer " + m2Bg + " " + (showM1 ? "border-l-2 border-slate-700" : "") + "'><span class='text-slate-500 text-[9px] md:text-xs font-bold tracking-widest pointer-events-none'>" + window.trimMonth(window.monthHeadersConfig.m2) + "</span><span class='pointer-events-none " + (bD.p2 > 0 ? 'text-amber-400 font-black text-sm md:text-lg' : 'text-slate-500 text-sm md:text-lg') + "'>₹" + bD.p2 + "</span></div>";
          if (showM3) blockHtml += "<div onclick=\"event.stopPropagation(); window.applyFilterFromCard('" + apt + "', '" + blk + "', 'm3')\" class='flex flex-col flex-1 p-1.5 rounded-lg transition cursor-pointer " + m3Bg + " " + ((showM1 || showM2) ? "border-l-2 border-slate-700" : "") + "'><span class='text-slate-500 text-[9px] md:text-xs font-bold tracking-widest pointer-events-none'>" + window.trimMonth(window.monthHeadersConfig.m3) + "</span><span class='pointer-events-none " + (bD.p3 > 0 ? 'text-amber-100 font-black text-sm md:text-lg' : 'text-slate-500 text-sm md:text-lg') + "'>₹" + bD.p3 + "</span></div>";

          blockHtml += "</div></div>";
        }
        blockHtml += "</div>";
      }

      // NEW: Injects the dynamic label into the card header
      htmlOutput += "<div class='bg-slate-800 border-4 border-slate-700 hover:border-slate-500 transition rounded-2xl md:rounded-3xl p-4 md:p-6 flex flex-col shadow-lg'>" +
        "<div class='flex justify-between items-center cursor-pointer' onclick=\"window.toggleAccordion('" + uniqueId + "', 'icon-" + uniqueId + "')\">" +
        "<div><h4 class='text-xl md:text-2xl font-black text-white leading-tight'>" + apt + "</h4>" +
        "<p class='text-xs md:text-sm text-slate-400 uppercase tracking-widest mt-1'><span class='text-red-400 font-bold'>" + dueLabel + ": ₹" + aptData.totalPend.toLocaleString('en-IN') + "</span></p></div>" +
        (blockKeys.length > 0 ? "<svg id='icon-" + uniqueId + "' class='w-6 h-6 md:w-8 md:h-8 shrink-0 ml-2 text-slate-400 transition-transform duration-200' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path stroke-linecap='round' stroke-linejoin='round' stroke-width='3' d='M19 9l-7 7-7-7'></path></svg>" : "") +
        "</div>" +
        "<div id='" + uniqueId + "' class='accordion-content'><div class='overflow-hidden'>" + blockHtml + "</div></div>" +
        "</div>";
    }
    
    grid.innerHTML = htmlOutput;
    
    // Restore Open Accordion States so the UI doesn't snap shut on the user
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
    // Update the dropdowns to match the card click
    var aptDrop = document.getElementById('filter-apt');
    if (aptDrop) aptDrop.value = apt; 
    window.updateBlockDropdown(); 
    
    var blkDrop = document.getElementById('filter-blk');
    if (blkDrop) blkDrop.value = blk; 
    
    // Let setRowMonthFilter handle the highlights and table rendering
    window.setRowMonthFilter(monthKey || 'ALL'); 
    
    document.getElementById('outstanding-tbody').scrollIntoView({ behavior: 'smooth', block: 'start' }); 
  };
  
  window.renderDetailTable = function () {
    var apt = document.getElementById('filter-apt').value;
    var blk = document.getElementById('filter-blk').value;
    var payFilter = document.getElementById('global-filter-pay') ? document.getElementById('global-filter-pay').value : 'ALL';
    var thead = document.getElementById('outstanding-thead');
    var tbody = document.getElementById('outstanding-tbody');

    // 1. Filter Data and Calculate Sums
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
        return tbody.innerHTML = "<tr><td colspan='10' class='px-6 py-12 text-center text-slate-400 font-bold text-2xl'>No records found.</td></tr>"; 
    }

    // 2. Build the Dual-Row Header
    var headHtml = "";

    // ROW 1: The Sticky Totals
    headHtml += "<tr class='bg-slate-800 text-white shadow-md'>";
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
    headHtml += "<th class='px-6 py-4 text-center text-blue-400 font-black text-xl'>" + sumCans + "</th></tr>";

    // ROW 2: The Column Titles
    headHtml += "<tr>";
    headHtml += "<th class='px-6 py-5 bg-slate-100 border-b-4 border-slate-200'>Apt / Blk / Door</th>";
    headHtml += "<th class='px-6 py-5 bg-slate-100 border-b-4 border-slate-200'>Customer Profile</th>";
    if (window.visCols.m1) headHtml += "<th class='px-6 py-5 text-right text-red-600 bg-red-50/50 border-b-4 border-slate-200'>" + window.monthHeadersConfig.m1 + "</th>";
    if (window.visCols.m2) headHtml += "<th class='px-6 py-5 text-right text-red-600 bg-slate-100 border-b-4 border-slate-200'>" + window.monthHeadersConfig.m2 + "</th>";
    if (window.visCols.m3) headHtml += "<th class='px-6 py-5 text-right text-red-600 bg-slate-100 border-b-4 border-slate-200'>" + window.monthHeadersConfig.m3 + "</th>";
    if (window.visCols.m4) headHtml += "<th class='px-6 py-5 text-right text-red-600 bg-slate-100 border-b-4 border-slate-200'>" + window.monthHeadersConfig.m4 + "</th>";
    headHtml += "<th class='px-6 py-5 text-right text-slate-900 bg-slate-200/90 border-b-4 border-slate-300'>Total Due</th>";
    if (window.visCols.adv) headHtml += "<th class='px-6 py-5 text-right text-emerald-600 bg-slate-100 border-b-4 border-slate-200'>Advance</th>";
    headHtml += "<th class='px-6 py-5 text-center text-blue-600 bg-slate-100 border-b-4 border-slate-200'>Cans</th></tr>";
    
    thead.innerHTML = headHtml;

    // 3. Render Table Rows
    var html = '';
    for (var j = 0; j < filtered.length; j++) {
      var r = filtered[j], totalDue = r.pend1 + r.pend2 + r.pend3 + r.pend4;
      var advBadge = r.advance > 0 ? "<span class='bg-emerald-100 text-emerald-800 px-4 py-2 rounded-xl border-2 border-emerald-300 text-xl font-black'>₹" + r.advance + "</span>" : "<span class='text-slate-300 font-bold'>-</span>";
      var totalDueHtml = totalDue > 0 ? "<span class='font-black text-red-600 text-2xl md:text-3xl'>₹" + totalDue.toLocaleString('en-IN') + "</span>" : "<span class='text-slate-400 font-bold text-xl'>₹0</span>";
      var rowHtml = "<tr class='hover:bg-slate-100 transition border-b-4 border-slate-50'>" +
        "<td class='px-6 py-5'><div class='text-lg font-bold text-slate-500 uppercase tracking-widest'>" + r.apartment + "</div><div class='font-black text-slate-800 text-2xl md:text-3xl'>" + (r.block || '-') + " / " + (r.door || '-') + "</div></td>" +
        "<td class='px-6 py-5'><div class='font-black text-slate-800 text-2xl md:text-3xl truncate max-w-[250px]'>" + r.name + "</div><div class='text-xl text-blue-600 font-black tracking-widest'>" + r.cpn + "</div></td>";
      if (window.visCols.m1) rowHtml += "<td class='px-6 py-5 text-right bg-red-50/30 text-2xl md:text-3xl font-black " + (r.pend1 > 0 ? 'text-red-500' : 'text-slate-300') + "'>" + (r.pend1 || '-') + "</td>";
      if (window.visCols.m2) rowHtml += "<td class='px-6 py-5 text-right text-2xl md:text-3xl font-black " + (r.pend2 > 0 ? 'text-red-500' : 'text-slate-300') + "'>" + (r.pend2 || '-') + "</td>";
      if (window.visCols.m3) rowHtml += "<td class='px-6 py-5 text-right text-2xl md:text-3xl font-black " + (r.pend3 > 0 ? 'text-red-500' : 'text-slate-300') + "'>" + (r.pend3 || '-') + "</td>";
      if (window.visCols.m4) rowHtml += "<td class='px-6 py-5 text-right text-2xl md:text-3xl font-black " + (r.pend4 > 0 ? 'text-red-500' : 'text-slate-300') + "'>" + (r.pend4 || '-') + "</td>";
      rowHtml += "<td class='px-6 py-5 text-right bg-slate-50'>" + totalDueHtml + "</td>";
      if (window.visCols.adv) rowHtml += "<td class='px-6 py-5 text-right'>" + advBadge + "</td>";
      rowHtml += "<td class='px-6 py-5 text-center'><span class='inline-flex items-center justify-center w-14 h-14 rounded-2xl text-2xl " + (r.cans > 0 ? 'bg-blue-100 text-blue-800 font-black border-4 border-blue-200' : 'bg-slate-100 text-slate-400 font-bold') + "'>" + r.cans + "</span></td></tr>";
      html += rowHtml;
    }
    tbody.innerHTML = html;
  };

  // =====================================
  // EXPORT OUTSTANDING LEDGER
  // =====================================
  window.exportOutstandingCSV = function () {
    var apt = document.getElementById('filter-apt').value;
    var blk = document.getElementById('filter-blk').value;
    var payFilter = document.getElementById('global-filter-pay') ? document.getElementById('global-filter-pay').value : 'ALL';
    var filtered = [];
    
    // 1. Gather Currently Filtered Data
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
    
    // 2. Build CSV Headers
    var csv = "Apartment,Block,Door,Name,CPN,";
    if (window.visCols.m1) csv += window.monthHeadersConfig.m1 + ",";
    if (window.visCols.m2) csv += window.monthHeadersConfig.m2 + ",";
    if (window.visCols.m3) csv += window.monthHeadersConfig.m3 + ",";
    if (window.visCols.m4) csv += window.monthHeadersConfig.m4 + ",";
    csv += "Total Due,";
    if (window.visCols.adv) csv += "Advance,";
    csv += "Cans With Customer\n";

    // 3. Build CSV Rows
    filtered.forEach(function (r) {
      var totalDue = (r.pend1 || 0) + (r.pend2 || 0) + (r.pend3 || 0) + (r.pend4 || 0);
      
      // Clean names/apts of commas so it doesn't break the CSV layout
      var cleanApt = String(r.apartment || "").replace(/,/g, ' ');
      var cleanName = String(r.name || "").replace(/,/g, ' ');
      
      csv += cleanApt + "," + (r.block || "") + "," + (r.door || "") + "," + cleanName + "," + r.cpn + ",";
      if (window.visCols.m1) csv += (r.pend1 || 0) + ",";
      if (window.visCols.m2) csv += (r.pend2 || 0) + ",";
      if (window.visCols.m3) csv += (r.pend3 || 0) + ",";
      if (window.visCols.m4) csv += (r.pend4 || 0) + ",";
      csv += totalDue + ",";
      if (window.visCols.adv) csv += (r.advance || 0) + ",";
      csv += (r.cans || 0) + "\n";
    });
    
    // 4. Download Trigger
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
    
    // Save original styling
    const originalMaxHeight = tableContainer.style.maxHeight;
    const originalOverflowY = tableContainer.style.overflowY;
    const originalOverflowX = tableContainer.style.overflowX;

    // Remove all scroll limitations and stickiness so html2pdf can map it
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
        windowWidth: tableContainer.scrollWidth // Crucial: forces canvas to see the full width
      },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' }
    };

    html2pdf().set(opt).from(tableContainer).save().then(() => {
       // Restore original scrolling and stickiness
       tableContainer.style.maxHeight = originalMaxHeight;
       tableContainer.style.overflowY = originalOverflowY;
       tableContainer.style.overflowX = originalOverflowX;
       thead.classList.add('sticky');
    });
  };
