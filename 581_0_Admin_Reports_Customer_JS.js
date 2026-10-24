window.crMasterData = [];
window.crLogsData = [];
window.crFilteredData = [];
window.crCurrentReportType = '';

window.loadCustomerAnalyticsData = async function (filterArg) {
  var tb = document.getElementById('rpt-cust-tbody');
  tb.innerHTML = "<tr><td colspan='6' class='px-6 py-12 text-center text-slate-400 dark:text-slate-500 font-bold text-2xl animate-pulse transition-colors'>Fetching Database...</td></tr>";
  
  try {
      const supa = window.supabase1;
      
      var thirtyDaysAgoDate = new Date();
      thirtyDaysAgoDate.setDate(thirtyDaysAgoDate.getDate() - 30);
      var thirtyDaysAgoStr = thirtyDaysAgoDate.toISOString();

      const [custRes, logsRes] = await Promise.all([
          supa.from('ac_customers').select('*').order('created_at', {ascending: false}),
          supa.from('crm_dormant_call_logs').select('*').gte('created_at', thirtyDaysAgoStr).order('created_at', {ascending: false})
      ]);

      if (custRes.error) throw custRes.error;
      if (logsRes.error) throw logsRes.error;
      
      window.crMasterData = custRes.data || [];
      window.crLogsData = logsRes.data || [];

      var allStatuses = window.crMasterData.map(c => String(c.final_status || 'UNKNOWN').toUpperCase().trim());
      var uniqueStatuses = [...new Set(allStatuses)].filter(Boolean).sort();
      
      var statusDrop = document.getElementById('rpt-cust-status');
      var html = '<option value="ALL">ALL STATUSES</option>';
      uniqueStatuses.forEach(s => html += `<option value="${s}">${s}</option>`);
      statusDrop.innerHTML = html;

      if (filterArg) {
          let parts = filterArg.split('|');
          if (parts.length === 2) {
              statusDrop.value = parts[0];
              document.getElementById('rpt-cust-type').value = parts[1];
          }
      } else {
          statusDrop.value = "ACTIVE"; 
          document.getElementById('rpt-cust-type').value = "ADVANCE"; 
      }

      window.generateCustomerReport();

  } catch (err) {
      tb.innerHTML = "<tr><td colspan='6' class='px-6 py-12 text-center text-red-500 dark:text-red-400 font-bold text-2xl transition-colors'>Database Error: " + err.message + "</td></tr>";
  }
};

window.generateCustomerReport = function () {
  if (window.crMasterData.length === 0) return;

  var statusFilter = document.getElementById('rpt-cust-status').value;
  var reportType = document.getElementById('rpt-cust-type').value;
  window.crCurrentReportType = reportType;

  if (reportType === 'CHURN_30_DAYS') {
      window.crFilteredData = window.crLogsData.filter(function (log) {
          var prev = String(log.previous_customer_status || '').toUpperCase().trim();
          var curr = String(log.new_customer_status || '').toUpperCase().trim();
          return (prev === 'ACTIVE' && curr === 'INACTIVE');
      });
      window.renderCustomerReportUI(reportType);
      return;
  }

  window.crFilteredData = window.crMasterData.filter(function (c) {
    if (statusFilter !== "ALL" && String(c.final_status).toUpperCase().trim() !== statusFilter) return false;
    
    var advance = Number(c.can_deposit) || 0;
    var dRate = Number(c.default_rate) || 0;
    var pType = String(c.pay_type || '').toUpperCase().trim();
    var fStat = String(c.final_status || '').toUpperCase().trim();
    var cWaiver = c.waiver_request === true || String(c.waiver_request).toUpperCase() === 'TRUE';
    var oWaiver = c.overdue_waiver === true || String(c.overdue_waiver).toUpperCase() === 'TRUE';
    
    switch (reportType) {
      case 'ADVANCE': return advance > 0;
      case 'NO_ADVANCE': return advance === 0;
      case 'PAY_CASH': return pType === 'CASH';
      case 'PAY_ONLINE': return pType === 'ONLINE';
      case 'PAY_NODATA': return pType !== 'CASH' && pType !== 'ONLINE';
      case 'HIGH_RISK': return advance === 0 && (c.default_rate > 0); 
      case 'INACTIVE_NO_REASON': return fStat === 'INACTIVE' && !c.inactive_reason;
      case 'INACTIVE_BY_REASON': return fStat === 'INACTIVE';
      case 'ZERO_RATE': return dRate === 0;
      case 'NO_CONTACT': return !c.con1 || !c.email;
      case 'NO_PASSWORD': return !c.password;
      case 'MISSING_DELIVERY': return !c.del_color || !c.apartment || !c.block || !c.door;
      case 'DELIVERY_COLOR': return true; 
      case 'WAIVERS': return cWaiver || oWaiver;
      case 'HIGH_LIMIT': return false;
      case 'CUSTOMER_LIST': return true;
      case 'CUSTOMER_JOINED_LAST30DAYS': {
        if (!c.created_at) return false;
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return new Date(c.created_at) >= thirtyDaysAgo;
      }
      default: return false;
    }
  });

  if (reportType === 'DELIVERY_COLOR') {
    window.crFilteredData.sort((a, b) => String(a.del_color || '').localeCompare(String(b.del_color || '')));
  }
  else if (reportType === 'INACTIVE_BY_REASON') {
    window.crFilteredData.sort((a, b) => String(a.inactive_reason || '').localeCompare(String(b.inactive_reason || '')));
  }

  window.renderCustomerReportUI(reportType);
};

window.renderCustomerReportUI = function (reportType) {
  var kpiContainer = document.getElementById('rpt-cust-kpis');
  var thead = document.getElementById('rpt-cust-thead');
  var tbody = document.getElementById('rpt-cust-tbody');

  var count = window.crFilteredData.length;
  var kpisHtml = '';
  var headHtml = '<tr><th class="px-6 py-4 text-left border-b-4 border-slate-700">CPN & Customer</th><th class="px-6 py-4 text-left border-b-4 border-slate-700">Location</th><th class="px-6 py-4 text-left border-b-4 border-slate-700">Status</th>';

  if (reportType === 'ADVANCE') {
    var totalAdv = 0;
    window.crFilteredData.forEach(function(c) { totalAdv += (Number(c.can_deposit) || 0); });
    kpisHtml = buildKPI('Total Customers', count, 'blue') + buildKPI('Total Deposit Held', '₹' + totalAdv.toLocaleString(), 'emerald');
    headHtml += '<th class="px-6 py-4 text-right border-b-4 border-slate-700">Can Deposit (₹)</th></tr>';
  } 
  else if (reportType === 'NO_ADVANCE') {
    kpisHtml = buildKPI('Zero Deposit', count, 'rose');
    headHtml += '<th class="px-6 py-4 text-center border-b-4 border-slate-700">Deposit Status</th></tr>';
  }
  else if (reportType === 'PAY_CASH' || reportType === 'PAY_ONLINE' || reportType === 'PAY_NODATA') {
    kpisHtml = buildKPI('Total Matching', count, 'amber');
    headHtml += '<th class="px-6 py-4 text-center border-b-4 border-slate-700">Pay Type</th></tr>';
  }
  else if (reportType === 'CHURN_30_DAYS') {
    kpisHtml = buildKPI('Total Churned', count, 'rose');
    headHtml = '<tr><th class="px-6 py-4 text-left border-b-4 border-slate-700">CPN & Details</th><th class="px-6 py-4 text-center border-b-4 border-slate-700">Contact</th><th class="px-6 py-4 text-left border-b-4 border-slate-700">Reason Logged</th><th class="px-6 py-4 text-center border-b-4 border-slate-700">Date/Time</th></tr>';
  }
  else if (reportType === 'INACTIVE_BY_REASON') {
    kpisHtml = buildKPI('Total Inactive', count, 'rose');
    headHtml += '<th class="px-6 py-4 text-left border-b-4 border-slate-700">Contact</th><th class="px-6 py-4 text-center border-b-4 border-slate-700">Inactive Reason</th></tr>';
  }
  else if (reportType === 'ZERO_RATE') {
    kpisHtml = buildKPI('Rate Missing', count, 'rose');
    headHtml += '<th class="px-6 py-4 text-center border-b-4 border-slate-700">Rate Configuration</th></tr>';
  }
  else if (reportType === 'CUSTOMER_JOINED_LAST30DAYS') {
    kpisHtml = buildKPI('CUSTOMERS JOINED IN LAST 30 DAYS', count, 'emerald');
    headHtml += '<th class="px-6 py-4 text-center border-b-4 border-slate-700">Join Date</th></tr>';
  }
  else {
    kpisHtml = buildKPI('Matching Records', count, 'slate');
    headHtml += '<th class="px-6 py-4 text-center border-b-4 border-slate-700">Additional Data</th></tr>';
  }

  kpiContainer.innerHTML = kpisHtml;
  thead.innerHTML = headHtml;

  if (count === 0) {
    tbody.innerHTML = "<tr><td colspan='4' class='px-6 py-12 text-center text-slate-400 dark:text-slate-500 font-bold text-2xl transition-colors'>No customers match this report filter.</td></tr>";
    return;
  }

  var tbodyHtml = '';
  for (var i = 0; i < count; i++) {
    var c = window.crFilteredData[i];

    if (reportType === 'CHURN_30_DAYS') {
        let cpnBadgeHtml = `<span class="inline-flex items-center gap-1.5 px-2 py-0.5 mt-1 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/50 hover:shadow-sm active:scale-95 transition-all cursor-pointer group" onclick="window.openCustomer360('${c.cpn_no || '-'}')">
          ${c.cpn_no || '-'}
          <svg class="w-3.5 h-3.5 text-indigo-400 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
        </span>`;

        tbodyHtml += "<tr class='hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700/50 transition-colors'>" +
          "<td class='px-6 py-5'><p class='font-black text-slate-800 dark:text-white text-xl'>" + (c.customer_name || 'UNKNOWN') + "</p>" + cpnBadgeHtml + "</td>" +
          "<td class='px-6 py-5 text-center font-bold text-slate-600 dark:text-slate-400'>" + (c.phone || '-') + "</td>" +
          "<td class='px-6 py-5 text-left font-black text-rose-600 dark:text-rose-400'>" + (c.reason_for_dormancy || 'UNSPECIFIED') + "</td>" +
          "<td class='px-6 py-5 text-center font-bold text-slate-500 dark:text-slate-400'>" + formatDateForDisplay(c.created_at) + "</td></tr>";
        continue; 
    }

    var fStat = String(c.final_status || 'UNKNOWN').toUpperCase();
    var cpnBadgeHtml = `<span class="inline-flex items-center gap-1.5 px-2 py-0.5 mt-1 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/50 hover:shadow-sm active:scale-95 transition-all cursor-pointer group" onclick="window.openCustomer360('${c.cpn_no}')">
      ${c.cpn_no}
      <svg class="w-3.5 h-3.5 text-indigo-400 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
    </span>`;

    var baseRow = "<tr class='hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700/50 transition-colors'>" +
      "<td class='px-6 py-5'><p class='font-black text-slate-800 dark:text-white text-xl'>" + (c.poc1 || 'N/A') + "</p>" + cpnBadgeHtml + "</td>" +
      "<td class='px-6 py-5'><p class='font-bold text-slate-500 dark:text-slate-400 uppercase'>" + (c.apartment || '') + "</p><p class='font-black text-slate-800 dark:text-white text-lg'>" + (c.block || '') + " / " + (c.door || '') + "</p></td>" +
      "<td class='px-6 py-5'><span class='px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest transition-colors " + (fStat === 'ACTIVE' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300') + "'>" + fStat + "</span></td>";

    if (reportType === 'ADVANCE') tbodyHtml += baseRow + "<td class='px-6 py-5 text-right font-black text-emerald-600 dark:text-emerald-400 text-2xl'>₹" + (Number(c.can_deposit)||0).toLocaleString() + "</td></tr>";
    else if (reportType === 'NO_ADVANCE') tbodyHtml += baseRow + "<td class='px-6 py-5 text-center font-black text-rose-500 dark:text-rose-400 text-2xl'>₹0</td></tr>";
    else if (reportType === 'PAY_CASH' || reportType === 'PAY_ONLINE' || reportType === 'PAY_NODATA') tbodyHtml += baseRow + "<td class='px-6 py-5 text-center font-black text-amber-600 dark:text-amber-500 text-xl'>" + (c.pay_type || 'N/A').toUpperCase() + "</td></tr>";
    else if (reportType === 'INACTIVE_BY_REASON') tbodyHtml += baseRow + "<td class='px-6 py-5 text-left font-bold text-slate-800 dark:text-slate-300'>Ph: " + (c.con1 || "MISSING") + "</td><td class='px-6 py-5 text-center font-black text-rose-600 dark:text-rose-400 text-sm'>" + (c.inactive_reason || "UNSPECIFIED") + "</td></tr>";
    else if (reportType === 'ZERO_RATE') tbodyHtml += baseRow + "<td class='px-6 py-5 text-center font-black text-rose-500 dark:text-rose-400 text-2xl'>₹0</td></tr>";
    else if (reportType === 'CUSTOMER_JOINED_LAST30DAYS') tbodyHtml += baseRow + "<td class='px-6 py-5 text-center font-black text-indigo-600 dark:text-indigo-400 text-xl'>" + (formatDateForDisplay(c.created_at) || "NO DATE") + "</td></tr>";
    else tbodyHtml += baseRow + "<td class='px-6 py-5 text-center text-slate-400 dark:text-slate-500'>-</td></tr>";
  }
  
  tbody.innerHTML = tbodyHtml;
};

function buildKPI(title, value, color) {
  return "<div class='bg-" + color + "-50 dark:bg-" + color + "-900/20 border-2 border-" + color + "-200 dark:border-" + color + "-800 p-4 rounded-2xl transition-colors'><p class='text-[10px] font-black text-" + color + "-600 dark:text-" + color + "-400 uppercase tracking-widest mb-1'>" + title + "</p><p class='text-2xl md:text-3xl font-black text-" + color + "-800 dark:text-" + color + "-300'>" + value + "</p></div>";
}

window.exportCustomerReportCSV = function () {
  if (window.crFilteredData.length === 0) return alert("No data to export.");
  var csv = "CPN,Name,Phone,Apartment,Block,Door,Status,Value\n";
  
  for (var i = 0; i < window.crFilteredData.length; i++) {
    var c = window.crFilteredData[i];

    if (window.crCurrentReportType === 'CHURN_30_DAYS') {
        csv += (c.cpn_no || "") + "," + (c.customer_name || "").replace(/,/g, ' ') + "," + (c.phone || "") + ",-,-,-,CHURNED," + (c.reason_for_dormancy || "UNSPECIFIED").replace(/,/g, ' ') + "\n";
        continue;
    }

    var cleanApt = String(c.apartment || "").replace(/,/g, ' ');
    var cleanName = String(c.poc1 || "").replace(/,/g, ' ');
    var cleanPhone = String(c.con1 || "").replace(/,/g, ' '); 
    var val = "Matched";
    
    if (window.crCurrentReportType === 'ADVANCE') val = c.can_deposit;
    else if (window.crCurrentReportType === 'DELIVERY_COLOR') val = c.del_color;
    else if (window.crCurrentReportType === 'INACTIVE_BY_REASON') val = (c.inactive_reason || "UNSPECIFIED").replace(/,/g, ' ');

    csv += (c.cpn_no||'') + "," + cleanName + "," + cleanPhone + "," + cleanApt + "," + (c.block||'') + "," + (c.door||'') + "," + (c.final_status||'') + "," + val + "\n";
  }
  
  var blob = new Blob([csv], { type: 'text/csv' });
  var url = window.URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = 'Customer_Audit_' + new Date().toISOString().split('T')[0] + '.csv';
  a.click();
};

window.exportCustomerReportPDF = function () {
  const tableContainer = document.querySelector('#rpt-cust-table-container');
  const thead = document.getElementById('rpt-cust-thead');
  
  const originalMaxHeight = tableContainer.style.maxHeight;
  tableContainer.style.maxHeight = 'none';
  tableContainer.style.overflowY = 'visible';
  thead.classList.remove('sticky');

  const opt = {
    margin: 0.5,
    filename: 'Customer_Audit_' + new Date().toISOString().split('T')[0] + '.pdf',
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
  };

  window.html2pdf().set(opt).from(tableContainer).save().then(() => {
     tableContainer.style.maxHeight = originalMaxHeight;
     tableContainer.style.overflowY = 'auto';
     thead.classList.add('sticky');
  });
};

function formatDateForDisplay(dateStr) {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "N/A";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); 
};

window.tabActions['reports-customer'] = function(arg) { window.loadCustomerAnalyticsData(arg); };