window.generateDormantConversionReport = async function () {
    var s = document.getElementById('crm-rep-start').value, e = document.getElementById('crm-rep-end').value;
    if (!s || !e) return alert("Please select dates.");
    document.getElementById('crm-rep-content').classList.add('hidden'); document.getElementById('crm-rep-loading').classList.remove('hidden');

    try {
        var start = new Date(s); start.setHours(0, 0, 0, 0);
        var end = new Date(e); end.setHours(23, 59, 59, 999);

        const { data, error } = await supabase1
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
        if (d.lostCustomers.length === 0) lostHtml = '<p class="text-slate-400 font-bold text-center py-4">No customers moved to Inactive.</p>';
        else {
            d.lostCustomers.forEach(c => {
                lostHtml += '<div class="flex justify-between items-center p-3 bg-slate-50 border border-slate-200 rounded-xl"><div><p class="font-black text-slate-800">' + c.name + ' <span class="text-xs text-blue-600 tracking-widest">' + c.cpn + '</span></p><p class="text-xs font-bold text-slate-500">' + c.reason + '</p></div><div class="text-xs font-black text-slate-400 bg-white px-2 py-1 border rounded">' + c.date + '</div></div>';
            });
        }
        document.getElementById('crm-rep-lost-list').innerHTML = lostHtml;

        var reasonHtml = '';
        var rKeys = Object.keys(d.reasons).sort((a, b) => d.reasons[b] - d.reasons[a]);
        if (rKeys.length === 0) reasonHtml = '<p class="text-slate-400 font-bold text-center py-4">No data available.</p>';
        else {
            rKeys.forEach(k => {
                reasonHtml += '<div class="flex justify-between items-center border-b border-slate-100 pb-2"><span class="font-bold text-sm text-slate-600">' + k + '</span><span class="font-black text-indigo-600 text-lg">' + d.reasons[k] + '</span></div>';
            });
        }
        document.getElementById('crm-rep-reasons').innerHTML = reasonHtml;

    } catch(err) {
        alert("Error: " + err.message);
    } finally {
        document.getElementById('crm-rep-loading').classList.add('hidden');
    }
};