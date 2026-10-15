  window.loadEscalationsData = function () {
    var tb = document.getElementById('escalations-tbody');
    tb.innerHTML = "<tr><td colspan='4' class='px-6 py-12 text-center text-slate-500 font-bold text-2xl animate-pulse'>Scanning CRM logs...</td></tr>";

    google.script.run.withSuccessHandler(function (res) {
      if (!res.success) return tb.innerHTML = "<tr><td colspan='4' class='px-6 py-12 text-center font-bold text-red-500 text-xl'>" + res.message + "</td></tr>";
      if (res.data.length === 0) return tb.innerHTML = "<tr><td colspan='4' class='px-6 py-12 text-center font-bold text-slate-400 text-2xl'>No pending escalations. You're all caught up!</td></tr>";

      var html = '';
      for (var i = 0; i < res.data.length; i++) {
        var e = res.data[i];
        html += "<tr class='hover:bg-slate-50 border-b-4 border-slate-100'><td class='px-6 py-5'><p class='font-black text-slate-800 text-xl'>" + e.name + "</p><p class='text-sm font-bold text-blue-600 tracking-widest'>" + e.cpn + "</p><p class='text-xs font-bold text-slate-500 mt-1'>" + e.phone + "</p></td><td class='px-6 py-5'><p class='font-bold text-slate-700 text-lg'>" + e.agent + "</p><p class='text-xs font-black text-slate-400 uppercase tracking-widest'>" + e.date + "</p></td><td class='px-6 py-5 max-w-md'><div class='bg-red-50 border border-red-200 p-3 rounded-xl text-red-800 font-bold text-sm'>" + e.remark + "</div></td><td class='px-6 py-5 text-center'><button onclick='window.resolveEscalation(\"" + e.logId + "\", " + e.rowIdx + ")' class='bg-emerald-600 text-white font-black px-4 py-2 rounded-xl shadow-sm hover:bg-emerald-700 transition active:scale-95'>Resolve</button></td></tr>";
      }
      tb.innerHTML = html;
    }).fetchCRMEscalations();
  };

  window.resolveEscalation = function (logId, rowIdx) {
    var note = prompt("Enter resolution notes:");
    if (note === null) return;
    if (note.trim() === "") note = "Resolved by Admin";
    google.script.run.withSuccessHandler(function (res) { alert(res.message); if (res.success) window.loadEscalationsData(); }).resolveCRMEscalation(logId, rowIdx, note);
  };

