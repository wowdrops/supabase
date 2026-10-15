

    window.activeCalView = 'BOTH';
    window.salesCalendarData = null;

    window.setSalesCalView = function (viewType) {
        window.activeCalView = viewType;

        var ids = ['btn-cal-cans', 'btn-cal-amt', 'btn-cal-both'];
        for (var i = 0; i < ids.length; i++) {
            document.getElementById(ids[i]).className = "flex-1 px-4 py-2 rounded-lg text-xs md:text-sm font-black text-slate-500 hover:text-slate-800 transition";
        }

        var activeMap = { 'CANS': 'btn-cal-cans', 'AMT': 'btn-cal-amt', 'BOTH': 'btn-cal-both' };
        document.getElementById(activeMap[viewType]).className = "flex-1 px-4 py-2 rounded-lg text-xs md:text-sm font-black bg-white shadow-sm text-indigo-700 transition";

        if (window.salesCalendarData) window.renderSalesCalendar();
    };

    window.loadSalesCalendar = function () {
        var weeks = parseInt(document.getElementById('sales-cal-weeks').value) || 4;
        document.getElementById('calendar-grid').innerHTML = "";
        document.getElementById('cal-loading').classList.remove('hidden');
        document.getElementById('cal-detail-section').classList.add('hidden');

        google.script.run.withSuccessHandler(function (res) {
            document.getElementById('cal-loading').classList.add('hidden');
            if (!res.success) return alert(res.message);
            window.salesCalendarData = res;
            window.renderSalesCalendar();
        }).getSalesCalendarData(weeks);
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

            var boxClass = "bg-slate-50 border-2 border-slate-100";
            if (isToday) boxClass = "bg-indigo-50 border-2 border-indigo-400 shadow-inner ring-2 ring-indigo-200";
            else if (dayData.actD > 0 || dayData.amt > 0) boxClass = "bg-white border-2 border-slate-200 hover:border-indigo-400 hover:shadow-lg hover:-translate-y-1 cursor-pointer transition-all";

            var clickAction = (dayData.actD > 0 || dayData.amt > 0) ? "onclick=\"window.showSalesCalendarDetails('" + dKey + "', '" + displayDay + "')\"" : "";

            // Reduced padding and minimum heights for a more compact card
            html += "<div class='flex flex-col p-1 md:p-1.5 rounded-xl " + boxClass + " min-h-[60px] md:min-h-[75px]' " + clickAction + ">";
            html += "<span class='text-[10px] md:text-xs font-bold text-slate-400 mb-1 text-center'>" + displayDay + "</span>";

            if (dayData.actD > 0 || dayData.amt > 0) {
                html += "<div class='mt-auto flex flex-col gap-1'>";
                if (window.activeCalView === 'CANS' || window.activeCalView === 'BOTH') {
                    html += "<span class='bg-blue-100 text-blue-800 text-[10px] md:text-xs font-black px-1 py-0.5 rounded text-center truncate shadow-sm'>" + dayData.actD + " 💧</span>";
                }
                if (window.activeCalView === 'AMT' || window.activeCalView === 'BOTH') {
                    html += "<span class='bg-emerald-100 text-emerald-800 text-[10px] md:text-xs font-black px-1 py-0.5 rounded text-center truncate shadow-sm'>₹" + dayData.amt.toLocaleString('en-IN') + "</span>";
                }
                html += "</div>";
            } else if (isFuture) {
                html += "<span class='mt-auto text-center text-[9px] md:text-[10px] font-bold text-slate-300 uppercase truncate'>-</span>";
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

            // 1. DYNAMIC STATUS BADGE
            var statusColor = r.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-red-100 text-red-800 border-red-300";
            var statusHtml = "<span class='px-3 py-1 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-widest border " + statusColor + "'>" + r.status + "</span>";

            // 2. UNDERPAYMENT HIGHLIGHT MATH
            var expectedAmount = (r.actD || 0) * (r.defRate || 0);
            var isUnderpaid = (r.amt < expectedAmount && r.actD > 0);
            var amtClass = isUnderpaid ? "bg-amber-100 text-amber-800 px-3 py-1 rounded-lg border-2 border-amber-300" : "text-emerald-600";

            // 3. CONTACT BUTTONS
            var waNum = String(r.contact).replace(/\D/g, '');
            var actionLinks = "";
            if (waNum) {
                actionLinks += "<a href='tel:" + waNum + "' target='_top' class='inline-block bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-black border border-blue-200 shadow-sm mr-1 hover:bg-blue-200 transition'>Call</a>";
                actionLinks += "<a href='https://wa.me/" + waNum + "' target='_blank' class='inline-block bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg text-xs font-black border border-emerald-200 shadow-sm hover:bg-emerald-200 transition'>WA</a>";
            } else {
                actionLinks = "<span class='text-xs text-slate-400 font-bold'>No Number</span>";
            }

            // 4. BUILD THE ROW
            html += "<tr class='hover:bg-slate-50 border-b-4 border-slate-100'>";
            html += "<td class='px-4 py-3 whitespace-normal'><p class='font-black text-slate-800 text-lg md:text-xl'>" + r.poc + "</p><p class='text-xs text-indigo-600 font-bold tracking-widest'>" + r.cpn + "</p></td>";
            html += "<td class='px-4 py-3'><p class='text-xs font-bold text-slate-500 uppercase tracking-widest'>" + r.apt + "</p><p class='font-black text-slate-700 text-base md:text-lg'>" + r.blk + " " + r.door + "</p></td>";
            
            // NEW STATUS COLUMN INSERTED HERE
            html += "<td class='px-4 py-3 text-center'>" + statusHtml + "</td>"; 
            
            html += "<td class='px-4 py-3 text-center'><span class='inline-flex items-center justify-center w-10 h-10 rounded-xl bg-blue-100 text-blue-800 font-black text-xl border border-blue-200 shadow-sm'>" + r.actD + "</span></td>";
            html += "<td class='px-4 py-3 text-right font-black text-xl md:text-2xl'><span class='" + amtClass + "'>₹" + r.amt.toLocaleString('en-IN') + "</span></td>";
            html += "<td class='px-4 py-3 text-center'>" + actionLinks + "</td>";
            html += "</tr>";
        }

        tbody.innerHTML = html;
        document.getElementById('cal-detail-section').classList.remove('hidden');
        document.getElementById('cal-detail-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

