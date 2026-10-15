// ==========================================
// HISTORY & ACTIVITY LOG (Supabase Version)
// ==========================================

async function fetchDashboardActivity() {
  var cpn = activeUserSession.cpn;

  try {
    // 1. Fetch Latest Delivery / Out for Delivery status from 'deliveries' table
    const { data: delData } = await supabase1
      .from('deliveries')
      .select('*')
      .eq('cpn_no', cpn)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    var ldCard = document.getElementById('widget-latest-delivery');
    if (delData) {
      var isOutForDelivery = String(delData.status || '').toUpperCase() === 'PENDING' || !delData.unload_on;
      if (!isOutForDelivery) {
        if (ldCard) ldCard.classList.remove('hidden');
        var elDate = document.getElementById('ld-date'); if (elDate) elDate.innerText = delData.del_date || delData.order_date || '';
        var elActD = document.getElementById('ld-actd'); if (elActD) elActD.innerText = delData.act_d || delData.ord_d || 0;
        var elActE = document.getElementById('ld-acte'); if (elActE) elActE.innerText = delData.act_e || delData.ord_e || 0;
        var elAmt = document.getElementById('ld-amt'); if (elAmt) elAmt.innerText = "₹" + (delData.amount || ((delData.act_d || delData.ord_d || 0) * (delData.rate || activeUserSession.defaultRate || 0)));

        var elThumb = document.getElementById('ld-thumb');
        if (elThumb) {
          var link = delData.door_delivery_link || '';
          var safeDelImg = getDriveDirectUrl(link);
          var thumbHtml = link ? "<a href='" + link + "' target='_blank'><img src='" + safeDelImg + "' class='w-full h-full object-cover' onerror=\"this.parentElement.innerHTML='<div class=\\'w-full h-full flex items-center justify-center text-[8px] text-slate-400 font-bold p-1 text-center\\'>Image</div>'\"></a>" : "<div class='w-full h-full flex items-center justify-center text-[8px] text-slate-400 font-bold p-1 text-center'>No Photo</div>";
          elThumb.innerHTML = thumbHtml;
        }
      } else {
        if (ldCard) ldCard.classList.add('hidden');

        var poDetails = document.getElementById('po-details');
        var poEmpty = document.getElementById('po-empty-msg');
        var pendingBanner = document.getElementById('pending-alert-banner');

        if (poDetails) poDetails.classList.remove('hidden');
        if (poEmpty) poEmpty.classList.add('hidden');
        if (pendingBanner) pendingBanner.classList.add('hidden');

        var elPoDate = document.getElementById('po-date'); if (elPoDate) elPoDate.innerText = "Today";
        var elPoCans = document.getElementById('po-cans'); if (elPoCans) elPoCans.innerText = delData.ord_d || 1;
        var elPoEmpties = document.getElementById('po-empties'); if (elPoEmpties) elPoEmpties.innerText = delData.ord_e || 1;

        var statusBadge = document.getElementById('po-status-badge');
        if (statusBadge) {
          statusBadge.innerText = "🚚 Out for Delivery";
          statusBadge.className = "mt-2 text-[10px] font-bold text-amber-800 bg-amber-100 p-1.5 rounded-md inline-block shadow-sm";
        }

        var poRepContainer = document.getElementById('po-rep-container');
        var poRepText = document.getElementById('po-rep-text');
        if ((delData.replace_qty || 0) > 0 && poRepContainer && poRepText) {
          poRepText.innerText = delData.replace_qty + " Replacement(s) (" + (delData.replace_reason || '') + ")";
          poRepContainer.classList.remove('hidden');
        } else if (poRepContainer) {
          poRepContainer.classList.add('hidden');
        }
      }
    } else {
      if (ldCard) ldCard.classList.add('hidden');
    }
  } catch (err) {
    console.error("Delivery widget render error: " + err);
  }

  try {
    // 2. Fetch Latest Sale from 'sales' table
    const { data: saleData } = await supabase1
      .from('sales')
      .select('*')
      .eq('cpn_no', cpn)
      .order('del_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    var sHtml = "";
    if (saleData) {
      sHtml = "<div class='flex justify-between items-end mt-1'>" +
        "<div>" +
        "<div class='text-sm'><span class='font-bold text-slate-800'>" + (saleData.del_date || saleData.order_date || '') + "</span></div>" +
        "<div class='flex gap-3 text-xs mt-1 font-medium text-slate-600'>" +
        "<span>Dropped: <b class='text-indigo-600'>" + (saleData.act_d || 0) + "</b></span>" +
        "<span>Empties: <b class='text-indigo-600'>" + (saleData.act_e || 0) + "</b></span>" +
        "</div>" +
        "</div>" +
        "<div class='font-black text-indigo-700 text-lg'>₹" + (saleData.amount || 0) + "</div>" +
        "</div>";
    } else { 
      sHtml = "<p class='text-xs text-slate-400 mt-2 font-medium'>No recent sales found.</p>"; 
    }
    var elSales = document.getElementById('widget-sales');
    if (elSales) elSales.innerHTML = sHtml;
  } catch (e1) { 
    console.error("Sales widget error: " + e1); 
  }

  try {
    // 3. Fetch Latest Payment from 'pays' table
    const { data: payData } = await supabase1
      .from('pays')
      .select('*')
      .eq('cpn_no', cpn)
      .order('payment_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    var pHtml = "";
    if (payData) {
      pHtml = "<div class='flex justify-between items-end mt-1'>" +
        "<div>" +
        "<div class='text-sm'><span class='font-bold text-slate-800'>" + (payData.payment_date || '') + "</span></div>" +
        "<div class='text-xs mt-1 font-medium text-slate-500'>Payment successfully credited to ledger.</div>" +
        "</div>" +
        "<div class='font-black text-emerald-700 text-lg'>₹" + (payData.amount || 0) + "</div>" +
        "</div>";
    } else { 
      pHtml = "<p class='text-xs text-slate-400 mt-2 font-medium'>No recent payments found.</p>"; 
    }
    var elPays = document.getElementById('widget-pays');
    if (elPays) elPays.innerHTML = pHtml;
  } catch (e2) { 
    console.error("Pays widget error: " + e2); 
  }
}

function loadActivityLogLazy() {
  if (isServerBusy()) return; 
  var activityContainer = document.getElementById('recent-activity-container');
  var toggleIcon = document.getElementById('icon-toggle-activity');
  var toggleText = document.getElementById('text-toggle-activity');
  
  if (activityContainer.classList.contains('hidden')) {
      toggleIcon.classList.add('rotate-180');
      toggleText.innerText = "FETCHING DATA...";
      activityContainer.classList.remove('hidden');
      
      setTimeout(() => {
          activityContainer.classList.remove('opacity-0');
          activityContainer.classList.add('opacity-100');
      }, 50);
      
      fetchDashboardActivity();
      
      setTimeout(() => {
          toggleText.innerText = "RECENT ACTIVITY LOG";
      }, 800);
  } else {
      activityContainer.classList.remove('opacity-100');
      activityContainer.classList.add('opacity-0');
      toggleIcon.classList.remove('rotate-180');
      
      setTimeout(() => {
          activityContainer.classList.add('hidden');
      }, 300);
  }
}

function openSalesHistory() {
  switchView('view-sales-history');
  var dates = getDefaultDateRange();
  document.getElementById('sales-start').value = dates.start;
  document.getElementById('sales-end').value = dates.end;
  loadSalesData();
}

async function loadSalesData() {
  var start = document.getElementById('sales-start').value;
  var end = document.getElementById('sales-end').value;
  var listEl = document.getElementById('sales-list');
  listEl.innerHTML = "<div class='flex justify-center py-10'><p class='text-sm text-indigo-600 font-bold animate-pulse'>Fetching sales records...</p></div>";

  try {
    const { data, error } = await supabase1
      .from('sales')
      .select('*')
      .eq('cpn_no', activeUserSession.cpn)
      .gte('del_date', start)
      .lte('del_date', end)
      .order('del_date', { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) { 
      listEl.innerHTML = "<p class='text-center text-sm text-slate-500 py-10 font-bold'>No sales records found.</p>"; 
      return; 
    }

    var html = '';
    data.forEach(function (r) {
      var link = r.door_delivery_link || '';
      var safeImg = getDriveDirectUrl(link);
      var imgHtml = link ? "<a href='" + link + "' target='_blank' class='shrink-0'><img src='" + safeImg + "' class='w-14 h-16 object-cover rounded border shadow-sm' onerror=\"this.parentElement.innerHTML='<div class=\\'w-14 h-16 bg-slate-100 flex items-center justify-center rounded border text-[8px] text-center text-slate-400 font-bold p-1\\'>Image</div>'\"></a>" : "";
      html += "<div class='bg-white p-3 rounded-xl shadow-sm border border-slate-100 flex gap-3'>" + imgHtml +
        "<div class='flex-1 flex justify-between items-center'>" +
        "<div><p class='text-[11px] text-slate-500 font-black mb-1.5 uppercase tracking-wide'>" + (r.del_date || r.order_date || '') + "</p>" +
        "<div class='flex space-x-2 text-[10px] font-bold'><span class='bg-indigo-50 text-indigo-700 px-2 py-1 rounded'>Delivered: " + (r.act_d || 0) + "</span>" +
        "<span class='bg-emerald-50 text-emerald-700 px-2 py-1 rounded'>Empties: " + (r.act_e || 0) + "</span></div></div>" +
        "<div class='text-right'><p class='text-[9px] text-slate-400 font-bold uppercase mb-0.5'>Amount</p>" +
        "<span class='text-lg font-black text-slate-800'>₹" + (r.amount || 0) + "</span></div>" +
        "</div></div>";
    });
    listEl.innerHTML = html;

  } catch (err) {
    console.error("Sales history error:", err);
    listEl.innerHTML = "<p class='text-center text-sm text-red-500 py-10 font-bold'>Failed to load sales history.</p>";
  }
}

function openPaymentHistory() {
  switchView('view-payment-history');
  var dates = getDefaultDateRange();
  document.getElementById('pays-start').value = dates.start;
  document.getElementById('pays-end').value = dates.end;
  loadPaymentData();
}

async function loadPaymentData() {
  var start = document.getElementById('pays-start').value;
  var end = document.getElementById('pays-end').value;
  var listEl = document.getElementById('payment-list');
  listEl.innerHTML = "<div class='flex justify-center py-10'><p class='text-sm text-indigo-600 font-bold animate-pulse'>Fetching payment records...</p></div>";

  try {
    const { data, error } = await supabase1
      .from('pays')
      .select('*')
      .eq('cpn_no', activeUserSession.cpn)
      .gte('payment_date', start)
      .lte('payment_date', end)
      .order('payment_date', { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) { 
      listEl.innerHTML = "<p class='text-center text-sm text-slate-500 py-10 font-bold'>No payments found.</p>"; 
      return; 
    }

    var html = '';
    data.forEach(function (r) {
      var commentUI = r.comment ? "<p class='text-[11px] text-slate-600 mt-1 font-medium bg-slate-50 p-1.5 rounded inline-block'>" + r.comment + "</p>" : "";
      html += "<div class='bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center'>" +
        "<div><p class='text-[11px] text-slate-500 font-black mb-0.5 uppercase tracking-wide'>" + (r.payment_date || '') + "</p>" + commentUI + "</div>" +
        "<div class='text-right'><p class='text-[9px] text-slate-400 font-bold uppercase mb-0.5'>Paid</p>" +
        "<span class='text-lg font-black text-emerald-600'>₹" + (r.amount || 0) + "</span></div></div>";
    });
    listEl.innerHTML = html;

  } catch (err) {
    console.error("Payment history error:", err);
    listEl.innerHTML = "<p class='text-center text-sm text-red-500 py-10 font-bold'>Failed to load payment history.</p>";
  }
}

function getDriveDirectUrl(url) {
  if (!url) return '';
  var fileId = '';
  var matchD = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (matchD && matchD[1]) { fileId = matchD[1]; } else {
    var matchId = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (matchId && matchId[1]) fileId = matchId[1];
  }
  if (fileId) return 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w200';
  return url;
}


