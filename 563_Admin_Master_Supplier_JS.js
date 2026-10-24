window.masterSupplierData = [];
window.filteredSuppliers = [];

window.loadSuppliers = async function () {
    var loadingEl = document.getElementById('sup-loading');
    if(loadingEl) loadingEl.classList.remove('hidden');
    
    var tbody = document.getElementById('supplier-tbody');
    if(tbody) tbody.innerHTML = '';

    try {
        const { data, error } = await window.supabase1
            .from('ac_suppliers')
            .select('*')
            .order('supplier_name', { ascending: true });

        if (error) throw error;

        window.masterSupplierData = data || [];
        window.filteredSuppliers = window.masterSupplierData;
        window.renderSuppliersTable();

    } catch (err) {
        if(window.showToast) window.showToast("Failed to load suppliers: " + err.message, "error");
    } finally {
        if(loadingEl) loadingEl.classList.add('hidden');
    }
};

window.filterSuppliers = function () {
    var searchInput = document.getElementById('sup-search');
    var query = searchInput ? searchInput.value.toLowerCase().trim() : "";
    
    if (!query) {
        window.filteredSuppliers = window.masterSupplierData;
    } else {
        window.filteredSuppliers = window.masterSupplierData.filter(function (s) {
            return (s.supplier_name.toLowerCase().indexOf(query) > -1) ||
                   (String(s.ledger_code || "").toLowerCase().indexOf(query) > -1);
        });
    }
    window.renderSuppliersTable();
};

window.renderSuppliersTable = function () {
    var tbody = document.getElementById('supplier-tbody');
    if(!tbody) return;
    
    if (window.filteredSuppliers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-12 text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest transition-colors">No suppliers found.</td></tr>';
        return;
    }

    var html = '';
    window.filteredSuppliers.forEach(function(s) {
        var statusBadge = s.status === 'ACTIVE'
            ? `<span class="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-[10px] px-2.5 py-1 rounded font-black uppercase tracking-widest transition-colors">ACTIVE</span>`
            : `<span class="bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-400 border border-rose-200 dark:border-rose-800 text-[10px] px-2.5 py-1 rounded font-black uppercase tracking-widest transition-colors">INACTIVE</span>`;

        html += `<tr class="hover:bg-slate-50 dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700/50 transition-colors">
            <td class="px-6 py-4">
                <p class="font-black text-slate-800 dark:text-white text-base uppercase transition-colors">${s.supplier_name}</p>
                <p class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5 transition-colors">ID: ${s.id}</p>
            </td>
            <td class="px-6 py-4 text-center font-black text-indigo-600 dark:text-indigo-400 text-lg transition-colors">₹${s.rate_per_can || 0}</td>
            <td class="px-6 py-4 font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest text-sm transition-colors">${s.ledger_code || '-'}</td>
            <td class="px-6 py-4 text-center">${statusBadge}</td>
            <td class="px-6 py-4 text-right">
                <button onclick="window.openSupplierModal(${s.id})" class="bg-slate-100 dark:bg-slate-900/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-slate-600 dark:text-slate-400 hover:text-indigo-700 dark:hover:text-indigo-400 border border-slate-200 dark:border-slate-700 px-4 py-1.5 rounded-lg text-xs font-black tracking-widest uppercase transition-colors outline-none shadow-sm">Edit</button>
            </td>
        </tr>`;
    });
    
    tbody.innerHTML = html;
};

window.openSupplierModal = function(id) {
    document.getElementById('sup-modal-id').value = id || "";
    
    if (id) {
        var s = window.masterSupplierData.find(x => String(x.id) === String(id));
        document.getElementById('sup-modal-title').innerText = "Edit Supplier";
        document.getElementById('sup-modal-name').value = s.supplier_name || "";
        document.getElementById('sup-modal-rate').value = s.rate_per_can || 0;
        document.getElementById('sup-modal-ledger').value = s.ledger_code || "";
        document.getElementById('sup-modal-status').value = s.status || "ACTIVE";
    } else {
        document.getElementById('sup-modal-title').innerText = "Add Supplier";
        document.getElementById('sup-modal-name').value = "";
        document.getElementById('sup-modal-rate').value = "";
        document.getElementById('sup-modal-ledger').value = "";
        document.getElementById('sup-modal-status').value = "ACTIVE";
    }

    if(typeof window.toggleScrollLock === 'function') window.toggleScrollLock(true);
    document.getElementById('modal-supplier').classList.remove('hidden');
};

window.saveSupplier = async function() {
    var id = document.getElementById('sup-modal-id').value;
    var name = document.getElementById('sup-modal-name').value.trim();
    var rate = parseFloat(document.getElementById('sup-modal-rate').value);
    var ledger = document.getElementById('sup-modal-ledger').value.trim().toUpperCase();
    var status = document.getElementById('sup-modal-status').value;
    var btn = document.getElementById('btn-save-supplier');

    if (!name || isNaN(rate)) {
        if(window.showToast) return window.showToast("Supplier Name and Rate are mandatory.", "warning");
        return;
    }

    btn.innerText = "Saving..."; btn.disabled = true;

    try {
        var payload = {
            supplier_name: name,
            rate_per_can: rate,
            ledger_code: ledger || null,
            status: status
        };

        if (id) {
            const { error } = await window.supabase1.from('ac_suppliers').update(payload).eq('id', id);
            if (error) throw error;
        } else {
            payload.created_at = new Date().toISOString();
            payload.created_by = window.activeAdminSession ? window.activeAdminSession.username : 'SYSTEM';
            const { error } = await window.supabase1.from('ac_suppliers').insert([payload]);
            if (error) throw error;
        }

        window.closeModal('modal-supplier');
        if(window.showToast) window.showToast("Supplier saved successfully!", "success");
        window.loadSuppliers();

    } catch(err) {
        if(window.showToast) window.showToast("Failed to save: " + err.message, "error");
    } finally {
        btn.innerHTML = 'Save Vendor'; btn.disabled = false;
    }
};

// SPA Standard Router Hook
window.tabActions['master-supplier'] = function() {
    window.loadSuppliers();
};