// ==============================================================
// 565_Admin_Tran_Pays_JS.js - Standardized with Sales Architecture
// ==============================================================

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
  tbody.innerHTML = '<tr><td colspan="6" class="text-center py-10 text-emerald-400 animate-pulse font-bold">Loading Payments...</td></tr>';

  try {
    const { data, error } = await supabase1
      .from('pays')
      .select('*')
      .gte('payment_date', start)
      .lte('payment_date', end)
      .order('payment_date', { ascending: false })
      .order('id', { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center py-10 text-slate-500 font-bold">No payment logs found for this date range.</td></tr>';
      return;
    }

    window.currentPaysRecords = data;

    // NEW: Calculate the totals and push them to the sticky grid header
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
      html += `<tr class="hover:bg-slate-800/40 transition">
        <td class="p-4">
          <button onclick="window.openCustomer360('${r.cpn_no}')" class="text-indigo-400 font-black hover:underline cursor-pointer">${r.cpn_no}</button>
          <div class="text-[10px] text-slate-400 font-normal uppercase mt-0.5">${r.name || ''}</div>
        </td>
        <td class="p-4 text-slate-300 font-medium">${r.payment_date}</td>
        <td class="p-4"><span class="bg-slate-800 border border-slate-700 px-2 py-1 rounded text-[10px] font-black text-indigo-300 uppercase">${r.mode || 'ONLINE'}</span></td>
        <td class="p-4 text-right text-emerald-400 font-black text-base">₹${r.amount}</td>
        <td class="p-4 text-xs text-slate-400 max-w-[200px] truncate">${r.comment || '-'}</td>
        <td class="p-4 text-center space-x-2">
          <button onclick="window.editPaysRecord(${index})" class="text-indigo-400 hover:text-indigo-300 p-1 bg-slate-800 rounded-lg transition active:scale-95">✏️</button>
          <button onclick="window.deletePaysRecord(${r.id})" class="text-rose-400 hover:text-rose-300 p-1 bg-slate-800 rounded-lg transition active:scale-95">🗑️</button>
        </td>
      </tr>`;
    });
    tbody.innerHTML = html;
  } catch (e) {
    console.error(e);
    if (window.showToast) window.showToast("Fetch Error: " + e.message, "error");
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-10 text-rose-400 font-bold">Error loading payments: ${e.message}</td></tr>`;
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
};

window.closePaysModal = function () {
  document.getElementById('pays-crud-modal').classList.add('hidden');
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
};

window.submitPaysCrud = async function () {
  var cpnNo = document.getElementById('pc-cpn').value.trim().toUpperCase();
  var amountVal = document.getElementById('pc-amount').value;

  if (!cpnNo || !amountVal) {
    if (window.showToast) window.showToast("CPN and Amount are required.", "warning");
    else alert("CPN and Amount are required.");
    return;
  }

  var btn = document.getElementById('pc-btn-save');
  btn.innerText = "Saving...";
  btn.disabled = true;

  try {
    const isEdit = document.getElementById('pc-isEdit').value === 'true';
    const recordId = document.getElementById('pc-uniqueNo').value;
    const currentUser = window.activeAdminSession ? window.activeAdminSession.username : 'ADMIN';
    const now = new Date();
    const time24 = String(now.getHours()).padStart(2, '0') + ":" + String(now.getMinutes()).padStart(2, '0') + ":" + String(now.getSeconds()).padStart(2, '0');

    // 1. Fetch customer details from ac_customers to snap into pays record
    let custName = null, custContact = null, apt = null, blk = null, dr = null;
    const { data: custData } = await supabase1
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

    // 2. Build Payload
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
      const { error } = await supabase1.from('pays').update(payload).eq('id', recordId);
      if (error) throw error;
      if (window.showToast) window.showToast("Payment record updated successfully.", "success");
    } else {
      var newUniqueNo = "PAY_" + now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0') + now.getHours() + now.getMinutes() + now.getSeconds() + "_0_" + Math.random().toString().replace(".", "_");

      payload.unique_no = newUniqueNo;
      payload.time_24hr = time24;
      payload.created_at = now.toISOString();
      payload.created_by = currentUser;

      const { error } = await supabase1.from('pays').insert([payload]);
      if (error) throw error;
      if (window.showToast) window.showToast("Payment logged successfully.", "success");
    }

    window.closePaysModal();
    window.loadPaysCrudData();
  } catch (err) {
    console.error(err);
    if (window.showToast) window.showToast("Database Error: " + err.message, "error");
    else alert("Database Error: " + err.message);
  } finally {
    btn.innerText = "Save & Sync Ledger";
    btn.disabled = false;
  }
};

window.deletePaysRecord = async function (id) {
  if (!confirm("Warning: Deleting this payment record cannot be undone. Proceed?")) return;
  try {
    const { error } = await supabase1.from('pays').delete().eq('id', id);
    if (error) throw error;
    if (window.showToast) window.showToast("Payment record deleted successfully.", "success");
    window.loadPaysCrudData();
  } catch (err) {
    if (window.showToast) window.showToast("Delete failed: " + err.message, "error");
    else alert("Delete failed: " + err.message);
  }
};

// Triggered dynamically when the router opens the Pays tab
window.tabActions['tran-pays-crud'] = function() {
    var startEl = document.getElementById('pc-flt-start');
    
    // If the date boxes are empty, fill them with default dates first
    if (startEl && !startEl.value) {
        window.initPaysCrudDates();
    }
    
    // Now fetch the data safely!
    window.loadPaysCrudData();
};