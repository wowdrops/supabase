// ==========================================
// MODULE: MANAGE ORDERS (SUPABASE DIRECT)
// ==========================================

const ORD2_FETCH_MODE = "LiveSearch"; 
  
let ord2CurrentEditId = null;
let ord2CurrentEditRowIdx = null; 
let ord2CachedOrders = [];
let ord2TypingTimer;
let ord2SetupConfig = { totalAllowed: 0, restrictQty: 0, minQty: 0 };
let ord2CachedProfile = { apt: "", blk: "", door: "", name: "", contact: "", rate: 0, status: "", statusReason: "", advanceDepositAmount: 0 };
  
window.activeOrd2TimerInterval = null;
window.ord2StartTime = 0;

window.handlePendAutoFill = function() {
  const pendVal = Number(document.getElementById('ord2-inp-pend').value) || 0;
  const ordDInput = document.getElementById('ord2-inp-ordD');
  const currOrdD = Number(ordDInput.value) || 0;
  
  if (pendVal > currOrdD) {
     ordDInput.value = pendVal;
  }
};

window.startOrd2Timer = function(actionLabel) {
  var timerBadge = document.getElementById('ord2-live-timer');
  if (!timerBadge) return;
  
  timerBadge.outerHTML = '<span id="ord2-live-timer" class="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-400 font-black px-3 py-1.5 rounded-lg text-sm border-2 border-indigo-200 dark:border-indigo-800 shadow-inner flex items-center gap-1.5 min-w-max transition-colors"><svg class="w-4 h-4 animate-spin text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>' + actionLabel + ': <span id="ord2-timer-sec">0.00</span>s</span>';
  
  var badge = document.getElementById('ord2-live-timer');
  badge.classList.remove('hidden');

  window.ord2StartTime = performance.now();
  if(window.activeOrd2TimerInterval) clearInterval(window.activeOrd2TimerInterval);
  
  window.activeOrd2TimerInterval = setInterval(function() {
      var curr = ((performance.now() - window.ord2StartTime) / 1000).toFixed(2);
      var secEl = document.getElementById('ord2-timer-sec');
      if(secEl) secEl.innerText = curr;
  }, 50);
};

window.stopOrd2Timer = function(successLabel, isError) {
  if(window.activeOrd2TimerInterval) clearInterval(window.activeOrd2TimerInterval);
  var finalTime = ((performance.now() - window.ord2StartTime) / 1000).toFixed(2);
  var badge = document.getElementById('ord2-live-timer');
  if(badge) {
      if (isError) {
          badge.outerHTML = '<span id="ord2-live-timer" class="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400 font-bold px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-800 text-xs uppercase tracking-widest whitespace-nowrap shadow-sm min-w-max transition-colors">Failed</span>';
      } else {
          badge.outerHTML = '<span id="ord2-live-timer" class="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400 font-bold px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 text-xs uppercase tracking-widest whitespace-nowrap shadow-sm min-w-max transition-colors">' + successLabel + ' in ' + finalTime + 's</span>';
      }
  }
};

window.toggleOrd2Header = function() {
  var col = document.getElementById('ord2-header-collapsible');
  var icon = document.getElementById('ord2-header-icon');
  if (col.classList.contains('hidden')) { col.classList.remove('hidden'); icon.classList.add('rotate-180'); } 
  else { col.classList.add('hidden'); icon.classList.remove('rotate-180'); }
};

window.loadTranOrdersData = async function() {
  const tbody = document.getElementById('ord2-tbl-body');
  if (!tbody) return;
  
  window.startOrd2Timer('Loading');
  tbody.innerHTML = '<tr><td colspan="18" class="text-center py-10 text-indigo-500 dark:text-indigo-400 font-bold animate-pulse transition-colors">Loading live orders...</td></tr>';
  
  try {
    const supa = window.supabase1;
    if (!supa) throw new Error("Database not connected.");

    const { data: setupData } = await supa.from('setup').select('key, value');
    let setupConfig = { totalAllowed: 0, restrictQty: 0, minQty: 0 };
    (setupData || []).forEach(row => {
      const k = String(row.key || '').trim().toLowerCase();
      const v = Number(row.value) || 0;
      if (k === "per day can count") setupConfig.totalAllowed = v;
      if (k === "lookup restrict can qty") setupConfig.restrictQty = v;
      if (k === "minimum entry qty") setupConfig.minQty = v;
    });
    ord2SetupConfig = setupConfig;

    const { data: ordersData, error: ordersErr } = await supa
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (ordersErr) throw ordersErr;

    const { data: outData, error: outErr } = await supa.from('v_customer_outstanding').select('*');

    const outDict = {};
    if (!outErr && outData) {
      outData.forEach(row => {
        const cpn = String(row.cpn_no || '').trim().toUpperCase();
        if (cpn) {
          outDict[cpn] = {
            m1: Number( row.old_pending || 0),
            m2: Number( row.m2_pending || 0),
            m3: Number( row.m1_pending || 0),
            m4: Number( row.current_month_pending || 0),
            cans: Number( row.cans || 0)
          };
        }
      });
    }

    let orders = [];
    (ordersData || []).forEach((row) => {
      const ordCpn = String(row.cpn_no || '').trim().toUpperCase();
      const ledger = outDict[ordCpn] || { m1: 0, m2: 0, m3: 0, m4: 0, cans: 0 };
      const totalDue = ledger.m1 + ledger.m2 + ledger.m3 + ledger.m4;
      const ordD = Number(row.ord_d || 0);
      const rate = Number(row.rate || row.default_rate || 0);

      let dateStr = row.order_date ? new Date(row.order_date).toLocaleDateString('en-GB', {day: '2-digit', month: 'short', year: 'numeric'}).replace(/ /g, '-') : '';
      let timeStr = row.created_at ? new Date(row.created_at).toLocaleDateString('en-GB', {day: '2-digit', month: 'short'}) + ' ' + new Date(row.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false}) : '';

      orders.push({
        id: row.id,
        rowIdx: row.id,
        date: dateStr,
        time: timeStr,
        apt: row.apartment || '',
        blk: row.block || '',
        door: row.door || '',
        cpn: ordCpn,
        name: row.name || '',
        phone: row.contact || '',
        ordD: ordD,
        ordE: Number(row.ord_e || 0),
        pendQty: Number(row.pending_qty || 0),
        repQty: Number(row.replace_qty || 0),
        repReason: row.replace_reason || '',
        rate: rate,
        estAmt: ordD * rate,
        canDeposit: Number(row.can_deposit || 0),
        outTotal: totalDue,
        outAB: ledger.m1,
        outAC: ledger.m2,
        outAD: ledger.m3,
        outAE: ledger.m4,
        outAF: ledger.cans,
        cmt: row.order_comment || ''
      });
    });

    ord2CachedOrders = orders;
    window.stopOrd2Timer('Loaded', false);
    renderOrd2Table(orders);

  } catch (err) {
    window.stopOrd2Timer('Failed', true);
    if(window.showToast) window.showToast("Load Error: " + err.message, "error");
    tbody.innerHTML = `<tr><td colspan="18" class="text-center py-10 text-red-500 dark:text-red-400 font-bold transition-colors">Error: ${err.message}</td></tr>`;
  }
};

function renderOrd2Table(data) {
  const tbody = document.getElementById('ord2-tbl-body');
  tbody.innerHTML = '';
  let sumD = 0, sumE = 0, sumEst = 0, sumPend = 0, sumRep = 0, sumDeposit = 0;

  if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="18" class="text-center py-12 text-slate-400 dark:text-slate-500 font-bold transition-colors">No active orders found.</td></tr>';
  } else {
      data.forEach(order => {
        sumD += order.ordD;
        sumE += order.ordE;
        sumPend += order.pendQty;
        sumRep += order.repQty;
        sumEst += order.estAmt;
        sumDeposit += (order.canDeposit || 0);

        const row = document.createElement('tr');
        row.className = "hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-100 dark:border-slate-700/50";
        
        let locHtml = `<p class="font-bold text-slate-500 dark:text-slate-400 text-xs tracking-widest uppercase transition-colors">${order.apt}</p><p class="text-slate-800 dark:text-white font-black transition-colors">${order.blk} / ${order.door}</p>`;
        
        let custHtml = `<p class="font-black text-indigo-700 text-base"><span class="inline-flex items-center gap-1.5 px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/50 hover:shadow-sm active:scale-95 transition-all cursor-pointer group" onclick="window.openCustomer360('${order.cpn}')">
                          ${order.cpn}
                          <svg class="w-3.5 h-3.5 text-indigo-400 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                          </span>
                        </p><p class="text-xs font-bold text-slate-500 dark:text-slate-400 truncate max-w-[150px] transition-colors">${order.name}</p><p class="text-[10px] text-slate-400 dark:text-slate-500 tracking-widest transition-colors">${order.phone}</p>`;  
        
        let reasonStr = order.repReason ? `<br><span class="text-[9px] text-rose-500 dark:text-rose-400 font-bold uppercase tracking-widest transition-colors">${order.repReason}</span>` : '';

        // FIX: Injecting value="${order.id}" into the checkbox below!
        row.innerHTML = `
          <td class="p-4 text-center"><input type="checkbox" value="${order.id}" class="w-5 h-5 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 ord-batch-chk cursor-pointer transition-colors"></td>
          <td class="p-4"><p class="text-sm font-black text-slate-700 dark:text-slate-300 transition-colors">${order.date}</p><p class="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest transition-colors">${order.time}</p></td>
          <td class="p-4">${locHtml}</td>
          <td class="p-4">${custHtml}</td>
          <td class="p-4 text-center"><span class="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1 rounded-lg text-lg font-black text-slate-700 dark:text-slate-300 transition-colors">${order.ordD}</span></td>
          <td class="p-4 text-center"><span class="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1 rounded-lg text-lg font-black text-slate-700 dark:text-slate-300 transition-colors">${order.ordE}</span></td>
          <td class="p-4 text-center"><span class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-2.5 py-1 rounded-lg text-base font-black text-amber-700 dark:text-amber-500 transition-colors">${order.pendQty}</span></td>
          <td class="p-4 text-center leading-tight"><span class="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 px-2.5 py-1 rounded-lg text-base font-black text-rose-700 dark:text-rose-500 transition-colors">${order.repQty}</span>${reasonStr}</td>
          <td class="p-4 text-right text-emerald-600 dark:text-emerald-400 text-lg font-black transition-colors">₹${order.estAmt}</td>
          <td class="p-4 text-right text-amber-600 dark:text-amber-500 text-lg font-black transition-colors">₹${order.canDeposit || 0}</td>
          <td class="p-4 text-right bg-slate-50 dark:bg-slate-900/50 border-l border-slate-100 dark:border-slate-700/50 font-black text-lg transition-colors ${order.outTotal > 0 ? 'text-red-500 dark:text-red-400' : 'text-slate-400 dark:text-slate-500'}">₹${order.outTotal}</td>
          <td class="p-4 text-right hidden ord2-ext-col bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-xs transition-colors">${order.outAB}</td>
          <td class="p-4 text-right hidden ord2-ext-col bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-xs transition-colors">${order.outAC}</td>
          <td class="p-4 text-right hidden ord2-ext-col bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-xs transition-colors">${order.outAD}</td>
          <td class="p-4 text-right hidden ord2-ext-col bg-slate-50 dark:bg-slate-900/50 font-black text-rose-600 dark:text-rose-400 transition-colors">${order.outAE}</td>
          <td class="p-4 text-right hidden ord2-ext-col bg-slate-50 dark:bg-slate-900/50 font-black text-amber-600 dark:text-amber-400 transition-colors">${order.outAF}</td>
          <td class="p-4 text-xs text-slate-500 dark:text-slate-400 font-bold max-w-[150px] truncate transition-colors"><div class="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 transition-colors" title="${order.cmt}">${order.cmt || '-'}</div></td>
          <td class="p-4 text-center space-x-2">
            <button onclick="window.triggerOrd2Edit('${order.id}')" class="text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 p-1.5 rounded transition-colors" title="Edit Order">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
            </button>
            <button onclick="window.triggerOrd2Delete('${order.id}')" class="text-rose-400 hover:text-rose-600 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-900/30 p-1.5 rounded transition-colors" title="Delete Order">
               <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
          </td>
        `;
        tbody.appendChild(row);
      });
  }

  document.getElementById('ord2-txt-totOrdD').innerText = sumD;
  document.getElementById('ord2-txt-totOrdE').innerText = sumE;
  document.getElementById('ord2-txt-totPend').innerText = sumPend;
  document.getElementById('ord2-txt-totRep').innerText = sumRep;
  document.getElementById('ord2-txt-totEst').innerText = '₹' + sumEst;
  document.getElementById('ord2-txt-totDeposit').innerText = '₹' + sumDeposit;
  
  document.getElementById('ord2-top-totOrdD').innerText = sumD;
  document.getElementById('ord2-top-totOrdE').innerText = sumE;
  document.getElementById('ord2-top-totEst').innerText = '₹' + sumEst;

  var allowed = ord2SetupConfig.totalAllowed;
  var physicalDemand = sumD; 
  var available = allowed - physicalDemand; 
  
  document.getElementById('dash-tot-allowed').innerText = allowed;
  document.getElementById('dash-norm-placed').innerText = physicalDemand;
  document.getElementById('dash-pend-placed').innerText = sumPend;
  document.getElementById('dash-rep-placed').innerText = sumRep;
  document.getElementById('dash-avail-cans').innerText = available;
  document.getElementById('dash-min-qty').innerText = ord2SetupConfig.minQty;
  document.getElementById('dash-res-qty').innerText = ord2SetupConfig.restrictQty;
}

window.toggleOrd2OutstandingCols = function() {
  const extCols = document.querySelectorAll('.ord2-ext-col');
  const icon = document.getElementById('ord2-txt-toggleIcon');
  if(!extCols.length) return;
  let isHidden = extCols[0].classList.contains('hidden');
  extCols.forEach(col => {
    if (isHidden) col.classList.remove('hidden');
    else col.classList.add('hidden');
  });
  icon.innerText = isHidden ? '-' : '+';
};

window.handleOrd2CpnTyping = function() {
  if (ORD2_FETCH_MODE !== "LiveSearch") return;
  const cpn = document.getElementById('ord2-inp-cpn').value.trim();
  const btn = document.getElementById('ord2-btn-submit');
  if (btn) btn.disabled = true;

  clearTimeout(ord2TypingTimer);
  if (cpn.length >= 3) { ord2TypingTimer = setTimeout(() => { window.executeOrd2CpnFetch(cpn); }, 600); }
};

window.forceFetchOrd2Cpn = function() {
  const cpn = document.getElementById('ord2-inp-cpn').value.trim();
  if(cpn) window.executeOrd2CpnFetch(cpn);
};

window.executeOrd2CpnFetch = async function(cpn) {
  window.startOrd2Timer('Searching');
  const card = document.getElementById('ord2-card-cpnInfo');
  card.classList.remove('hidden');
  document.getElementById('ord2-txt-infoDeposit').innerText = '...';
  document.getElementById('ord2-txt-infoDue').innerText = '...';
  document.getElementById('ord2-txt-infoAdv').innerText = '...';
  document.getElementById('ord2-txt-infoCans').innerText = '...';
  document.getElementById('ord2-txt-infoName').innerText = 'Loading Profile...';
  document.getElementById('ord2-txt-infoAptBlkDoor').innerText = '-';

  const submitBtn = document.getElementById('ord2-btn-submit');
  submitBtn.disabled = true;

  try {
    const supa = window.supabase1;
    const cleanCpn = cpn.trim().toUpperCase();

    const { data: custData, error: custErr } = await supa
      .from('ac_customers')
      .select('*')
      .eq('cpn_no', cleanCpn)
      .maybeSingle();

    if (custErr || !custData) {
      window.stopOrd2Timer('Not Found', true);
      ord2CachedProfile = { apt: "", blk: "", door: "", name: "", contact: "", rate: 0, status: "", statusReason: "", advanceDepositAmount: 0 };
      document.getElementById('ord2-txt-infoDeposit').innerText = 'N/A';
      document.getElementById('ord2-txt-infoDue').innerText = 'N/A';
      document.getElementById('ord2-txt-infoAdv').innerText = 'N/A';
      document.getElementById('ord2-txt-infoCans').innerText = 'N/A';
      document.getElementById('ord2-txt-infoName').innerText = 'Not Found';
      document.getElementById('ord2-txt-infoAptBlkDoor').innerText = '-';
      document.getElementById('ord2-inp-rate').value = "";
      submitBtn.disabled = true;
      return;
    }

    const { data: outData } = await supa
      .from('v_customer_outstanding')
      .select('*')
      .eq('cpn_no', cleanCpn)
      .maybeSingle();

    let m1 = 0, m2 = 0, m3 = 0, m4 = 0, cans = 0;
    if (outData) {
      m1 = Number( outData.old_pending || 0);
      m2 = Number( outData.m2_pending || 0);
      m3 = Number( outData.m1_pending || 0);
      m4 = Number( outData.current_month_pending || 0);
      cans = Number( outData.cans || 0);
    }
    let due = m1 + m2 + m3 + m4;

    ord2CachedProfile = {
      apt: custData.apartment || '',
      blk: custData.block || '',
      door: custData.door || '',
      name: custData.poc1 || '',
      contact: custData.con1 || '',
      rate: Number(custData.default_rate || 0),
      status: custData.final_status || custData.client_status || '',
      statusReason: custData.inactive_reason || '',
      advanceDepositAmount: Number(custData.can_deposit || 0),
      outTotal: due,
      outM1: m1, outM2: m2, outM3: m3, outM4: m4,
      cans: cans
    };

    window.stopOrd2Timer('Found', false);
    document.getElementById('ord2-txt-infoDeposit').innerText = '₹' + ord2CachedProfile.advanceDepositAmount;
    document.getElementById('ord2-txt-infoDue').innerText = '₹' + due;
    document.getElementById('ord2-txt-infoAdv').innerText = '₹0';
    document.getElementById('ord2-txt-infoCans').innerText = cans;

    if (!ord2CurrentEditId) {
      document.getElementById('ord2-inp-rate').value = ord2CachedProfile.rate || 0;
    }

    if (ord2CachedProfile.status === 'INACTIVE') {
      let reasonText = ord2CachedProfile.statusReason ? ` (${ord2CachedProfile.statusReason})` : '';
      document.getElementById('ord2-txt-infoName').innerHTML = `<span class="text-rose-600 dark:text-rose-400 font-black">⚠️ INACTIVE${reasonText}:</span> ${ord2CachedProfile.name || 'Unknown'}`;
      document.getElementById('ord2-txt-infoAptBlkDoor').innerText = `${ord2CachedProfile.apt || '-'} | ${ord2CachedProfile.blk || '-'} | ${ord2CachedProfile.door || '-'}`;
      submitBtn.disabled = true;
      if(window.showToast) window.showToast("Cannot place order. Customer is INACTIVE.", "warning");
    } else {
      document.getElementById('ord2-txt-infoName').innerText = ord2CachedProfile.name || 'Unknown';
      document.getElementById('ord2-txt-infoAptBlkDoor').innerText = `${ord2CachedProfile.apt || '-'} | ${ord2CachedProfile.blk || '-'} | ${ord2CachedProfile.door || '-'}`;
      submitBtn.disabled = false;
    }

  } catch (err) {
    window.stopOrd2Timer('Failed', true);
    if(window.showToast) window.showToast("Search Error: " + err.message, "error");
  }
};

window.triggerOrd2Edit = function(uniqueNo) {
  const order = ord2CachedOrders.find(o => String(o.id) === String(uniqueNo));
  if (!order) return;
  if (!confirm("Are you sure you want to edit this order?")) return;

  ord2CurrentEditId = uniqueNo;
  
  document.getElementById('ord2-inp-cpn').value = order.cpn;
  document.getElementById('ord2-inp-ordD').value = order.ordD;
  document.getElementById('ord2-inp-ordE').value = order.ordE;
  document.getElementById('ord2-inp-pend').value = order.pendQty || "";
  document.getElementById('ord2-inp-rep').value = order.repQty || "";
  document.getElementById('ord2-inp-repReason').value = order.repReason || "";
  document.getElementById('ord2-inp-rate').value = order.rate || 0; 
  document.getElementById('ord2-inp-comment').value = order.cmt || "";
  
  const submitBtn = document.getElementById('ord2-btn-submit');
  submitBtn.classList.replace('bg-indigo-600', 'bg-amber-500');
  submitBtn.classList.replace('hover:bg-indigo-700', 'hover:bg-amber-600');
  submitBtn.classList.replace('dark:bg-indigo-700', 'dark:bg-amber-600');
  submitBtn.classList.replace('dark:hover:bg-indigo-600', 'dark:hover:bg-amber-500');
  document.getElementById('ord2-icon-submit').outerHTML = `<svg id="ord2-icon-submit" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>`;
  
  document.getElementById('ord2-btn-cancelEdit').classList.remove('hidden');
  
  window.executeOrd2CpnFetch(order.cpn);
  var col = document.getElementById('ord2-header-collapsible');
  if (col.classList.contains('hidden')) window.toggleOrd2Header();
  if (typeof window.scrollAdminTo === 'function') window.scrollAdminTo('top');
};

window.resetOrd2Form = function() {
  ord2CurrentEditId = null;
  ord2CachedProfile = { apt: "", blk: "", door: "", name: "", contact: "", rate: 0, status: "", statusReason: "", advanceDepositAmount: 0 };
  
  document.getElementById('ord2-inp-cpn').value = "";
  document.getElementById('ord2-inp-ordD').value = "";
  document.getElementById('ord2-inp-ordE').value = "";
  document.getElementById('ord2-inp-pend').value = "";
  document.getElementById('ord2-inp-rep').value = "";
  document.getElementById('ord2-inp-repReason').value = "";
  document.getElementById('ord2-inp-rate').value = ""; 
  document.getElementById('ord2-inp-comment').value = "";
  document.getElementById('ord2-card-cpnInfo').classList.add('hidden');
  
  const submitBtn = document.getElementById('ord2-btn-submit');
  submitBtn.classList.replace('bg-amber-500', 'bg-indigo-600');
  submitBtn.classList.replace('hover:bg-amber-600', 'hover:bg-indigo-700');
  submitBtn.classList.replace('dark:bg-amber-600', 'dark:bg-indigo-700');
  submitBtn.classList.replace('dark:hover:bg-amber-500', 'dark:hover:bg-indigo-600');
  document.getElementById('ord2-icon-submit').outerHTML = `<svg id="ord2-icon-submit" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M12 4v16m8-8H4"></path></svg>`;
  
  document.getElementById('ord2-btn-cancelEdit').classList.add('hidden');
};

window.submitOrd2Order = async function() {
  const cpn = document.getElementById('ord2-inp-cpn').value.trim();
  let ordD = Number(document.getElementById('ord2-inp-ordD').value) || 0; 
  const ordE = Number(document.getElementById('ord2-inp-ordE').value) || 0;
  const pendQty = Number(document.getElementById('ord2-inp-pend').value) || 0;
  const repQty = Number(document.getElementById('ord2-inp-rep').value) || 0;
  const repReason = document.getElementById('ord2-inp-repReason').value.trim();
  const rateOverride = document.getElementById('ord2-inp-rate').value; 
  const cmt = document.getElementById('ord2-inp-comment').value;
  const btn = document.getElementById('ord2-btn-submit');
  
  const adminName = (window.activeAdminSession && window.activeAdminSession.username) ? window.activeAdminSession.username : 'Admin';

  if (!ord2CachedProfile || !ord2CachedProfile.name) {
     return window.showToast ? window.showToast("Wait for profile to load.", "warning") : alert("Wait for profile.");
  }

  if (!cpn) return window.showToast ? window.showToast("Provide a CPN.", "warning") : alert("Provide a CPN.");
  
  if (ordD === 0 && ordE === 0 && pendQty === 0 && repQty === 0) {
     return window.showToast ? window.showToast("Provide an amount for D, E, PEND, or REP.", "warning") : alert("Provide quantities.");
  }

  if (ord2CachedProfile.status === 'INACTIVE') {
      return window.showToast ? window.showToast("Cannot place order. Customer is INACTIVE.", "error") : alert("Customer is INACTIVE.");
  }

  if (pendQty > ordD) { 
    ordD = pendQty; 
    document.getElementById('ord2-inp-ordD').value = ordD; 
  }

  ord2CachedProfile.rate = Number(rateOverride) || 0;

  btn.disabled = true;
  window.startOrd2Timer('Saving');

  try {
    const supa = window.supabase1;
    const cleanCpn = cpn.toUpperCase();

    if (!ord2CurrentEditId) {
      const { data: duplicateCheck, error: dupErr } = await supa
        .from('orders')
        .select('id')
        .eq('cpn_no', cleanCpn)
        .maybeSingle();

      if (dupErr) throw dupErr;

      if (duplicateCheck) {
        btn.disabled = false;
        window.stopOrd2Timer('Declined', true);
        if(window.showToast) window.showToast("Active order already exists for " + cleanCpn + ".", "error");
        return;
      }
    }

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const uniqueID = "ORD2_" + now.getTime();
    const estAmt = ordD * ord2CachedProfile.rate;

    const payload = {
      cpn_no: cleanCpn,
      apartment: ord2CachedProfile.apt,
      block: ord2CachedProfile.blk,
      door: ord2CachedProfile.door,
      name: ord2CachedProfile.name,
      contact: ord2CachedProfile.contact,
      default_rate: ord2CachedProfile.rate,
      can_deposit: ord2CachedProfile.advanceDepositAmount,
      order_date: todayStr, 
      ord_d: ordD,
      ord_e: ordE,
      pending_qty: pendQty,
      replace_qty: repQty,
      replace_reason: repReason,
      rate: ord2CachedProfile.rate,
      amount: estAmt,
      order_comment: cmt,
      unique_no: uniqueID,
      status: 'NEW',
      created_by: adminName
    };

    if (ord2CurrentEditId) {
      const { error } = await supa.from('orders').update(payload).eq('id', ord2CurrentEditId);
      if (error) throw error;
      window.stopOrd2Timer('Saved', false);
      if(window.showToast) window.showToast("Order updated.", "success");
      window.resetOrd2Form();
      window.loadTranOrdersData();
    } else {
      const { error } = await supa.from('orders').insert([payload]);
      if (error) throw error;
      window.stopOrd2Timer('Saved', false);
      if(window.showToast) window.showToast("Order placed successfully.", "success");
      window.resetOrd2Form();
      window.loadTranOrdersData();
    }
  } catch (err) {
    btn.disabled = false;
    window.stopOrd2Timer('Failed', true);
    if(window.showToast) window.showToast("Save Error: " + err.message, "error");
  }
};

window.triggerOrd2Delete = async function(uniqueNo) {
  if (confirm("Are you sure you want to permanently delete this order?")) {
     window.startOrd2Timer('Deleting');
     try {
       const supa = window.supabase1;
       const { error } = await supa.from('orders').delete().eq('id', uniqueNo);
       if (error) throw error;
       window.stopOrd2Timer('Deleted', false);
       if(window.showToast) window.showToast("Order deleted.", "success");
       window.loadTranOrdersData();
     } catch (err) {
       window.stopOrd2Timer('Failed', true);
       if(window.showToast) window.showToast("Delete Error: " + err.message, "error");
     }
  }
};

window.executeBatchTransferToDel2 = async function() {
  var btn = document.getElementById('ord2-btn-batchTransfer');
  var checkboxes = document.querySelectorAll('.ord-batch-chk:checked');
  var selectedIds = [];

  checkboxes.forEach(chk => selectedIds.push(Number(chk.value))); 

  if (selectedIds.length === 0) {
      return window.showToast ? window.showToast("Select at least one order to transfer.", "warning") : alert("Select orders.");
  }
 
  if (confirm("Transfer " + selectedIds.length + " orders to deliveries stage?")) {
    btn.disabled = true;
    window.startOrd2Timer('Transferring');

    try {
      const adminName = (window.activeAdminSession && window.activeAdminSession.username) ? window.activeAdminSession.username : 'Admin';

      // 1. Single RPC Call handles everything (Transfer, Delete, and Notification Logs)
      const { data: result, error } = await window.supabase1.rpc('process_daily_order_transfers', {
        p_order_ids: selectedIds,
        p_admin_name: adminName
      });

      if (error) throw error;

      // 2. Handle the Safety Check Failure
      if (!result.success && result.error === 'DELIVERIES_NOT_EMPTY') {
        btn.disabled = false;
        window.stopOrd2Timer('Declined', true);
        return window.showToast ? window.showToast(result.message, "error") : alert(result.message);
      }

      // 3. Success!
      window.stopOrd2Timer('Transferred', false);
      btn.disabled = false;
      if(window.showToast) window.showToast(result.transferred_count + " records moved to deliveries & alerts queued.", "success");
      
      window.loadTranOrdersData(); 

    } catch (err) {
      btn.disabled = false;
      window.stopOrd2Timer('Failed', true);
      if(window.showToast) window.showToast("Transfer Error: " + err.message, "error");
    }
  }
};

window.toggleAllOrdChk = function(mainChk) {
  const checkboxes = document.querySelectorAll('.ord-batch-chk');
  checkboxes.forEach(chk => chk.checked = mainChk.checked);
};

window.tabActions['tran-order'] = function() { 
    if(typeof window.resetOrd2Form === 'function') window.resetOrd2Form();
    window.loadTranOrdersData(); 
};