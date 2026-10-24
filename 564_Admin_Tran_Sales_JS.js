window.currentSalesRecords = [];

window.escapeHTML = function (str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

window.handleServerError = function (error) {
  if (window.showToast) window.showToast("Connection Error: " + (error.message || "Failed to communicate with server."), "error");
  var btn = document.getElementById('sc-btn-save');
  if (btn) { btn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg> Save Sales Record'; btn.disabled = false; }
  var tbody = document.getElementById('sales-crud-tbody');
  if (tbody && tbody.innerHTML.includes("Loading")) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center py-12 text-rose-500 font-bold uppercase tracking-widest">Failed to load data. Please retry.</td></tr>';
  }
};

window.initSalesCrudDates = function () {
  var startEl = document.getElementById('sc-flt-start');
  if (!startEl) return;

  var today = new Date();
  var fromday = new Date();
  fromday.setDate(today.getDate() - 2);

  startEl.value = fromday.toISOString().split('T')[0];
  var endEl = document.getElementById('sc-flt-end');
  if (endEl) endEl.value = today.toISOString().split('T')[0];
};

window.loadSalesCrudData = async function () {
  var start = document.getElementById('sc-flt-start').value;
  var end = document.getElementById('sc-flt-end').value;
  var tbody = document.getElementById('sales-crud-tbody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="text-center py-12 text-indigo-500 animate-pulse font-black uppercase tracking-widest">Loading Sales Records...</td></tr>';

  try {
    const { data, error } = await window.supabase1
      .from('sales')
      .select('*')
      .gte('del_date', start)
      .lte('del_date', end)
      .order('id', { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="text-center py-12 text-slate-400 font-bold uppercase tracking-widest">No sales records found for this date range.</td></tr>';
      
      var resetEls = ['sum-records', 'sum-act-d', 'sum-act-e', 'sum-amount'];
      resetEls.forEach(id => { var el = document.getElementById(id); if(el) el.innerText = "0"; });
      
      return;
    }

    window.currentSalesRecords = data.map(row => ({
      id: row.id,
      uniqueNo: row.unique_no || "",
      cpn: (row.cpn_no || "⚠️ MISSING CPN").toUpperCase(),
      delDate: row.del_date || "⚠️ BAD DATE",
      actD: Number(row.act_d) || 0,
      actE: Number(row.act_e) || 0,
      rate: Number(row.rate) || 0,
      amount: Number(row.amount) || 0,
      delComment: row.delivery_comment || "",
      doorLink: row.door_delivery_link || "",
      vjFull: Number(row.act_d_vj) || 0,
      nvjFull: Number(row.act_d_nvj) || 0,
      vjEmp: Number(row.act_e_vj) || 0,
      nvjEmp: Number(row.act_e_nvj) || 0
    }));

    var totalActD = 0;
    var totalActE = 0;
    var totalAmount = 0;

    window.currentSalesRecords.forEach(r => {
      totalActD += r.actD;
      totalActE += r.actE;
      totalAmount += r.amount;
    });

    var sumRecEl = document.getElementById('sum-records'); if (sumRecEl) sumRecEl.innerText = window.currentSalesRecords.length;
    var sumActDEl = document.getElementById('sum-act-d'); if (sumActDEl) sumActDEl.innerText = totalActD;
    var sumActEEl = document.getElementById('sum-act-e'); if (sumActEEl) sumActEEl.innerText = totalActE;
    var sumAmtEl = document.getElementById('sum-amount'); if (sumAmtEl) sumAmtEl.innerText = "₹" + totalAmount.toLocaleString('en-IN');

    var html = '';
    window.currentSalesRecords.forEach(function (r, index) {
      var cleanCpn = String(r.cpn || '').trim().toUpperCase();
      
      html += `<tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                <td class="p-4 pl-6">
                   <span class="inline-flex items-center gap-1.5 px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/50 hover:shadow-sm active:scale-95 transition-all cursor-pointer group" onclick="window.openCustomer360('${cleanCpn}')">
                      <span class="font-black tracking-widest text-xs">${cleanCpn}</span>
                      <svg class="w-3 h-3 text-indigo-400 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                   </span>
                </td>
                <td class="p-4 text-slate-600 dark:text-slate-300 font-bold text-xs uppercase tracking-widest">${r.delDate}</td>
                <td class="p-4 text-center font-black text-indigo-600 dark:text-indigo-300 text-base">${r.actD} <span class="text-[10px] font-bold text-slate-400 block -mt-1 tracking-widest uppercase">VJ:${r.vjFull} / NVJ:${r.nvjFull}</span></td>
                <td class="p-4 text-center font-black text-amber-600 dark:text-amber-400 text-base">${r.actE} <span class="text-[10px] font-bold text-slate-400 block -mt-1 tracking-widest uppercase">VJ:${r.vjEmp} / NVJ:${r.nvjEmp}</span></td>
                <td class="p-4 text-right text-slate-600 dark:text-slate-300 font-black text-xs">₹${r.rate}</td>
                <td class="p-4 text-right text-emerald-600 dark:text-emerald-400 font-black text-lg drop-shadow-sm">₹${r.amount}</td>
                <td class="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 max-w-[200px] truncate" title="${r.delComment}">${r.delComment || '-'}</td>
                <td class="p-4 text-center space-x-1.5">
                  <button onclick="window.editSalesRecord(${index})" class="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-200 hover:shadow-sm p-1.5 rounded-lg transition outline-none" title="Edit Record"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg></button>
                  <button onclick="window.deleteSalesRecord('${window.escapeHTML(r.uniqueNo)}')" class="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-rose-200 hover:shadow-sm p-1.5 rounded-lg transition outline-none" title="Delete Record"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
                </td></tr>`;
    });
    if (tbody) tbody.innerHTML = html;

  } catch (err) {
    window.handleServerError(err);
  }
};

window.openSalesModal = function () {
  var modal = document.getElementById('sales-crud-modal');
  if (modal && modal.parentNode !== document.body) {
    document.body.appendChild(modal);
  }

  document.getElementById('sc-uniqueNo').value = '';
  document.getElementById('sc-cpn').value = '';
  document.getElementById('sc-delDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('sc-vjFull').value = '1';
  document.getElementById('sc-nvjFull').value = '0';
  document.getElementById('sc-vjEmp').value = '1';
  document.getElementById('sc-nvjEmp').value = '0';
  document.getElementById('sc-rate').value = '40';
  document.getElementById('sc-delComment').value = '';
  document.getElementById('sc-doorLink').value = '';

  document.getElementById('sales-modal-title').innerText = "New Sales Record";
  window.calcSalesAmt();
  modal.classList.remove('hidden');
  if(typeof window.toggleScrollLock === 'function') window.toggleScrollLock(true);
};

window.calcSalesAmt = function () {
  var vj = parseFloat(document.getElementById('sc-vjFull').value) || 0;
  var nvj = parseFloat(document.getElementById('sc-nvjFull').value) || 0;
  var rate = parseFloat(document.getElementById('sc-rate').value) || 0;
  var totalActD = vj + nvj;
  document.getElementById('sc-calcAmt').value = "₹" + (totalActD * rate);
};

window.fetchCpnDefaultRate = async function (cpn) {
  if (!cpn) return;
  try {
    const { data, error } = await window.supabase1
      .from('ac_customers')
      .select('default_rate')
      .eq('cpn_no', cpn.toUpperCase())
      .maybeSingle();

    if (error) throw error;
    if (data && data.default_rate) {
      if (!document.getElementById('sc-uniqueNo').value) {
        document.getElementById('sc-rate').value = data.default_rate;
        window.calcSalesAmt();
      }
    }
  } catch (err) {
    console.error("Failed to fetch default rate:", err.message);
  }
};

window.editSalesRecord = function (index) {
  var modal = document.getElementById('sales-crud-modal');
  if (modal && modal.parentNode !== document.body) document.body.appendChild(modal);

  var r = window.currentSalesRecords[index];
  if (!r) {
    if (window.showToast) window.showToast("Unable to find record details. Please refresh the data.", "error");
    return;
  }

  document.getElementById('sales-modal-title').innerText = "Edit Sales Record";
  document.getElementById('sc-uniqueNo').value = r.uniqueNo;
  document.getElementById('sc-cpn').value = r.cpn.replace('⚠️ MISSING CPN', '');
  document.getElementById('sc-delDate').value = r.delDate.replace('⚠️ BAD DATE', '');
  document.getElementById('sc-vjFull').value = r.vjFull;
  document.getElementById('sc-nvjFull').value = r.nvjFull;
  document.getElementById('sc-vjEmp').value = r.vjEmp;
  document.getElementById('sc-nvjEmp').value = r.nvjEmp;
  document.getElementById('sc-rate').value = r.rate;
  document.getElementById('sc-delComment').value = r.delComment;
  document.getElementById('sc-doorLink').value = r.doorLink;
  window.calcSalesAmt();
  modal.classList.remove('hidden');
  if(typeof window.toggleScrollLock === 'function') window.toggleScrollLock(true);
};

window.submitSalesCrud = async function () {
  var cpn = document.getElementById('sc-cpn').value.trim().toUpperCase();
  if (!cpn) {
      if (window.showToast) window.showToast("CPNNO is required to save.", "warning");
      return;
  }

  var btn = document.getElementById('sc-btn-save');
  btn.innerHTML = '<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Saving...'; 
  btn.disabled = true;

  var uniqueNo = document.getElementById('sc-uniqueNo').value;
  var vjFull = Number(document.getElementById('sc-vjFull').value) || 0;
  var nvjFull = Number(document.getElementById('sc-nvjFull').value) || 0;
  var vjEmp = Number(document.getElementById('sc-vjEmp').value) || 0;
  var nvjEmp = Number(document.getElementById('sc-nvjEmp').value) || 0;
  var rate = Number(document.getElementById('sc-rate').value) || 0;

  var actD = vjFull + nvjFull;
  var actE = vjEmp + nvjEmp;
  var amount = actD * rate;

  var currentUser = window.activeAdminSession ? window.activeAdminSession.username : 'ADMIN';

  var payload = {
    cpn_no: cpn,
    del_date: document.getElementById('sc-delDate').value,
    act_d: actD,
    act_e: actE,
    rate: rate,
    amount: amount,
    delivery_comment: document.getElementById('sc-delComment').value,
    door_delivery_link: document.getElementById('sc-doorLink').value,
    act_d_vj: vjFull,
    act_d_nvj: nvjFull,
    act_e_vj: vjEmp,
    act_e_nvj: nvjEmp,
    delivery_entered_at: new Date().toISOString(),
    delivery_entered_by: currentUser
  };

  try {
    if (uniqueNo) {
      const { error } = await window.supabase1.from('sales').update(payload).eq('unique_no', uniqueNo);
      if (error) throw error;
      if (window.showToast) window.showToast("Sales record updated successfully.", "success");
    } else {
      var timeStamp = new Date();
      var newUniqueNo = "SALES_" + timeStamp.getFullYear() + String(timeStamp.getMonth() + 1).padStart(2, '0') + String(timeStamp.getDate()).padStart(2, '0') + timeStamp.getHours() + timeStamp.getMinutes() + timeStamp.getSeconds() + "_0_" + Math.random().toString().replace(".", "_");

      payload.unique_no = newUniqueNo;
      payload.order_entered_at = payload.delivery_entered_at;
      payload.order_entered_by = currentUser;

      const { error } = await window.supabase1.from('sales').insert([payload]);
      if (error) throw error;
      if (window.showToast) window.showToast("New Sales entry created successfully.", "success");
    }

    if(typeof window.closeModal === 'function') window.closeModal('sales-crud-modal');
    else document.getElementById('sales-crud-modal').classList.add('hidden');
    
    window.loadSalesCrudData();
  } catch (err) {
    if (window.showToast) window.showToast("Backend Error: " + err.message, "error");
  } finally {
    btn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg> Save Sales Record';
    btn.disabled = false;
  }
};

window.deleteSalesRecord = async function (uniqueNo) {
  if (!confirm("Are you sure you want to delete this sales entry?")) return;

  try {
    const { error } = await window.supabase1.from('sales').delete().eq('unique_no', uniqueNo);
    if (error) throw error;

    window.loadSalesCrudData();
    if (window.showToast) window.showToast("Record deleted successfully.", "success");
  } catch (err) {
    if (window.showToast) window.showToast("Delete failed: " + err.message, "error");
  }
};

window.tabActions['tran-sales-crud'] = function () {
  var startEl = document.getElementById('sc-flt-start');
  if (startEl && !startEl.value) {
    window.initSalesCrudDates();
  }
  window.loadSalesCrudData();
};