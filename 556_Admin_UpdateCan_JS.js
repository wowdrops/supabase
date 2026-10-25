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

window.setAdjJarType = function (type) {
  var jarInput = document.getElementById('uc-jar-type');
  if (jarInput) jarInput.value = type;

  var btnNvj = document.getElementById('btn-type-nvj');
  var btnVj = document.getElementById('btn-type-vj');

  if (type === 'NVJ') {
    if (btnNvj) {
      btnNvj.className = "p-3 rounded-xl font-black text-sm border-2 border-indigo-600 bg-indigo-600 text-white transition-all uppercase tracking-wider shadow-sm";
    }
    if (btnVj) {
      btnVj.className = "p-3 rounded-xl font-black text-sm border-2 border-slate-300 dark:border-slate-600 bg-transparent text-slate-700 dark:text-slate-300 transition-all uppercase tracking-wider";
    }
  } else {
    if (btnVj) {
      btnVj.className = "p-3 rounded-xl font-black text-sm border-2 border-indigo-600 bg-indigo-600 text-white transition-all uppercase tracking-wider shadow-sm";
    }
    if (btnNvj) {
      btnNvj.className = "p-3 rounded-xl font-black text-sm border-2 border-slate-300 dark:border-slate-600 bg-transparent text-slate-700 dark:text-slate-300 transition-all uppercase tracking-wider";
    }
  }
};

window.fetchCpnCount = async function () {
  var cpnInput = document.getElementById('uc-cpnno');
  if (!cpnInput) return;
  var cpn = cpnInput.value.trim().toUpperCase();
  if (!cpn) {
      if(window.showToast) window.showToast("Please enter a CPN Number.", "warning");
      else alert("Enter a CPN Number.");
      return;
  }

  var btn = document.getElementById('btn-fetch-cpn'); 
  if (btn) { btn.innerText = "Searching..."; btn.disabled = true; }
  
  var formArea = document.getElementById('uc-form-area');
  if (formArea) formArea.classList.add('hidden');

  try {
    const supa = window.supabase1;
    if (!supa) throw new Error("Database connection unavailable.");

    const { data: custData, error: custErr } = await supa
      .from('ac_customers')
      .select('cpn_no, poc1')
      .eq('cpn_no', cpn)
      .maybeSingle(); 

    if (custErr) throw custErr;
    if (!custData) {
      if(window.showToast) window.showToast("CPN not found in Master Database.", "error");
      if (btn) { btn.innerText = "Search"; btn.disabled = false; }
      return;
    }

    const { data: salesBalanceData, error: salesErr } = await supa
      .from('sales')
      .select('act_d, act_e, act_d_vj, act_e_vj, act_d_nvj, act_e_nvj')
      .eq('cpn_no', cpn);

    if (salesErr) throw salesErr;

    var currentCans = 0;
    (salesBalanceData || []).forEach(function(row) {
      currentCans += (Number(row.act_d) || 0) - (Number(row.act_e) || 0);
    });

    if (btn) { btn.innerText = "Search"; btn.disabled = false; }
    
    var dispName = document.getElementById('uc-disp-name');
    var dispCans = document.getElementById('uc-disp-cans');
    var cpnBtn = document.getElementById('uc-disp-cpn-btn');
    
    if (dispName) dispName.innerText = custData.poc1 || cpn;
    if (dispCans) dispCans.innerText = currentCans;
    if (cpnBtn) {
        cpnBtn.innerText = cpn;
        cpnBtn.onclick = function() { window.openCustomer360(cpn); };
    }

    var shortEl = document.getElementById('uc-shortage');
    var excEl = document.getElementById('uc-excess');
    
    if (shortEl) shortEl.value = "";
    if (excEl) excEl.value = "";
    if (formArea) formArea.classList.remove('hidden');

    window.loadStockLogs();

  } catch (err) {
    if (btn) { btn.innerText = "Search"; btn.disabled = false; }
    if(window.showToast) window.showToast(err.message, "error");
  }
};

window.submitCanAdjustment = async function () {
  var cpn = document.getElementById('uc-cpnno').value.trim().toUpperCase();
  var short = document.getElementById('uc-shortage').value;
  var exc = document.getElementById('uc-excess').value;
  var jarType = document.getElementById('uc-jar-type') ? document.getElementById('uc-jar-type').value : 'NVJ';
  var submitBtn = document.getElementById('btn-submit-stock');

  if ((!short || Number(short) <= 0) && (!exc || Number(exc) <= 0)) {
    if(window.showToast) window.showToast("Enter a positive number in Shortage or Excess.", "warning");
    return;
  }

  if(!confirm("Are you sure you want to adjust " + jarType + " stock for " + cpn + "?")) return;

  if (submitBtn) {
      submitBtn.innerHTML = '<svg class="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Processing...';
      submitBtn.disabled = true;
  }

  try {
    const supa = window.supabase1;
    var actEValue = 0;
    var logType = "";

    if (short && Number(short) > 0) {
      actEValue = Math.abs(Number(short));
      logType = "Shortage (-)";
    } else if (exc && Number(exc) > 0) {
      actEValue = -Math.abs(Number(exc));
      logType = "Excess (+)";
    }

    var now = new Date();
    var todayStr = now.toISOString().split('T')[0];
    var fullTimestamp = now.toISOString();
    var uniqueID = "ADJ_" + now.getTime();
    var adminUser = (window.activeAdminSession && window.activeAdminSession.username) ? window.activeAdminSession.username : "Admin";

    var payload = {
      cpn_no: cpn,
      order_date: todayStr,
      ord_d: 0,
      ord_e: actEValue,
      del_date: todayStr,
      act_d: 0,
      act_e: actEValue,
      rate: 0,
      order_comment: "##STOCK UPDATE## (" + jarType + ")",
      amount: 0,
      unique_no: uniqueID,
      order_entered_at: fullTimestamp,
      order_entered_by: adminUser,
      delivery_entered_at: fullTimestamp,
      delivery_entered_by: adminUser,
      status: 'COMPLETED'
    };

    if (jarType === 'VJ') {
      payload.act_e_vj = actEValue;
      payload.act_e_nvj = 0;
    } else {
      payload.act_e_nvj = actEValue;
      payload.act_e_vj = 0;
    }

    const { error } = await supa.from('sales').insert([payload]);
    if (error) throw error;

    if(window.showToast) window.showToast("Stock " + logType + " (" + jarType + ") logged successfully.", "success");
    window.fetchCpnCount();

  } catch (err) {
    if(window.showToast) window.showToast("Transaction failed: " + err.message, "error");
  } finally {
    if (submitBtn) {
        submitBtn.innerHTML = '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg> Update Stock Ledger';
        submitBtn.disabled = false;
    }
  }
};

window.loadStockLogs = async function () {
  var startInput = document.getElementById('log-start');
  var endInput = document.getElementById('log-end');
  var cpnInputEl = document.getElementById('log-cpn-filter');
  
  var start = startInput ? startInput.value : '';
  var end = endInput ? endInput.value : '';
  var cpnInput = cpnInputEl ? cpnInputEl.value.trim().toUpperCase() : '';

  var tbody = document.getElementById('log-tbody');
  var regTbody = document.getElementById('regular-sales-tbody');
  var btn = document.getElementById('btn-fetch-logs');

  if (!start || !end || !cpnInput) {
      if(window.showToast) window.showToast("Date range and CPN are required.", "warning");
      return;
  }

  if (tbody) tbody.innerHTML = "<tr><td colspan='4' class='px-4 py-8 text-center text-slate-500 dark:text-slate-400 font-bold animate-pulse'>Loading adjustments...</td></tr>";
  if (regTbody) regTbody.innerHTML = "<tr><td colspan='4' class='px-4 py-8 text-center text-slate-500 dark:text-slate-400 font-bold animate-pulse'>Loading sales...</td></tr>";
  if (btn) btn.innerHTML = '<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>';

  try {
    const supa = window.supabase1;
    
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
    
    var sumActD = 0, sumActE = 0, sumAmt = 0;

    (salesData || []).forEach(function (r) {
      var dStr = window.format360Date ? window.format360Date(r.del_date || r.order_date) : (r.del_date || "");
      var actE = Number(r.act_e || 0);
      var actD = Number(r.act_d || 0);
      var amt = Number(r.amount || 0);
      var ordComment = String(r.order_comment || "").trim();

      if (ordComment.startsWith("##STOCK UPDATE##")) {
        stockLogs.push({
          date: dStr, cpn: r.cpn_no,
          type: actE > 0 ? "Shortage" : "Excess",
          qty: Math.abs(actE),
          comment: ordComment
        });
      } else {
        sumActD += actD; sumActE += actE; sumAmt += amt;
        regularSales.push({ date: dStr, actD: actD, actE: actE, amt: amt });
      }
    });

    if(document.getElementById('uc-lbl-adj-count')) document.getElementById('uc-lbl-adj-count').innerText = stockLogs.length;
    var stockHtml = '';
    if (stockLogs.length === 0) {
      stockHtml = "<tr><td colspan='4' class='px-4 py-8 text-center text-slate-400 dark:text-slate-500 font-bold'>No manual adjustments in this period.</td></tr>";
    } else {
      stockLogs.forEach(function (r) {
        var isShort = r.type === "Shortage";
        var typeStyle = isShort ? "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800" : "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800";
        var qtyStyle = isShort ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400";
        var prefix = isShort ? "-" : "+";
        
        stockHtml += `<tr class='hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-100 dark:border-slate-800/50'>
          <td class='px-4 py-3 text-slate-600 dark:text-slate-400 font-bold text-xs'>${r.date}</td>
          <td class='px-4 py-3'>
             <span class="inline-flex items-center gap-1 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded text-xs hover:bg-indigo-100 dark:hover:bg-indigo-900/50 cursor-pointer transition-colors active:scale-95" onclick="window.openCustomer360('${r.cpn}')">
               ${r.cpn}
               <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
             </span>
          </td>
          <td class='px-4 py-3 text-center'><span class='px-2 py-0.5 text-[10px] font-black rounded border ${typeStyle} uppercase tracking-widest transition-colors'>${r.type}</span></td>
          <td class='px-4 py-3 text-center font-black ${qtyStyle} text-lg transition-colors'>${prefix}${r.qty}</td>
        </tr>`;
      });
    }
    if (tbody) tbody.innerHTML = stockHtml;

    if(document.getElementById('uc-lbl-sales-count')) document.getElementById('uc-lbl-sales-count').innerText = regularSales.length;
    var salesHtml = '';
    if (regularSales.length === 0) {
      salesHtml = "<tr><td colspan='4' class='px-4 py-8 text-center text-slate-400 dark:text-slate-500 font-bold transition-colors'>No deliveries recorded in this period.</td></tr>";
    } else {
      regularSales.forEach(function (s) {
        salesHtml += `<tr class='hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-100 dark:border-slate-800/50'>
          <td class='px-4 py-3 font-bold text-slate-600 dark:text-slate-400 text-xs transition-colors'>${s.date}</td>
          <td class='px-4 py-3 text-center font-black text-indigo-600 dark:text-indigo-400 text-base transition-colors'>${s.actD}</td>
          <td class='px-4 py-3 text-center font-black text-amber-600 dark:text-amber-500 text-base transition-colors'>${s.actE}</td>
          <td class='px-4 py-3 text-right font-black text-emerald-600 dark:text-emerald-400 text-base transition-colors'>₹${s.amt.toLocaleString('en-IN')}</td>
        </tr>`;
      });
    }
    if (regTbody) regTbody.innerHTML = salesHtml;
    
    if(document.getElementById('uc-tot-d')) document.getElementById('uc-tot-d').innerText = sumActD;
    if(document.getElementById('uc-tot-e')) document.getElementById('uc-tot-e').innerText = sumActE;
    if(document.getElementById('uc-tot-amt')) document.getElementById('uc-tot-amt').innerText = "₹" + sumAmt.toLocaleString('en-IN');

  } catch (err) {
    if(window.showToast) window.showToast("Error loading logs: " + err.message, "error");
    if (tbody) tbody.innerHTML = "<tr><td colspan='4' class='px-4 py-8 text-center font-bold text-red-500 dark:text-red-400 transition-colors'>Failed to load data.</td></tr>";
  } finally {
     if (btn) btn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path></svg> Filter';
  }
};

window.tabActions['update-can'] = function() {
    var today = new Date();
    var firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    var todayStr = today.toISOString().split('T')[0];
    
    var startInput = document.getElementById('log-start');
    var endInput = document.getElementById('log-end');
    if (startInput && !startInput.value) startInput.value = firstDay;
    if (endInput && !endInput.value) endInput.value = todayStr;
};