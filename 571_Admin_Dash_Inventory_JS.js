window.loadInventoryDashboard = async function() {
    try {
        const supa = window.supabase1;

        // 1. Fetch the single Master Scoreboard row
        const { data: masterData, error: masterErr } = await supa
            .from('inventory_master')
            .select('*')
            .eq('id', 1)
            .single();

        if (masterErr && masterErr.code !== 'PGRST116') throw masterErr; // Ignore 'No Rows' error initially
        
        if (masterData) {
            // Totals
            document.getElementById('dash-tot-vj').innerText = masterData.total_vj_owned || 0;
            document.getElementById('dash-tot-nvj').innerText = masterData.total_nvj_owned || 0;
            
            // Godown
            document.getElementById('dash-gd-fvj').innerText = masterData.godown_full_vj || 0;
            document.getElementById('dash-gd-fnvj').innerText = masterData.godown_full_nvj || 0;
            document.getElementById('dash-gd-evj').innerText = masterData.godown_empty_vj || 0;
            document.getElementById('dash-gd-envj').innerText = masterData.godown_empty_nvj || 0;
            
            // Transit
            document.getElementById('dash-tr-fvj').innerText = masterData.transit_full_vj || 0;
            document.getElementById('dash-tr-fnvj').innerText = masterData.transit_full_nvj || 0;
            document.getElementById('dash-tr-evj').innerText = masterData.transit_empty_vj || 0;
            document.getElementById('dash-tr-envj').innerText = masterData.transit_empty_nvj || 0;
            
            // Customer
            document.getElementById('dash-cu-vj').innerText = masterData.customer_vj || 0;
            document.getElementById('dash-cu-nvj').innerText = masterData.customer_nvj || 0;
        }

        // 2. Fetch Active Batches for Expiry Radar
        const { data: batchData, error: batchErr } = await supa
            .from('inventory_batches')
            .select('batch_no, qty_active, expiry_date, can_type')
            .eq('status', 'ACTIVE')
            .order('expiry_date', { ascending: true });

        if (batchErr) throw batchErr;

        var radarContainer = document.getElementById('dash-expiry-list');
        if (!batchData || batchData.length === 0) {
            radarContainer.innerHTML = '<p class="text-center py-6 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">No active batches.</p>';
            return;
        }

        var html = '';
        var today = new Date();
        today.setHours(0,0,0,0);

        batchData.forEach(b => {
            if (!b.qty_active || b.qty_active <= 0) return;

            var expDate = new Date(b.expiry_date);
            var diffTime = expDate - today;
            var diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            var styleClass = "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400";
            var icon = "✅";
            var statusText = diffDays + " days left";

            if (diffDays <= 0) {
                styleClass = "bg-rose-50 dark:bg-rose-900/20 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400";
                icon = "🚨";
                statusText = "EXPIRED";
            } else if (diffDays <= 45) {
                styleClass = "bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400";
                icon = "⚠️";
            }

            html += `
            <div class="flex items-center justify-between p-3 border rounded-xl shadow-sm transition-colors ${styleClass}">
              <div>
                <p class="font-black text-sm uppercase tracking-widest">${b.batch_no}</p>
                <p class="text-[9px] font-bold uppercase tracking-widest mt-0.5 opacity-80">${b.qty_active} ${b.can_type} Active</p>
              </div>
              <div class="text-right">
                <p class="font-black text-xs">${icon} ${statusText}</p>
                <p class="text-[9px] font-bold opacity-80 mt-0.5">${b.expiry_date}</p>
              </div>
            </div>`;
        });

        if(html === '') html = '<p class="text-center py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">All active batches safe.</p>';
        radarContainer.innerHTML = html;

    } catch (err) {
        console.error("Dashboard Load Error:", err);
        if(window.showToast) window.showToast("Failed to load dashboard data.", "error");
    }
};

// Register for SPA Router
window.tabActions['inventory-dash'] = function() {
    window.loadInventoryDashboard();
};