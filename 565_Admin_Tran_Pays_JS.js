window.currentPaysRecords = [];

window.initPaysCrudDates = function () {
  var startEl = document.getElementById('pc-flt-start');
  if (!startEl) return;

  var today = new Date();
  var lastWeek = new Date();
  lastWeek.setDate(today.getDate() - 7);

  startEl.value = lastWeek.toISOString().split('T')[0];
  var endEl = document.getElementById('pc-flt-end');
  if (endEl) endEl.value = today.toISOString().split('T')[0];
};

window.loadPaysCrudData = async function () {
  var start = document.getElementById('pc-flt-start').value;
  var end = document.getElementById('pc-flt-end').value;
  var tbody = document.getElementById('pays-crud-tbody');
  
  if(tbody) tbody.innerHTML = '<tr><td colspan="6" class="text-center py-12 text-emerald-500 animate-pulse font-black uppercase tracking-widest">Loading Payments...</td></tr>';

  try {
    const { data, error } = await window.supabase1
      .from('pays')
      .select('*')
      .gte('payment_date', start)
      .lte('payment_date', end)
      .order('payment_date', { ascending: false })
      .order('id', { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) {
      if(tbody) tbody.innerHTML = '<tr><td colspan="6" class="text-center py-12 text-slate-400 font-bold uppercase tracking-widest">No payment logs found for this date range.</td></tr>';
      
      var sumRecEl = document.getElementById('sum-pay-records'); if(sumRecEl) sumRecEl.innerText = "0";
      var sumAmtEl = document.getElementById('sum-pay-amount'); if(sumAmtEl) sumAmtEl.innerText = "₹0";
      return;
    }

    window.currentPaysRecords = data;

    var totalAmount = 0;
    data.forEach(r => {
      totalAmount += (Number(r.amount) || 0);
    });

    var sumRecEl = document.getElementById('sum-pay-records');
    if (sumRecEl) sumRecEl.innerText = data.length;

    var sumAmtEl = document.getElementById('sum-pay-amount');
    if (sumAmtEl) sumAmtEl.innerText = "₹" + totalAmount.toLocaleString('en-IN');

    var html = '';
    data.forEach(function (r, index) {
      var cleanCpn = String(r.cpn_no || '').trim().toUpperCase();
      var badgeClass = (r.mode || 'ONLINE').toUpperCase() === 'CASH' 
          ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400' 
          : 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400';

      html += `<tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
        <td class="p-4 pl-6">
           <span class="inline-flex items-center gap-1.5 px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/50 hover:shadow-sm active:scale-95 transition-all cursor-pointer group" onclick="window.openCustomer360('${cleanCpn}')">
              <span class="font-black tracking-widest text-xs">${cleanCpn}</span>
              <svg class="w-3 h-3 text-indigo-400 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
           </span>
           <div class="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase mt-1 tracking-widest">${r.name || 'UNKNOWN'}</div>
        </td>
        <td class="p-4 text-slate-600 dark:text-slate-300 font-bold text-xs uppercase tracking-widest">${r.payment_date}</td>
        <td class="p-4 text-center"><span class="border px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest shadow-sm ${badgeClass}">${r.mode || 'ONLINE'}</span></td>
        <td class="p-4 text-right text-emerald-600 dark:text-emerald-400 font-black text-lg drop-shadow-sm">₹${r.amount}</td>
        <td class="p-4 text-xs font-bold text-slate-500 dark:text-slate-400 max-w-[200px] truncate" title="${r.comment || ''}">${r.comment || '-'}</td>
        <td class="p-4 text-center space-x-1.5">
          <button onclick="window.editPaysRecord(${index})" class="text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-emerald-200 hover:shadow-sm p-1.5 rounded-lg transition outline-none" title="Edit Record"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg></button>
          <button onclick="window.deletePaysRecord(${r.id})" class="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-rose-200 hover:shadow-sm p-1.5 rounded-lg transition outline-none" title="Delete Record"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
        </td>
      </tr>`;
    });
    if(tbody) tbody.innerHTML = html;
  } catch (e) {
    if (window.showToast) window.showToast("Fetch Error: " + e.message, "error");
    if(tbody) tbody.innerHTML = `<tr><td colspan="6" class="text-center py-12 text-rose-500 font-bold uppercase tracking-widest">Error loading payments.</td></tr>`;
  }
};

window.openPaysModal = function () {
  var modal = document.getElementById('pays-crud-modal');
  if (modal && modal.parentNode !== document.body) {
    document.body.appendChild(modal);
  }

  document.getElementById('pc-uniqueNo').value = '';
  document.getElementById('pc-isEdit').value = 'false';
  document.getElementById('pc-cpn').value = '';
  document.getElementById('pc-payDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('pc-amount').value = '';
  document.getElementById('pc-mode').value = 'ONLINE';
  document.getElementById('pc-remark').value = '';
  modal.classList.remove('hidden');
  if(typeof window.toggleScrollLock === 'function') window.toggleScrollLock(true);
};

window.editPaysRecord = function (index) {
  var modal = document.getElementById('pays-crud-modal');
  if (modal && modal.parentNode !== document.body) {
    document.body.appendChild(modal);
  }

  var r = window.currentPaysRecords[index];
  if (!r) {
    if (window.showToast) window.showToast("Record not found. Please refresh.", "error");
    return;
  }

  document.getElementById('pc-uniqueNo').value = r.id;
  document.getElementById('pc-isEdit').value = 'true';
  document.getElementById('pc-cpn').value = r.cpn_no;
  document.getElementById('pc-payDate').value = r.payment_date;
  document.getElementById('pc-amount').value = r.amount;

  var modeVal = ((r.mode || '').toUpperCase().indexOf('CASH') > -1) ? 'CASH' : 'ONLINE';
  document.getElementById('pc-mode').value = modeVal;

  document.getElementById('pc-remark').value = r.comment || '';
  modal.classList.remove('hidden');
  if(typeof window.toggleScrollLock === 'function') window.toggleScrollLock(true);
};

window.submitPaysCrud = async function () {
  var cpnNo = document.getElementById('pc-cpn').value.trim().toUpperCase();
  var amountVal = document.getElementById('pc-amount').value;

  if (!cpnNo || !amountVal) {
    if (window.showToast) window.showToast("CPN and Amount are required.", "warning");
    return;
  }

  var btn = document.getElementById('pc-btn-save');
  btn.innerHTML = '<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Saving...'; 
  btn.disabled = true;

  try {
    const isEdit = document.getElementById('pc-isEdit').value === 'true';
    const recordId = document.getElementById('pc-uniqueNo').value;
    const currentUser = window.activeAdminSession ? window.activeAdminSession.username : 'ADMIN';
    const now = new Date();
    const time24 = String(now.getHours()).padStart(2, '0') + ":" + String(now.getMinutes()).padStart(2, '0') + ":" + String(now.getSeconds()).padStart(2, '0');

    let custName = null, custContact = null, apt = null, blk = null, dr = null;
    const { data: custData } = await window.supabase1
      .from('ac_customers')
      .select('poc1, con1, apartment, block, door')
      .eq('cpn_no', cpnNo)
      .maybeSingle();

    if (custData) {
      custName = custData.poc1;
      custContact = custData.con1;
      apt = custData.apartment;
      blk = custData.block;
      dr = custData.door;
    }

    var payload = {
      cpn_no: cpnNo,
      payment_date: document.getElementById('pc-payDate').value,
      amount: parseFloat(amountVal),
      mode: document.getElementById('pc-mode').value,
      comment: document.getElementById('pc-remark').value,
      name: custName,
      contact: custContact,
      apartment: apt,
      block: blk,
      door: dr
    };

    if (isEdit) {
      const { error } = await window.supabase1.from('pays').update(payload).eq('id', recordId);
      if (error) throw error;
      if (window.showToast) window.showToast("Payment record updated successfully.", "success");
    } else {
      var newUniqueNo = "PAY_" + now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0') + now.getHours() + now.getMinutes() + now.getSeconds() + "_0_" + Math.random().toString().replace(".", "_");

      payload.unique_no = newUniqueNo;
      payload.time_24hr = time24;
      payload.created_at = now.toISOString();
      payload.created_by = currentUser;

      const { error } = await window.supabase1.from('pays').insert([payload]);
      if (error) throw error;
      if (window.showToast) window.showToast("Payment logged successfully.", "success");
    }

    if(typeof window.closeModal === 'function') window.closeModal('pays-crud-modal');
    else document.getElementById('pays-crud-modal').classList.add('hidden');
    
    window.loadPaysCrudData();
  } catch (err) {
    if (window.showToast) window.showToast("Database Error: " + err.message, "error");
  } finally {
    btn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg> Save & Sync Ledger';
    btn.disabled = false;
  }
};

window.deletePaysRecord = async function (id) {
  if (!confirm("Warning: Deleting this payment record cannot be undone. Proceed?")) return;
  try {
    const { error } = await window.supabase1.from('pays').delete().eq('id', id);
    if (error) throw error;
    if (window.showToast) window.showToast("Payment record deleted successfully.", "success");
    window.loadPaysCrudData();
  } catch (err) {
    if (window.showToast) window.showToast("Delete failed: " + err.message, "error");
  }
};

// Triggered dynamically when the router opens the Pays tab
window.tabActions['tran-pays-crud'] = function() {
    var startEl = document.getElementById('pc-flt-start');
    
    if (startEl && !startEl.value) {
        window.initPaysCrudDates();
    }
    
    window.loadPaysCrudData();
};