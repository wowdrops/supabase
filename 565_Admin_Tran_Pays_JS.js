
  window.initPaysCrudDates = function() {
    var startEl = document.getElementById('pc-flt-start');
    if (!startEl) return; // Exit safely if tab isn't loaded/visible yet
    
    var today = new Date();
    var lastWeek = new Date();
    lastWeek.setDate(today.getDate() - 7);
    
    startEl.value = lastWeek.toISOString().split('T')[0];
    var endEl = document.getElementById('pc-flt-end');
    if (endEl) endEl.value = today.toISOString().split('T')[0];
  };

  window.loadPaysCrudData = function() {
    var start = document.getElementById('pc-flt-start').value;
    var end = document.getElementById('pc-flt-end').value;
    var tbody = document.getElementById('pays-crud-tbody');
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-10 text-emerald-400 animate-pulse font-bold">Loading Payments...</td></tr>';

    google.script.run.withSuccessHandler(function(res) {
      if(!res.success) { tbody.innerHTML = '<tr><td colspan="6" class="text-center py-10 text-rose-400 font-bold">Error loading payments.</td></tr>'; return; }
      if(res.data.length === 0) { tbody.innerHTML = '<tr><td colspan="6" class="text-center py-10 text-slate-500 font-bold">No payment logs found for this date range.</td></tr>'; return; }

      var html = '';
      res.data.forEach(function(r) {
        html += `<tr class="hover:bg-slate-800/40 transition">
          <td class="p-4"><button onclick="window.openCustomer360('${r.cpn}')" class="text-indigo-400 font-black hover:underline cursor-pointer">${r.cpn}</button></td>
          <td class="p-4 text-slate-300">${r.payDate}</td>
          <td class="p-4"><span class="bg-slate-800 border border-slate-700 px-2 py-1 rounded text-[10px] font-black text-indigo-300 uppercase">${r.mode}</span></td>
          <td class="p-4 text-right text-emerald-400 font-black text-base">₹${r.amount}</td>
          <td class="p-4 text-xs text-slate-400 max-w-[200px] truncate">${r.remark || '-'}</td>
          <td class="p-4 text-center space-x-2">
            <button onclick='window.editPaysRecord(${JSON.stringify(r).replace(/'/g, "\\'")})' class="text-indigo-400 hover:text-indigo-300 p-1 bg-slate-800 rounded-lg">✏️</button>
            <button onclick="window.deletePaysRecord('${r.uniqueNo}')" class="text-rose-400 hover:text-rose-300 p-1 bg-slate-800 rounded-lg">🗑️</button>
          </td>
        </tr>`;
      });
      tbody.innerHTML = html;
    }).fetchPaysCrudRecords(start, end);
  };

  window.openPaysModal = function() {
    document.getElementById('pc-uniqueNo').value = '';
    document.getElementById('pc-isEdit').value = 'false';
    document.getElementById('pc-cpn').value = '';
    document.getElementById('pc-payDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('pc-amount').value = '';
    document.getElementById('pc-mode').value = 'ONLINE';
    document.getElementById('pc-remark').value = '';
    document.getElementById('pays-crud-modal').classList.remove('hidden');
  };

  window.closePaysModal = function() {
    document.getElementById('pays-crud-modal').classList.add('hidden');
  };

  window.editPaysRecord = function(r) {
    document.getElementById('pc-uniqueNo').value = r.uniqueNo;
    document.getElementById('pc-isEdit').value = 'true';
    document.getElementById('pc-cpn').value = r.cpn;
    document.getElementById('pc-payDate').value = r.payDate;
    document.getElementById('pc-amount').value = r.amount;
    
    var modeVal = (r.mode.toUpperCase().indexOf('CASH') > -1) ? 'CASH' : 'ONLINE';
    document.getElementById('pc-mode').value = modeVal;
    
    document.getElementById('pc-remark').value = r.remark;
    document.getElementById('pays-crud-modal').classList.remove('hidden');
  };

  window.submitPaysCrud = function() {
    var btn = document.getElementById('pc-btn-save');
    btn.innerText = "Syncing Ledger..."; btn.disabled = true;

    var payload = {
      isEdit: document.getElementById('pc-isEdit').value === 'true',
      uniqueNo: document.getElementById('pc-uniqueNo').value,
      cpn: document.getElementById('pc-cpn').value.trim(),
      payDate: document.getElementById('pc-payDate').value,
      amount: document.getElementById('pc-amount').value,
      mode: document.getElementById('pc-mode').value,
      remark: document.getElementById('pc-remark').value
    };

    if(!payload.cpn || !payload.amount) {
       alert("CPN and Amount are required.");
       btn.innerText = "Save & Sync Ledger"; btn.disabled = false;
       return;
    }

    google.script.run.withSuccessHandler(function(res) {
      btn.innerText = "Save & Sync Ledger"; btn.disabled = false;
      if(res.success) {
        window.closePaysModal();
        window.loadPaysCrudData();
      } else {
        alert(res.message);
      }
    }).savePaysCrudRecord(payload);
  };

  window.deletePaysRecord = function(uniqueNo) {
    if(!confirm("Warning: Deleting this record will also remove the corresponding entries from the General Ledger (ACCOUNTS sheet). Proceed?")) return;
    google.script.run.withSuccessHandler(function(res) {
      if(res.success) window.loadPaysCrudData();
      else alert(res.message);
    }).deletePaysCrudRecord(uniqueNo);
  };

  // Run on load
  setTimeout(() => { 
    if (document.getElementById('pc-flt-start')) {
      window.initPaysCrudDates(); 
    }
  }, 100);
