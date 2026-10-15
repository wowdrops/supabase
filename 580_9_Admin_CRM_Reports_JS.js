
  window.generateDormantConversionReport = function () {
    var s = document.getElementById('crm-rep-start').value, e = document.getElementById('crm-rep-end').value;
    if (!s || !e) return alert("Please select dates.");
    document.getElementById('crm-rep-content').classList.add('hidden'); document.getElementById('crm-rep-loading').classList.remove('hidden');

    google.script.run.withSuccessHandler(function (res) {
      document.getElementById('crm-rep-loading').classList.add('hidden');
      if (!res.success) return alert("Error: " + res.message);
      var d = res.data; document.getElementById('crm-rep-content').classList.remove('hidden');

      document.getElementById('crm-rep-total').innerText = d.totalCalls;
      document.getElementById('crm-rep-lost').innerText = d.activeToInactive;
      document.getElementById('crm-rep-pending').innerText = d.pendingCount;

      var lostHtml = '';
      if (d.lostCustomers.length === 0) lostHtml = '<p class="text-slate-400 font-bold text-center py-4">No customers moved to Inactive.</p>';
      else {
        for (var i = 0; i < d.lostCustomers.length; i++) {
          var c = d.lostCustomers[i];
          lostHtml += '<div class="flex justify-between items-center p-3 bg-slate-50 border border-slate-200 rounded-xl"><div><p class="font-black text-slate-800">' + c.name + ' <span class="text-xs text-blue-600 tracking-widest">' + c.cpn + '</span></p><p class="text-xs font-bold text-slate-500">' + c.reason + '</p></div><div class="text-xs font-black text-slate-400 bg-white px-2 py-1 border rounded">' + c.date + '</div></div>';
        }
      }
      document.getElementById('crm-rep-lost-list').innerHTML = lostHtml;

      var reasonHtml = '';
      var rKeys = Object.keys(d.reasons).sort(function (a, b) { return d.reasons[b] - d.reasons[a] });
      if (rKeys.length === 0) reasonHtml = '<p class="text-slate-400 font-bold text-center py-4">No data available.</p>';
      else {
        for (var j = 0; j < rKeys.length; j++) {
          reasonHtml += '<div class="flex justify-between items-center border-b border-slate-100 pb-2"><span class="font-bold text-sm text-slate-600">' + rKeys[j] + '</span><span class="font-black text-indigo-600 text-lg">' + d.reasons[rKeys[j]] + '</span></div>';
        }
      }
      document.getElementById('crm-rep-reasons').innerHTML = reasonHtml;
    }).getDormantConversionAnalytics(s, e);
  };
