window.invState = {
    suppliers: [],
    activeBatches: [],
    refillHistory: [],
    purchaseHistory: []
};

// ==========================================
// NAVIGATION & INIT
// ==========================================
window.invSwitchTab = function(tabName) {
    var tabs = ['refills', 'purchase', 'retire'];
    for (var i = 0; i < tabs.length; i++) {
        var t = tabs[i];
        var view = document.getElementById('inv-view-' + t);
        var btn = document.getElementById('btn-inv-' + t);
        if(view) view.classList.add('hidden');
        if(btn) btn.className = "flex-1 px-4 py-3 rounded-xl text-sm font-black text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors uppercase tracking-widest";
    }
    
    var actView = document.getElementById('inv-view-' + tabName);
    var actBtn = document.getElementById('btn-inv-' + tabName);
    if(actView) actView.classList.remove('hidden');
    if(actBtn) actBtn.className = "flex-1 px-4 py-3 rounded-xl text-sm font-black bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-sm transition-colors uppercase tracking-widest";
};

window.loadInventoryData = async function() {
    // Get exact local date (IST) for pre-filling
    var now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    var localToday = now.toISOString().slice(0, 10);
    
    var rfDate = document.getElementById('inv-rf-date');
    var puDate = document.getElementById('inv-pu-date');
    if (rfDate && !rfDate.value) rfDate.value = localToday;
    if (puDate && !puDate.value) puDate.value = localToday;
    
    try {
        const { data: supData } = await window.supabase1.from('ac_suppliers').select('id, supplier_name, rate_per_can').eq('status', 'ACTIVE').order('supplier_name');
        window.invState.suppliers = supData || [];

        var rfSel = document.getElementById('inv-rf-supplier');
        var puSel = document.getElementById('inv-pu-supplier');
        var supHtml = '<option value="">Select Supplier/Plant...</option>';
        window.invState.suppliers.forEach(s => { supHtml += `<option value="${s.id}">${s.supplier_name}</option>`; });
        if(rfSel) rfSel.innerHTML = supHtml;
        if(puSel) puSel.innerHTML = supHtml;

        window.generateBatchSuggestion();
        
        // Load all 3 History Tables independently
        window.loadRefillHistory();
        window.loadPurchaseHistory();

    } catch (err) {
        if(window.showToast) window.showToast("Setup Error: " + err.message, "error");
    }
};

window.generateBatchSuggestion = function() {
    var puBatch = document.getElementById('inv-pu-batch');
    if (puBatch && !puBatch.value) {
        var rand = Math.floor(Math.random() * 900) + 100;
        var month = new Date().toLocaleString('default', { month: 'short' }).toUpperCase();
        var year = new Date().getFullYear().toString().substr(-2);
        puBatch.value = `BATCH-${month}${year}-${rand}`;
    }
};

window.invAutoFillRate = function(prefix) {
    var supId = document.getElementById(`inv-${prefix}-supplier`).value;
    var rateInput = document.getElementById(`inv-${prefix}-rate`);
    if (!supId || !rateInput) return;
    var s = window.invState.suppliers.find(x => String(x.id) === String(supId));
    if (s) rateInput.value = s.rate_per_can || 0;
};

window.invCalcPuAmt = function() {
    var qty = parseInt(document.getElementById('inv-pu-qty').value) || 0;
    var rate = parseFloat(document.getElementById('inv-pu-rate').value) || 0;
    document.getElementById('inv-pu-amt').value = (qty * rate).toFixed(2);
};

// ==========================================
// TAB 1: PLANT REFILLS CRUD
// ==========================================
window.loadRefillHistory = async function() {
    var tbody = document.getElementById('rf-history-tbody');
    try {
        const { data, error } = await window.supabase1.from('water_fillings').select('*, ac_suppliers(supplier_name)').order('filling_date', { ascending: false }).limit(20);
        if (error) throw error;
        window.invState.refillHistory = data || [];

        if (window.invState.refillHistory.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-12 text-slate-400">No recent refills found.</td></tr>';
            return;
        }

        var html = '';
        window.invState.refillHistory.forEach(row => {
            var supName = row.ac_suppliers ? row.ac_suppliers.supplier_name : 'Unknown';
            var totEmpty = (row.empty_sent_vj || 0) + (row.empty_sent_nvj || 0);
            var totFull = (row.full_received_vj || 0) + (row.full_received_nvj || 0);
            
            html += `<tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 border-b border-slate-100 dark:border-slate-700/50">
                <td class="px-4 py-3"><p class="font-black uppercase">${supName}</p><p class="text-[9px] text-slate-500">${row.filling_date} | ₹${row.rate_per_can}/can</p></td>
                <td class="px-4 py-3 text-center bg-emerald-50/50 dark:bg-emerald-900/10 font-black text-emerald-600">${totEmpty}</td>
                <td class="px-4 py-3 text-center bg-indigo-50/50 dark:bg-indigo-900/10 font-black text-indigo-600">${totFull}</td>
                <td class="px-4 py-3 text-center"><span class="text-[9px] px-2 py-1 rounded font-black uppercase ${row.payment_status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}">${row.payment_status}</span></td>
                <td class="px-4 py-3 text-right">
                    <button onclick="window.editRefill('${row.id}')" class="text-indigo-600 hover:bg-indigo-100 p-1.5 rounded"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg></button>
                    <button onclick="window.deleteRefill('${row.id}')" class="text-rose-600 hover:bg-rose-100 p-1.5 rounded"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
                </td>
            </tr>`;
        });
        tbody.innerHTML = html;
    } catch (err) { console.error(err); }
};

window.editRefill = function(id) {
    var row = window.invState.refillHistory.find(x => String(x.id) === String(id));
    if(!row) return;
    document.getElementById('inv-rf-id').value = row.id;
    document.getElementById('inv-rf-date').value = row.filling_date;
    document.getElementById('inv-rf-supplier').value = row.supplier_id;
    document.getElementById('inv-rf-evj').value = row.empty_sent_vj || 0;
    document.getElementById('inv-rf-envj').value = row.empty_sent_nvj || 0;
    document.getElementById('inv-rf-fvj').value = row.full_received_vj || 0;
    document.getElementById('inv-rf-fnvj').value = row.full_received_nvj || 0;
    document.getElementById('inv-rf-rate').value = row.rate_per_can;
    document.getElementById('inv-rf-paystatus').value = row.payment_status;
    document.getElementById('inv-rf-remarks').value = row.remarks || "";

    document.getElementById('rf-form-title').innerText = "Update Refill Log";
    document.getElementById('btn-submit-refill').innerHTML = "Update Entry";
    document.getElementById('btn-submit-refill').classList.replace('bg-indigo-600', 'bg-emerald-600');
    document.getElementById('btn-rf-cancel').classList.remove('hidden');
};

window.invClearRefillForm = function() {
    document.getElementById('inv-rf-id').value = "";
    document.getElementById('inv-rf-evj').value = "0";
    document.getElementById('inv-rf-envj').value = "0";
    document.getElementById('inv-rf-fvj').value = "0";
    document.getElementById('inv-rf-fnvj').value = "0";
    document.getElementById('inv-rf-remarks').value = "";
    
    document.getElementById('rf-form-title').innerText = "Log Refill";
    document.getElementById('btn-submit-refill').innerHTML = "Save Entry";
    document.getElementById('btn-submit-refill').classList.replace('bg-emerald-600', 'bg-indigo-600');
    document.getElementById('btn-rf-cancel').classList.add('hidden');
};

window.submitPlantRefill = async function() {
    var editId = document.getElementById('inv-rf-id').value;
    var btn = document.getElementById('btn-submit-refill');
    
    var date = document.getElementById('inv-rf-date').value;
    var sup = document.getElementById('inv-rf-supplier').value;
    var evj = parseInt(document.getElementById('inv-rf-evj').value) || 0;
    var envj = parseInt(document.getElementById('inv-rf-envj').value) || 0;
    var fvj = parseInt(document.getElementById('inv-rf-fvj').value) || 0;
    var fnvj = parseInt(document.getElementById('inv-rf-fnvj').value) || 0;
    var rate = parseFloat(document.getElementById('inv-rf-rate').value) || 0;
    var payStatus = document.getElementById('inv-rf-paystatus').value;
    var rem = document.getElementById('inv-rf-remarks').value.trim();

    if (!date || !sup) return window.showToast("Date and Supplier required.", "warning");

    btn.innerHTML = 'Saving...'; btn.disabled = true;

    try {
        var payload = {
            supplier_id: Number(sup),
            filling_date: date,
            quantity_filled: fvj + fnvj,
            rate_per_can: rate,
            payment_status: payStatus,
            remarks: rem,
            empty_sent_vj: evj,
            empty_sent_nvj: envj,
            full_received_vj: fvj,
            full_received_nvj: fnvj
            // NOTE: total_amount and quantity_filled are omitted to let DB auto-calculate.
        };

        if (editId) {
            const { error } = await window.supabase1.from('water_fillings').update(payload).eq('id', editId);
            if (error) throw error;
            if(window.showToast) window.showToast("Refill Log Updated!", "success");
        } else {
            payload.filling_id = "FILL-" + new Date().getTime();
            payload.created_at = new Date().toISOString();
            payload.created_by = window.activeAdminSession ? window.activeAdminSession.username : 'SYSTEM';
            
            const { error } = await window.supabase1.from('water_fillings').insert([payload]);
            if (error) throw error;
            if(window.showToast) window.showToast("New Refill Logged!", "success");
        }
        window.invClearRefillForm();
        window.loadRefillHistory();
    } catch (err) {
        if(window.showToast) window.showToast("Error: " + err.message, "error");
    } finally {
        btn.innerHTML = 'Save Entry'; btn.disabled = false;
    }
};

window.deleteRefill = async function(id) {
    if(!confirm("Permanently delete this refill record?")) return;
    try {
        const { error } = await window.supabase1.from('water_fillings').delete().eq('id', id);
        if (error) throw error;
        if(window.showToast) window.showToast("Record deleted.", "success");
        window.loadRefillHistory();
    } catch(err) {
        if(window.showToast) window.showToast("Delete failed: " + err.message, "error");
    }
};


// ==========================================
// TAB 2 & 3: PURCHASE & RETIRE CRUD
// ==========================================
window.loadPurchaseHistory = async function() {
    var tbodyPu = document.getElementById('pu-history-tbody');
    var tbodyRt = document.getElementById('rt-history-tbody');
    try {
        const { data, error } = await window.supabase1.from('inventory_batches').select('*, ac_suppliers(supplier_name)').order('created_at', { ascending: false });
        if (error) throw error;
        
        window.invState.purchaseHistory = data || [];
        window.invState.activeBatches = window.invState.purchaseHistory.filter(b => b.status === 'ACTIVE' && b.qty_active > 0);

        // Render Purchases Table (Tab 2)
        if (window.invState.purchaseHistory.length === 0) {
            tbodyPu.innerHTML = '<tr><td colspan="5" class="text-center py-12 text-slate-400">No purchases found.</td></tr>';
        } else {
            var htmlPu = '';
            window.invState.purchaseHistory.slice(0,20).forEach(row => {
                var supName = row.ac_suppliers ? row.ac_suppliers.supplier_name : 'Unknown';
                htmlPu += `<tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 border-b border-slate-100 dark:border-slate-700/50">
                    <td class="px-4 py-3"><p class="font-black uppercase">${row.batch_no}</p><p class="text-[9px] text-slate-500">${row.purchase_date} | ${supName}</p></td>
                    <td class="px-4 py-3"><span class="font-black text-xs">${row.can_type}</span></td>
                    <td class="px-4 py-3 text-center"><span class="font-black text-emerald-600">${row.qty_purchased}</span></td>
                    <td class="px-4 py-3 text-center"><span class="text-[9px] text-slate-500 font-bold">${row.expiry_date}</span></td>
                    <td class="px-4 py-3 text-right">
                        <button onclick="window.editPurchase('${row.id}')" class="text-indigo-600 hover:bg-indigo-100 p-1.5 rounded"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg></button>
                        <button onclick="window.deletePurchase('${row.id}')" class="text-rose-600 hover:bg-rose-100 p-1.5 rounded"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
                    </td>
                </tr>`;
            });
            tbodyPu.innerHTML = htmlPu;
        }

        // Render Active Batches Table & Dropdown (Tab 3)
        var rtSel = document.getElementById('inv-rt-batch');
        if (window.invState.activeBatches.length === 0) {
            tbodyRt.innerHTML = '<tr><td colspan="4" class="text-center py-12 text-slate-400">No active batches to scrap.</td></tr>';
            if(rtSel) rtSel.innerHTML = '<option value="">No active batches available.</option>';
        } else {
            var htmlRt = '';
            var optRt = '<option value="">Select a batch to scrap from...</option>';
            window.invState.activeBatches.forEach(b => {
                htmlRt += `<tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 border-b border-slate-100 dark:border-slate-700/50">
                    <td class="px-4 py-3"><p class="font-black uppercase">${b.batch_no}</p><p class="text-[9px] text-slate-500">${b.can_type}</p></td>
                    <td class="px-4 py-3 text-center"><span class="font-black text-emerald-600">${b.qty_active}</span></td>
                    <td class="px-4 py-3 text-center"><span class="font-black text-rose-600">${b.qty_retired}</span></td>
                    <td class="px-4 py-3 text-center"><span class="text-[9px] text-slate-500">${b.expiry_date}</span></td>
                </tr>`;
                optRt += `<option value="${b.id}">${b.batch_no} (${b.can_type}) - ${b.qty_active} left</option>`;
            });
            tbodyRt.innerHTML = htmlRt;
            if(rtSel) rtSel.innerHTML = optRt;
        }

    } catch (err) { console.error(err); }
};

window.editPurchase = function(id) {
    var row = window.invState.purchaseHistory.find(x => String(x.id) === String(id));
    if(!row) return;
    document.getElementById('inv-pu-id').value = row.id;
    document.getElementById('inv-pu-date').value = row.purchase_date;
    document.getElementById('inv-pu-supplier').value = row.supplier_id;
    document.getElementById('inv-pu-batch').value = row.batch_no;
    document.getElementById('inv-pu-type').value = row.can_type;
    document.getElementById('inv-pu-qty').value = row.qty_purchased;
    document.getElementById('inv-pu-rate').value = row.rate_per_can || 0;
    document.getElementById('inv-pu-amt').value = row.total_amount || 0;

    document.getElementById('inv-pu-retired').value = row.qty_retired || 0;
    document.getElementById('inv-pu-edit-retired-box').classList.remove('hidden');

    document.getElementById('pu-form-title').innerText = "Update Purchase";
    document.getElementById('btn-submit-purchase').innerHTML = "Update Entry";
    document.getElementById('btn-submit-purchase').classList.replace('bg-emerald-600', 'bg-indigo-600');
    document.getElementById('btn-pu-cancel').classList.remove('hidden');
    window.invSwitchTab('purchase');
};

window.invClearPurchaseForm = function() {
    document.getElementById('inv-pu-id').value = "";
    document.getElementById('inv-pu-qty').value = "";
    document.getElementById('inv-pu-rate').value = "0";
    document.getElementById('inv-pu-amt').value = "";
    document.getElementById('inv-pu-retired').value = "0";
    document.getElementById('inv-pu-edit-retired-box').classList.add('hidden');
    
    window.generateBatchSuggestion();
    
    document.getElementById('pu-form-title').innerText = "Log Purchase";
    document.getElementById('btn-submit-purchase').innerHTML = "Save Purchase";
    document.getElementById('btn-submit-purchase').classList.replace('bg-indigo-600', 'bg-emerald-600');
    document.getElementById('btn-pu-cancel').classList.add('hidden');
};

window.submitAssetPurchase = async function() {
    var editId = document.getElementById('inv-pu-id').value;
    var btn = document.getElementById('btn-submit-purchase');
    
    var dateStr = document.getElementById('inv-pu-date').value;
    var sup = document.getElementById('inv-pu-supplier').value;
    var batch = document.getElementById('inv-pu-batch').value.trim().toUpperCase();
    var type = document.getElementById('inv-pu-type').value;
    var qty = parseInt(document.getElementById('inv-pu-qty').value);

    // NEW: Grab the rate and total
    var rate = parseFloat(document.getElementById('inv-pu-rate').value) || 0;
    var amt = qty * rate;

    if (!dateStr || !sup || !batch || !qty || qty <= 0) return window.showToast("Valid input required.", "warning");

    btn.innerHTML = 'Saving...'; btn.disabled = true;

    var retired = parseInt(document.getElementById('inv-pu-retired').value) || 0;
    var activeQty = qty - retired;

    try {
        var pDate = new Date(dateStr);
        pDate.setFullYear(pDate.getFullYear() + 1);
        var expDateStr = pDate.toISOString().split('T')[0];

        var payload = {
            batch_no: batch,
            purchase_date: dateStr,
            supplier_id: Number(sup),
            can_type: type,
            qty_purchased: qty,
            qty_active: activeQty,
            qty_retired: retired,
            expiry_date: expDateStr,
            rate_per_can: rate,       // <-- Saved to DB
            total_amount: amt,         // <-- Saved to DB
            status: activeQty <= 0 ? 'RETIRED' : 'ACTIVE'
        };

        if(editId) {
            const { error } = await window.supabase1.from('inventory_batches').update(payload).eq('id', editId);
            if (error) throw error;
            if (window.showToast) window.showToast(`Batch updated.`, "success");
        } else {
            payload.qty_retired = 0;
            payload.status = 'ACTIVE';
            payload.created_at = new Date().toISOString();
            payload.created_by = window.activeAdminSession ? window.activeAdminSession.username : 'SYSTEM';
            
            const { error } = await window.supabase1.from('inventory_batches').insert([payload]);
            if (error) throw error;
            if (window.showToast) window.showToast(`Batch ${batch} saved!`, "success");
        }

        window.invClearPurchaseForm();
        window.loadPurchaseHistory();

    } catch (err) {
        if (window.showToast) window.showToast("Failed to save: " + err.message, "error");
    } finally {
        btn.innerHTML = 'Save Purchase'; btn.disabled = false;
    }
};

window.deletePurchase = async function(id) {
    if(!confirm("Permanently delete this batch?")) return;
    try {
        const { error } = await window.supabase1.from('inventory_batches').delete().eq('id', id);
        if (error) throw error;
        if(window.showToast) window.showToast("Batch deleted.", "success");
        window.loadPurchaseHistory();
    } catch(err) {
        if(window.showToast) window.showToast("Delete failed: " + err.message, "error");
    }
};

window.invSelectBatch = function() {
    var bId = document.getElementById('inv-rt-batch').value;
    var availInp = document.getElementById('inv-rt-avail');
    if (!bId) { availInp.value = ""; return; }
    var b = window.invState.activeBatches.find(x => String(x.id) === String(bId));
    if (b) availInp.value = b.qty_active;
};

window.submitScrapRetire = async function() {
    var btn = document.getElementById('btn-submit-retire');
    var bId = document.getElementById('inv-rt-batch').value;
    var qtyToScrap = parseInt(document.getElementById('inv-rt-qty').value);
    
    if (!bId || !qtyToScrap || qtyToScrap <= 0) return window.showToast("Select batch and enter quantity.", "warning");

    var batch = window.invState.activeBatches.find(x => String(x.id) === String(bId));
    if (!batch) return;
    if (qtyToScrap > batch.qty_active) return window.showToast(`Cannot scrap ${qtyToScrap}. Only ${batch.qty_active} available.`, "warning");
    if (!confirm(`Retire ${qtyToScrap} cans from ${batch.batch_no}?`)) return;

    btn.innerHTML = 'Retiring...'; btn.disabled = true;

    try {
        var newActive = batch.qty_active - qtyToScrap;
        var newRetired = batch.qty_retired + qtyToScrap;
        var newStatus = newActive <= 0 ? 'RETIRED' : 'ACTIVE';

        const { error } = await window.supabase1.from('inventory_batches').update({ qty_active: newActive, qty_retired: newRetired, status: newStatus }).eq('id', bId);
        if (error) throw error;

        if (window.showToast) window.showToast(`${qtyToScrap} cans retired.`, "success");
        document.getElementById('inv-rt-qty').value = "";
        window.loadPurchaseHistory(); // Refreshes both active batches and tables

    } catch (err) {
        if (window.showToast) window.showToast("Failed to scrap: " + err.message, "error");
    } finally {
        btn.innerHTML = 'Confirm Scrap'; btn.disabled = false;
    }
};

// ==========================================
// SPA ROUTER HOOK
// ==========================================
window.tabActions['tran-inventory'] = function() {
    window.invSwitchTab('refills');
    window.loadInventoryData();
};