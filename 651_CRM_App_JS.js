window.crmQueues = { pending: [], wip: [], completed: [] };
window.crmCurrentTab = 'pending';
window.crmSortOrder = 'none';
window.crmSortMetricDirection = -1; 
window.crmSetupConfig = { wipStatuses: [], completedStatuses: [] };
window.crmDropdownsInitialized = false;

window.crmInitDropdowns = async function() {
    if (window.crmDropdownsInitialized) return;
    
    try {
        const { data: setupOptions, error } = await window.supabase1.from('setup').select('key, value')
            .in('key', ['Call_Statuses', 'WIP_Statuses', 'Completed_Statuses', 'Customer_Statuses', 'Dormancy_Reasons']);
            
        if(error) throw error;
        
        var callStatusDropdown = document.getElementById('crm-call-status');
        var custStatusDropdown = document.getElementById('crm-cust-status');
        var dormReasonDropdown = document.getElementById('crm-dorm-reason');

        if(setupOptions) {
            setupOptions.forEach(s => {
                var keyRaw = String(s.key).toLowerCase();
                var arr = s.value.split(',').map(x => x.trim());
                var optionsHtml = arr.map(x => `<option value="${x}">${x}</option>`).join('');
                
                if(keyRaw === 'call_statuses') {
                    if(callStatusDropdown) callStatusDropdown.innerHTML = optionsHtml;
                }
                if(keyRaw === 'wip_statuses') {
                    window.crmSetupConfig.wipStatuses = arr.map(x => x.toUpperCase());
                }
                if(keyRaw === 'completed_statuses') {
                    window.crmSetupConfig.completedStatuses = arr.map(x => x.toUpperCase());
                }
                if(keyRaw === 'customer_statuses') {
                    if(custStatusDropdown) custStatusDropdown.innerHTML = optionsHtml;
                }
                if(keyRaw === 'dormancy_reasons') {
                    if(dormReasonDropdown) dormReasonDropdown.innerHTML = optionsHtml;
                }
            });
            window.crmDropdownsInitialized = true;
        }
    } catch(e) {
        console.error("Failed to load CRM dropdown configurations:", e);
        if(window.showToast) window.showToast("Warning: Failed to load dropdown configurations.", "error");
    }
};

window.crmSwitchTab = function(tab) {
    window.crmCurrentTab = tab;
    
    ['pending', 'wip', 'completed', 'patterns', 'feedbacks'].forEach(t => {
        var el = document.getElementById('tab-' + t);
        if(!el) return;
        if (t === tab) el.className = "px-5 py-2.5 bg-indigo-600 dark:bg-indigo-700 text-white font-black rounded-t-xl text-sm uppercase tracking-widest transition-colors whitespace-nowrap";
        else el.className = "px-5 py-2.5 bg-transparent text-slate-500 dark:text-slate-400 font-black rounded-t-xl text-sm uppercase tracking-widest hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap";
    });

    var btnMetric = document.getElementById('btn-sort-metric');
    if (btnMetric) {
        if (tab === 'completed') btnMetric.innerText = "Newest First";
        else btnMetric.innerText = "Highest Days";
    }

    if (tab === 'patterns' || tab === 'feedbacks') {
        document.getElementById('queue-title').innerText = tab === 'patterns' ? 'Pattern Tracker' : 'Customer Feedbacks';
        document.getElementById('queue-count-badge').classList.add('hidden');
        document.getElementById('queue-list').innerHTML = '<div class="col-span-full p-6 bg-slate-50 dark:bg-slate-900 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-center transition-colors"><p class="text-slate-500 dark:text-slate-400 text-sm font-bold">Predictive AI module launching next phase.</p></div>';
        return;
    }

    document.getElementById('queue-count-badge').classList.remove('hidden');
    document.getElementById('customer-360-view').classList.add('hidden'); 
    window.crmApplyQueueFilters();
};

window.crmLoadQueues = async function() {
    var container = document.getElementById('queue-list');
    if(container) container.innerHTML = '<div class="col-span-full text-center py-10"><p class="text-sm font-bold text-indigo-500 dark:text-indigo-400 animate-pulse tracking-widest uppercase transition-colors">Syncing Live Queues...</p></div>';

    try {
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
        if(container) container.innerHTML = '<div class="col-span-full p-6 bg-rose-50 dark:bg-rose-900/20 border-2 border-rose-200 dark:border-rose-800 rounded-xl text-center transition-colors"><p class="text-sm font-bold text-rose-600 dark:text-rose-400">Error loading queues: ' + err.message + '</p></div>';
        if(window.showToast) window.showToast("Sync Error: " + err.message, "error");
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
    var badgeEl = document.getElementById('queue-count-badge');
    var titles = { 'pending': 'Pending Leads', 'wip': 'WIP / Follow-ups', 'completed': 'Recent History' };
    
    document.getElementById('queue-title').innerText = titles[window.crmCurrentTab];
    if(badgeEl) badgeEl.innerText = dataArray.length;
    
    if(dataArray.length === 0) {
        if(container) container.innerHTML = '<div class="col-span-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-center p-6 mt-4 transition-colors"><p class="text-slate-400 dark:text-slate-500 text-sm font-bold uppercase tracking-widest">Queue is Empty</p></div>';
        return;
    }
    
    var html = '';
    for(var i = 0; i < dataArray.length; i++) {
        var item = dataArray[i];
        var subtext = "";
        
        if (window.crmCurrentTab === 'pending') {
            subtext = '<p class="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-widest transition-colors">' + item.days + ' Days Inactive</p>';
        } else if (window.crmCurrentTab === 'wip') {
            subtext = '<p class="text-[10px] font-bold text-amber-600 dark:text-amber-500 mt-1 uppercase tracking-widest transition-colors">' + item.status + ' <span class="text-slate-400 dark:text-slate-500">(' + item.days + 'd)</span></p>';
        } else {
            subtext = '<p class="text-[10px] font-bold text-emerald-600 dark:text-emerald-500 mt-1 uppercase tracking-widest transition-colors">' + item.status + ' <span class="text-slate-400 dark:text-slate-500 ml-1">| ' + item.dateStr + '</span></p>';
        }

        html += `<div onclick="window.crmOpenInlineProfile('${item.cpn}')" 
                 class="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:bg-indigo-50 dark:hover:bg-slate-800 hover:border-indigo-300 dark:hover:border-slate-600 transition-colors shadow-sm flex flex-col justify-between h-full mb-2 active:scale-[0.98]">
            <div>
                <p class="font-black text-slate-800 dark:text-white text-lg">${item.cpn}</p>
                <p class="text-xs font-bold text-slate-600 dark:text-slate-400 truncate">${item.name}</p>
            </div>
            <div class="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 transition-colors">
                ${subtext}
            </div>
        </div>`;
    }

    if(container) container.innerHTML = html;
};

window.crmOpenInlineProfile = async function(cpn) {
    document.getElementById('customer-360-view').classList.remove('hidden');
    document.getElementById('crm-header-title').innerText = cpn;
    document.getElementById('crm-hidden-cpn').value = cpn;
    
    var formContainer = document.getElementById('crm-interaction-form');
    var existingClosedMsg = document.getElementById('crm-closed-message');

    if (window.crmCurrentTab === 'completed') {
        if (formContainer) formContainer.classList.add('hidden');
        if (!existingClosedMsg && formContainer) {
            var msg = document.createElement('div');
            msg.id = 'crm-closed-message';
            msg.className = "p-6 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-center mt-4 shadow-inner transition-colors";
            msg.innerHTML = '<p class="text-slate-500 dark:text-slate-400 font-black uppercase tracking-widest text-sm mb-1">Ticket Closed</p><p class="text-xs text-slate-400 dark:text-slate-500 font-bold">This interaction has already been logged and archived. No further action can be taken.</p>';
            formContainer.parentNode.insertBefore(msg, formContainer.nextSibling);
        } else if (existingClosedMsg) {
            existingClosedMsg.classList.remove('hidden');
        }
    } else {
        if (formContainer) formContainer.classList.remove('hidden');
        if (existingClosedMsg) existingClosedMsg.classList.add('hidden');
    }
    
    let ctx360 = null;
    if (typeof window.openCustomer360 === 'function') {
        ctx360 = await window.openCustomer360(cpn, true);
    } else {
        document.getElementById('crm-inline-profile').innerHTML = '<p class="text-rose-500 font-bold p-4">Error: Universal 360 Module not loaded.</p>';
    }

    if (ctx360 && ctx360.profile) {
        document.getElementById('crm-hidden-prev-status').value = ctx360.profile.final_status || "Unknown";
    }

    var qcBtn = document.getElementById('crm-quick-close-btn');
    if (qcBtn) {
        if (ctx360 && ctx360.activeOrder && window.crmCurrentTab !== 'completed') {
            qcBtn.classList.remove('hidden');
        } else {
            qcBtn.classList.add('hidden');
        }
    }

    if (window.crmCurrentTab !== 'completed') {
        const { data: latestLog } = await window.supabase1.from('crm_dormant_call_logs').select('*').eq('cpn_no', cpn).order('last_updated', {ascending: false}).limit(1).maybeSingle();
        
        var callStatusDropdown = document.getElementById('crm-call-status');
        var reasonDrop = document.getElementById('crm-dorm-reason');
        var remarkTxt = document.getElementById('crm-remark');
        var escalateChk = document.getElementById('crm-admin-escalate');

        if (latestLog) {
            if (callStatusDropdown && latestLog.call_status) callStatusDropdown.value = latestLog.call_status;
            if (reasonDrop && latestLog.reason_for_dormancy) reasonDrop.value = latestLog.reason_for_dormancy;
            if (remarkTxt) remarkTxt.value = (latestLog.telecaller_feedback || "").replace("⚠️ [ADMIN REVIEW] ", "");
        } else {
            if (remarkTxt) remarkTxt.value = "";
        }
        if (escalateChk) escalateChk.checked = false;
    }
};

window.crmSubmitInteraction = async function() {
    var cpn = document.getElementById('crm-hidden-cpn').value;
    if(!cpn) return window.showToast ? window.showToast("Please select a lead first.", "warning") : alert("Select a lead first.");

    var btn = document.getElementById('btn-save-interaction');
    btn.innerHTML = '<svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Processing...'; 
    btn.disabled = true;

    try {
        var payload = {
            call_status: document.getElementById('crm-call-status').value,
            new_customer_status: document.getElementById('crm-cust-status').value,
            previous_customer_status: document.getElementById('crm-hidden-prev-status').value || "Unknown",
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
        btn.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg> Save Log'; 
        btn.disabled = false;
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

window.tabActions['crm-workspace'] = async function() {
    await window.crmInitDropdowns();
    window.crmLoadQueues();
};