// ==========================================
// 1. DASHBOARD UI CONTROLS & ROUTING
// ==========================================

window.switchDashTab = function (tabNum) {
  for (let i = 1; i <= 3; i++) {
    let contentEl = document.getElementById('dash-content-' + i);
    let btnEl = document.getElementById('btn-dash-tab-' + i);
    if (contentEl) contentEl.classList.add('hidden');
    if (btnEl) btnEl.className = "flex-1 px-3 md:px-6 py-3 rounded-xl text-base md:text-xl font-black bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-center whitespace-nowrap";
  }

  let activeContent = document.getElementById('dash-content-' + tabNum);
  let activeBtn = document.getElementById('btn-dash-tab-' + tabNum);
  if (activeContent) activeContent.classList.remove('hidden');
  if (activeBtn) activeBtn.className = "flex-1 px-3 md:px-6 py-3 rounded-xl text-base md:text-xl font-black bg-slate-800 dark:bg-blue-600 text-white shadow-md transition-colors text-center whitespace-nowrap";
  window.dashboardReturnState = tabNum;
  
  // Auto-sync the mobile bottom tab bar if it exists
  if (typeof window.updateMobileNav === 'function') {
      window.updateMobileNav(tabNum);
  }
};

window.formatDateForInput = function (dateStr) {
  if (!dateStr) return "";
  var d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.getFullYear() + "-" + (d.getMonth() + 1).toString().padStart(2, '0') + "-" + d.getDate().toString().padStart(2, '0');
};

function formatDisplayDate(dateStr) {
  if (!dateStr) return "N/A";
  var parts = dateStr.split('-');
  if (parts.length === 3) {
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }
  var d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

window.switchDefaulterView = function (viewType) {
  var btnHigh = document.getElementById('btn-def-highest');
  var btnOld = document.getElementById('btn-def-oldest');
  if (btnHigh) btnHigh.className = "flex-1 md:flex-none px-3 py-1.5 rounded-lg text-xs md:text-sm font-black transition-colors " + (viewType === 'highest' ? 'bg-white dark:bg-slate-700 shadow-sm text-red-700 dark:text-red-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white');
  if (btnOld) btnOld.className = "flex-1 md:flex-none px-3 py-1.5 rounded-lg text-xs md:text-sm font-black transition-colors " + (viewType === 'oldest' ? 'bg-white dark:bg-slate-700 shadow-sm text-red-700 dark:text-red-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white');

  var list = (window.defaultersData && window.defaultersData[viewType]) ? window.defaultersData[viewType] : [];
  var tableHtml = '';
  if (list.length === 0) {
    tableHtml = "<tr><td colspan='4' class='px-4 py-8 text-center text-slate-400 dark:text-slate-500 font-bold text-sm md:text-lg transition-colors'>No outstanding debts found.</td></tr>";
  } else {
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      var waNum = String(c.contact || '').replace(/\D/g, '');
      var actionLinks = "";
      if (c.contact) {
        actionLinks += "<a href='tel:" + c.contact + "' target='_top' class='inline-block bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 px-3 py-1.5 rounded-lg text-xs md:text-sm font-black border border-blue-200 dark:border-blue-800 shadow-sm mr-2 transition-colors'>Call</a>";
        actionLinks += "<a href='https://wa.me/" + waNum + "' target='_blank' class='inline-block bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 px-3 py-1.5 rounded-lg text-xs md:text-sm font-black border border-emerald-200 dark:border-emerald-800 shadow-sm transition-colors'>WA</a>";
      } else { 
        actionLinks = "<span class='text-xs md:text-sm text-slate-400 dark:text-slate-500 font-bold transition-colors'>No Number</span>"; 
      }
      
      let cpnBadgeHtml = `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 mt-1 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded hover:bg-red-100 dark:hover:bg-red-900/50 hover:shadow-sm active:scale-95 transition-all cursor-pointer group text-[10px] md:text-xs font-bold" onclick="window.openCustomer360('${c.cpn || ''}')">
        ${c.cpn || 'UNKNOWN'}
        <svg class="w-3 h-3 text-red-400 group-hover:text-red-700 dark:group-hover:text-red-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
      </span>`;

      tableHtml += "<tr class='hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors border-b-2 border-slate-100 dark:border-slate-700/50'>" +
        "<td class='px-4 py-3'><p class='font-black text-slate-800 dark:text-white text-sm md:text-lg'>" + (c.name || 'Unknown') + "</p>" + (c.cpn ? cpnBadgeHtml : "") + "</td>" +
        "<td class='px-4 py-3 text-xs md:text-sm font-bold text-slate-500 dark:text-slate-400 uppercase'>" + (c.apt || '') + (c.blk ? " - " + c.blk : "") + "</td>" +
        "<td class='px-4 py-3 text-right font-black text-red-600 dark:text-red-400 text-lg md:text-2xl transition-colors'>₹" + (Number(c.due || 0)).toLocaleString('en-IN') + "</td>" +
        "<td class='px-4 py-3 text-center'>" + actionLinks + "</td>" +
        "</tr>";
    }
  }
  var tbody = document.getElementById('dash-defaulters');
  if (tbody) tbody.innerHTML = tableHtml;
};

// ==========================================
// 2. SUPABASE METRICS ENGINE
// ==========================================
window.activeDashTimerInterval = null;

window.loadDashboardData = async function (forceRefresh) {
  var startTime = performance.now();
  var loadBadge = document.getElementById('dash-load-time');
  if (loadBadge) loadBadge.classList.add('hidden');

  var loadingEl = document.getElementById('dash-loading');
  if (loadingEl) {
    loadingEl.innerText = "Querying Supabase database...";
    loadingEl.classList.remove('hidden');
  }

  var content1 = document.getElementById('dash-content-1');
  var content2 = document.getElementById('dash-content-2');
  var content3 = document.getElementById('dash-content-3');
  if (content1) content1.classList.add('hidden');
  if (content2) content2.classList.add('hidden');
  if (content3) content3.classList.add('hidden');

  if (window.activeDashTimerInterval) clearInterval(window.activeDashTimerInterval);
  window.activeDashTimerInterval = setInterval(function() {
      var curr = ((performance.now() - startTime) / 1000).toFixed(2);
      if (loadingEl) loadingEl.innerText = "Querying Supabase... (" + curr + "s)";
  }, 100);

  try {
    const supa = window.supabase1;
    if (!supa) throw new Error("window.supabase1 is not initialized. Please check supabase_config.js.");

    var now = new Date();
    var todayStartStr = now.toISOString().split('T')[0];

    var thirtyDaysAgoDate = new Date();
    thirtyDaysAgoDate.setDate(thirtyDaysAgoDate.getDate() - 30);
    var thirtyDaysAgoStr = thirtyDaysAgoDate.toISOString();

    const [
      ordersRes, setupRes, deliveryRes, salesRes, paysRes, outstandingRes, customersRes, logsRes       
    ] = await Promise.all([
      supa.from('orders').select('cpn_no, ord_d, ord_e, rate, amount, pending_qty, replace_qty'),
      supa.from('setup').select('key, value').in('key', ['PER_DAY_COUNT', 'RESTRICT_QTY', 'MIN_ENTRY_QTY', 'SUPPLY_STATUS']),
      supa.from('deliveries').select('cpn_no,act_d,act_e,ord_d,rate,default_rate,delivery_entered_at,door_delivery_link,status,door_qc,act_d_vj,act_d_nvj,act_e_vj,act_e_nvj'),
      supa.from('sales').select('cpn_no, del_date, act_d, act_e, amount').lte('del_date', todayStartStr).order('del_date', { ascending: false }).limit(1000),
      supa.from('pays').select('cpn_no, payment_date, amount').lte('payment_date', todayStartStr).order('payment_date', { ascending: false }).limit(1000),
      supa.from('v_customer_outstanding').select('*'),
      supa.from('ac_customers').select('cpn_no, final_status, pay_type, can_deposit, default_rate, created_at, inactive_reason, waiver_request, overdue_waiver'),
      supa.from('crm_dormant_call_logs').select('previous_customer_status, new_customer_status, reason_for_dormancy').gte('created_at', thirtyDaysAgoStr)
    ]);

    // Error logging silently handles missing data
    if (ordersRes.error) console.warn("Orders Query Warning:", ordersRes.error);
    if (outstandingRes.error) console.warn("Outstanding Query Warning:", outstandingRes.error);
    if (customersRes && customersRes.error) console.warn("Customers Query Warning:", customersRes.error);
    if (logsRes && logsRes.error) console.warn("Logs Query Warning:", logsRes.error);

    // ----------------------------------------------------
    // A. CAPACITY & LIVE ORDERS
    // ----------------------------------------------------
    var ordList = ordersRes.data || [];
    var ordCount = 0, ordCans = 0, ordEmpties = 0, ordAmt = 0, ordPend = 0, ordRep = 0;

    ordList.forEach(function (r) {
      if (!r.cpn_no) return;
      ordCount++;
      var cans = Number(r.ord_d || 0);
      var empties = Number(r.ord_e || 0);
      var rate = Number(r.rate || 0);
      var rowAmt = Number(r.amount || 0);
      if (!rowAmt && cans > 0 && rate > 0) rowAmt = cans * rate;

      ordCans += cans;
      ordEmpties += empties;
      ordAmt += rowAmt;
      ordPend += Number(r.pending_qty || 0);
      ordRep += Number(r.replace_qty || 0);
    });

    var configMap = {};
    (setupRes.data || []).forEach(function (row) { configMap[row.key] = row.value; });
    var totalAllowed = Number(configMap['PER_DAY_COUNT']) || 200;
    var physicalDemand = ordCans - ordPend;
    var available = totalAllowed - physicalDemand;

    if(document.getElementById('dash-ord-count')) document.getElementById('dash-ord-count').innerText = ordCount + " Orders";
    if(document.getElementById('dash-ord-amt')) document.getElementById('dash-ord-amt').innerText = "₹" + ordAmt.toLocaleString('en-IN');
    if(document.getElementById('dash-ord-cans')) document.getElementById('dash-ord-cans').innerText = ordCans;
    if(document.getElementById('dash-ord-empties')) document.getElementById('dash-ord-empties').innerText = ordEmpties;
    if(document.getElementById('dash-ord-allowed')) document.getElementById('dash-ord-allowed').innerText = totalAllowed;
    if(document.getElementById('dash-ord-avail')) document.getElementById('dash-ord-avail').innerText = available;
    if(document.getElementById('dash-ord-normal')) document.getElementById('dash-ord-normal').innerText = physicalDemand;
    if(document.getElementById('dash-ord-pend')) document.getElementById('dash-ord-pend').innerText = ordPend;
    if(document.getElementById('dash-ord-rep')) document.getElementById('dash-ord-rep').innerText = ordRep;

    // ----------------------------------------------------
    // B. LIVE DELIVERY
    // ----------------------------------------------------
    var delList = deliveryRes.data || [];
    var delCustCount = 0, delActD = 0, delActE = 0, delOrdD = 0, delSalesAmt = 0;
    var doorsDelivered = 0, doorsPending = 0;

    delList.forEach(function (d) {
      if (!d.cpn_no) return;
      delCustCount++;
      
      var actD = Number(d.act_d) || (Number(d.act_d_vj || 0) + Number(d.act_d_nvj || 0));
      var actE = Number(d.act_e) || (Number(d.act_e_vj || 0) + Number(d.act_e_nvj || 0));
      var rate = Number(d.rate) || Number(d.default_rate) || 0;
      var rowAmt = (Number(d.act_d) || 0) * (Number(d.rate || d.default_rate) || 0);
      
      if (!rowAmt && actD > 0 && rate > 0) rowAmt = actD * rate;

      delActD += actD;
      delActE += actE;
      delOrdD += Number(d.ord_d || 0);
      delSalesAmt += rowAmt;

      var isDone = !!d.delivery_entered_at || !!d.door_delivery_link || String(d.status || '').toUpperCase() === 'DELIVERED' || String(d.door_qc || '').toUpperCase() === 'PASS' || String(d.door_qc || '').toUpperCase() === 'TRUE' || d.door_qc === true;
      
      if (isDone) {
        doorsDelivered++;
      } else {
        doorsPending++;
      }
    });

    if(document.getElementById('dash-del-amt')) document.getElementById('dash-del-amt').innerText = "₹" + delSalesAmt.toLocaleString('en-IN');
    if(document.getElementById('dash-del-cust')) document.getElementById('dash-del-cust').innerText = delCustCount;
    if(document.getElementById('dash-del-ord')) document.getElementById('dash-del-ord').innerText = delOrdD;
    if(document.getElementById('dash-del-actd')) document.getElementById('dash-del-actd').innerText = delActD;
    if(document.getElementById('dash-del-acte')) document.getElementById('dash-del-acte').innerText = delActE;
    if(document.getElementById('dash-del-doors-done')) document.getElementById('dash-del-doors-done').innerText = doorsDelivered;
    if(document.getElementById('dash-del-doors-pend')) document.getElementById('dash-del-doors-pend').innerText = doorsPending;

    // ----------------------------------------------------
    // C. SALES BY DATE HASH-MAP
    // ----------------------------------------------------
    var salesByDate = {};
    (salesRes.data || []).forEach(function (s) {
      if (!s.del_date) return;
      var dKey = String(s.del_date).substring(0, 10);
      if (dKey > todayStartStr) return;
      if (!salesByDate[dKey]) salesByDate[dKey] = { cans: 0, empties: 0, amt: 0 };
      salesByDate[dKey].cans += Number(s.act_d || 0);
      salesByDate[dKey].empties += Number(s.act_e || 0);
      salesByDate[dKey].amt += Number(s.amount || 0);
    });

    var sortedSalesDates = Object.keys(salesByDate).sort().reverse();
    var sLastDate = sortedSalesDates[0] || null;
    var sSecondLastDate = sortedSalesDates[1] || null;
    var sLast = sLastDate ? salesByDate[sLastDate] : { cans: 0, empties: 0, amt: 0 };
    var sSecondLast = sSecondLastDate ? salesByDate[sSecondLastDate] : { cans: 0, empties: 0, amt: 0 };

    if(document.getElementById('dash-sales-amt')) document.getElementById('dash-sales-amt').innerText = "₹" + sLast.amt.toLocaleString('en-IN');
    if(document.getElementById('dash-sales-cans')) document.getElementById('dash-sales-cans').innerText = sLast.cans;
    if(document.getElementById('dash-sales-empties')) document.getElementById('dash-sales-empties').innerText = sLast.empties;
    if(document.getElementById('dash-label-sales-last')) document.getElementById('dash-label-sales-last').innerText = "Sales: " + (sLastDate ? formatDisplayDate(sLastDate) : "None");
    if(document.getElementById('dash-label-sales-secondlast')) document.getElementById('dash-label-sales-secondlast').innerText = sSecondLastDate ? formatDisplayDate(sSecondLastDate) : "Previous";
    if(document.getElementById('dash-sales-yday')) document.getElementById('dash-sales-yday').innerText = "₹" + sSecondLast.amt.toLocaleString('en-IN');

    // ----------------------------------------------------
    // D. PAYS BY DATE HASH-MAP & ACTIVE PAYS
    // ----------------------------------------------------
    var paysByDate = {};
    (paysRes.data || []).forEach(function (p) {
      if (!p.payment_date) return;
      var pKey = String(p.payment_date).substring(0, 10);
      if (pKey > todayStartStr) return;
      if (!paysByDate[pKey]) paysByDate[pKey] = { total: 0, cpnMap: {} };
      var amt = Number(p.amount || 0);
      paysByDate[pKey].total += amt;
      var cpn = String(p.cpn_no || '').trim();
      if (cpn) {
        paysByDate[pKey].cpnMap[cpn] = (paysByDate[pKey].cpnMap[cpn] || 0) + amt;
      }
    });

    var sortedPaysDates = Object.keys(paysByDate).sort().reverse();
    var pLastDate = sortedPaysDates[0] || null;
    var pSecondLastDate = sortedPaysDates[1] || null;
    var pLastTotal = pLastDate ? paysByDate[pLastDate].total : 0;
    var pSecondLastTotal = pSecondLastDate ? paysByDate[pSecondLastDate].total : 0;
    var activePays = pLastDate ? paysByDate[pLastDate].cpnMap : {};

    if(document.getElementById('dash-pays-amt')) document.getElementById('dash-pays-amt').innerText = "₹" + pLastTotal.toLocaleString('en-IN');
    if(document.getElementById('dash-label-pays-last')) document.getElementById('dash-label-pays-last').innerText = "Payments: " + (pLastDate ? formatDisplayDate(pLastDate) : "None");
    if(document.getElementById('dash-label-pays-secondlast')) document.getElementById('dash-label-pays-secondlast').innerText = pSecondLastDate ? formatDisplayDate(pSecondLastDate) : "Previous";
    if(document.getElementById('dash-pays-yday')) document.getElementById('dash-pays-yday').innerText = "₹" + pSecondLastTotal.toLocaleString('en-IN');

    // ----------------------------------------------------
    // E. OUTSTANDING LEDGER & FIFO ALLOCATION
    // ----------------------------------------------------
    var outList = outstandingRes.data || [];
    var grandTotal = 0;
    var m1_total = 0, m2_total = 0, m3_total = 0, m4_total = 0;
    var netPay = { total: 0, currCleared: 0, prevCleared: 0, olderCleared: 0 };
    var customers = [];

    outList.forEach(function (r) {
      var cCpn = String(r.cpn_no || '').trim();
      var cDue1 = Number(r.current_month_pending || r.m1_pending || 0);
      var cDue2 = Number(r.m1_pending || r.m2_pending || 0);
      var cDue3 = Number(r.m2_pending || r.m3_pending || 0);
      var cDue4 = Number(r.old_pending || r.m4_pending || 0);
      var due = Number(r.current_balance !== undefined ? r.current_balance : (cDue1 + cDue2 + cDue3 + cDue4));

      grandTotal += due;
      m1_total += cDue1;
      m2_total += cDue2;
      m3_total += cDue3;
      m4_total += cDue4;

      if (cCpn && activePays[cCpn]) {
        var p = activePays[cCpn];
        netPay.total += p;
        var clOld = Math.min(p, (cDue4 + cDue3));
        p -= clOld;
        netPay.olderCleared += clOld;

        var clPrev = Math.min(p, cDue2);
        p -= clPrev;
        netPay.prevCleared += clPrev;

        var clCurr = Math.min(p, cDue1);
        p -= clCurr;
        netPay.currCleared += clCurr;
      }

      if (due > 0) {
        customers.push({
          cpn: cCpn,
          name: r.name || r.poc1 || r.customer_name || cCpn || "Unknown",
          contact: r.contact || r.con1 || r.phone || "",
          apt: r.apartment || r.block || "",
          blk: r.block || "",
          due: due,
          oldestDue: (cDue4 + cDue3)
        });
      }
    });

    if(document.getElementById('dash-grand-out')) document.getElementById('dash-grand-out').innerText = "₹" + grandTotal.toLocaleString('en-IN');
    var currMonthName = now.toLocaleString('default', { month: 'short', year: 'numeric' });
    var prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    var prevMonthName = prevMonthDate.toLocaleString('default', { month: 'short', year: 'numeric' });

    if(document.getElementById('lbl-curr-month')) document.getElementById('lbl-curr-month').innerText = currMonthName;
    if(document.getElementById('curr-pend')) document.getElementById('curr-pend').innerText = "₹" + m1_total.toLocaleString('en-IN');
    if(document.getElementById('lbl-prev-month')) document.getElementById('lbl-prev-month').innerText = prevMonthName;
    if(document.getElementById('prev-pend')) document.getElementById('prev-pend').innerText = "₹" + m2_total.toLocaleString('en-IN');

    if(document.getElementById('dash-clean-pay')) document.getElementById('dash-clean-pay').innerText = "₹" + netPay.total.toLocaleString('en-IN');
    if(document.getElementById('dash-pay-curr')) document.getElementById('dash-pay-curr').innerText = "₹" + netPay.currCleared.toLocaleString('en-IN');
    if(document.getElementById('dash-pay-prev')) document.getElementById('dash-pay-prev').innerText = "₹" + netPay.prevCleared.toLocaleString('en-IN');
    if(document.getElementById('dash-pay-older')) document.getElementById('dash-pay-older').innerText = "₹" + netPay.olderCleared.toLocaleString('en-IN');

    // ----------------------------------------------------
    // F. TOP 10 DEFAULTERS 
    // ----------------------------------------------------
    var highestList = customers.slice().sort(function (a, b) { return b.due - a.due; }).slice(0, 10);
    var oldestList = customers.slice().sort(function (a, b) {
      if (b.oldestDue === a.oldestDue) return b.due - a.due;
      return b.oldestDue - a.oldestDue;
    }).slice(0, 10);

    window.defaultersData = { highest: highestList, oldest: oldestList };
    window.switchDefaulterView('highest');

    // ----------------------------------------------------
    // G. CUSTOMER OVERVIEW ENGINE (RESPONSIVE FONTS)
    // ----------------------------------------------------
    var custResData = customersRes ? (customersRes.data || []) : [];
    var logsResData = logsRes ? (logsRes.data || []) : [];

    var masterStatus = { 'ACTIVE': 0, 'ACTIVE RANDOM': 0, 'INACTIVE': 0 };
    var payCash = { 'ACTIVE': 0, 'ACTIVE RANDOM': 0, 'INACTIVE': 0 };
    var payOnline = { 'ACTIVE': 0, 'ACTIVE RANDOM': 0, 'INACTIVE': 0 };
    var payNone = { 'ACTIVE': 0, 'ACTIVE RANDOM': 0, 'INACTIVE': 0 };
    var advHolders = { 'ACTIVE': {c:0, s:0}, 'ACTIVE RANDOM': {c:0, s:0}, 'INACTIVE': {c:0, s:0} };
    var noAdv = { 'ACTIVE': 0, 'ACTIVE RANDOM': 0, 'INACTIVE': 0 };
    var zeroRate = { 'ACTIVE': 0, 'ACTIVE RANDOM': 0, 'INACTIVE': 0 };
    var joined30 = { 'ACTIVE': 0, 'ACTIVE RANDOM': 0, 'INACTIVE': 0 };
    var waivers = { 'ACTIVE': 0, 'ACTIVE RANDOM': 0, 'INACTIVE': 0 };
    var inactiveReasons = {};

    custResData.forEach(function(c) {
       var rawStat = String(c.final_status || '').toUpperCase().trim();
       var stat = 'INACTIVE';
       if (rawStat === 'ACTIVE') stat = 'ACTIVE';
       else if (rawStat === 'ACTIVE RANDOM') stat = 'ACTIVE RANDOM';

       masterStatus[stat]++;

       var pType = String(c.pay_type || '').toUpperCase().trim();
       if (pType === 'CASH') payCash[stat]++;
       else if (pType === 'ONLINE') payOnline[stat]++;
       else payNone[stat]++;

       var dep = Number(c.can_deposit || 0);
       if (dep > 0) {
          advHolders[stat].c++;
          advHolders[stat].s += dep;
       } else {
          noAdv[stat]++;
       }

       if (Number(c.default_rate || 0) === 0) zeroRate[stat]++;
       if (c.created_at && new Date(c.created_at) >= thirtyDaysAgoDate) joined30[stat]++;

       if (stat === 'INACTIVE') {
          var rsn = String(c.inactive_reason || 'UNSPECIFIED').toUpperCase().trim();
          if(!rsn) rsn = 'UNSPECIFIED';
          inactiveReasons[rsn] = (inactiveReasons[rsn] || 0) + 1;
       }

       if (c.waiver_request === true || String(c.waiver_request).toUpperCase() === 'TRUE' ||
           c.overdue_waiver === true || String(c.overdue_waiver).toUpperCase() === 'TRUE') {
          waivers[stat]++;
       }
    });

    var churnReasons = {};
    var totalChurn = 0;
    logsResData.forEach(function(log) {
       var prev = String(log.previous_customer_status || '').toUpperCase().trim();
       var curr = String(log.new_customer_status || '').toUpperCase().trim();
       if (prev === 'ACTIVE' && curr === 'INACTIVE') {
          totalChurn++;
          var r = String(log.reason_for_dormancy || 'UNSPECIFIED').toUpperCase().trim();
          if(!r) r = 'UNSPECIFIED';
          churnReasons[r] = (churnReasons[r] || 0) + 1;
       }
    });

    // Helper functions updated to use fully responsive tailwind text classes
    function bRow(lbl, typeKey, act, rnd, ina) {
       return '<div><p class="text-[10px] md:text-xs font-black text-slate-500 dark:text-slate-400 uppercase mb-1 md:mb-1.5 tracking-wider transition-colors">' + lbl + '</p>' +
              '<div class="flex gap-2">' +
              '<button onclick="window.navigateFromDashboard(\'reports-customer\', \'ACTIVE|' + typeKey + '\', \'Operations & Ledger\')" class="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 hover:bg-emerald-200 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 px-2 py-1.5 rounded-lg text-[9px] md:text-xs font-black w-full text-center shadow-sm transition-colors active:scale-95">ACT: ' + act + '</button>' +
              '<button onclick="window.navigateFromDashboard(\'reports-customer\', \'ACTIVE RANDOM|' + typeKey + '\', \'Operations & Ledger\')" class="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 hover:bg-blue-200 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-400 px-2 py-1.5 rounded-lg text-[9px] md:text-xs font-black w-full text-center shadow-sm transition-colors active:scale-95">RND: ' + rnd + '</button>' +
              '<button onclick="window.navigateFromDashboard(\'reports-customer\', \'INACTIVE|' + typeKey + '\', \'Operations & Ledger\')" class="bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800 hover:bg-rose-200 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-400 px-2 py-1.5 rounded-lg text-[9px] md:text-xs font-black w-full text-center shadow-sm transition-colors active:scale-95">INA: ' + ina + '</button>' +
              '</div></div>';
    }

    function bAdv(lbl, data) {
       return '<div><p class="text-[10px] md:text-xs font-black text-slate-500 dark:text-slate-400 uppercase mb-1 md:mb-1.5 tracking-wider transition-colors">' + lbl + '</p>' +
              '<div class="flex flex-col gap-1.5">' +
              '<button onclick="window.navigateFromDashboard(\'reports-customer\', \'ACTIVE|ADVANCE\', \'Operations & Ledger\')" class="flex justify-between items-center bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-200 dark:hover:bg-emerald-900/40 border border-emerald-100 dark:border-emerald-800 px-2 py-1.5 rounded-lg shadow-sm text-[10px] md:text-xs font-black text-emerald-800 dark:text-emerald-400 transition-colors active:scale-95"><span>ACT (' + data['ACTIVE'].c + ')</span> <span>₹' + data['ACTIVE'].s.toLocaleString('en-IN') + '</span></button>' +
              '<button onclick="window.navigateFromDashboard(\'reports-customer\', \'ACTIVE RANDOM|ADVANCE\', \'Operations & Ledger\')" class="flex justify-between items-center bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-200 dark:hover:bg-blue-900/40 border border-blue-100 dark:border-blue-800 px-2 py-1.5 rounded-lg shadow-sm text-[10px] md:text-xs font-black text-blue-800 dark:text-blue-400 transition-colors active:scale-95"><span>RND (' + data['ACTIVE RANDOM'].c + ')</span> <span>₹' + data['ACTIVE RANDOM'].s.toLocaleString('en-IN') + '</span></button>' +
              '<button onclick="window.navigateFromDashboard(\'reports-customer\', \'INACTIVE|ADVANCE\', \'Operations & Ledger\')" class="flex justify-between items-center bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-200 dark:hover:bg-rose-900/40 border border-rose-100 dark:border-rose-800 px-2 py-1.5 rounded-lg shadow-sm text-[10px] md:text-xs font-black text-rose-800 dark:text-rose-400 transition-colors active:scale-95"><span>INA (' + data['INACTIVE'].c + ')</span> <span>₹' + data['INACTIVE'].s.toLocaleString('en-IN') + '</span></button>' +
              '</div></div>';
    }

    var eMaster = document.getElementById('ui-dash-master-status');
    if(eMaster) eMaster.innerHTML = 
       '<button onclick="window.navigateFromDashboard(\'reports-customer\', \'ACTIVE|CUSTOMER_LIST\', \'Operations & Ledger\')" class="w-full flex justify-between items-center p-3 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-200 dark:hover:bg-emerald-900/40 rounded-xl border border-emerald-200 dark:border-emerald-800 shadow-sm transition-colors active:scale-95"><span class="font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest text-xs md:text-sm">ACTIVE</span> <span class="text-xl md:text-2xl font-black text-emerald-900 dark:text-emerald-300">' + masterStatus['ACTIVE'] + '</span></button>' +
       '<button onclick="window.navigateFromDashboard(\'reports-customer\', \'ACTIVE RANDOM|CUSTOMER_LIST\', \'Operations & Ledger\')" class="w-full flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-200 dark:hover:bg-blue-900/40 rounded-xl border border-blue-200 dark:border-blue-800 shadow-sm transition-colors active:scale-95"><span class="font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest text-xs md:text-sm">ACTIVE RANDOM</span> <span class="text-xl md:text-2xl font-black text-blue-900 dark:text-blue-300">' + masterStatus['ACTIVE RANDOM'] + '</span></button>' +
       '<button onclick="window.navigateFromDashboard(\'reports-customer\', \'INACTIVE|CUSTOMER_LIST\', \'Operations & Ledger\')" class="w-full flex justify-between items-center p-3 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-200 dark:hover:bg-rose-900/40 rounded-xl border border-rose-200 dark:border-rose-800 shadow-sm transition-colors active:scale-95"><span class="font-black text-rose-700 dark:text-rose-400 uppercase tracking-widest text-xs md:text-sm">INACTIVE</span> <span class="text-xl md:text-2xl font-black text-rose-900 dark:text-rose-300">' + masterStatus['INACTIVE'] + '</span></button>';

    var eJoin = document.getElementById('ui-dash-joined');
    if(eJoin) eJoin.innerHTML = bRow('New Onboarding (30 Days)', 'CUSTOMER_JOINED_LAST30DAYS', joined30['ACTIVE'], joined30['ACTIVE RANDOM'], joined30['INACTIVE']);

    var ePay = document.getElementById('ui-dash-pay-types');
    if(ePay) ePay.innerHTML = bRow('Cash Collection', 'PAY_CASH', payCash['ACTIVE'], payCash['ACTIVE RANDOM'], payCash['INACTIVE']) +
                              bRow('Online Payment', 'PAY_ONLINE', payOnline['ACTIVE'], payOnline['ACTIVE RANDOM'], payOnline['INACTIVE']) +
                              bRow('Not Configured', 'PAY_NODATA', payNone['ACTIVE'], payNone['ACTIVE RANDOM'], payNone['INACTIVE']);

    var eAdv = document.getElementById('ui-dash-advance');
    if(eAdv) eAdv.innerHTML = bAdv('With Security Deposit', advHolders) + bRow('Zero Deposit Taken', 'NO_ADVANCE', noAdv['ACTIVE'], noAdv['ACTIVE RANDOM'], noAdv['INACTIVE']);

    var eRate = document.getElementById('ui-dash-zero-rate');
    if(eRate) eRate.innerHTML = bRow('Assigned ₹0 Rate', 'ZERO_RATE', zeroRate['ACTIVE'], zeroRate['ACTIVE RANDOM'], zeroRate['INACTIVE']);

    var eWaiver = document.getElementById('ui-dash-waivers');
    if(eWaiver) eWaiver.innerHTML = bRow('Active M1 / M2 Override', 'WAIVERS', waivers['ACTIVE'], waivers['ACTIVE RANDOM'], waivers['INACTIVE']);

    var eChurn = document.getElementById('ui-dash-churn');
    if(eChurn) {
       var cHtml = '<div class="flex justify-between items-center mb-3 transition-colors"><span class="text-[10px] md:text-xs font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest">Total Churned</span> <button onclick="window.navigateFromDashboard(\'reports-customer\', \'ALL|CHURN_30_DAYS\', \'Operations & Ledger\')" class="bg-rose-600 dark:bg-rose-700 hover:bg-rose-700 dark:hover:bg-rose-600 transition-colors border border-rose-700 dark:border-rose-800 text-white px-2.5 py-1 rounded-md text-[10px] md:text-xs font-black shadow-inner active:scale-95">' + totalChurn + ' &rarr;</button></div>';
       if(totalChurn === 0) cHtml += '<p class="text-xs md:text-sm font-bold text-slate-400 dark:text-slate-500 transition-colors">No churn detected in last 30 days.</p>';
       else {
          Object.keys(churnReasons).sort(function(a,b){return churnReasons[b]-churnReasons[a]}).forEach(function(rsn) {
             cHtml += '<div class="flex justify-between items-center bg-rose-50 dark:bg-rose-900/30 px-3 py-2.5 rounded-xl border border-rose-100 dark:border-rose-800 mb-2 shadow-sm transition-colors"><span class="text-[10px] md:text-xs font-bold text-rose-700 dark:text-rose-400 truncate mr-2 uppercase tracking-wide">' + rsn + '</span><span class="text-xs md:text-sm font-black text-rose-900 dark:text-rose-300">' + churnReasons[rsn] + '</span></div>';
          });
       }
       eChurn.innerHTML = cHtml;
    }

    var eIna = document.getElementById('ui-dash-ina-reasons');
    if(eIna) {
       var iHtml = '';
       if(Object.keys(inactiveReasons).length === 0) iHtml = '<p class="text-xs md:text-sm font-bold text-slate-400 dark:text-slate-500 transition-colors">No inactive reasons logged.</p>';
       else {
          Object.keys(inactiveReasons).sort(function(a,b){return inactiveReasons[b]-inactiveReasons[a]}).forEach(function(rsn) {
             iHtml += '<button onclick="window.navigateFromDashboard(\'reports-customer\', \'INACTIVE|INACTIVE_BY_REASON\', \'Operations & Ledger\')" class="w-full flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors active:scale-95 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm"><span class="text-[9px] md:text-xs font-bold text-slate-600 dark:text-slate-400 truncate mr-2 uppercase tracking-wide" title="' + rsn + '">' + rsn + '</span><span class="text-sm md:text-base font-black text-slate-800 dark:text-white">' + inactiveReasons[rsn] + '</span></button>';
          });
       }
       eIna.innerHTML = iHtml;
    }

    // ----------------------------------------------------
    // WRAP UP
    // ----------------------------------------------------
    clearInterval(window.activeDashTimerInterval);
    if (loadingEl) loadingEl.classList.add('hidden');
    window.switchDashTab(window.dashboardReturnState || 1); 

    var endTime = performance.now();
    var timeTaken = ((endTime - startTime) / 1000).toFixed(2);
    if (loadBadge) {
      loadBadge.innerText = timeTaken + "s (Supabase)";
      loadBadge.classList.remove('hidden');
    }

  } catch (err) {
    console.error("Dashboard Fatal Error:", err);
    clearInterval(window.activeDashTimerInterval);
    if (loadingEl) loadingEl.innerText = "Error Loading Dashboard. Please Refresh.";
    if (window.showToast) window.showToast("Dashboard Error: " + err.message, "error");
  }
};

// ==========================================
// 3. MOBILE NAVIGATION & SEARCH UI
// ==========================================

window.updateMobileNav = function(tabNum) {
    for(let i=1; i<=3; i++) {
        let btn = document.getElementById('mob-dash-tab-' + i);
        if(btn) btn.className = "flex-1 flex flex-col items-center justify-center gap-1 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors";
    }
    let act = document.getElementById('mob-dash-tab-' + tabNum);
    if(act) act.className = "flex-1 flex flex-col items-center justify-center gap-1 text-indigo-600 dark:text-indigo-400 transition-colors";
};

window.openMobileSearch = function() {
    const overlay = document.getElementById('mobile-search-overlay');
    if (!overlay) return;
    overlay.classList.remove('hidden');
    setTimeout(() => {
        overlay.classList.remove('opacity-0');
        document.getElementById('mobile-cpn-input').focus();
    }, 10);
};

window.closeMobileSearch = function() {
    const overlay = document.getElementById('mobile-search-overlay');
    if (!overlay) return;
    overlay.classList.add('opacity-0');
    setTimeout(() => {
        overlay.classList.add('hidden');
        document.getElementById('mobile-cpn-input').value = '';
    }, 300);
};

window.executeMobileSearch = function() {
    const input = document.getElementById('mobile-cpn-input');
    const rawCpn = input.value.trim().toUpperCase();
    if(rawCpn !== "") {
        input.blur();
        window.closeMobileSearch();
        
        if (typeof window.openCustomer360 === 'function') {
            window.openCustomer360(rawCpn);
        } else if (window.showToast) {
            window.showToast("Customer 360 module is not loaded.", "error");
        } else {
            alert("Customer 360 module is not loaded.");
        }
    }
};

window.tabActions['dashboard'] = function () { 
    window.loadDashboardData(true);
    if (typeof window.switchDashTab === 'function') window.switchDashTab(window.dashboardReturnState || 1);
};
