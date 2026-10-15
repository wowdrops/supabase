// =====================================
// 3. UPDATE CAN (STOCK LOGIC - SUPABASE DIRECT)
// =====================================

window.clearExcess = function () { 
  var exc = document.getElementById('uc-excess');
  if (exc) exc.value = ""; 
};

window.clearShortage = function () { 
  var short = document.getElementById('uc-shortage');
  if (short) short.value = ""; 
};

window.fetchCpnCount = async function () {
  var cpnInput = document.getElementById('uc-cpnno');
  if (!cpnInput) return;
  var cpn = cpnInput.value.trim();
  if (!cpn) return alert("Enter a CPN Number.");

  var btn = document.getElementById('btn-fetch-cpn'); 
  if (btn) { btn.innerText = "Searching..."; btn.disabled = true; }
  
  var formArea = document.getElementById('uc-form-area');
  if (formArea) formArea.classList.add('hidden');

  try {
    const supa = window.supabase1;
    if (!supa) throw new Error("Supabase client not initialized.");

    // 1. Fetch customer details from ac_customers
    const { data: custData, error: custErr } = await supa
      .from('ac_customers')
      .select('cpn_no, poc1, con1')
      .eq('cpn_no', cpn)
      .maybeSingle(); 

    if (custErr) throw new Error(custErr.message);
    if (!custData) {
      alert("CPNNO not found in customer records.");
      if (btn) { btn.innerText = "Search"; btn.disabled = false; }
      return;
    }

    // 2. Calculate current can balance dynamically from the sales table
    const { data: salesBalanceData, error: salesErr } = await supa
      .from('sales')
      .select('act_d, act_e')
      .eq('cpn_no', cpn);

    if (salesErr) throw salesErr;

    var currentCans = 0;
    (salesBalanceData || []).forEach(function(row) {
      currentCans += (Number(row.act_d) || 0) - (Number(row.act_e) || 0);
    });

    if (btn) { btn.innerText = "Search"; btn.disabled = false; }
    
    var dispName = document.getElementById('uc-disp-name');
    var dispCans = document.getElementById('uc-disp-cans');
    if (dispName) dispName.innerText = custData.poc1 || cpn;
    if (dispCans) dispCans.innerText = currentCans;

    var shortEl = document.getElementById('uc-shortage');
    var excEl = document.getElementById('uc-excess');
    var msgEl = document.getElementById('uc-msg');
    if (shortEl) shortEl.value = "";
    if (excEl) excEl.value = "";
    if (msgEl) msgEl.classList.add('hidden');
    if (formArea) formArea.classList.remove('hidden');

    // Default log date range to current month if empty
    var today = new Date();
    var firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    var todayStr = today.toISOString().split('T')[0];
    
    var startInput = document.getElementById('log-start');
    var endInput = document.getElementById('log-end');
    if (startInput && !startInput.value) startInput.value = firstDay;
    if (endInput && !endInput.value) endInput.value = todayStr;

    window.loadStockLogs();
  } catch (err) {
    if (btn) { btn.innerText = "Search"; btn.disabled = false; }
    alert("Database connection error: " + err.message);
  }
};

window.submitCanAdjustment = async function () {
  var cpn = document.getElementById('uc-cpnno').value.trim();
  var short = document.getElementById('uc-shortage').value;
  var exc = document.getElementById('uc-excess').value;
  var msgBox = document.getElementById('uc-msg');
  var submitBtn = document.getElementById('btn-submit-stock');

  if ((!short || Number(short) <= 0) && (!exc || Number(exc) <= 0)) {
    if (msgBox) {
      msgBox.innerText = "Enter a valid positive number in Shortage OR Excess.";
      msgBox.classList.remove('hidden');
      msgBox.className = "text-xl text-center font-bold p-4 rounded-xl border-2 bg-red-100 text-red-700 border-red-300 block";
    }
    return;
  }

  if (submitBtn) submitBtn.innerText = "Processing...";

  try {
    const supa = window.supabase1;
    var actEValue = 0;
    var logType = "";

    if (short && Number(short) > 0) {
      actEValue = Math.abs(Number(short));
      logType = "Shortage";
    } else if (exc && Number(exc) > 0) {
      actEValue = -Math.abs(Number(exc));
      logType = "Excess";
    }

    var now = new Date();
    var todayStr = now.toISOString().split('T')[0];
    var fullTimestamp = now.toISOString();
    var uniqueID = "ADJ_" + now.getTime();
    var adminUser = (window.activeAdminSession && window.activeAdminSession.username) ? window.activeAdminSession.username : "Admin";

    const payload = {
      cpn_no: cpn,
      order_date: todayStr,
      ord_d: 0,
      ord_e: actEValue,
      del_date: todayStr,
      act_d: 0,
      act_e: actEValue,
      rate: 0,
      order_comment: "##STOCK UPDATE##",
      amount: 0,
      unique_no: uniqueID,
      order_entered_at: fullTimestamp,
      order_entered_by: adminUser,
      delivery_entered_at: fullTimestamp,
      delivery_entered_by: adminUser,
      status: 'COMPLETED'
    };

    const { error } = await supa
      .from('sales')
      .insert([payload]);

    if (submitBtn) submitBtn.innerText = "Update Stock Ledger";

    if (error) throw error;

    if (msgBox) {
      msgBox.innerText = "Inventory " + logType + " committed successfully.";
      msgBox.classList.remove('hidden');
      msgBox.className = "text-xl text-center font-bold p-4 rounded-xl border-2 block bg-emerald-100 text-emerald-800 border-emerald-300";
    }

    window.fetchCpnCount();
    window.loadStockLogs();

  } catch (err) {
    if (submitBtn) submitBtn.innerText = "Update Stock Ledger";
    if (msgBox) {
      msgBox.innerText = "Transaction failed: " + err.message;
      msgBox.classList.remove('hidden');
      msgBox.className = "text-xl text-center font-bold p-4 rounded-xl border-2 block bg-red-100 text-red-700 border-red-300";
    }
  }
};

window.loadStockLogs = async function () {
  var startInput = document.getElementById('log-start');
  var endInput = document.getElementById('log-end');
  var cpnInputEl = document.getElementById('log-cpn-filter');
  
  var start = startInput ? startInput.value : '';
  var end = endInput ? endInput.value : '';
  var cpnInput = cpnInputEl ? cpnInputEl.value.trim() : '';

  var tbody = document.getElementById('log-tbody');
  var regTbody = document.getElementById('regular-sales-tbody');

  if (!start || !end || !cpnInput) return;

  if (tbody) tbody.innerHTML = "<tr><td colspan='5' class='px-6 py-12 text-center text-slate-500 font-bold text-2xl animate-pulse'>Fetching data for CPN " + cpnInput + "...</td></tr>";
  if (regTbody) regTbody.innerHTML = "<tr><td colspan='5' class='px-6 py-12 text-center text-slate-500 font-bold text-2xl animate-pulse'>Fetching sales...</td></tr>";

  try {
    const supa = window.supabase1;
    if (!supa) throw new Error("Supabase client not initialized.");

    // Calculate current can balance from sales table
    const { data: salesBalanceData, error: balErr } = await supa
      .from('sales')
      .select('act_d, act_e')
      .eq('cpn_no', cpnInput);

    if (balErr) throw balErr;

    var currentCans = 0;
    (salesBalanceData || []).forEach(function(row) {
      currentCans += (Number(row.act_d) || 0) - (Number(row.act_e) || 0);
    });

    // Fetch sales records matching date range and CPN
    const { data: salesData, error } = await supa
      .from('sales')
      .select('*')
      .eq('cpn_no', cpnInput)
      .gte('del_date', start)
      .lte('del_date', end)
      .order('del_date', { ascending: false });

    if (error) throw error;

    var stockLogs = [];
    var regularSales = [];

    (salesData || []).forEach(function (r) {
      var dStr = r.del_date || r.order_date || "";
      var actE = Number(r.act_e || 0);
      var ordComment = String(r.order_comment || "").trim();

      var entry = {
        displayDate: dStr,
        delDate: dStr,
        actD: Number(r.act_d || 0),
        actE: actE,
        amt: Number(r.amount || 0)
      };

      if (ordComment === "##STOCK UPDATE##") {
        entry.cpnno = r.cpn_no;
        entry.type = actE > 0 ? "Shortage" : "Excess";
        entry.currentCans = currentCans;
        stockLogs.push(entry);
      } else {
        regularSales.push(entry);
      }
    });

    var stockHtml = '';
    if (stockLogs.length === 0) {
      stockHtml = "<tr><td colspan='5' class='px-6 py-12 text-center text-slate-400 font-bold text-2xl'>No manual stock updates found.</td></tr>";
    } else {
      stockLogs.forEach(function (r) {
        var badgeColor = r.type.indexOf("Shortage") > -1 ? "bg-red-100 text-red-800 border-red-300" : "bg-emerald-100 text-emerald-800 border-emerald-300";
        stockHtml += "<tr class='hover:bg-slate-50 transition border-b-4 border-slate-100'>" +
          "<td class='px-6 py-5 text-lg font-black text-slate-500 uppercase'>" + r.displayDate + "</td>" +
          "<td class='px-6 py-5 font-black text-slate-800 text-2xl'>" + r.cpnno + "</td>" +
          "<td class='px-6 py-5'><span class='px-4 py-2 text-lg font-black rounded-lg border-2 " + badgeColor + " uppercase tracking-widest'>" + r.type + "</span></td>" +
          "<td class='px-6 py-5 text-center font-black text-3xl'>" + Math.abs(r.actE) + "</td>" +
          "<td class='px-6 py-5 text-right font-black text-blue-600 text-4xl'>" + r.currentCans + "</td>" +
          "</tr>";
      });
    }
    if (tbody) tbody.innerHTML = stockHtml;

    var salesHtml = '';
    if (regularSales.length === 0) {
      salesHtml = "<tr><td colspan='5' class='px-6 py-12 text-center text-slate-400 font-bold text-2xl'>No regular sales found.</td></tr>";
    } else {
      regularSales.forEach(function (s) {
        salesHtml += "<tr class='hover:bg-slate-50 transition border-b-4 border-slate-100'>" +
          "<td class='px-6 py-5 font-bold text-slate-500 text-lg'>" + s.displayDate + "</td>" +
          "<td class='px-6 py-5 font-black text-slate-800 text-xl'>" + s.delDate + "</td>" +
          "<td class='px-6 py-5 text-center font-black text-3xl text-indigo-600'>" + s.actD + "</td>" +
          "<td class='px-6 py-5 text-center font-black text-3xl text-amber-600'>" + s.actE + "</td>" +
          "<td class='px-6 py-5 text-right font-black text-emerald-600 text-3xl'>₹" + s.amt.toLocaleString('en-IN') + "</td>" +
          "</tr>";
      });
    }
    if (regTbody) regTbody.innerHTML = salesHtml;

  } catch (err) {
    console.error("Stock logs error:", err);
    if (tbody) tbody.innerHTML = "<tr><td colspan='5' class='px-6 py-12 text-center font-bold text-red-500 text-2xl'>Error: " + err.message + "</td></tr>";
  }
};