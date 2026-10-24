window.loadEscalationsData = async function () {
    var tb = document.getElementById('escalations-tbody');
    var badge = document.getElementById('escalation-count-badge');
    
    if (tb) tb.innerHTML = "<tr><td colspan='4' class='px-6 py-12 text-center text-indigo-400 dark:text-indigo-500 font-bold text-xl animate-pulse tracking-widest uppercase transition-colors'>Scanning CRM logs...</td></tr>";

    try {
        const { data, error } = await window.supabase1
            .from('crm_dormant_call_logs')
            .select('*')
            .like('telecaller_feedback', '%⚠️ [ADMIN REVIEW]%')
            .order('last_updated', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            if (badge) badge.innerText = "0 Pending";
            if (tb) tb.innerHTML = "<tr><td colspan='4' class='px-6 py-16 text-center transition-colors'><div class='text-4xl mb-4'>🌟</div><p class='font-black text-slate-400 dark:text-slate-500 text-xl tracking-widest uppercase transition-colors'>No pending escalations. You're all caught up!</p></td></tr>";
            return;
        }

        if (badge) badge.innerText = data.length + " Pending";

        var html = '';
        data.forEach(e => {
            // Strip out the trigger flag to keep the UI clean
            var feedbackClean = (e.telecaller_feedback || "").replace("⚠️ [ADMIN REVIEW]", "").replace("⚠️ [ADMIN REVIEW REQUESTED]", "").trim();
            if (feedbackClean.startsWith("]")) feedbackClean = feedbackClean.substring(1).trim(); 
            
            var dateStr = e.last_updated ? new Date(e.last_updated).toLocaleString('en-IN', {day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'}) : 'N/A';
            var cleanCpn = String(e.cpn_no || '').trim().toUpperCase();

            html += `<tr class='hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-100 dark:border-slate-700/50'>
                <td class='px-6 py-5 whitespace-normal min-w-[200px]'>
                    <p class='font-black text-slate-800 dark:text-white text-lg mb-1 leading-tight transition-colors'>${e.customer_name || 'Unknown'}</p>
                    <span class="inline-flex items-center gap-1.5 px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/50 hover:shadow-sm active:scale-95 transition-all cursor-pointer group" onclick="window.openCustomer360('${cleanCpn}')">
                        <span class="font-black text-sm tracking-widest">${cleanCpn}</span>
                        <svg class="w-3.5 h-3.5 text-indigo-400 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                    </span>
                    <p class='text-[10px] font-bold text-slate-400 dark:text-slate-500 tracking-widest mt-1.5 uppercase transition-colors'>${e.phone || 'No Phone'}</p>
                </td>
                <td class='px-6 py-5 whitespace-normal'>
                    <p class='font-black text-slate-700 dark:text-slate-300 text-base transition-colors'>${e.action_taken_by || 'System'}</p>
                    <p class='text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1 transition-colors'>${dateStr}</p>
                </td>
                <td class='px-6 py-5 whitespace-normal min-w-[300px]'>
                    <div class='bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 p-3 rounded-xl text-rose-800 dark:text-rose-400 font-bold text-sm shadow-sm inline-block transition-colors'>
                       <span class="text-rose-500 dark:text-rose-400 font-black mr-1">⚠️</span> ${feedbackClean}
                    </div>
                </td>
                <td class='px-6 py-5 text-center'>
                    <button onclick='window.resolveEscalation("${e.log_id}", ${JSON.stringify(e.telecaller_feedback)})' class='bg-emerald-600 dark:bg-emerald-700 text-white font-black px-5 py-2.5 rounded-xl shadow-md hover:bg-emerald-700 dark:hover:bg-emerald-600 transition-colors active:scale-95 text-xs md:text-sm uppercase tracking-widest flex items-center justify-center gap-2 mx-auto'>
                       <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>
                       Resolve
                    </button>
                </td>
            </tr>`;
        });
        if (tb) tb.innerHTML = html;
        
    } catch (err) {
        if (tb) tb.innerHTML = `<tr><td colspan='4' class='px-6 py-12 text-center font-bold text-rose-500 dark:text-rose-400 text-xl transition-colors'>Error: ${err.message}</td></tr>`;
        if (window.showToast) window.showToast("Failed to load escalations.", "error");
    }
};

window.resolveEscalation = async function (logId, currentFeedback) {
    var note = prompt("Enter resolution notes (this will be appended to the log history):");
    if (note === null) return; 
    if (note.trim() === "") note = "Resolved by Admin";
    
    try {
        var updatedFeedback = (currentFeedback || "").replace(/⚠️ \[ADMIN REVIEW\]/g, `✅ [RESOLVED by Admin: ${note}]`).replace(/⚠️ \[ADMIN REVIEW REQUESTED\]/g, `✅ [RESOLVED by Admin: ${note}]`);
        
        const { error } = await window.supabase1
            .from('crm_dormant_call_logs')
            .update({ telecaller_feedback: updatedFeedback })
            .eq('log_id', logId);

        if (error) throw error;
        
        if (window.showToast) window.showToast("Ticket resolved successfully.", "success");
        window.loadEscalationsData();
        
    } catch (err) {
        if (window.showToast) window.showToast("Failed to resolve: " + err.message, "error");
        else alert("Failed to resolve: " + err.message);
    }
};

// SPA Standard Router Hook
window.tabActions['tran-escalations'] = function() {
    window.loadEscalationsData();
};