
// =====================================
  // 2. DAILY SALES REPORT 
  // =====================================
  window.generateDailySalesReport = function () {
    var monthStr = document.getElementById('report-month').value, tbody = document.getElementById('report-tbody');
    if (!monthStr) return alert("Select month.");
    tbody.innerHTML = "<tr><td colspan='4' class='px-6 py-12 text-center text-slate-500 animate-pulse font-bold text-2xl'>Calculating data...</td></tr>";
    google.script.run.withSuccessHandler(function (res) {
      if (!res.success) { tbody.innerHTML = "<tr><td colspan='4' class='px-6 py-12 text-center text-red-500 font-bold text-2xl'>" + res.message + "</td></tr>"; return; }
      if (res.data.length === 0) { tbody.innerHTML = "<tr><td colspan='4' class='px-6 py-12 text-center text-slate-400 font-bold text-2xl'>No records found.</td></tr>"; document.getElementById('sum-rev').innerText = "₹0.00"; document.getElementById('sum-cans').innerText = "0 Cans"; document.getElementById('sum-empties').innerText = "0 Units"; return; }
      var html = '', revSum = 0, canSum = 0, emptySum = 0;
      for (var i = 0; i < res.data.length; i++) {
        var row = res.data[i]; revSum += row.totalRevenue; canSum += row.totalCansDelivered; emptySum += row.totalEmptiesTaken;
        html += "<tr class='hover:bg-slate-50 transition border-b-4 border-slate-100'><td class='px-6 py-5 font-bold font-mono text-xl'>" + row.displayDate + "</td><td class='px-6 py-5 text-right font-black text-emerald-600 text-2xl'>₹" + row.totalRevenue.toFixed(2) + "</td><td class='px-6 py-5 text-center font-black text-2xl'>" + row.totalCansDelivered + "</td><td class='px-6 py-5 text-center font-black text-2xl'>" + row.totalEmptiesTaken + "</td></tr>";
      }
      tbody.innerHTML = html; document.getElementById('sum-rev').innerText = "₹" + revSum.toLocaleString('en-IN'); document.getElementById('sum-cans').innerText = canSum + " Cans"; document.getElementById('sum-empties').innerText = emptySum + " Units";
    }).getDailySalesSummary(monthStr);
  };

  