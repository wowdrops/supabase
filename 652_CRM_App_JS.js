window.crmQueues = { pending: [], wip: [], completed: [] };
window.crmCurrentTab = 'pending';
window.crmSortOrder = 'none';
window.crmSortMetricDirection = -1; 
window.crmSetupConfig = { wipStatuses: [], completedStatuses: [] };

window.crmSwitchTab = function(tab) {
    window.crmCurrentTab = tab;
    
    ['pending', 'wip', 'completed', 'patterns', 'feedbacks'].forEach(t => {
        var el = document.getElementById('tab-' + t);
        if(!el) return;
        if (t === tab) el.className = "px-5 py-2.5 bg-indigo-600 text-white font-black rounded-t-xl text-sm uppercase tracking-widest transition whitespace-nowrap";
        else el.className = "px-5 py-2.5 bg-transparent text-slate-500 font-black rounded-t-xl text-sm uppercase tracking-widest hover:bg-slate-100 transition whitespace-nowrap";
    });

    var btnMetric = document.getElementById('btn-sort-metric');
    if (btnMetric) {
        if (tab === 'completed') btnMetric.innerText = "Newest First";
        else btnMetric.innerText = "Highest Days";
    }

    if (tab === 'patterns' || tab === 'feedbacks') {
        document.getElementById('queue-title').innerText = tab === 'patterns' ? 'Pattern Tracker' : 'Customer Feedbacks';
        document.getElementById('queue-list').innerHTML = '<div class="col-span-full p-6 bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl text-center"><p class="text-slate-500 text-sm font-bold">Predictive AI module launching next phase.</p></div>';
        return;
    }

    window.crmApplyQueueFilters();
};

window.crmLoadQueues = async function() {
    var container = document.getElementById('queue-list');
    if(container) container.innerHTML = '<div class="col-span-full text-center p-6"><p class="text-sm font-bold text-indigo-500 animate-pulse">Syncing queues with Supabase...</p></div>';

    try {
        const { data: setupData } = await window.supabase1.from('setup').select('key, value').in('key', ['wip_statuses', 'completed_statuses']);
        if (setupData) {
            setupData.forEach(s => {
                if (s.key === 'wip_statuses' && s.value) window.crmSetupConfig.wipStatuses = s.value.split(',').map(x => x.trim().toUpperCase());
                if (s.key === 'completed_statuses' && s.value) window.crmSetupConfig.completedStatuses = s.value.split(',').map(x => x.trim().toUpperCase());
            });
        }

        const { data: logs, error } = await window.supabase1.from('crm_dormant_call_logs').select('*').order('last_updated', { ascending: false });
        if (error) throw error;

        window.crmQueues = { pending: [], wip: [], completed: [] };

        if (logs) {
            logs.forEach(row => {
                var callStatus = String(row.call_status || "").trim().toUpperCase();
                var isPending = (callStatus === "" || callStatus === "PENDING");
                var isWip = window.crmSetupConfig.wipStatuses.includes(callStatus);

                var item = {
                    cpn: String(row.cpn_no || "").trim(),
                    name: String(row.customer_name || "").trim(),
                    status: callStatus || "PENDING",
                    days: Number(row.days_dormant) || 0,
                    dateStr: new Date(row.last_updated).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
                    ts: new Date(row.last_updated).getTime()
                };

                if (isPending) window.crmQueues.pending.push(item);
                else if (isWip) window.crmQueues.wip.push(item);
                else window.crmQueues.completed.push(item);
            });
        }
        
        window.crmApplyQueueFilters();

    } catch (err) {
        if(container) container.innerHTML = '<div class="col-span-full p-4 text-rose-500 font-bold">Error loading queues: ' + err.message + '</div>';
    }
};

window.crmSortQueue = function(order) {
    if (order === 'metric') {
        window.crmSortOrder = 'metric';
        window.crmSortMetricDirection *= -1;
        var btnLabel = window.crmCurrentTab === 'completed' 
            ? (window.crmSortMetricDirection === -1 ? "Newest First" : "Oldest First")
            : (window.crmSortMetricDirection === -1 ? "Highest Days" : "Lowest Days");
        var btnMetric = document.getElementById('btn-sort-metric');
        if(btnMetric) btnMetric.innerText = btnLabel;
    } else {
        window.crmSortOrder = order;
    }
    window.crmApplyQueueFilters();
};

window.crmApplyQueueFilters = function() {
    var searchInput = document.getElementById('queue-search');
    var term = searchInput ? searchInput.value.trim().toLowerCase() : "";
    var activeArray = window.crmQueues[window.crmCurrentTab] || [];

    var filtered = activeArray.filter(function (item) { 
        return item.cpn.toLowerCase().indexOf(term) > -1 || item.name.toLowerCase().indexOf(term) > -1; 
    });

    if (window.crmSortOrder === 'cpn-asc') {
        filtered.sort((a, b) => a.cpn.localeCompare(b.cpn));
    } else if (window.crmSortOrder === 'cpn-desc') {
        filtered.sort((a, b) => b.cpn.localeCompare(a.cpn));
    } else if (window.crmSortOrder === 'metric') {
        if (window.crmCurrentTab === 'completed') {
            filtered.sort((a, b) => window.crmSortMetricDirection === -1 ? b.ts - a.ts : a.ts - b.ts);
        } else {
            filtered.sort((a, b) => window.crmSortMetricDirection === -1 ? b.days - a.days : a.days - b.days);
        }
    }

    window.crmDrawQueueList(filtered);
};

window.crmDrawQueueList = function(dataArray) {
    var container = document.getElementById('queue-list');
    var titleEl = document.getElementById('queue-title');
    var titles = { 'pending': 'Pending Leads', 'wip': 'WIP / Follow-ups', 'completed': 'Recent History' };
    
    if(titleEl) titleEl.innerText = titles[window.crmCurrentTab] + ' (' + dataArray.length + ')';
    
    if(dataArray.length === 0) {
        if(container) container.innerHTML = '<div class="col-span-full text-slate-500 text-sm font-bold p-3">No matching records found.</div>';
        return;
    }
    
    var html = '';
    for(var i = 0; i < dataArray.length; i++) {
        var item = dataArray[i];
        var subtext = "";
        
        if (window.crmCurrentTab === 'pending') {
            subtext = '<p class="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-widest">' + item.days + ' Days Inactive</p>';
        } else if (window.crmCurrentTab === 'wip') {
            subtext = '<p class="text-[10px] font-bold text-amber-600 mt-1 uppercase tracking-widest">' + item.status + ' <span class="text-slate-400">(' + item.days + 'd)</span></p>';
        } else {
            subtext = '<p class="text-[10px] font-bold text-emerald-600 mt-1 uppercase tracking-widest">' + item.status + ' | ' + item.dateStr + '</p>';
        }

        html += `<div onclick="window.crmOpenInlineProfile('${item.cpn}')" 
                 class="p-4 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-indigo-50 hover:border-indigo-300 transition shadow-sm flex flex-col justify-between h-full">
            <div>
                <p class="font-black text-slate-800 text-lg">${item.cpn}</p>
                <p class="text-xs font-bold text-slate-600 truncate">${item.name}</p>
            </div>
            <div class="mt-2 pt-2 border-t border-slate-200">
                ${subtext}
            </div>
        </div>`;
    }

    if(container) container.innerHTML = html;
};

// =====================================
// INLINE 360 PROFILE & FORM MANAGER
// =====================================
window.crmOpenInlineProfile = async function(cpn) {
    document.getElementById('customer-360-view').classList.remove('hidden');
    document.getElementById('crm-header-title').innerText = cpn;
    
    // 1. Handle Completed Tab Lockout
    var formContainer = document.getElementById('crm-interaction-form');
    var existingClosedMsg = document.getElementById('crm-closed-message');

    if (window.crmCurrentTab === 'completed') {
        if (formContainer) formContainer.classList.add('hidden');
        if (!existingClosedMsg && formContainer) {
            var msg = document.createElement('div');
            msg.id = 'crm-closed-message';
            msg.className = "p-6 bg-slate-50 border-2 border-slate-200 rounded-2xl text-center mt-4";
            msg.innerHTML = '<p class="text-slate-500 font-black uppercase tracking-widest text-sm mb-1">Ticket Closed</p><p class="text-xs text-slate-400 font-bold">This interaction has already been logged and archived. No further action can be taken.</p>';
            formContainer.parentNode.insertBefore(msg, formContainer.nextSibling);
        } else if (existingClosedMsg) {
            existingClosedMsg.classList.remove('hidden');
        }
    } else {
        if (formContainer) formContainer.classList.remove('hidden');
        if (existingClosedMsg) existingClosedMsg.classList.add('hidden');
    }
    
    // 2. Call the Universal 360 Component in Inline Mode and capture context
    let ctx360 = null;
    if (typeof window.openCustomer360 === 'function') {
        ctx360 = await window.openCustomer360(cpn, true);
    } else {
        document.getElementById('crm-inline-profile').innerHTML = '<p class="text-rose-500 font-bold p-4">Error: 360 Module not loaded.</p>';
    }

    // 3. Handle Quick Close button visibility natively inside the CRM based on returned context!
    var qcBtn = document.getElementById('crm-quick-close-btn');
    if (qcBtn) {
        if (ctx360 && ctx360.activeOrder && window.crmCurrentTab !== 'completed') {
            qcBtn.classList.remove('hidden');
        } else {
            qcBtn.classList.add('hidden');
        }
    }

    // 4. Load Interaction Form Dropdowns
    var callStatusDropdown = document.getElementById('crm-call-status');
    if (callStatusDropdown && callStatusDropdown.options.length === 0) {
        const { data: setupOptions } = await window.supabase1.from('setup').select('key, value').in('key', ['call_statuses', 'final_status_options', 'dormancy_reasons']);
        if(setupOptions) {
            setupOptions.forEach(s => {
                var arr = s.value.split(',').map(x => x.trim());
                var optionsHtml = arr.map(x => `<option value="${x}">${x}</option>`).join('');
                if(s.key === 'call_statuses') callStatusDropdown.innerHTML = optionsHtml;
                if(s.key === 'final_status_options') document.getElementById('crm-cust-status').innerHTML = optionsHtml;
                if(s.key === 'dormancy_reasons') document.getElementById('crm-dorm-reason').innerHTML = optionsHtml;
            });
        }
    }

    // 5. Pre-fill Form from Latest Log
    if (window.crmCurrentTab !== 'completed') {
        const { data: latestLog } = await window.supabase1.from('crm_dormant_call_logs').select('*').eq('cpn_no', cpn).order('last_updated', {ascending: false}).limit(1).maybeSingle();
        
        if (latestLog) {
            if (callStatusDropdown && latestLog.call_status) callStatusDropdown.value = latestLog.call_status;
            var reasonDrop = document.getElementById('crm-dorm-reason');
            if (reasonDrop && latestLog.reason_for_dormancy) reasonDrop.value = latestLog.reason_for_dormancy;
            var remarkTxt = document.getElementById('crm-remark');
            if (remarkTxt) {
                remarkTxt.value = (latestLog.telecaller_feedback || "").replace("⚠️ [ADMIN REVIEW] ", "");
            }
        } else {
            var remarkTxt = document.getElementById('crm-remark');
            if (remarkTxt) remarkTxt.value = "";
        }
        var escalateChk = document.getElementById('crm-admin-escalate');
        if (escalateChk) escalateChk.checked = false;
    }
};

window.crmSubmitInteraction = async function() {
    var cpn = document.getElementById('crm-hidden-cpn').value;
    if(!cpn) return window.showToast ? window.showToast("Please select a lead first.", "warning") : alert("Select a lead first.");

    var btn = document.getElementById('btn-save-interaction');
    btn.innerText = "Processing..."; btn.disabled = true;

    try {
        var payload = {
            call_status: document.getElementById('crm-call-status').value,
            new_customer_status: document.getElementById('crm-cust-status').value,
            previous_customer_status: document.getElementById('crm-hidden-prev-status').value,
            reason_for_dormancy: document.getElementById('crm-dorm-reason').value,
            telecaller_feedback: document.getElementById('crm-remark').value,
            action_taken_by: window.activeAdminSession ? window.activeAdminSession.username : 'Telecaller',
            last_updated: new Date().toISOString()
        };

        if (document.getElementById('crm-admin-escalate').checked) {
            payload.telecaller_feedback = "⚠️ [ADMIN REVIEW] " + payload.telecaller_feedback;
        }

        const { error: err1 } = await window.supabase1.from('crm_dormant_call_logs').update(payload).eq('cpn_no', cpn);
        if(err1) throw err1;

        const { error: err2 } = await window.supabase1.from('ac_customers').update({ final_status: payload.new_customer_status }).eq('cpn_no', cpn);
        if(err2) throw err2;

        if (window.showToast) window.showToast("Interaction logged successfully!", "success");
        
        document.getElementById('customer-360-view').classList.add('hidden');
        window.crmLoadQueues();

    } catch(e) {
        if (window.showToast) window.showToast("Save Error: " + e.message, "error");
    } finally {
        btn.innerText = "Save Log"; btn.disabled = false;
    }
};

window.quickCloseInteraction = async function(cpn) {
    if (!confirm("Are you sure you want to close " + cpn + "? This will log them as 'Self-Activated'.")) return;

    var btn = document.getElementById('crm-quick-close-btn');
    if (btn) { btn.innerText = "Closing..."; btn.disabled = true; }

    try {
        var prevStatusEl = document.getElementById('crm-hidden-prev-status');
        var callStat = (window.crmSetupConfig.completedStatuses && window.crmSetupConfig.completedStatuses.length > 0) ? window.crmSetupConfig.completedStatuses[0] : "CONNECTED";

        var payload = {
            call_status: callStat,
            new_customer_status: "ACTIVE",
            previous_customer_status: prevStatusEl ? prevStatusEl.value : "Unknown",
            reason_for_dormancy: "Self-Activated",
            telecaller_feedback: "System Note: Customer placed an order independently. Ticket auto-closed via Quick Close.",
            action_taken_by: window.activeAdminSession ? window.activeAdminSession.username : 'System',
            last_updated: new Date().toISOString()
        };

        const { error: err1 } = await window.supabase1.from('crm_dormant_call_logs').update(payload).eq('cpn_no', cpn);
        if (err1) throw err1;

        const { error: err2 } = await window.supabase1.from('ac_customers').update({ final_status: "ACTIVE" }).eq('cpn_no', cpn);
        if (err2) throw err2;

        if (window.showToast) window.showToast("Ticket auto-closed successfully", "success");
        document.getElementById('customer-360-view').classList.add('hidden');
        window.crmLoadQueues();
        
    } catch(e) {
        if (window.showToast) window.showToast("Quick Close Error: " + e.message, "error");
        if (btn) { btn.innerText = "Mark Self-Activated"; btn.disabled = false; }
    }
};

window.tabActions['crm-workspace'] = function() {
    window.crmLoadQueues();
};