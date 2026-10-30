// State Management
let currentGridData = [];
let selectedCpns = new Set();
window.waTemplateMaps = {};
window.pushUrlMap = {};

// ------------------------------------------------------------------
// 1. INITIALIZATION & DATA LOADING
// ------------------------------------------------------------------
window.loadNotificationManager = async function() {
    selectedCpns.clear();
    updateSelectionUI();
    
    // Bind Event Listeners
    document.getElementById('notif-context-select').addEventListener('change', loadGridData);
    document.getElementById('notif-grid-search').addEventListener('input', renderGrid);
    document.getElementById('notif-select-all').addEventListener('change', toggleAllSelection);

    await Promise.all([
        loadNotificationConfigs(),
        loadGridData(),
        fetchNotificationLogs() // This also calculates KPIs
    ]);
};

async function loadNotificationConfigs() {
    const templateSelect = document.getElementById('notif-wa-template');
    if (!templateSelect) return;
    try {
        const { data, error } = await window.supabase1.from('setup').select('key, value').in('key', [
            'WA_TEMPLATES', 
            'WA_MAP_delivery_confirmation', 
            'WA_MAP_order_confirmation', 
            'WA_MAP_payment_confirmation',
            'PUSH_URL_ROUTING' // 2. Add the new key to the fetch list
        ]);

        if (error) throw error;
        
        let optionsHTML = '<option value="">-- No Template (Text Only / Non-WhatsApp) --</option>';
        
        if (data) {
            data.forEach(row => {
                if (row.key === 'WA_TEMPLATES') {
                    const templates = row.value.split(',').map(t => t.trim()).filter(t => t);
                    templates.forEach(t => optionsHTML += `<option value="${t}">${t}</option>`);
                } else if (row.key.startsWith('WA_MAP_')) {
                    const tName = row.key.replace('WA_MAP_', '');
                    window.waTemplateMaps[tName] = row.value.split(',').map(c => c.trim());
                } else if (row.key === 'PUSH_URL_ROUTING') {
                    // 3. Parse the JSON map from the database directly into the global object
                    window.pushUrlMap = JSON.parse(row.value);
                }
            });
        }
        templateSelect.innerHTML = optionsHTML;
    } catch (err) {
        console.error("Failed to load configs:", err);
    }
}

async function loadGridData() {
    const context = document.getElementById('notif-context-select').value;
    const tbody = document.getElementById('notif-target-grid');
    const metricHeader = document.getElementById('notif-grid-metric-header');
    
    tbody.innerHTML = '<tr><td colspan="5" class="p-10 text-center text-slate-500 font-bold"><i class="fas fa-spinner fa-spin text-xl mb-2 text-emerald-500"></i><br>Loading Database...</td></tr>';
    selectedCpns.clear();
    updateSelectionUI();

    try {
        let data = [], error = null;

        // FIXED LOGIC: We now select('*') without aliasing to preserve all columns for WA templates. 
        // We map the UI 'name' and 'contact' manually below.
        if (context === 'GENERAL') {
            metricHeader.textContent = "A/c Status";
            ({ data, error } = await window.supabase1.from('ac_customers').select('*').in('final_status', ['ACTIVE', 'Active']));
            currentGridData = data ? data.map(d => ({ ...d, name: d.poc1, contact: d.con1, metric: d.final_status, isInvalid: !d.con1 || String(d.con1).length < 10 })) : [];
        }
        else if (context === 'ORDERS') {
            metricHeader.textContent = "Rate / Amt";
            ({ data, error } = await window.supabase1.from('orders').select('*'));
            currentGridData = data ? data.map(d => ({ ...d, name: d.name, contact: d.contact, metric: `₹${d.rate} / ₹${d.amount}`, isInvalid: !d.contact || String(d.contact).length < 10 })) : [];
        }
        else if (context === 'DELIVERIES') {
            metricHeader.textContent = "Delivered";
            ({ data, error } = await window.supabase1.from('deliveries').select('*'));
            currentGridData = data ? data.map(d => ({ ...d, name: d.name, contact: d.contact, metric: `D:${d.act_d || 0} E:${d.act_e || 0}`, isInvalid: !d.contact || String(d.contact).length < 10 })) : [];
        }
        else if (context === 'OUTSTANDING') {
            metricHeader.textContent = "Balance";
            ({ data, error } = await window.supabase1.from('v_customer_outstanding').select('*'));
            currentGridData = data ? data.map(d => ({ ...d, name: d.customer_name, contact: d.contact, metric: `₹${d.current_balance}`, isInvalid: !d.contact || String(d.contact).length < 10 })) : [];
        }

        if (error) throw error;
        renderGrid();
    } catch (err) {
        console.error("Grid Load Error:", err);
        tbody.innerHTML = `<tr><td colspan="5" class="p-5 text-center text-rose-400 font-bold">Failed to load context data: ${err.message}</td></tr>`;
    }
}

async function processDispatch(mode) {
    const feedbackEl = document.getElementById('notif-feedback');
    const { channels, title, body, template, context } = getPayloadData();

    if (selectedCpns.size === 0) {
        showFeedback(feedbackEl, "Select at least one valid customer from the grid.", "error");
        return;
    }
    if (channels.length === 0) {
        showFeedback(feedbackEl, "Select at least one delivery channel.", "error");
        return;
    }

    const btnId = mode === 'POOL' ? 'btn-pool' : 'btn-immediate';
    const btnEl = document.getElementById(btnId);
    const originalHtml = btnEl.innerHTML;
    setButtonLoading(btnEl, true, mode);

    try {
        const adminUser = localStorage.getItem('user_email') || 'Unknown Admin';
        const targetUrl = window.pushUrlMap[context] || "https://wowdrops.github.io/351_portal.html";

        const insertData = Array.from(selectedCpns).map(cpn => {
            const rowData = currentGridData.find(r => r.cpn_no === cpn) || {};
            const customerName = rowData.name || 'Customer';

            const personalizedTitle = title.replace(/\{\{name\}\}/gi, customerName);
            const personalizedBody = body.replace(/\{\{name\}\}/gi, customerName);

            let wa_variables = [];
            if (template && window.waTemplateMaps && window.waTemplateMaps[template]) {
                const requiredColumns = window.waTemplateMaps[template];
                wa_variables = requiredColumns.map(col => {
                    return rowData[col] !== undefined && rowData[col] !== null ? String(rowData[col]) : 'N/A';
                });
            }

            return {
                cpn_no: cpn,
                channel: channels.join(', '), 
                message_type: context,
                status: 'PENDING', // MUST be PENDING for the Edge Function
                trigger_type: 'MANUAL',
                target_channels: channels,
                raw_payload: { 
                    title: personalizedTitle, 
                    body: personalizedBody, 
                    wa_template: template || null,
                    wa_variables: wa_variables,
                    push_url: targetUrl
                },
                created_by: adminUser
            };
        });

        const { data: insertedLogs, error: insertErr } = await window.supabase1
            .from('notification_logs')
            .insert(insertData)
            .select('id, cpn_no');

        if (insertErr) throw insertErr;

        if (mode === 'IMMEDIATE' && insertedLogs) {
            const promises = insertedLogs.map(log => 
                window.supabase1.functions.invoke('send-alert', { 
                    body: { action: 'send_immediate', log_id: log.id } 
                })
            );
            await Promise.allSettled(promises); // Wait for Backend to 100% finish
            showFeedback(feedbackEl, `Successfully dispatched ${selectedCpns.size} alerts!`, "success");
        } else {
            showFeedback(feedbackEl, `Transferred ${selectedCpns.size} alerts to the Pool.`, "success");
        }

        document.getElementById('notif-title').value = '';
        document.getElementById('notif-body').value = '';
        selectedCpns.clear();
        document.getElementById('notif-select-all').checked = false;
        renderGrid(); 
        
        // FIXED LOGIC: We fetch logs AFTER the promises are settled, so it instantly reads SUCCESS
        fetchNotificationLogs(); 

    } catch (err) {
        showFeedback(feedbackEl, "System Error: " + err.message, "error");
    } finally {
        setButtonLoading(btnEl, false, mode, originalHtml);
    }
}

function renderGrid() {
    const searchTerm = document.getElementById('notif-grid-search').value.toLowerCase();
    const tbody = document.getElementById('notif-target-grid');
    
    const filtered = currentGridData.filter(row => 
        row.cpn_no?.toLowerCase().includes(searchTerm) || 
        row.name?.toLowerCase().includes(searchTerm)
    );

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="p-5 text-center text-slate-500 font-bold">No records found.</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(row => {
        const isSelected = selectedCpns.has(row.cpn_no);
        const rowClass = row.isInvalid ? 'bg-rose-900/10 border-rose-900/30' : 'hover:bg-slate-800/50';
        const textClass = row.isInvalid ? 'text-rose-400' : 'text-slate-300';
        const warningIcon = row.isInvalid ? '<i class="fas fa-exclamation-triangle text-rose-500 mr-1" title="Invalid Contact"></i>' : '';

        return `
        <tr class="border-b border-slate-700/50 transition-colors ${rowClass}">
            <td class="p-2 text-center">
                <input type="checkbox" value="${row.cpn_no}" onchange="toggleRowSelection(this)" ${isSelected ? 'checked' : ''} ${row.isInvalid ? 'disabled' : ''} class="accent-emerald-500 w-4 h-4 rounded cursor-pointer">
            </td>
            <td class="p-2 font-bold ${textClass}">${warningIcon}${row.cpn_no}</td>
            <td class="p-2">
                <p class="font-bold ${textClass} truncate max-w-[150px]">${row.name || 'Unknown'}</p>
                <p class="text-[9px] font-mono text-slate-500">${row.contact || 'No Number'}</p>
            </td>
            <td class="p-2 text-right font-mono text-slate-400">${row.metric}</td>
            <td class="p-2 text-center">
                ${row.isInvalid 
                    ? '<span class="px-1.5 py-0.5 rounded bg-rose-900/30 text-rose-400 text-[9px] font-black uppercase tracking-wider border border-rose-900/50">Invalid</span>' 
                    : '<span class="px-1.5 py-0.5 rounded bg-emerald-900/20 text-emerald-400 text-[9px] font-black uppercase tracking-wider border border-emerald-900/50">Valid</span>'}
            </td>
        </tr>`;
    }).join('');
    
    updateSelectionUI();
}

// ------------------------------------------------------------------
// 2. SELECTION LOGIC
// ------------------------------------------------------------------
function toggleRowSelection(checkbox) {
    if (checkbox.checked) selectedCpns.add(checkbox.value);
    else selectedCpns.delete(checkbox.value);
    updateSelectionUI();
}

function toggleAllSelection(e) {
    const isChecked = e.target.checked;
    const checkboxes = document.querySelectorAll('#notif-target-grid input[type="checkbox"]:not(:disabled)');
    checkboxes.forEach(cb => {
        cb.checked = isChecked;
        if (isChecked) selectedCpns.add(cb.value);
        else selectedCpns.delete(cb.value);
    });
    updateSelectionUI();
}

function updateSelectionUI() {
    const countEl = document.getElementById('notif-selected-count');
    const btnImmediate = document.getElementById('btn-immediate');
    
    countEl.textContent = selectedCpns.size;
    
    // Safety lock for immediate dispatch
    if (selectedCpns.size > 10) {
        btnImmediate.disabled = true;
        btnImmediate.classList.add('opacity-50', 'cursor-not-allowed');
        btnImmediate.classList.remove('hover:bg-emerald-500', 'active:scale-95');
    } else {
        btnImmediate.disabled = false;
        btnImmediate.classList.remove('opacity-50', 'cursor-not-allowed');
        btnImmediate.classList.add('hover:bg-emerald-500', 'active:scale-95');
    }
}

// ------------------------------------------------------------------
// 3. DISPATCH LOGIC (Pool vs Immediate)
// ------------------------------------------------------------------
function getPayloadData() {
    const channels = [];
    if(document.getElementById('channel-wa').checked) channels.push('WHATSAPP');
    if(document.getElementById('channel-push').checked) channels.push('FIREBASE');
    if(document.getElementById('channel-gmail').checked) channels.push('GMAIL');

    const title = document.getElementById('notif-title').value.trim();
    const body = document.getElementById('notif-body').value.trim();
    const template = document.getElementById('notif-wa-template').value;
    const context = document.getElementById('notif-context-select').value;

    return { channels, title, body, template, context };
}

async function dispatchToPool() {
    await processDispatch('POOL');
}

async function dispatchImmediately() {
    if (selectedCpns.size > 10) return; // Hard stop
    await processDispatch('IMMEDIATE');
}

// ------------------------------------------------------------------
// 4. COMMAND CENTER (Ledger & KPIs)
// ------------------------------------------------------------------
async function fetchNotificationLogs() {
    const container = document.getElementById('notif-logs-container');
    const filterChannel = document.getElementById('filter-channel').value;
    const filterStatus = document.getElementById('filter-status').value;
    const filterTrigger = document.getElementById('filter-trigger').value;
    
    if(container) container.innerHTML = '<div class="flex flex-col items-center justify-center py-10"><i class="fas fa-spinner fa-spin text-2xl text-emerald-500 mb-3"></i><p class="text-[10px] font-black text-slate-500 uppercase tracking-widest">Syncing Live Ledger...</p></div>';

    try {
        let query = window.supabase1.from('notification_logs').select('*').order('created_at', { ascending: false }).limit(50);
        
        if(filterChannel !== 'ALL') query = query.contains('target_channels', `["${filterChannel}"]`); // Note: JSONB contains check might vary slightly based on exact structure, but keeping it simple for array
        if(filterStatus !== 'ALL') query = query.eq('status', filterStatus);
        if(filterTrigger !== 'ALL') query = query.eq('trigger_type', filterTrigger);

        const { data, error } = await query;
        if (error) throw error;

        calculateKPIs(data); // Call KPI function before rendering

        if (!data || data.length === 0) {
            if(container) container.innerHTML = '<p class="text-[10px] font-bold text-slate-500 text-center bg-slate-900 rounded-xl p-6 border border-slate-700 uppercase tracking-widest mt-4">No dispatches match criteria.</p>';
            return;
        }

        if(container) {
            container.innerHTML = data.map(log => {
                let isSuccess = log.status === 'SUCCESS';
                let isPending = log.status === 'PENDING' || log.status === 'PROCESSING';
                
                let statusColor = isSuccess ? 'text-emerald-400' : (isPending ? 'text-amber-400' : 'text-rose-400');
                let statusBg = isSuccess ? 'bg-emerald-900/20 border-emerald-900/50' : (isPending ? 'bg-amber-900/20 border-amber-900/50' : 'bg-rose-900/20 border-rose-900/50');
                let statusDot = isSuccess ? 'bg-emerald-400' : (isPending ? 'bg-amber-400 animate-pulse' : 'bg-rose-400');
                
                const timestamp = new Date(log.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
                
                // Tooltip for errors
                const errorAttr = log.error_log ? `title="Error: ${log.error_log.replace(/"/g, "'")}"` : '';

                return `
                <div class="bg-slate-900 border border-slate-700 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between shadow-sm transition-all hover:border-slate-600 gap-2" ${errorAttr}>
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center shrink-0 shadow-inner">
                            <i class="fas ${log.trigger_type === 'AUTOMATIC' ? 'fa-robot text-blue-400' : 'fa-user text-slate-400'}"></i>
                        </div>
                        <div>
                            <p class="text-sm font-black text-white tracking-wide">${log.cpn_no} <span class="text-[9px] font-bold text-slate-400 ml-1 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 uppercase tracking-wider">${log.message_type}</span></p>
                            <p class="text-[9px] font-bold text-slate-500 mt-0.5 uppercase tracking-wider">${timestamp} • By ${log.created_by || 'System'}</p>
                        </div>
                    </div>
                    <div class="text-left sm:text-right">
                        <div class="flex items-center justify-start sm:justify-end gap-1 mb-1 ${statusBg} px-2 py-0.5 rounded border inline-flex sm:flex ${log.error_log ? 'cursor-help' : ''}">
                            <div class="w-1.5 h-1.5 rounded-full ${statusDot}"></div>
                            <p class="text-[9px] font-black ${statusColor} uppercase tracking-widest">${log.status}</p>
                        </div>
                        <p class="text-[10px] text-slate-500 font-mono">Cost: ₹${log.estimated_cost?.toFixed(2) || '0.00'}</p>
                    </div>
                </div>`;
            }).join('');
        }

    } catch (err) {
        console.error("Ledger Fetch Error:", err);
        if(container) container.innerHTML = '<p class="text-[10px] font-black text-rose-400 text-center py-6 bg-rose-900/10 rounded-xl border border-rose-900/30 uppercase tracking-widest">Failed to sync ledger.</p>';
    }
}

async function calculateKPIs(currentViewData) {
    // Note: For a true "Today's" KPI, we should query DB separately to ignore current dropdown filters.
    try {
        const todayStart = new Date();
        todayStart.setHours(0,0,0,0);
        
        const { data: todayStats, error } = await window.supabase1
            .from('notification_logs')
            .select('status, estimated_cost')
            .gte('created_at', todayStart.toISOString());
            
        if(error) throw error;

        let totalCost = 0;
        let pendingCount = 0;
        let successCount = 0;
        let failCount = 0;

        todayStats.forEach(log => {
            totalCost += (log.estimated_cost || 0);
            if (log.status === 'PENDING' || log.status === 'PROCESSING') pendingCount++;
            if (log.status === 'SUCCESS') successCount++;
            if (log.status === 'FAILED') failCount++;
        });

        const totalResolved = successCount + failCount;
        const successRate = totalResolved > 0 ? Math.round((successCount / totalResolved) * 100) : 100;

        document.getElementById('kpi-cost').textContent = totalCost.toFixed(2);
        document.getElementById('kpi-queue').textContent = pendingCount;
        document.getElementById('kpi-success').textContent = successRate;

    } catch (err) {
        console.error("KPI Error:", err);
    }
}

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------
function showFeedback(el, msg, type) {
    el.textContent = msg;
    if (type === 'error') {
        el.className = "text-[10px] font-black text-center block text-rose-400 mt-3 uppercase tracking-wider bg-rose-900/20 p-2 rounded-lg border border-rose-900/50";
    } else {
        el.className = "text-[10px] font-black text-center block text-emerald-400 mt-3 uppercase tracking-wider bg-emerald-900/20 p-2 rounded-lg border border-emerald-900/50";
    }
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 5000);
}

function setButtonLoading(btn, isLoading, mode, originalHtml = '') {
    if (isLoading) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> <span class="uppercase tracking-widest text-xs font-black">${mode === 'POOL' ? 'Queuing...' : 'Routing...'}</span>`;
        btn.classList.add('opacity-75', 'cursor-not-allowed');
    } else {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
        btn.classList.remove('opacity-75', 'cursor-not-allowed');
    }
}

// Bind to SPA Router
window.tabActions['push-notifications'] = window.loadNotificationManager;
