window.activeCalView = 'BOTH';
window.salesCalendarData = null;

window.setSalesCalView = function (viewType) {
    window.activeCalView = viewType;

    var ids = ['btn-cal-cans', 'btn-cal-amt', 'btn-cal-both'];
    for (var i = 0; i < ids.length; i++) {
        document.getElementById(ids[i]).className = "flex-1 px-4 py-2 rounded-lg text-xs md:text-sm font-black text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors";
    }

    var activeMap = { 'CANS': 'btn-cal-cans', 'AMT': 'btn-cal-amt', 'BOTH': 'btn-cal-both' };
    document.getElementById(activeMap[viewType]).className = "flex-1 px-4 py-2 rounded-lg text-xs md:text-sm font-black bg-white dark:bg-slate-600 shadow-sm text-indigo-700 dark:text-indigo-300 transition-colors";

    if (window.salesCalendarData) window.renderSalesCalendar();
};

window.loadSalesCalendar = async function () {
    var weeks = parseInt(document.getElementById('sales-cal-weeks').value) || 4;
    document.getElementById('calendar-grid').innerHTML = "";
    document.getElementById('cal-loading').classList.remove('hidden');
    document.getElementById('cal-detail-section').classList.add('hidden');

    try {
        const supa = window.supabase1;
        if (!supa) throw new Error("Supabase not initialized");

        var now = new Date();
        var currentDayOfWeek = now.getDay(); 
        var currentSunday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - currentDayOfWeek);
        var startDate = new Date(currentSunday.getFullYear(), currentSunday.getMonth(), currentSunday.getDate() - ((weeks - 1) * 7)); 
        
        var startDateStr = startDate.getFullYear() + "-" + (startDate.getMonth() + 1).toString().padStart(2, '0') + "-" + startDate.getDate().toString().padStart(2, '0');

        const [salesRes, custRes] = await Promise.all([
            supa.from('sales').select('cpn_no, del_date, act_d, amount, apartment, block, door').gte('del_date', startDateStr),
            supa.from('ac_customers').select('cpn_no, poc1, con1, final_status, default_rate')
        ]);

        if (salesRes.error) throw salesRes.error;
        if (custRes.error) throw custRes.error;

        var cpnMap = {};
        (custRes.data || []).forEach(function(c) {
            if (c.cpn_no) {
                cpnMap[String(c.cpn_no).trim().toUpperCase()] = {
                    poc: c.poc1 || 'Unknown',
                    contact: c.con1 || '',
                    status: String(c.final_status || 'ACTIVE').toUpperCase(),
                    defRate: Number(c.default_rate || 0)
                };
            }
        });

        var summary = {};
        var details = {};
        
        (salesRes.data || []).forEach(function(s) {
            if (!s.del_date) return;
            var dKey = String(s.del_date).split('T')[0];
            
            var actD = Number(s.act_d || 0);
            var amt = Number(s.amount || 0);
            var cpnNo = String(s.cpn_no || '').trim().toUpperCase();

            if (!summary[dKey]) summary[dKey] = { actD: 0, amt: 0 };
            summary[dKey].actD += actD;
            summary[dKey].amt += amt;

            if (!details[dKey]) details[dKey] = [];
            var profile = cpnMap[cpnNo] || { poc: 'Unknown', contact: '', status: 'UNKNOWN', defRate: 0 }; 
            
            if (actD > 0 || amt > 0) {
                details[dKey].push({
                   cpn: cpnNo, poc: profile.poc, contact: profile.contact,
                   apt: s.apartment || '', blk: s.block || '', door: s.door || '', 
                   status: profile.status, defRate: profile.defRate,
                   actD: actD, amt: amt
                });
            }
        });

        window.salesCalendarData = { 
            success: true, 
            summary: summary, 
            details: details, 
            startDate: startDateStr, 
            totalDays: weeks * 7 
        };
        
        document.getElementById('cal-loading').classList.add('hidden');
        window.renderSalesCalendar();

    } catch (err) {
        document.getElementById('cal-loading').classList.add('hidden');
        alert("Error loading calendar: " + err.message);
        console.error(err);
    }
};

window.renderSalesCalendar = function () {
    if (!window.salesCalendarData) return;
    var data = window.salesCalendarData;
    var grid = document.getElementById('calendar-grid');
    var html = "";

    var startParts = data.startDate.split("-");
    var runnerDate = new Date(startParts[0], startParts[1] - 1, startParts[2]);

    var today = new Date();
    var todayKey = today.getFullYear() + "-" + (today.getMonth() + 1).toString().padStart(2, '0') + "-" + today.getDate().toString().padStart(2, '0');

    for (var i = 0; i < data.totalDays; i++) {
        var dKey = runnerDate.getFullYear() + "-" + (runnerDate.getMonth() + 1).toString().padStart(2, '0') + "-" + runnerDate.getDate().toString().padStart(2, '0');
        var dayData = data.summary[dKey] || { actD: 0, amt: 0 };

        var displayDay = runnerDate.getDate();
        if (displayDay === 1 || i === 0) displayDay = displayDay + " " + runnerDate.toLocaleString('default', { month: 'short' });

        var isFuture = runnerDate > today;
        var isToday = dKey === todayKey;

        var boxClass = "bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-100 dark:border-slate-800 transition-colors";
        if (isToday) boxClass = "bg-indigo-50 dark:bg-indigo-900/30 border-2 border-indigo-400 dark:border-indigo-600 shadow-inner ring-2 ring-indigo-200 dark:ring-indigo-800 transition-colors";
        else if (dayData.actD > 0 || dayData.amt > 0) boxClass = "bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-600 hover:border-indigo-400 dark:hover:border-indigo-400 hover:shadow-lg hover:-translate-y-1 cursor-pointer transition-all";

        var clickAction = (dayData.actD > 0 || dayData.amt > 0) ? "onclick=\"window.showSalesCalendarDetails('" + dKey + "', '" + displayDay + "')\"" : "";

        html += "<div class='flex flex-col p-1 md:p-1.5 rounded-xl " + boxClass + " min-h-[60px] md:min-h-[75px]' " + clickAction + ">";
        html += "<span class='text-[10px] md:text-xs font-bold text-slate-400 dark:text-slate-500 mb-1 text-center'>" + displayDay + "</span>";

        if (dayData.actD > 0 || dayData.amt > 0) {
            html += "<div class='mt-auto flex flex-col gap-1'>";
            if (window.activeCalView === 'CANS' || window.activeCalView === 'BOTH') {
                html += "<span class='bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-400 text-[10px] md:text-xs font-black px-1 py-0.5 rounded text-center truncate shadow-sm transition-colors'>" + dayData.actD + " 💧</span>";
            }
            if (window.activeCalView === 'AMT' || window.activeCalView === 'BOTH') {
                html += "<span class='bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-400 text-[10px] md:text-xs font-black px-1 py-0.5 rounded text-center truncate shadow-sm transition-colors'>₹" + dayData.amt.toLocaleString('en-IN') + "</span>";
            }
            html += "</div>";
        } else if (isFuture) {
            html += "<span class='mt-auto text-center text-[9px] md:text-[10px] font-bold text-slate-300 dark:text-slate-700 uppercase truncate transition-colors'>-</span>";
        }

        html += "</div>";
        runnerDate.setDate(runnerDate.getDate() + 1);
    }
    grid.innerHTML = html;
};

window.showSalesCalendarDetails = function (dateKey, displayDay) {
    var details = window.salesCalendarData.details[dateKey] || [];
    document.getElementById('cal-detail-title').innerText = "Sales on " + displayDay + " (" + details.length + " Customers)";

    var tbody = document.getElementById('cal-detail-tbody');
    var html = "";

    for (var i = 0; i < details.length; i++) {
        var r = details[i];

        var statusColor = r.status === "ACTIVE" ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700" : (r.status === "ACTIVE RANDOM" ? "bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-400 border-blue-300 dark:border-blue-700" : "bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-400 border-red-300 dark:border-red-700");
        var statusHtml = "<span class='px-3 py-1 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-widest border transition-colors " + statusColor + "'>" + r.status + "</span>";

        var expectedAmount = (r.actD || 0) * (r.defRate || 0);
        var isUnderpaid = (r.amt < expectedAmount && r.actD > 0);
        var amtClass = isUnderpaid ? "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-400 px-3 py-1 rounded-lg border-2 border-amber-300 dark:border-amber-700 transition-colors" : "text-emerald-600 dark:text-emerald-400 transition-colors";

        var waNum = String(r.contact).replace(/\D/g, '');
        var actionLinks = "";
        if (waNum) {
            actionLinks += "<a href='tel:" + waNum + "' target='_top' class='inline-block bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 px-3 py-1.5 rounded-lg text-xs font-black border border-blue-200 dark:border-blue-800 shadow-sm mr-1 hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-colors'>Call</a>";
            actionLinks += "<a href='https://wa.me/" + waNum + "' target='_blank' class='inline-block bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 px-3 py-1.5 rounded-lg text-xs font-black border border-emerald-200 dark:border-emerald-800 shadow-sm hover:bg-emerald-200 dark:hover:bg-emerald-900/60 transition-colors'>WA</a>";
        } else {
            actionLinks = "<span class='text-xs text-slate-400 dark:text-slate-500 font-bold'>No Number</span>";
        }

        let cpnBadgeHtml = `<span class="inline-flex items-center gap-1.5 px-2 py-0.5 mt-1 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/50 hover:shadow-sm active:scale-95 transition-all cursor-pointer group" onclick="window.openCustomer360('${r.cpn}')">
          ${r.cpn}
          <svg class="w-3.5 h-3.5 text-indigo-400 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
        </span>`;

        html += "<tr class='hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b-4 border-slate-100 dark:border-slate-700/50 transition-colors'>";
        html += "<td class='px-4 py-3 whitespace-normal'><p class='font-black text-slate-800 dark:text-white text-lg md:text-xl'>" + r.poc + "</p>" + cpnBadgeHtml + "</td>";
        html += "<td class='px-4 py-3'><p class='text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest'>" + r.apt + "</p><p class='font-black text-slate-700 dark:text-slate-300 text-base md:text-lg'>" + r.blk + " " + r.door + "</p></td>";
        html += "<td class='px-4 py-3 text-center'>" + statusHtml + "</td>"; 
        html += "<td class='px-4 py-3 text-center'><span class='inline-flex items-center justify-center w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-400 font-black text-xl border border-blue-200 dark:border-blue-800 shadow-sm transition-colors'>" + r.actD + "</span></td>";
        html += "<td class='px-4 py-3 text-right font-black text-xl md:text-2xl'><span class='" + amtClass + "'>₹" + r.amt.toLocaleString('en-IN') + "</span></td>";
        html += "<td class='px-4 py-3 text-center'>" + actionLinks + "</td>";
        html += "</tr>";
    }

    tbody.innerHTML = html;
    document.getElementById('cal-detail-section').classList.remove('hidden');
    document.getElementById('cal-detail-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
};

window.tabActions['sales-cal'] = window.loadSalesCalendar;