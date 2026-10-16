window.loadEscalationsData = async function () {
    var tb = document.getElementById('escalations-tbody');
    tb.innerHTML = "<tr><td colspan='4' class='px-6 py-12 text-center text-slate-500 font-bold text-2xl animate-pulse'>Scanning CRM logs...</td></tr>";

    try {
        const { data, error } = await supabase1
            .from('crm_dormant_call_logs')
            .select('*')
            .like('telecaller_feedback', '%⚠️ [ADMIN REVIEW REQUESTED]%')
            .order('last_updated', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            return tb.innerHTML = "<tr><td colspan='4' class='px-6 py-12 text-center font-bold text-slate-400 text-2xl'>No pending escalations. You're all caught up!</td></tr>";
        }

        var html = '';
        data.forEach(e => {
            var feedbackClean = (e.telecaller_feedback || "").replace("⚠️ [ADMIN REVIEW REQUESTED] - ", "").replace("⚠️ [ADMIN REVIEW REQUESTED]", "").trim();
            var dateStr = e.last_updated ? new Date(e.last_updated).toLocaleString('en-IN', {day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'}) : 'N/A';
            
            html += `<tr class='hover:bg-slate-50 border-b-4 border-slate-100'>
                <td class='px-6 py-5'><p class='font-black text-slate-800 text-xl'>${e.customer_name || 'Unknown'}</p><p class='text-sm font-bold text-blue-600 tracking-widest'>${e.cpn_no}</p><p class='text-xs font-bold text-slate-500 mt-1'>${e.phone || '-'}</p></td>
                <td class='px-6 py-5'><p class='font-bold text-slate-700 text-lg'>${e.action_taken_by || 'System'}</p><p class='text-xs font-black text-slate-400 uppercase tracking-widest'>${dateStr}</p></td>
                <td class='px-6 py-5 max-w-md'><div class='bg-red-50 border border-red-200 p-3 rounded-xl text-red-800 font-bold text-sm'>${feedbackClean}</div></td>
                <td class='px-6 py-5 text-center'><button onclick='window.resolveEscalation("${e.log_id}", "${e.telecaller_feedback}")' class='bg-emerald-600 text-white font-black px-4 py-2 rounded-xl shadow-sm hover:bg-emerald-700 transition active:scale-95'>Resolve</button></td>
            </tr>`;
        });
        tb.innerHTML = html;
    } catch (err) {
        tb.innerHTML = `<tr><td colspan='4' class='px-6 py-12 text-center font-bold text-red-500 text-xl'>Error: ${err.message}</td></tr>`;
    }
};

window.resolveEscalation = async function (logId, currentFeedback) {
    var note = prompt("Enter resolution notes:");
    if (note === null) return;
    if (note.trim() === "") note = "Resolved by Admin";
    
    try {
        var updatedFeedback = (currentFeedback || "").replace("⚠️ [ADMIN REVIEW REQUESTED]", `✅ [RESOLVED by Admin: ${note}]`);
        
        const { error } = await supabase1
            .from('crm_dormant_call_logs')
            .update({ telecaller_feedback: updatedFeedback })
            .eq('log_id', logId);

        if (error) throw error;
        alert("Ticket resolved successfully.");
        window.loadEscalationsData();
    } catch (err) {
        alert("Failed to resolve: " + err.message);
    }
};