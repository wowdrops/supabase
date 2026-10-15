
//560
  // =====================================
  // NEW: DORMANT & CRM DASHBOARD
  // =====================================

  // --- NEW CRM VARS ---
  window.crmReportMasterData = null;
  window.crmActiveCategory = null;


  window.switchCRMDashTab = function (tabNum) {
    document.getElementById('crm-dash-content-1').classList.add('hidden');
    document.getElementById('crm-dash-content-2').classList.add('hidden');

    document.getElementById('btn-crm-tab-1').className = "flex-1 px-3 md:px-6 py-3 rounded-xl text-base md:text-xl font-black bg-white text-slate-500 hover:bg-slate-100 transition text-center whitespace-nowrap";
    document.getElementById('btn-crm-tab-2').className = "flex-1 px-3 md:px-6 py-3 rounded-xl text-base md:text-xl font-black bg-white text-slate-500 hover:bg-slate-100 transition text-center whitespace-nowrap";

    document.getElementById('crm-dash-content-' + tabNum).classList.remove('hidden');
    document.getElementById('btn-crm-tab-' + tabNum).className = "flex-1 px-3 md:px-6 py-3 rounded-xl text-base md:text-xl font-black bg-slate-800 text-white shadow-md transition text-center whitespace-nowrap";

    if (tabNum === 2 && !window.crmReportMasterData) {
      window.fetchCRMDashboardStats();
    }
  };

  window.fetchCRMDashboardStats = function (days) {
    days = parseInt(days) || 7;

    // 1. Highlight Active Preset Button
    var btns = document.querySelectorAll('.crm-days-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].className = "crm-days-btn px-6 py-2.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl text-sm font-black transition-all";
    }
    var activeBtn = document.getElementById('btn-crm-days-' + days);
    if (activeBtn) {
      activeBtn.className = "crm-days-btn px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-black shadow-md transition-all";
      document.getElementById('crm-custom-days').value = "";
    }

    // 2. Update the Text Badges
    var badges = document.querySelectorAll('.crm-days-badge');
    for (var j = 0; j < badges.length; j++) {
      badges[j].innerText = "LAST " + days + " DAYS";
    }

    document.getElementById('crm-dash-loading').classList.remove('hidden');

    google.script.run.withSuccessHandler(function (res) {
      document.getElementById('crm-dash-loading').classList.add('hidden');
      if (!res.success) return alert("CRM Sync Error: " + res.message);

      window.crmReportMasterData = res.data;

      // Smart filter target injection
      function formatClickableSplit(splitObj, filterTarget) {
        var arr = [];
        for (var k in splitObj) {
          var safeKey = String(k).replace(/'/g, "\\'");
          arr.push("<button onclick=\"window.filterCRMByKeyword('" + filterTarget + "', '" + safeKey + "')\" class='bg-slate-100 hover:bg-indigo-100 hover:text-indigo-800 px-2 rounded cursor-pointer transition shadow-sm'>" + k + ": " + splitObj[k] + "</button>");
        }
        return arr.length > 0 ? arr.join("") : "No activity";
      }

      document.getElementById('crm-card-inactive').innerText = res.data.inactive.total;
      document.getElementById('crm-split-inactive').innerHTML = formatClickableSplit(res.data.inactive.splits, 'REASON');

      document.getElementById('crm-card-retained').innerText = res.data.retained.total;
      document.getElementById('crm-split-retained').innerHTML = formatClickableSplit(res.data.retained.splits, 'STATUS'); // Active vs Active Random

      document.getElementById('crm-card-wip').innerText = res.data.wip.total;
      document.getElementById('crm-split-wip').innerHTML = formatClickableSplit(res.data.wip.splits, 'STATUS');

      document.getElementById('crm-card-completed').innerText = res.data.completed.total;
      document.getElementById('crm-split-completed').innerHTML = formatClickableSplit(res.data.completed.splits, 'REASON');

      document.getElementById('crm-card-escalated').innerText = res.data.escalated.total;
      document.getElementById('crm-split-escalated').innerHTML = formatClickableSplit(res.data.escalated.splits, 'REASON');

      if (!document.getElementById('crm-detailed-report').classList.contains('hidden')) {
        window.renderCRMTable();
      }

    }).getCRMDashboardStats(days);
  };
  window.fetchDormantSummaryCards = function () {
    var c7 = document.getElementById('dormant-7');
    if (c7) c7.classList.add('animate-pulse');

    google.script.run.withSuccessHandler(function (res) {
      if (c7) c7.classList.remove('animate-pulse');
      if (res.success) {
        document.getElementById('dormant-7').innerText = res.counts.exactly7;
        document.getElementById('dormant-10').innerText = res.counts.days7to10;
        document.getElementById('dormant-15').innerText = res.counts.days10to15;
        document.getElementById('dormant-30').innerText = res.counts.days15to30;
      } else {
        console.error("Dormant Card Error: ", res.message);
      }
    }).getDormantDashboardCounts();
  };

  // Smart Filter function
  window.filterCRMByKeyword = function (filterTarget, keyword) {
    event.stopPropagation();

    // Clear both inputs first
    document.getElementById('crm-flt-status').value = "";
    document.getElementById('crm-flt-reason').value = "";

    if (filterTarget === 'STATUS') {
      document.getElementById('crm-flt-status').value = keyword;
    } else {
      document.getElementById('crm-flt-reason').value = keyword;
    }

    window.renderCRMTable();
  };


  window.loadCRMReportData = function (categoryType) {
    if (!window.crmReportMasterData) return;
    window.crmActiveCategory = categoryType;
    document.getElementById('crm-detailed-report').classList.remove('hidden');

    var titles = {
      'INACTIVE': 'Lost Customers (Active -> Inactive)',
      'RETAINED': 'Retained / Saved (Active -> Active/Random)',
      'WIP': 'Pending & WIP Queue',
      'COMPLETED': 'Closed / Resolved Calls',
      'ESCALATED': 'Admin Escalations Required'
    };
    document.getElementById('crm-report-title').innerText = titles[categoryType];

    // --- NEW: Highlight the active KPI card ---
    // 1. Remove highlight from all cards
    var allCards = document.querySelectorAll('.crm-kpi-card');
    for (var c = 0; c < allCards.length; c++) {
      allCards[c].classList.remove('ring-4', 'ring-indigo-600', 'ring-offset-2', 'scale-[1.02]');
    }
    // 2. Add highlight to the specific clicked card
    var activeCard = document.getElementById('crm-card-container-' + categoryType);
    if (activeCard) {
      activeCard.classList.add('ring-4', 'ring-indigo-600', 'ring-offset-2', 'scale-[1.02]');
    }
    // ------------------------------------------

    document.getElementById('crm-flt-cpn').value = "";
    document.getElementById('crm-flt-status').value = "";
    document.getElementById('crm-flt-reason').value = "";
    document.getElementById('crm-flt-date').value = "";

    window.renderCRMTable();
    document.getElementById('crm-detailed-report').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  window.renderCRMTable = function () {
    if (!window.crmActiveCategory || !window.crmReportMasterData) return;

    var keyMap = { 'INACTIVE': 'inactive', 'RETAINED': 'retained', 'WIP': 'wip', 'COMPLETED': 'completed', 'ESCALATED': 'escalated' };
    var sourceData = window.crmReportMasterData[keyMap[window.crmActiveCategory]].rows;

    var fCpn = document.getElementById('crm-flt-cpn').value.trim().toUpperCase();
    var fStat = document.getElementById('crm-flt-status').value.trim().toUpperCase();
    var fReas = document.getElementById('crm-flt-reason').value.trim().toUpperCase();
    var fDate = document.getElementById('crm-flt-date').value;

    var filtered = [];
    for (var i = 0; i < sourceData.length; i++) {
      var r = sourceData[i];

      var matchCpn = fCpn === "" || String(r.cpn).toUpperCase().indexOf(fCpn) > -1 || String(r.name).toUpperCase().indexOf(fCpn) > -1;

      var rCallStat = String(r.callStatus).trim().toUpperCase();
      if (rCallStat === "") rCallStat = "PENDING";
      var rNewStat = String(r.newStatus).trim().toUpperCase();
      var matchStat = fStat === "" || rCallStat.indexOf(fStat) > -1 || rNewStat.indexOf(fStat) > -1;

      var matchReas = fReas === "" || String(r.reason).toUpperCase().indexOf(fReas) > -1 || String(r.tcRemark).toUpperCase().indexOf(fReas) > -1 || String(r.actionBy).toUpperCase().indexOf(fReas) > -1;

      var matchDate = true;
      if (fDate) {
        var fParts = fDate.split('-');
        if (fParts.length === 3) {
          var rowDateObj = new Date(r.ts);
          var rY = rowDateObj.getFullYear();
          var rM = String(rowDateObj.getMonth() + 1).padStart(2, '0');
          var rD = String(rowDateObj.getDate()).padStart(2, '0');
          var rowDateStr = rY + "-" + rM + "-" + rD;

          if (rowDateStr !== fDate) {
            matchDate = false;
          }
        }
      }

      if (matchCpn && matchStat && matchReas && matchDate) filtered.push(r);
    }

    var tb = document.getElementById('crm-detailed-tbody');
    var countBadge = document.getElementById('crm-table-count');

    // --- NEW: Update the Live Record Count ---
    if (filtered.length === 0) {
      countBadge.innerText = "0 Records";
      countBadge.className = "bg-rose-100 border border-rose-300 text-rose-800 px-3 py-1 rounded-lg text-sm font-black tracking-widest hidden sm:inline-block";
      tb.innerHTML = "<tr><td colspan='6' class='text-center p-8 font-bold text-slate-400'>No records match the current filters.</td></tr>";
      return;
    }

    countBadge.innerText = filtered.length + " Record" + (filtered.length > 1 ? "s" : "");
    countBadge.className = "bg-indigo-100 border border-indigo-300 text-indigo-800 px-3 py-1 rounded-lg text-sm font-black tracking-widest hidden sm:inline-block";
    // -----------------------------------------

    var h = "";
    for (var j = 0; j < filtered.length; j++) {
      var r = filtered[j];
      var escalateBadge = r.tcRemark.indexOf("⚠️") > -1 ? "bg-rose-100 border-rose-300" : "bg-white";
      var dispCallStatus = String(r.callStatus).trim() === "" ? "PENDING" : r.callStatus;

      h += "<tr class='hover:bg-slate-50 border-b border-slate-100 " + escalateBadge + "'>" +
        "<td class='px-4 py-3 whitespace-normal'><span class='font-bold text-slate-800 block'>" + r.enterDate + "</span><span class='text-xs text-slate-400'>" + r.logId + "</span></td>" +
        "<td class='px-4 py-3 whitespace-normal'><span class='font-black text-indigo-600 block'>" + r.cpn + "</span><span class='text-sm text-slate-600 font-bold'>" + r.name + "</span></td>" +
        "<td class='px-4 py-3 whitespace-normal'><span class='line-through text-slate-400 text-xs'>" + r.prevStatus + "</span><br/><span class='font-bold text-emerald-600'>" + r.newStatus + "</span></td>" +
        "<td class='px-4 py-3'><span class='bg-slate-100 px-3 py-1 rounded-full text-xs font-black uppercase border border-slate-200'>" + dispCallStatus + "</span></td>" +
        "<td class='px-4 py-3 whitespace-normal min-w-[200px]'><p class='text-sm font-bold text-indigo-600'>" + r.reason + "</p><p class='text-xs font-bold text-slate-700 mt-1'>" + r.tcRemark + "</p></td>" +
        "<td class='px-4 py-3 whitespace-normal'><span class='text-sm font-black text-slate-800 block'>" + r.actionBy + "</span><span class='text-xs font-bold text-emerald-600'>" + r.lastUpdateDate + "</span></td>" +
        "</tr>";
    }
    tb.innerHTML = h;
  };
