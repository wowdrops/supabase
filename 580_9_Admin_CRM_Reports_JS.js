window.generateDormantConversionReport = async function () {
    var s = document.getElementById('crm-rep-start').value;
    var e = document.getElementById('crm-rep-end').value;
    
    if (!s || !e) return alert("Please select dates.");
    
    document.getElementById('crm-rep-content').classList.add('hidden'); 
    document.getElementById('crm-rep-loading').classList.remove('hidden');

    try {
        var start = new Date(s); start.setHours(0, 0, 0, 0);
        var end = new Date(e); end.setHours(23, 59, 59, 999);

        const { data, error } = await window.supabase1
            .from('crm_dormant_call_logs')
            .select('*')
            .gte('last_updated', start.toISOString())
            .lte('last_updated', end.toISOString());

        if (error) throw error;

        var d = { totalCalls: 0, activeToInactive: 0, pendingCount: 0, lostCustomers: [], reasons: {}, agents: {} };

        if (data) {
            data.forEach(row => {
                var status = String(row.call_status || "").trim().toLowerCase();
                if (status === "" || status === "pending") { d.pendingCount++; return; }
                
                d.totalCalls++;
                var prevStatus = String(row.previous_customer_status || "").trim().toUpperCase();
                var newStatus = String(row.new_customer_status || "").trim().toUpperCase();
                var reason = String(row.reason_for_dormancy || "").trim() || "Unspecified";
                var agent = String(row.action_taken_by || "").trim() || "Unknown";
                
                if (prevStatus === "ACTIVE" && newStatus === "INACTIVE") {
                    d.activeToInactive++;
                    d.lostCustomers.push({ 
                        cpn: String(row.cpn_no).trim(), name: String(row.customer_name).trim(), 
                        date: new Date(row.last_updated).toLocaleDateString('en-IN', {day: '2-digit', month: 'short'}), reason: reason 
                    });
                }
                d.reasons[reason] = (d.reasons[reason] || 0) + 1;
                d.agents[agent] = (d.agents[agent] || 0) + 1;
            });
        }

        document.getElementById('crm-rep-content').classList.remove('hidden');
        document.getElementById('crm-rep-total').innerText = d.totalCalls;
        document.getElementById('crm-rep-lost').innerText = d.activeToInactive;
        document.getElementById('crm-rep-pending').innerText = d.pendingCount;

        var lostHtml = '';
        if (d.lostCustomers.length === 0) {
            lostHtml = '<p class="text-slate-400 dark:text-slate-500 font-bold text-center py-4 transition-colors">No customers moved to Inactive.</p>';
        } else {
            d.lostCustomers.forEach(c => {
                let cpnBadgeHtml = `<span class="inline-flex items-center gap-1.5 px-2 py-0.5 ml-2 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/50 hover:shadow-sm active:scale-95 transition-all cursor-pointer group" onclick="window.openCustomer360('${c.cpn}')">
                  ${c.cpn}
                  <svg class="w-3 h-3 text-indigo-400 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                </span>`;
                
                lostHtml += '<div class="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl transition-colors"><div><p class="font-black text-slate-800 dark:text-white flex items-center">' + c.name + cpnBadgeHtml + '</p><p class="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">' + c.reason + '</p></div><div class="text-[10px] font-black text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-800 px-2 py-1 border border-slate-200 dark:border-slate-700 rounded transition-colors uppercase tracking-widest">' + c.date + '</div></div>';
            });
        }
        document.getElementById('crm-rep-lost-list').innerHTML = lostHtml;

        var reasonHtml = '';
        var rKeys = Object.keys(d.reasons).sort((a, b) => d.reasons[b] - d.reasons[a]);
        if (rKeys.length === 0) {
            reasonHtml = '<p class="text-slate-400 dark:text-slate-500 font-bold text-center py-4 transition-colors">No data available.</p>';
        } else {
            rKeys.forEach(k => {
                reasonHtml += '<div class="flex justify-between items-center border-b border-slate-100 dark:border-slate-700/50 pb-2 mb-2 transition-colors"><span class="font-bold text-sm text-slate-600 dark:text-slate-300">' + k + '</span><span class="font-black text-indigo-600 dark:text-indigo-400 text-lg">' + d.reasons[k] + '</span></div>';
            });
        }
        document.getElementById('crm-rep-reasons').innerHTML = reasonHtml;

    } catch(err) {
        alert("Error: " + err.message);
    } finally {
        document.getElementById('crm-rep-loading').classList.add('hidden');
    }
};

window.tabActions['crm-reports'] = function() {
    var startEl = document.getElementById('crm-rep-start');
    var endEl = document.getElementById('crm-rep-end');
    
    if (startEl && !startEl.value) {
      var today = new Date(); 
      var lastWeek = new Date(); 
      lastWeek.setDate(today.getDate() - 7);
      
      var offset = today.getTimezoneOffset() * 60000;
      var localToday = (new Date(today - offset)).toISOString().split('T')[0];
      var localLastWeek = (new Date(lastWeek - offset)).toISOString().split('T')[0];
      
      startEl.value = localLastWeek;
      if (endEl) endEl.value = localToday;
    }
    
    window.generateDormantConversionReport();
};