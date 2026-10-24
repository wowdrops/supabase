// =====================================
// 2. DAILY SALES REPORT (Supabase)
// =====================================
window.generateDailySalesReport = async function () {
  var monthStr = document.getElementById('report-month').value;
  var tbody = document.getElementById('report-tbody');
  
  if (!monthStr) return alert("Please select a month.");
  
  tbody.innerHTML = "<tr><td colspan='4' class='px-6 py-12 text-center text-slate-500 dark:text-slate-400 animate-pulse font-bold text-2xl'>Fetching data from Supabase...</td></tr>";
  
  try {
    const [yearStr, monthNumStr] = monthStr.split('-');
    const startYear = parseInt(yearStr, 10);
    const startMonth = parseInt(monthNumStr, 10) - 1; 
    
    const startDateStr = `${yearStr}-${monthNumStr}-01`;
    
    const nextMonthDate = new Date(startYear, startMonth + 1, 1);
    const endYear = nextMonthDate.getFullYear();
    const endMonth = String(nextMonthDate.getMonth() + 1).padStart(2, '0');
    const endDateStr = `${endYear}-${endMonth}-01`;

    const { data: salesData, error: salesErr } = await window.supabase1
      .from('sales')
      .select('del_date, act_d, act_e, amount')
      .gte('del_date', startDateStr)
      .lt('del_date', endDateStr);

    if (salesErr) throw salesErr;

    if (!salesData || salesData.length === 0) {
      tbody.innerHTML = "<tr><td colspan='4' class='px-6 py-12 text-center text-slate-400 dark:text-slate-500 font-bold text-2xl'>No records found for this month.</td></tr>";
      document.getElementById('sum-rev').innerText = "₹0.00";
      document.getElementById('sum-cans').innerText = "0 Cans";
      document.getElementById('sum-empties').innerText = "0 Units";
      return;
    }

    const summaryMap = {};
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    salesData.forEach(row => {
      if (!row.del_date) return;
      
      const dateParts = row.del_date.split('T')[0].split('-');
      const dObj = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
      const dateKey = `${dateParts[0]}-${dateParts[1]}-${dateParts[2]}`;
      
      if (!summaryMap[dateKey]) {
        const displayDate = `${days[dObj.getDay()]}, ${String(dObj.getDate()).padStart(2, '0')} ${months[dObj.getMonth()]} ${dObj.getFullYear()}`;
        summaryMap[dateKey] = {
          dateKey: dateKey,
          displayDate: displayDate,
          totalCansDelivered: 0,
          totalEmptiesTaken: 0,
          totalRevenue: 0
        };
      }
      
      summaryMap[dateKey].totalCansDelivered += (Number(row.act_d) || 0);
      summaryMap[dateKey].totalEmptiesTaken += (Number(row.act_e) || 0);
      summaryMap[dateKey].totalRevenue += (Number(row.amount) || 0);
    });

    const compiledList = Object.values(summaryMap).sort((a, b) => new Date(a.dateKey) - new Date(b.dateKey));

    var html = '', revSum = 0, canSum = 0, emptySum = 0;
    
    compiledList.forEach(row => {
      revSum += row.totalRevenue;
      canSum += row.totalCansDelivered;
      emptySum += row.totalEmptiesTaken;
      
      html += `<tr class='hover:bg-slate-50 dark:hover:bg-slate-700/50 transition border-b-4 border-slate-100 dark:border-slate-700/50'>
        <td class='px-6 py-5 font-bold font-mono text-xl text-slate-600 dark:text-slate-300'>${row.displayDate}</td>
        <td class='px-6 py-5 text-right font-black text-emerald-600 dark:text-emerald-400 text-2xl'>₹${row.totalRevenue.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
        <td class='px-6 py-5 text-center font-black text-2xl text-slate-700 dark:text-white'>${row.totalCansDelivered}</td>
        <td class='px-6 py-5 text-center font-black text-2xl text-amber-600 dark:text-amber-400'>${row.totalEmptiesTaken}</td>
      </tr>`;
    });

    tbody.innerHTML = html;
    document.getElementById('sum-rev').innerText = "₹" + revSum.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    document.getElementById('sum-cans').innerText = canSum + " Cans";
    document.getElementById('sum-empties').innerText = emptySum + " Units";

  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan='4' class='px-6 py-12 text-center text-red-500 dark:text-red-400 font-bold text-2xl'>Database Error: ${err.message}</td></tr>`;
  }
};