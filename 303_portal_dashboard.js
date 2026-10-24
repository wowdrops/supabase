// ==========================================
// DASHBOARD & ORDERS (Supabase Version)
// ==========================================
function updateHeaderDisplays() {
  if (!activeUserSession) return;
  document.querySelectorAll('.disp-cust-name').forEach(el => el.innerText = activeUserSession.name || "");
  var parts = [];
  if (activeUserSession.phone) parts.push(activeUserSession.phone);
  if (activeUserSession.cpn) parts.push(activeUserSession.cpn);
  if (activeUserSession.apartment) parts.push(activeUserSession.apartment);
  if (activeUserSession.block) parts.push(activeUserSession.block);
  if (activeUserSession.door) parts.push(activeUserSession.door);

  var separator = '<span class="text-indigo-300/50 mx-1.5 font-light">|</span>';
  document.querySelectorAll('.disp-cust-details').forEach(el => el.innerHTML = parts.join(separator));
}

function showDashboardSkeletons() {
  document.getElementById('dash-skel').classList.remove('hidden');
  document.getElementById('dash-outstanding').innerHTML = "<div class='h-6 bg-slate-700/50 rounded w-16 animate-pulse'></div>";
  document.getElementById('dash-previous-dues').innerHTML = "<div class='h-5 bg-slate-700/50 rounded w-12 animate-pulse'></div>";
  document.getElementById('dash-current-month').innerHTML = "<div class='h-5 bg-slate-700/50 rounded w-12 animate-pulse'></div>";
  document.getElementById('val-advance').innerHTML = "<div class='h-6 bg-slate-700/50 rounded w-12 animate-pulse'></div>";
  document.getElementById('val-cans').innerHTML = "<div class='h-6 bg-slate-700/50 rounded w-8 animate-pulse'></div>";

  var submitBtn = document.getElementById('btn-submit-order');
  submitBtn.disabled = true;
  submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
  submitBtn.innerHTML = "<span class='animate-pulse'>Fetching Live Status...</span>";
}

async function refreshCustomerSessionData(cpn) {
  if (!activeUserSession.rowCache) activeUserSession.rowCache = { ord: null, out: null, db: null };

  try {
    // 1. Fetch Existing Order from Supabase 'orders' table
    const { data: orderData, error: orderError } = await supabase1
      .from('orders')
      .select('*')
      .eq('cpn_no', cpn)
      .maybeSingle();

    if (orderError) throw new Error("Failed to fetch order data: " + orderError.message);

    activeUserSession.uniqueNo = orderData ? orderData.unique_no : null;
    activeUserSession.existingOrdD = orderData ? (orderData.ord_d || 0) : 1;
    activeUserSession.existingOrdE = orderData ? (orderData.ord_e || 0) : 1;
    activeUserSession.rate = orderData ? (orderData.rate || activeUserSession.defaultRate || 0) : activeUserSession.defaultRate;
    activeUserSession.hasExistingOrder = !!orderData;
    activeUserSession.status = orderData ? (orderData.status || "NEW") : "NEW";
    activeUserSession.pendingQty = orderData ? (orderData.pending_qty || 0) : 0;
    activeUserSession.replaceQty = orderData ? (orderData.replace_qty || 0) : 0;
    activeUserSession.replaceReason = orderData ? (orderData.replace_reason || "") : "";

    if (orderData && orderData.order_date) {
      try {
        activeUserSession.ordDate = new Date(orderData.order_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      } catch(e) {
        activeUserSession.ordDate = orderData.order_date;
      }
    } else {
      activeUserSession.ordDate = null;
    }

    // Fetch Supply Configuration from 'setup' table
    activeUserSession.supplyConfig = await getSupabaseSupplyConfig();

    var submitBtn = document.getElementById('btn-submit-order');
    submitBtn.disabled = false;
    submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    submitBtn.innerHTML = "<span>Submit Request</span>";

    renderOrderWidget();
    await sleep(400);

    // 2. Fetch Customer Outstanding, Master details, and Can Balances
    const { data: outstandingData } = await supabase1
      .from('v_customer_outstanding')
      .select('*')
      .eq('cpn_no', cpn)
      .maybeSingle();

    const { data: custData } = await supabase1
      .from('ac_customers')
      .select('can_deposit, maximum_ord_d, maximum_ord_e, final_status, mail_id, con2, default_rate')
      .eq('cpn_no', cpn)
      .maybeSingle();

    /*const { data: canBalData } = await supabase1
      .from('customer_can_balance')
      .select('*')
      .eq('cpn_no', cpn)
      .maybeSingle();
    */

    if (custData && String(custData.final_status).trim().toUpperCase() === 'INACTIVE') {
        localStorage.removeItem('wowdrops_customer_session');
        activeUserSession = null;
        switchView('view-login');
        var loginErr = document.getElementById('login-err');
        loginErr.innerText = "Your status is changed to inactive. Please contact wowdrops";
        loginErr.classList.remove('hidden');
        return; 
    }

    // Populate Ledger details directly matching v_customer_outstanding view columns
    activeUserSession.outstanding = outstandingData ? (Number(outstandingData.current_balance) || 0) : 0;
    activeUserSession.currentMon = outstandingData ? (Number(outstandingData.current_month_pending) || 0) : 0;
    activeUserSession.lastMon = outstandingData ? (Number(outstandingData.m1_pending) || 0) : 0;
    activeUserSession.older = outstandingData ? ((Number(outstandingData.m2_pending) || 0) + (Number(outstandingData.old_pending) || 0)) : 0;
    //activeUserSession.advance = outstandingData ? (Number(outstandingData.advance_amount) || Number(outstandingData.can_deposit) || 0) : (custData ? (Number(custData.can_deposit) || 0) : 0);

    //activeUserSession.cansWithCustomer = canBalData ? ((canBalData.filled_vj_held || 0) + (canBalData.filled_nvj_held || 0)) : 0;
    activeUserSession.cansWithCustomer = (Number(outstandingData.cans) || 0);
    activeUserSession.advance = custData ? (Number(custData.can_deposit) || 0) : 0;
    activeUserSession.maxClientD = custData && custData.maximum_ord_d !== null ? Number(custData.maximum_ord_d) : 9999;
    activeUserSession.maxClientE = custData && custData.maximum_ord_e !== null ? Number(custData.maximum_ord_e) : 9999;
    activeUserSession.email = custData ? (custData.mail_id || "") : "";
    activeUserSession.whatsapp = custData ? (custData.con2 || "") : "";
    activeUserSession.defaultRate = custData ? (Number(custData.default_rate) || 0) : 0;

    localStorage.setItem('wowdrops_customer_session', JSON.stringify(activeUserSession));

    document.getElementById('dash-skel').classList.add('hidden');
    renderFinancialWidget();
    
    if (typeof checkEmailCollection === "function") checkEmailCollection();

  } catch (error) {
    console.error("Dashboard failed to load securely:", error);
    alert("Failed to connect to the server. Please check your internet or try refreshing.");
    
    var skel = document.getElementById('dash-skel');
    if (skel) skel.classList.add('hidden');
    
    var submitBtn = document.getElementById('btn-submit-order');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      submitBtn.innerHTML = "<span>Refresh to Try Again</span>";
    }
  }
}

// Helper to fetch global supply limits from Supabase 'setup' table
async function getSupabaseSupplyConfig() {
  try {
    const { data, error } = await supabase1
      .from('setup')
      .select('key, value')
      .in('key', ['PER_DAY_COUNT', 'RESTRICT_QTY', 'MIN_ENTRY_QTY', 'SUPPLY_STATUS']);

    if (error || !data) return { isOn: false, isSoldOut: false, limitActive: false, globalMax: 9999 };

    let configMap = {};
    data.forEach(row => { configMap[row.key] = row.value; });

    var perDayCount = Number(configMap['PER_DAY_COUNT']) || 210;
    var restrictQty = Number(configMap['RESTRICT_QTY']) || 25;
    var minEntryQty = Number(configMap['MIN_ENTRY_QTY']) || 1;
    var isOn = String(configMap['SUPPLY_STATUS'] || "").trim().toUpperCase() === 'ON';

    const { data: allOrders } = await supabase1
      .from('orders')
      .select('ord_d, pending_qty');

    let totalFreshCans = 0;
    if (allOrders) {
      allOrders.forEach(ord => {
        let ordD = Number(ord.ord_d) || 0;
        let pendQty = Number(ord.pending_qty) || 0;
        let freshImpact = Math.max(0, ordD - pendQty);
        totalFreshCans += freshImpact;
      });
    }

    var remainingStock = perDayCount - totalFreshCans;
    var isSoldOut = remainingStock <= 0;
    var limitActive = remainingStock > 0 && remainingStock <= restrictQty;
    var currentGlobalMax = 9999;

    if (isOn) {
      if (isSoldOut) currentGlobalMax = 0;
      else if (limitActive) currentGlobalMax = Math.min(minEntryQty, remainingStock);
    }

    return { 
      isOn: isOn, 
      isSoldOut: isSoldOut, 
      limitActive: limitActive, 
      globalMax: currentGlobalMax 
    };
  } catch (e) {
    return { isOn: false, isSoldOut: false, limitActive: false, globalMax: 9999 };
  }
}

function renderOrderWidget() {
  var poDetails = document.getElementById('po-details');
  var poEmpty = document.getElementById('po-empty-msg');
  var pendingBanner = document.getElementById('pending-alert-banner');
  
  if (activeUserSession.status === "PENDING") {
    pendingBanner.classList.remove('hidden');
  } else {
    pendingBanner.classList.add('hidden');
  }

  var badge = document.getElementById('replacement-badge');
  var badgeText = document.getElementById('replacement-badge-text');
  var rQty = (window.pendingReplaceQty != null) ? window.pendingReplaceQty : (activeUserSession.replaceQty || 0);
  var rReason = (window.pendingReplaceReason != null) ? window.pendingReplaceReason : (activeUserSession.replaceReason || "");
  
  if (rQty > 0) {
    badgeText.innerText = "📦 Includes " + rQty + " Free Replacement (" + rReason + ")";
    badge.classList.remove('hidden');
    badge.classList.add('flex');
  } else {
    badge.classList.add('hidden');
    badge.classList.remove('flex');
  }

  if (activeUserSession.hasExistingOrder) {
    poDetails.classList.remove('hidden');
    poEmpty.classList.add('hidden');
    document.getElementById('po-date').innerText = activeUserSession.ordDate || "recently";
    document.getElementById('po-cans').innerText = activeUserSession.existingOrdD || 0;
    document.getElementById('po-empties').innerText = activeUserSession.existingOrdE || 0;

    var poRepContainer = document.getElementById('po-rep-container');
    var poRepText = document.getElementById('po-rep-text');
    var sReqQty = activeUserSession.replaceQty || 0;
    var sReqRsn = activeUserSession.replaceReason || "";

    if (sReqQty > 0 && poRepContainer && poRepText) {
      poRepText.innerText = sReqQty + " Replacement(s) (" + sReqRsn + ")";
      poRepContainer.classList.remove('hidden');
    } else if (poRepContainer) {
      poRepContainer.classList.add('hidden');
    }

    document.getElementById('input-ord-d').value = activeUserSession.existingOrdD || 1;
    document.getElementById('input-ord-e').value = activeUserSession.existingOrdE || 1;
    toggleOrderEditMode(false);
  } else {
    poDetails.classList.add('hidden');
    poEmpty.classList.remove('hidden');
    document.getElementById('po-date').innerText = "--";
    toggleOrderEditMode(true);
  }

  var conf = activeUserSession.supplyConfig;
  var supplyBanner = document.getElementById('supply-limit-banner');

  if (conf && conf.isOn && conf.isSoldOut) {
    supplyBanner.classList.remove('hidden');
    supplyBanner.innerHTML = "<div class='bg-red-50 text-red-800 p-3 rounded-xl text-xs font-bold border border-red-200 flex items-start space-x-2 shadow-sm'><svg class='w-5 h-5 text-red-500 shrink-0 mt-0.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'></path></svg><span>Sold Out: Daily supply limit has been reached. No new orders can be placed for today.</span></div>";
  } else if (conf && conf.isOn && conf.limitActive) {
    supplyBanner.classList.remove('hidden');
    supplyBanner.innerHTML = "<div class='bg-amber-50 text-amber-800 p-3 rounded-xl text-xs font-bold border border-amber-200 flex items-start space-x-2 shadow-sm'><svg class='w-5 h-5 text-amber-500 shrink-0 mt-0.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'></path></svg><span>High demand alert: Available stock is low today. New limits have been applied to fresh orders.</span></div>";
  } else {
    supplyBanner.classList.add('hidden');
  }
}

function renderFinancialWidget() {
  document.getElementById('val-cans').innerText = activeUserSession.cansWithCustomer || 0;
  document.getElementById('val-advance').innerText = "₹" + formatCurrency(activeUserSession.advance);
  document.getElementById('dash-outstanding').innerText = "₹" + formatCurrency(activeUserSession.outstanding);

  var prevSum = (activeUserSession.older || 0) + (activeUserSession.lastMon || 0);
  document.getElementById('dash-previous-dues').innerText = "₹" + formatCurrency(prevSum);
  document.getElementById('dash-current-month').innerText = "₹" + formatCurrency(activeUserSession.currentMon);

  var monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  document.getElementById('current-month-name').innerText = monthNames[new Date().getMonth()];

  var pendingBonus = activeUserSession.pendingQty || 0;
  var baseMaxD = ((activeUserSession.maxClientD !== undefined && activeUserSession.maxClientD !== null) ? activeUserSession.maxClientD : 9999) + pendingBonus;
  var baseMaxE = ((activeUserSession.maxClientE !== undefined && activeUserSession.maxClientE !== null) ? activeUserSession.maxClientE : 9999) + pendingBonus;
  var conf = activeUserSession.supplyConfig;

  var isGlobalConstraining = conf && conf.isOn && (conf.limitActive || conf.isSoldOut);
  var globalLimit = isGlobalConstraining ? conf.globalMax : 9999;

  var activeLimitD = baseMaxD;
  window.limitReasonD = "You have exceeded your personal limit for Cans. Maximum allowed is";
  if (isGlobalConstraining && globalLimit < baseMaxD) {
    activeLimitD = globalLimit;
    window.limitReasonD = conf.isSoldOut ? "We are completely sold out of Cans for today. Maximum allowed is" : "Due to high demand, Cans are currently restricted to a maximum of";
  }
  window.currentMaxOrdD = Math.max(activeLimitD, activeUserSession.existingOrdD || 0);

  var activeLimitE = baseMaxE;
  window.limitReasonE = "You have exceeded your personal limit for Empties. Maximum allowed is";
  if (isGlobalConstraining && globalLimit < baseMaxE) {
    activeLimitE = globalLimit;
    window.limitReasonE = conf.isSoldOut ? "Daily capacity reached. Empties return is currently restricted to" : "Due to high demand, Empties are currently restricted to a maximum of";
  }
  window.currentMaxOrdE = Math.max(activeLimitE, activeUserSession.existingOrdE || 0);

  var inputD = document.getElementById('input-ord-d');
  var inputE = document.getElementById('input-ord-e');
  if (parseInt(inputD.value) > window.currentMaxOrdD) inputD.value = window.currentMaxOrdD;
  if (parseInt(inputE.value) > window.currentMaxOrdE) inputE.value = window.currentMaxOrdE;

  var btn1 = document.getElementById('btn-quick-1');
  var btn2 = document.getElementById('btn-quick-2');
  var btn3 = document.getElementById('btn-quick-3');

  if (btn1 && btn2 && btn3) {
    btn1.disabled = window.currentMaxOrdE < 1;
    btn2.disabled = window.currentMaxOrdE < 2;
    btn3.disabled = window.currentMaxOrdE < 3;
  }
}

function toggleOrderEditMode(isEditing) {
  var cancelBtn = document.getElementById('btn-cancel-edit');
  if (isEditing) {
    document.getElementById('order-edit-mode-msg').classList.add('hidden');
    document.getElementById('order-input-section').classList.remove('hidden');
    if (activeUserSession && activeUserSession.hasExistingOrder && cancelBtn) {
      cancelBtn.classList.remove('hidden');
    } else if (cancelBtn) {
      cancelBtn.classList.add('hidden');
    }
  } else {
    document.getElementById('order-edit-mode-msg').classList.remove('hidden');
    document.getElementById('order-input-section').classList.add('hidden');
  }
}

function cancelEditMode() {
  if (activeUserSession && activeUserSession.hasExistingOrder) {
    document.getElementById('input-ord-d').value = activeUserSession.existingOrdD || 1;
    document.getElementById('input-ord-e').value = activeUserSession.existingOrdE || 1;
  }
  window.pendingReplaceQty = null;
  window.pendingReplaceReason = null;
  toggleOrderEditMode(false);
  renderOrderWidget(); 
}

function openCancelModal() {
  var modal = document.getElementById('cancel-order-modal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.getElementById('cancel-checkbox').checked = false;
  document.getElementById('cancel-toggle').checked = false;

  if (CONFIRMATION_STYLE === 'toggle') {
    document.getElementById('confirm-type-toggle').classList.remove('hidden');
    document.getElementById('confirm-type-toggle').classList.add('flex');
    document.getElementById('confirm-type-checkbox').classList.add('hidden');
    document.getElementById('confirm-type-checkbox').classList.remove('flex');
  } else {
    document.getElementById('confirm-type-checkbox').classList.remove('hidden');
    document.getElementById('confirm-type-checkbox').classList.add('flex');
    document.getElementById('confirm-type-toggle').classList.add('hidden');
    document.getElementById('confirm-type-toggle').classList.remove('flex');
  }
  validateCancelAction();
}

function closeCancelModal() {
  var modal = document.getElementById('cancel-order-modal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

function validateCancelAction() {
  var isConfirmed = CONFIRMATION_STYLE === 'toggle' ? document.getElementById('cancel-toggle').checked : document.getElementById('cancel-checkbox').checked;
  var btn = document.getElementById('btn-execute-cancel');
  if (isConfirmed) {
    btn.disabled = false;
    btn.classList.remove('bg-slate-300', 'text-slate-500', 'cursor-not-allowed');
    btn.classList.add('bg-red-600', 'text-white', 'hover:bg-red-700', 'shadow-md');
  } else {
    btn.disabled = true;
    btn.classList.add('bg-slate-300', 'text-slate-500', 'cursor-not-allowed');
    btn.classList.remove('bg-red-600', 'text-white', 'hover:bg-red-700', 'shadow-md');
  }
}

async function executeCancelOrder() {
  var btn = document.getElementById('btn-execute-cancel');
  btn.innerHTML = 'Cancelling...';
  btn.disabled = true;

  try {
    const { error } = await supabase1
      .from('orders')
      .delete()
      .eq('cpn_no', activeUserSession.cpn);

    closeCancelModal();
    btn.innerHTML = 'Confirm & Cancel'; 
    btn.disabled = false;

    if (error) throw error;

    var msgEl = document.getElementById('order-msg');
    if (msgEl) {
        msgEl.innerText = "Order Cancelled Successfully.";
        msgEl.className = "text-center text-sm font-black text-red-600 mt-3 p-2 bg-red-50 border border-red-200 rounded-lg fade-in";
        msgEl.classList.remove('hidden');
        setTimeout(() => msgEl.classList.add('hidden'), 5000);
    }
    
    if (activeUserSession) {
      activeUserSession.hasExistingOrder = false;
      activeUserSession.replaceQty = 0;
      activeUserSession.replaceReason = "";
      localStorage.setItem('wowdrops_customer_session', JSON.stringify(activeUserSession));
    }

    window.pendingReplaceQty = null;
    window.pendingReplaceReason = null;
    var badge = document.getElementById('replacement-badge');
    if (badge) {
      badge.classList.add('hidden');
      badge.classList.remove('flex');
    }
    
    var poDetails = document.getElementById('po-details');
    var poEmpty = document.getElementById('po-empty-msg');
    
    if (poDetails) poDetails.classList.add('hidden');
    if (poEmpty) poEmpty.classList.remove('hidden');
    
    var poDate = document.getElementById('po-date');
    if (poDate) poDate.innerText = "--";
    
    toggleOrderEditMode(true); 

  } catch (err) {
    closeCancelModal();
    btn.innerHTML = 'Confirm & Cancel';
    btn.disabled = false;
    alert("Failed to cancel order: " + err.message);
  }
}

function syncCans(val) {
  var numVal = parseInt(val) || 0;
  var fieldE = document.getElementById('input-ord-e');
  if (window.currentMaxOrdE !== null && numVal > window.currentMaxOrdE) {
    numVal = window.currentMaxOrdE;
    fieldE.value = numVal;
  }
  if (!ALLOW_MANUAL_CAN_ENTRY) {
    var fieldD = document.getElementById('input-ord-d');
    var finalD = numVal;
    if (window.currentMaxOrdD !== null && finalD > window.currentMaxOrdD) {
      finalD = window.currentMaxOrdD;
    }
    fieldD.value = finalD;
  }
}

function adjustValue(inputId, step) {
  var field = document.getElementById(inputId);
  var currentVal = parseInt(field.value) || 0;
  var newVal = Math.max(0, currentVal + step);
  var maxAllowed = inputId === 'input-ord-d' ? window.currentMaxOrdD : window.currentMaxOrdE;
  if (maxAllowed !== null && newVal > maxAllowed) newVal = maxAllowed;
  field.value = newVal;
  if (inputId === 'input-ord-e') syncCans(newVal);
}

function quickAddCans(qty) {
  if (window.currentMaxOrdE === null) return;
  var finalQty = Math.min(qty, window.currentMaxOrdE);
  var fieldE = document.getElementById('input-ord-e');
  fieldE.value = finalQty;
  syncCans(finalQty);
}

async function processOrderSubmission() {
  var dVal = parseInt(document.getElementById('input-ord-d').value) || 0;
  var eVal = parseInt(document.getElementById('input-ord-e').value) || 0;
  
  var rQty = (window.pendingReplaceQty != null) ? window.pendingReplaceQty : ((activeUserSession.hasExistingOrder) ? (activeUserSession.replaceQty || 0) : 0);
  var rReason = (window.pendingReplaceReason != null) ? window.pendingReplaceReason : ((activeUserSession.hasExistingOrder) ? (activeUserSession.replaceReason || "") : "");
  
  var msgEl = document.getElementById('order-msg');

  if (window.currentMaxOrdD !== null && dVal > window.currentMaxOrdD) { return showError(msgEl, window.limitReasonD + " " + window.currentMaxOrdD + " Can(s)."); }
  if (window.currentMaxOrdE !== null && eVal > window.currentMaxOrdE) { return showError(msgEl, window.limitReasonE + " " + window.currentMaxOrdE + " Empties."); }

  toggleButtonState('btn-submit-order', true, 'Processing...');

  try {
    var todayStr = new Date().toISOString().split('T')[0];
    var currentRate = activeUserSession.defaultRate || 0;
    var totalAmt = dVal * currentRate;

    const payload = {
      cpn_no: activeUserSession.cpn,
      apartment: activeUserSession.apartment,
      block: activeUserSession.block,
      door: activeUserSession.door,
      name: activeUserSession.name,
      contact: activeUserSession.phone,
      default_rate: currentRate,
      can_deposit: activeUserSession.advance || 0,
      order_date: todayStr,
      ord_d: dVal,
      ord_e: eVal,
      rate: currentRate,
      amount: totalAmt,
      status: 'NEW',
      replace_qty: rQty,
      replace_reason: rReason,
      created_by: activeUserSession.cpn
    };

    if (activeUserSession.hasExistingOrder) {
      const { error } = await supabase1
        .from('orders')
        .update(payload)
        .eq('cpn_no', activeUserSession.cpn);

      if (error) throw error;
    } else {
      var uniqueNo = "ORD-" + activeUserSession.cpn + "-" + Date.now().toString().slice(-6);
      payload.unique_no = uniqueNo;

      const { error } = await supabase1
        .from('orders')
        .insert([payload]);

      if (error) throw error;
      activeUserSession.uniqueNo = uniqueNo;
    }

    var btn = document.getElementById('btn-submit-order');
    btn.disabled = false;
    btn.style.opacity = '1.0';
    btn.innerHTML = 'Submit Request';
    btn.classList.remove('ring-2', 'ring-rose-400', 'ring-offset-2');
    
    window.pendingReplaceQty = null;
    window.pendingReplaceReason = null;

    msgEl.className = "text-center text-sm font-bold block mt-4 text-emerald-600";
    msgEl.innerText = activeUserSession.hasExistingOrder ? "Order updated successfully!" : "Order placed successfully!";
    msgEl.classList.remove('hidden');
    setTimeout(function () { msgEl.classList.add('hidden'); }, 4000);

    activeUserSession.hasExistingOrder = true;
    activeUserSession.existingOrdD = dVal;
    activeUserSession.existingOrdE = eVal;
    activeUserSession.replaceQty = rQty;
    activeUserSession.replaceReason = rReason;
    activeUserSession.ordDate = "Just now";
    
    localStorage.setItem('wowdrops_customer_session', JSON.stringify(activeUserSession));
    
    var poDetails = document.getElementById('po-details');
    var poEmpty = document.getElementById('po-empty-msg');

    if (poDetails) poDetails.classList.remove('hidden');
    if (poEmpty) poEmpty.classList.add('hidden');

    document.getElementById('po-date').innerText = "Just now";
    document.getElementById('po-cans').innerText = dVal;
    document.getElementById('po-empties').innerText = eVal;

    var poRepContainer = document.getElementById('po-rep-container');
    var poRepText = document.getElementById('po-rep-text');

    if (rQty > 0 && poRepContainer && poRepText) {
      poRepText.innerText = rQty + " Replacement(s) (" + rReason + ")";
      poRepContainer.classList.remove('hidden');
    } else if (poRepContainer) {
      poRepContainer.classList.add('hidden');
    }

    toggleOrderEditMode(false);

  } catch (err) {
    toggleButtonState('btn-submit-order', false, 'Submit Request');
    showError(msgEl, "Network error: " + err.message);
  }
}

function openReplacementModal() {
  var sessionQty = (activeUserSession && activeUserSession.replaceQty) ? activeUserSession.replaceQty : 0;
  var sessionReason = (activeUserSession && activeUserSession.replaceReason) ? activeUserSession.replaceReason : "";
  
  var rQty = (window.pendingReplaceQty != null) ? window.pendingReplaceQty : sessionQty;
  var rReason = (window.pendingReplaceReason != null) ? window.pendingReplaceReason : sessionReason;
  
  document.getElementById('input-replace-qty').value = rQty;
  document.getElementById('input-replace-reason').value = rReason;
  
  var modal = document.getElementById('replacement-modal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeReplacementModal() {
  var modal = document.getElementById('replacement-modal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

function adjustReplacementValue(step) {
  var field = document.getElementById('input-replace-qty');
  var currentVal = parseInt(field.value) || 0;
  var newVal = Math.max(0, currentVal + step);
  
  var maxAllowed = (activeUserSession && activeUserSession.maxClientD !== undefined && activeUserSession.maxClientD !== null) ? activeUserSession.maxClientD : 9999;
  if (newVal > maxAllowed) newVal = maxAllowed;
  
  field.value = newVal;
}

function saveReplacementToOrder() {
  var rQty = parseInt(document.getElementById('input-replace-qty').value) || 0;
  var rReason = document.getElementById('input-replace-reason').value;
  
  if (rQty > 0 && rReason === "") {
    alert("Please select a reason for the replacement.");
    return;
  }

  var maxAllowed = (activeUserSession && activeUserSession.maxClientD !== undefined && activeUserSession.maxClientD !== null) ? activeUserSession.maxClientD : 9999;
  if (rQty > maxAllowed) {
     alert("You cannot replace more than your allowed personal limit of " + maxAllowed + " cans.");
     return;
  }
  
  window.pendingReplaceQty = rQty;
  window.pendingReplaceReason = rReason;
  
  closeReplacementModal();
  
  var badge = document.getElementById('replacement-badge');
  var badgeText = document.getElementById('replacement-badge-text');

  if (rQty > 0) {
    badgeText.innerText = "📦 Includes " + rQty + " Free Replacement (" + rReason + ")";
    badge.classList.remove('hidden');
    badge.classList.add('flex');
  } else {
    badge.classList.add('hidden');
    badge.classList.remove('flex');
  }
}