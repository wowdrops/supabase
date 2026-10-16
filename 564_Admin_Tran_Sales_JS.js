window.currentSalesRecords = [];

  window.escapeHTML = function(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

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
    if (!startEl) return; 
    
    var today = new Date();
    var fromday = new Date();
    fromday.setDate(today.getDate() - 2);
    
    startEl.value = fromday.toISOString().split('T')[0];
    var endEl = document.getElementById('sc-flt-end');
    if (endEl) endEl.value = today.toISOString().split('T')[0];
  };

  window.loadSalesCrudData = async function() {
    var start = document.getElementById('sc-flt-start').value;
    var end = document.getElementById('sc-flt-end').value;
    var tbody = document.getElementById('sales-crud-tbody');
    tbody.innerHTML = '<tr><td colspan="8" class="text-center py-10 text-indigo-400 animate-pulse font-bold">Loading Sales Records...</td></tr>';

    try {
        const { data, error } = await supabase1
            .from('sales')
            .select('*')
            .gte('del_date', start)
            .lte('del_date', end)
            .order('id', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) { 
            tbody.innerHTML = '<tr><td colspan="8" class="text-center py-10 text-slate-500 font-bold">No sales records found for this date range.</td></tr>'; 
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

        var html = '';
        window.currentSalesRecords.forEach(function(r, index) {
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

    } catch (err) {
        window.handleServerError(err);
    }
  };

  window.openSalesModal = function() {
    // Note: To ensure perfect CSS absolute positioning on the screen, attach the modal to the body if not already
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

  window.fetchCpnDefaultRate = async function(cpn) {
    if(!cpn) return;
    try {
        const { data, error } = await supabase1
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
    } catch(err) {
        console.error("Failed to fetch default rate:", err.message);
    }
  };

  window.editSalesRecord = function(index) {
    var modal = document.getElementById('sales-crud-modal');
    if (modal && modal.parentNode !== document.body) document.body.appendChild(modal);

    var r = window.currentSalesRecords[index];
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
    modal.classList.remove('hidden');
  };

  window.submitSalesCrud = async function() {
    var cpn = document.getElementById('sc-cpn').value.trim().toUpperCase();
    if (!cpn) return window.showToast("CPNNO is required to save.", "warning");

    var btn = document.getElementById('sc-btn-save');
    btn.innerText = "Saving..."; 
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
            const { error } = await supabase1.from('sales').update(payload).eq('unique_no', uniqueNo);
            if (error) throw error;
            window.showToast("Sales record updated successfully.", "success");
        } else {
            var timeStamp = new Date();
            var newUniqueNo = "SALES_" + timeStamp.getFullYear() + String(timeStamp.getMonth()+1).padStart(2,'0') + String(timeStamp.getDate()).padStart(2,'0') + timeStamp.getHours() + timeStamp.getMinutes() + timeStamp.getSeconds() + "_0_" + Math.random().toString().replace(".", "_");
            
            payload.unique_no = newUniqueNo;
            payload.order_entered_at = payload.delivery_entered_at;
            payload.order_entered_by = currentUser;

            const { error } = await supabase1.from('sales').insert([payload]);
            if (error) throw error;
            window.showToast("New Sales entry created successfully.", "success");
        }
        
        window.closeSalesModal();
        window.loadSalesCrudData();
    } catch (err) {
        window.showToast("Backend Error: " + err.message, "error");
    } finally {
        btn.innerText = "Save Sales Record"; 
        btn.disabled = false;
    }
  };

  window.deleteSalesRecord = async function(uniqueNo) {
    if(!confirm("Are you sure you want to delete this sales entry?")) return;
    
    try {
        const { error } = await supabase1.from('sales').delete().eq('unique_no', uniqueNo);
        if (error) throw error;
        
        window.loadSalesCrudData();
        window.showToast("Record deleted successfully.", "success");
    } catch (err) {
        window.showToast("Delete failed: " + err.message, "error");
    }
  };

  window.showToast = function(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    
    let borderColor = 'border-slate-700';
    let textColor = 'text-white';
    let icon = 'ℹ️';

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

    toast.className = `flex items-center gap-3 px-5 py-3.5 bg-slate-900 border ${borderColor} rounded-xl shadow-2xl transform transition-all duration-300 translate-y-10 opacity-0 pointer-events-auto backdrop-blur-md`;
    
    toast.innerHTML = `
      <span class="text-xl">${icon}</span>
      <span class="text-sm font-bold tracking-wide ${textColor}">${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => { toast.classList.remove('translate-y-10', 'opacity-0'); }, 10);
    setTimeout(() => {
      toast.classList.add('translate-y-10', 'opacity-0');
      setTimeout(() => { toast.remove(); }, 300); 
    }, 3500);
  };

  setTimeout(() => { 
    if (document.getElementById('sc-flt-start')) {
      window.initSalesCrudDates(); 
      window.loadSalesCrudData(); 
    }
  }, 100);