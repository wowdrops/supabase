// ==========================================
// 1. DASHBOARD UI CONTROLS & ROUTING
// ==========================================

window.switchDashTab = function (tabNum) {
  var contentEl = document.getElementById('dash-content-' + tabNum);
  var btnEl = document.getElementById('btn-dash-tab-' + tabNum);
  if (!contentEl || !btnEl) return;

  var content1 = document.getElementById('dash-content-1');
  var content2 = document.getElementById('dash-content-2');
  var btn1 = document.getElementById('btn-dash-tab-1');
  var btn2 = document.getElementById('btn-dash-tab-2');

  if (content1) content1.classList.add('hidden');
  if (content2) content2.classList.add('hidden');

  var defaultBtnClass = "flex-1 px-3 md:px-6 py-3 rounded-xl text-base md:text-xl font-black bg-white text-slate-500 hover:bg-slate-100 transition text-center whitespace-nowrap";
  if (btn1) btn1.className = defaultBtnClass;
  if (btn2) btn2.className = defaultBtnClass;

  contentEl.classList.remove('hidden');
  btnEl.className = "flex-1 px-3 md:px-6 py-3 rounded-xl text-base md:text-xl font-black bg-slate-800 text-white shadow-md transition text-center whitespace-nowrap";
};

window.navigateFromDashboard = function (targetTab, filterArg) {
  if (typeof window.goToReport === 'function') {
    window.goToReport(targetTab, filterArg);
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
  if (btnHigh) btnHigh.className = "flex-1 md:flex-none px-4 py-2 rounded-lg text-sm md:text-lg font-black transition " + (viewType === 'highest' ? 'bg-white shadow-sm text-red-700' : 'text-slate-500 hover:text-slate-800');
  if (btnOld) btnOld.className = "flex-1 md:flex-none px-4 py-2 rounded-lg text-sm md:text-lg font-black transition " + (viewType === 'oldest' ? 'bg-white shadow-sm text-red-700' : 'text-slate-500 hover:text-slate-800');

  var list = (window.defaultersData && window.defaultersData[viewType]) ? window.defaultersData[viewType] : [];
  var tableHtml = '';
  if (list.length === 0) {
    tableHtml = "<tr><td colspan='4' class='px-6 py-12 text-center text-slate-400 font-bold text-xl'>No outstanding debts found.</td></tr>";
  } else {
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      var waNum = String(c.contact || '').replace(/\D/g, '');
      var actionLinks = "";
      if (c.contact) {
        actionLinks += "<a href='tel:" + c.contact + "' target='_top' class='inline-block bg-blue-100 text-blue-700 px-4 py-2 rounded-xl text-sm font-black border-2 border-blue-200 shadow-sm mr-2'>Call</a>";
        actionLinks += "<a href='https://wa.me/" + waNum + "' target='_blank' class='inline-block bg-emerald-100 text-emerald-700 px-4 py-2 rounded-xl text-sm font-black border-2 border-emerald-200 shadow-sm'>WA</a>";
      } else { 
        actionLinks = "<span class='text-sm text-slate-400 font-bold'>No Number</span>"; 
      }
      tableHtml += "<tr class='hover:bg-slate-50 transition border-b-4 border-slate-100'>" +
        "<td class='px-6 py-5 font-black text-slate-800 text-xl md:text-2xl'>" + (c.name || 'Unknown') + "</td>" +
        "<td class='px-6 py-5 text-sm md:text-lg font-bold text-slate-500 uppercase'>" + (c.apt || '') + (c.blk ? " - " + c.blk : "") + "</td>" +
        "<td class='px-6 py-5 text-right font-black text-red-600 text-2xl md:text-3xl'>₹" + (Number(c.due || 0)).toLocaleString('en-IN') + "</td>" +
        "<td class='px-6 py-5 text-center'>" + actionLinks + "</td>" +
        "</tr>";
    }
  }
  var tbody = document.getElementById('dash-defaulters');
  if (tbody) tbody.innerHTML = tableHtml;
};

// ==========================================
// 2. SUPABASE METRICS ENGINE (Replicating GAS 505)
// ==========================================
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
  if (content1) content1.classList.add('hidden');
  if (content2) content2.classList.add('hidden');

  try {
    const supa = window.supabase1;
    if (!supa) throw new Error("window.supabase1 is not initialized. Please check supabase_config.js.");

    var now = new Date();
    var todayStartStr = now.toISOString().split('T')[0];

    // Parallel fetch from all required tables and views
    const [
      ordersRes,
      setupRes,
      deliveryRes,
      salesRes,
      paysRes,
      outstandingRes
    ] = await Promise.all([
      // 1. Orders (ORD2 equivalent)
      supa.from('orders')
        .select('cpn_no, ord_d, ord_e, rate, amount, pending_qty, replace_qty'),

      // 2. Setup (Capacity)
      supa.from('setup')
        .select('key, value')
        .in('key', ['PER_DAY_COUNT', 'RESTRICT_QTY', 'MIN_ENTRY_QTY', 'SUPPLY_STATUS']),

      // 3. Deliveries (DEL2 equivalent)
      supa.from('deliveries')
        .select('cpn_no, act_d, act_e, ord_d, rate, amount, delivery_entered_at, door_delivery_link, status, door_qc'),

      // 4. Sales history
      supa.from('sales')
        .select('cpn_no, del_date, act_d, act_e, amount')
        .lte('del_date', todayStartStr)
        .order('del_date', { ascending: false })
        .limit(1000),

      // 5. Payment history
      supa.from('pays')
        .select('cpn_no, payment_date, amount')
        .lte('payment_date', todayStartStr)
        .order('payment_date', { ascending: false })
        .limit(1000),

      // 6. Outstanding View (Single source of truth for balances)
      supa.from('v_customer_outstanding')
        .select('*')
    ]);

    if (ordersRes.error) console.warn("Orders Query Warning:", ordersRes.error);
    if (deliveryRes.error) console.warn("Delivery Query Warning:", deliveryRes.error);
    if (salesRes.error) console.warn("Sales Query Warning:", salesRes.error);
    if (paysRes.error) console.warn("Pays Query Warning:", paysRes.error);
    if (outstandingRes.error) console.warn("Outstanding Query Warning:", outstandingRes.error);

    // ----------------------------------------------------
    // A. CAPACITY & LIVE ORDERS (Replicating GAS Section 1)
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

    document.getElementById('dash-ord-count').innerText = ordCount + " Orders";
    document.getElementById('dash-ord-amt').innerText = "₹" + ordAmt.toLocaleString('en-IN');
    document.getElementById('dash-ord-cans').innerText = ordCans;
    document.getElementById('dash-ord-empties').innerText = ordEmpties;
    document.getElementById('dash-ord-allowed').innerText = totalAllowed;
    document.getElementById('dash-ord-avail').innerText = available;
    document.getElementById('dash-ord-normal').innerText = physicalDemand;
    document.getElementById('dash-ord-pend').innerText = ordPend;
    document.getElementById('dash-ord-rep').innerText = ordRep;

    // ----------------------------------------------------
    // B. LIVE DELIVERY (Replicating GAS Section 2)
    // ----------------------------------------------------
    var delList = deliveryRes.data || [];
    var delCustCount = 0, delActD = 0, delActE = 0, delOrdD = 0, delSalesAmt = 0;
    var doorsDelivered = 0, doorsPending = 0;

    delList.forEach(function (d) {
      if (!d.cpn_no) return;
      delCustCount++;
      var actD = Number(d.act_d || 0);
      var actE = Number(d.act_e || 0);
      var rate = Number(d.rate || 0);
      var rowAmt = Number(d.amount || 0);
      if (!rowAmt && actD > 0 && rate > 0) rowAmt = actD * rate;

      delActD += actD;
      delActE += actE;
      delOrdD += Number(d.ord_d || 0);
      delSalesAmt += rowAmt;

      var isDone = !!d.delivery_entered_at || !!d.door_delivery_link || String(d.status || '').toUpperCase() === 'DELIVERED' || d.door_qc === 'PASS';
      if (isDone) {
        doorsDelivered++;
      } else {
        doorsPending++;
      }
    });

    document.getElementById('dash-del-amt').innerText = "₹" + delSalesAmt.toLocaleString('en-IN');
    document.getElementById('dash-del-cust').innerText = delCustCount;
    document.getElementById('dash-del-ord').innerText = delOrdD;
    document.getElementById('dash-del-actd').innerText = delActD;
    document.getElementById('dash-del-acte').innerText = delActE;
    document.getElementById('dash-del-doors-done').innerText = doorsDelivered;
    document.getElementById('dash-del-doors-pend').innerText = doorsPending;

    // ----------------------------------------------------
    // C. SALES BY DATE HASH-MAP (Replicating GAS Section 3)
    // ----------------------------------------------------
    var salesByDate = {};
    (salesRes.data || []).forEach(function (s) {
      if (!s.del_date) return;
      var dKey = String(s.del_date).substring(0, 10);
      if (dKey > todayStartStr) return; // Strict <= today filter
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

    document.getElementById('dash-sales-amt').innerText = "₹" + sLast.amt.toLocaleString('en-IN');
    document.getElementById('dash-sales-cans').innerText = sLast.cans;
    document.getElementById('dash-sales-empties').innerText = sLast.empties;
    document.getElementById('dash-label-sales-last').innerText = "Sales: " + (sLastDate ? formatDisplayDate(sLastDate) : "None");
    document.getElementById('dash-label-sales-secondlast').innerText = sSecondLastDate ? formatDisplayDate(sSecondLastDate) : "Previous";
    document.getElementById('dash-sales-yday').innerText = "₹" + sSecondLast.amt.toLocaleString('en-IN');

    window._latestActionDate1 = window.formatDateForInput(sLastDate);
    window._latestActionDate2 = window.formatDateForInput(sSecondLastDate);

    // ----------------------------------------------------
    // D. PAYS BY DATE HASH-MAP & ACTIVE PAYS (GAS Section 4)
    // ----------------------------------------------------
    var paysByDate = {};
    (paysRes.data || []).forEach(function (p) {
      if (!p.payment_date) return;
      var pKey = String(p.payment_date).substring(0, 10);
      if (pKey > todayStartStr) return; // Strict <= today filter
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

    document.getElementById('dash-pays-amt').innerText = "₹" + pLastTotal.toLocaleString('en-IN');
    document.getElementById('dash-label-pays-last').innerText = "Payments: " + (pLastDate ? formatDisplayDate(pLastDate) : "None");
    document.getElementById('dash-label-pays-secondlast').innerText = pSecondLastDate ? formatDisplayDate(pSecondLastDate) : "Previous";
    document.getElementById('dash-pays-yday').innerText = "₹" + pSecondLastTotal.toLocaleString('en-IN');

    // ----------------------------------------------------
    // E. OUTSTANDING LEDGER & FIFO ALLOCATION (GAS Section 5)
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

      // Exact FIFO Math from 505_AdminDashboard.js line 180-193:
      // Oldest debt (cDue4 + cDue3) cleared first -> then prev (cDue2) -> then current (cDue1)
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
          name: r.name || r.poc1 || r.customer_name || cCpn || "Unknown",
          contact: r.contact || r.con1 || r.phone || "",
          apt: r.apartment || r.block || "",
          blk: r.block || "",
          due: due,
          oldestDue: (cDue4 + cDue3)
        });
      }
    });

    document.getElementById('dash-grand-out').innerText = "₹" + grandTotal.toLocaleString('en-IN');

    // Month Labels & Pending
    var currMonthName = now.toLocaleString('default', { month: 'short', year: 'numeric' });
    var prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    var prevMonthName = prevMonthDate.toLocaleString('default', { month: 'short', year: 'numeric' });

    document.getElementById('lbl-curr-month').innerText = currMonthName;
    document.getElementById('curr-pend').innerText = "₹" + m1_total.toLocaleString('en-IN');
    document.getElementById('lbl-prev-month').innerText = prevMonthName;
    document.getElementById('prev-pend').innerText = "₹" + m2_total.toLocaleString('en-IN');

    // Payment Allocations
    document.getElementById('dash-clean-pay').innerText = "₹" + netPay.total.toLocaleString('en-IN');
    document.getElementById('dash-pay-curr').innerText = "₹" + netPay.currCleared.toLocaleString('en-IN');
    document.getElementById('dash-pay-prev').innerText = "₹" + netPay.prevCleared.toLocaleString('en-IN');
    document.getElementById('dash-pay-older').innerText = "₹" + netPay.olderCleared.toLocaleString('en-IN');

    // ----------------------------------------------------
    // F. TOP 10 DEFAULTERS (Exact Sorting from 505)
    // ----------------------------------------------------
    var highestList = customers.slice().sort(function (a, b) {
      return b.due - a.due;
    }).slice(0, 10);

    var oldestList = customers.slice().sort(function (a, b) {
      if (b.oldestDue === a.oldestDue) return b.due - a.due;
      return b.oldestDue - a.oldestDue;
    }).slice(0, 10);

    window.defaultersData = {
      highest: highestList,
      oldest: oldestList
    };
    window.switchDefaulterView('highest');

    // Finish
    if (loadingEl) loadingEl.classList.add('hidden');
    window.switchDashTab(1);

    var endTime = performance.now();
    var timeTaken = ((endTime - startTime) / 1000).toFixed(2);
    if (loadBadge) {
      loadBadge.innerText = timeTaken + "s (Supabase)";
      loadBadge.classList.remove('hidden');
    }

  } catch (err) {
    console.error("Dashboard Fatal Error:", err);
    if (loadingEl) loadingEl.innerText = "Error: " + err.message;
  }
};