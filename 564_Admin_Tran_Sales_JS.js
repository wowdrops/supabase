
  // Global state to store the current view's data
  window.currentSalesRecords = [];

  // SECURITY: XSS Sanitization Function
  window.escapeHTML = function(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  // STABILITY: Global Failure Handler
  window.handleServerError = function(error) {
    window.showToast("Connection Error: " + (error.message || "Failed to communicate with server."), "error");
    var btn = document.getElementById('sc-btn-save');
    if (btn) { btn.innerText = "Save Sales Record"; btn.disabled = false; }
    var tbody = document.getElementById('sales-crud-tbody');
    if (tbody && tbody.innerHTML.includes("Loading")) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center py-10 text-rose-400 font-bold">Failed to load data. Please retry.</td></tr>';
    }
  };

  window.initSalesCrudDates = function() {
    var startEl = document.getElementById('sc-flt-start');
    if (!startEl) return; // Exit safely if tab isn't loaded/visible yet
    
    var today = new Date();
    var fromday = new Date();
    fromday.setDate(today.getDate() - 2);
    
    startEl.value = fromday.toISOString().split('T')[0];
    var endEl = document.getElementById('sc-flt-end');
    if (endEl) endEl.value = today.toISOString().split('T')[0];
  };

  window.loadSalesCrudData = function() {
    var start = document.getElementById('sc-flt-start').value;
    var end = document.getElementById('sc-flt-end').value;
    var tbody = document.getElementById('sales-crud-tbody');
    tbody.innerHTML = '<tr><td colspan="8" class="text-center py-10 text-indigo-400 animate-pulse font-bold">Loading Sales Records...</td></tr>';

    google.script.run
      .withFailureHandler(window.handleServerError)
      .withSuccessHandler(function(res) {
        if(!res.success) { 
          tbody.innerHTML = `<tr><td colspan="8" class="text-center py-10 text-rose-400 font-bold">Error: ${res.message}</td></tr>`; 
          return; 
        }
        if(res.data.length === 0) { 
          tbody.innerHTML = '<tr><td colspan="8" class="text-center py-10 text-slate-500 font-bold">No sales records found for this date range.</td></tr>'; 
          return; 
        }

        // Save data to global state for safe referencing
        window.currentSalesRecords = res.data;
        var html = '';
        
        res.data.forEach(function(r, index) {
          html += `<tr class="hover:bg-slate-800/40 transition">
            <td class="p-4"><button onclick="window.openCustomer360('${r.cpn}')" class="text-indigo-400 font-black hover:underline">${r.cpn}</button></td>
            <td class="p-4 text-slate-300">${r.delDate}</td>
            <td class="p-4 text-center font-black text-indigo-300">${r.actD} <span class="text-[10px] font-normal text-slate-500">(VJ:${r.vjFull}/NVJ:${r.nvjFull})</span></td>
            <td class="p-4 text-center font-black text-amber-300">${r.actE} <span class="text-[10px] font-normal text-slate-500">(VJ:${r.vjEmp}/NVJ:${r.nvjEmp})</span></td>
            <td class="p-4 text-right text-slate-300">₹${r.rate}</td>
            <td class="p-4 text-right text-emerald-400 font-black text-base">₹${r.amount}</td>
            <td class="p-4 text-xs text-slate-400 max-w-[200px] truncate">${r.delComment || '-'}</td>
            <td class="p-4 text-center space-x-2">
              <button onclick="window.editSalesRecord(${index})" class="text-indigo-400 hover:text-indigo-300 p-1 bg-slate-800 rounded-lg">✏️</button>
              <button onclick="window.deleteSalesRecord('${window.escapeHTML(r.uniqueNo)}')" class="text-rose-400 hover:text-rose-300 p-1 bg-slate-800 rounded-lg">🗑️</button>
            </td></tr>`;
        });
        tbody.innerHTML = html;
      })
      .withFailureHandler(function(err) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-10 text-rose-400 font-bold">Network Error: ${err.message}</td></tr>`;
      })
      .fetchSalesCrudRecords(start, end);
  };

  window.openSalesModal = function() {
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
    document.getElementById('sales-crud-modal').classList.remove('hidden');
  };

  window.closeSalesModal = function() {
    document.getElementById('sales-crud-modal').classList.add('hidden');
  };

  window.calcSalesAmt = function() {
    var vj = parseFloat(document.getElementById('sc-vjFull').value) || 0;
    var nvj = parseFloat(document.getElementById('sc-nvjFull').value) || 0;
    var rate = parseFloat(document.getElementById('sc-rate').value) || 0;
    var totalActD = vj + nvj;
    document.getElementById('sc-calcAmt').value = "₹" + (totalActD * rate);
  };

  window.fetchCpnDefaultRate = function(cpn) {
    if(!cpn) return;
    google.script.run
      .withFailureHandler(window.handleServerError)
      .withSuccessHandler(function(res) {
        if(res.success && res.profile && res.profile.rate) {
          if (!document.getElementById('sc-uniqueNo').value) {
             document.getElementById('sc-rate').value = res.profile.rate;
             window.calcSalesAmt();
          }
        }
      })
      .withFailureHandler(function(err) {
        console.error("Failed to fetch default rate:", err.message);
      })
      .fetchCpnInfoForAdmin(cpn);
  };

  // 🐛 FIX: Now accepts ID instead of object string, pulling data from global state
  window.editSalesRecord = function(index) {
    //var r = window.currentSalesRecords.find(item => item.uniqueNo === uniqueNo);
    var r = window.currentSalesRecords[index]; // <-- Pull from global array
    if (!r) {
      window.showToast("Unable to find record details. Please refresh the data.", "error");
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
    document.getElementById('sales-crud-modal').classList.remove('hidden');
  };

  window.submitSalesCrud = function() {
    // Basic frontend validation
    var cpn = document.getElementById('sc-cpn').value.trim();
    if (!cpn) {
      window.showToast("CPNNO is required to save.", "warning");
      return;
    }

    var btn = document.getElementById('sc-btn-save');
    btn.innerText = "Saving..."; 
    btn.disabled = true;

    var payload = {
      uniqueNo: document.getElementById('sc-uniqueNo').value,
      cpn: cpn,
      delDate: document.getElementById('sc-delDate').value,
      vjFull: document.getElementById('sc-vjFull').value,
      nvjFull: document.getElementById('sc-nvjFull').value,
      vjEmp: document.getElementById('sc-vjEmp').value,
      nvjEmp: document.getElementById('sc-nvjEmp').value,
      rate: document.getElementById('sc-rate').value,
      delComment: document.getElementById('sc-delComment').value,
      doorLink: document.getElementById('sc-doorLink').value
    };

    google.script.run
      .withFailureHandler(window.handleServerError)
      .withSuccessHandler(function(res) {
        btn.innerText = "Save Sales Record"; 
        btn.disabled = false;
        if(res.success) {
          window.closeSalesModal();
          window.loadSalesCrudData();
          window.showToast(res.message || "Record saved successfully!", "success");
        } else {
          window.showToast("Backend Error: " + res.message, "error");
        }
      })
      .withFailureHandler(function(err) {
        btn.innerText = "Save Sales Record"; 
        btn.disabled = false;
        window.showToast("Server connection failed: " + err.message, "error");
      })
      .saveSalesCrudRecord(payload);
  };

  window.deleteSalesRecord = function(uniqueNo) {
    if(!confirm("Are you sure you want to delete this sales entry?")) return;
    
    google.script.run
      .withFailureHandler(window.handleServerError)
      .withSuccessHandler(function(res) {
        if(res.success) {
          window.loadSalesCrudData();
          window.showToast("Record deleted successfully.", "success");
        } else {
          window.showToast("Delete failed: " + res.message, "error");
        }
      })
      .withFailureHandler(function(err) {
        window.showToast("Server connection failed: " + err.message, "error");
      })
      .deleteSalesCrudRecord(uniqueNo);
  };

  // --- TOAST NOTIFICATION SYSTEM ---
  window.showToast = function(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    
    // Default styling (Tailwind classes)
    let borderColor = 'border-slate-700';
    let textColor = 'text-white';
    let icon = 'ℹ️';

    // Conditional styling based on type
    if (type === 'success') {
      borderColor = 'border-emerald-500/50';
      textColor = 'text-emerald-400';
      icon = '✅';
    } else if (type === 'error') {
      borderColor = 'border-rose-500/50';
      textColor = 'text-rose-400';
      icon = '🚨';
    } else if (type === 'warning') {
      borderColor = 'border-amber-500/50';
      textColor = 'text-amber-400';
      icon = '⚠️';
    }

    // Base classes with animation start state
    toast.className = `flex items-center gap-3 px-5 py-3.5 bg-slate-900 border ${borderColor} rounded-xl shadow-2xl transform transition-all duration-300 translate-y-10 opacity-0 pointer-events-auto backdrop-blur-md`;
    
    toast.innerHTML = `
      <span class="text-xl">${icon}</span>
      <span class="text-sm font-bold tracking-wide ${textColor}">${message}</span>
    `;

    container.appendChild(toast);

    // Trigger slide-in animation
    setTimeout(() => {
      toast.classList.remove('translate-y-10', 'opacity-0');
    }, 10);

    // Trigger fade-out and remove after 3.5 seconds
    setTimeout(() => {
      toast.classList.add('translate-y-10', 'opacity-0');
      setTimeout(() => {
        toast.remove();
      }, 300); // Matches the duration-300 transition
    }, 3500);
  };

  // Run on load
  setTimeout(() => { 
    if (document.getElementById('sc-flt-start')) {
      window.initSalesCrudDates(); 
      window.loadSalesCrudData(); 
    }
  }, 100);
