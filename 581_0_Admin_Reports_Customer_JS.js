window.crMasterData = [];
  window.crLogsData = [];
  window.crFilteredData = [];
  window.crCurrentReportType = '';

  window.loadCustomerAnalyticsData = async function (filterArg) {
    var tb = document.getElementById('rpt-cust-tbody');
    tb.innerHTML = "<tr><td colspan='6' class='px-6 py-12 text-center text-slate-400 font-bold text-2xl animate-pulse'>Fetching Database...</td></tr>";
    
    try {
        const supa = window.supabase1;
        
        // Date math for 30 days
        var thirtyDaysAgoDate = new Date();
        thirtyDaysAgoDate.setDate(thirtyDaysAgoDate.getDate() - 30);
        var thirtyDaysAgoStr = thirtyDaysAgoDate.toISOString();

        // Concurrently fetch Master Customers AND the CRM logs
        const [custRes, logsRes] = await Promise.all([
            supa.from('ac_customers').select('*').order('created_at', {ascending: false}),
            supa.from('crm_dormant_call_logs').select('*').gte('created_at', thirtyDaysAgoStr).order('created_at', {ascending: false})
        ]);

        if (custRes.error) throw custRes.error;
        if (logsRes.error) throw logsRes.error;
        
        window.crMasterData = custRes.data || [];
        window.crLogsData = logsRes.data || [];

        // Build Dynamic Status Dropdown based on data
        var allStatuses = window.crMasterData.map(c => String(c.final_status || 'UNKNOWN').toUpperCase().trim());
        var uniqueStatuses = [...new Set(allStatuses)].filter(Boolean).sort();
        
        var statusDrop = document.getElementById('rpt-cust-status');
        var html = '<option value="ALL">ALL STATUSES</option>';
        uniqueStatuses.forEach(s => html += `<option value="${s}">${s}</option>`);
        statusDrop.innerHTML = html;

        // CATCH DASHBOARD DRILL-DOWN PRE-FILTERS!
        if (filterArg) {
            let parts = filterArg.split('|'); // e.g., "ACTIVE|PAY_CASH"
            if (parts.length === 2) {
                statusDrop.value = parts[0];
                document.getElementById('rpt-cust-type').value = parts[1];
            }
        } else {
            statusDrop.value = "ACTIVE"; // Default
            document.getElementById('rpt-cust-type').value = "ADVANCE"; // Default
        }

        window.generateCustomerReport();

    } catch (err) {
        tb.innerHTML = "<tr><td colspan='6' class='px-6 py-12 text-center text-red-500 font-bold text-2xl'>Database Error: " + err.message + "</td></tr>";
    }
  };

  window.generateCustomerReport = function () {
    if (window.crMasterData.length === 0) return;

    var statusFilter = document.getElementById('rpt-cust-status').value;
    var reportType = document.getElementById('rpt-cust-type').value;
    window.crCurrentReportType = reportType;

    // Special Branch for 30-Day Churn (Needs CRM Logs, not Customers)
    if (reportType === 'CHURN_30_DAYS') {
        window.crFilteredData = window.crLogsData.filter(function (log) {
            var prev = String(log.previous_customer_status || '').toUpperCase().trim();
            var curr = String(log.new_customer_status || '').toUpperCase().trim();
            // Optional: If they clicked a specific status filter, we can filter churn further, 
            // but generally churn is inherently Active -> Inactive.
            return (prev === 'ACTIVE' && curr === 'INACTIVE');
        });
        window.renderCustomerReportUI(reportType);
        return;
    }

    // Standard Filters
    window.crFilteredData = window.crMasterData.filter(function (c) {
      // Check Status
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
        // HIGH_RISK needs max limits. If you have those in ac_customers, replace 0 with c.max_ord_d
        case 'HIGH_RISK': return advance === 0 && (c.default_rate > 0); 
        case 'INACTIVE_NO_REASON': return fStat === 'INACTIVE' && !c.inactive_reason;
        case 'INACTIVE_BY_REASON': return fStat === 'INACTIVE';
        case 'ZERO_RATE': return dRate === 0;
        case 'NO_CONTACT': return !c.con1 || !c.email;
        case 'NO_PASSWORD': return !c.password;
        case 'MISSING_DELIVERY': return !c.del_color || !c.apartment || !c.block || !c.door;
        case 'DELIVERY_COLOR': return true; 
        case 'WAIVERS': return cWaiver || oWaiver;
        case 'HIGH_LIMIT': return false; // Needs limit columns if they exist
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

    // Build specific UI based on report type
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
      // Default fallback
      kpisHtml = buildKPI('Matching Records', count, 'slate');
      headHtml += '<th class="px-6 py-4 text-center border-b-4 border-slate-700">Additional Data</th></tr>';
    }

    kpiContainer.innerHTML = kpisHtml;
    thead.innerHTML = headHtml;

    // Render Body Rows
    if (count === 0) {
      tbody.innerHTML = "<tr><td colspan='4' class='px-6 py-12 text-center text-slate-400 font-bold text-2xl'>No customers match this report filter.</td></tr>";
      return;
    }

    var tbodyHtml = '';
    for (var i = 0; i < count; i++) {
      var c = window.crFilteredData[i];

      // SPECIAL CHURN LOG RENDERING
      if (reportType === 'CHURN_30_DAYS') {
          tbodyHtml += "<tr class='hover:bg-slate-50 border-b-4 border-slate-100'>" +
            "<td class='px-6 py-5'><p class='font-black text-slate-800 text-xl'>" + (c.customer_name || 'UNKNOWN') + "</p><p class='text-sm font-bold text-indigo-600 tracking-widest'>" + (c.cpn_no || '-') + "</p></td>" +
            "<td class='px-6 py-5 text-center font-bold text-slate-600'>" + (c.phone || '-') + "</td>" +
            "<td class='px-6 py-5 text-left font-black text-rose-600'>" + (c.reason_for_dormancy || 'UNSPECIFIED') + "</td>" +
            "<td class='px-6 py-5 text-center font-bold text-slate-500'>" + formatDateForDisplay(c.created_at) + "</td></tr>";
          continue; // Skip the rest of the loop
      }

      // STANDARD CUSTOMER RENDERING
      var fStat = String(c.final_status || 'UNKNOWN').toUpperCase();
      var baseRow = "<tr class='hover:bg-slate-50 border-b-4 border-slate-100'>" +
        "<td class='px-6 py-5'><p class='font-black text-slate-800 text-xl'>" + (c.poc1 || 'N/A') + "</p><p class='text-sm font-bold text-indigo-600 tracking-widest'>" + c.cpn_no + "</p></td>" +
        "<td class='px-6 py-5'><p class='font-bold text-slate-500 uppercase'>" + (c.apartment || '') + "</p><p class='font-black text-slate-800 text-lg'>" + (c.block || '') + " / " + (c.door || '') + "</p></td>" +
        "<td class='px-6 py-5'><span class='px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest " + (fStat === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600') + "'>" + fStat + "</span></td>";

      if (reportType === 'ADVANCE') tbodyHtml += baseRow + "<td class='px-6 py-5 text-right font-black text-emerald-600 text-2xl'>₹" + (Number(c.can_deposit)||0).toLocaleString() + "</td></tr>";
      else if (reportType === 'NO_ADVANCE') tbodyHtml += baseRow + "<td class='px-6 py-5 text-center font-black text-rose-500 text-2xl'>₹0</td></tr>";
      else if (reportType === 'PAY_CASH' || reportType === 'PAY_ONLINE' || reportType === 'PAY_NODATA') tbodyHtml += baseRow + "<td class='px-6 py-5 text-center font-black text-amber-600 text-xl'>" + (c.pay_type || 'N/A').toUpperCase() + "</td></tr>";
      else if (reportType === 'INACTIVE_BY_REASON') tbodyHtml += baseRow + "<td class='px-6 py-5 text-left font-bold text-slate-800'>Ph: " + (c.con1 || "MISSING") + "</td><td class='px-6 py-5 text-center font-black text-rose-600 text-sm'>" + (c.inactive_reason || "UNSPECIFIED") + "</td></tr>";
      else if (reportType === 'ZERO_RATE') tbodyHtml += baseRow + "<td class='px-6 py-5 text-center font-black text-rose-500 text-2xl'>₹0</td></tr>";
      else if (reportType === 'CUSTOMER_JOINED_LAST30DAYS') tbodyHtml += baseRow + "<td class='px-6 py-5 text-center font-black text-indigo-600 text-xl'>" + (formatDateForDisplay(c.created_at) || "NO DATE") + "</td></tr>";
      else tbodyHtml += baseRow + "<td class='px-6 py-5 text-center text-slate-400'>-</td></tr>";
    }
    
    tbody.innerHTML = tbodyHtml;
  };

  function buildKPI(title, value, color) {
    return "<div class='bg-" + color + "-50 border-2 border-" + color + "-200 p-4 rounded-2xl'><p class='text-[10px] font-black text-" + color + "-600 uppercase tracking-widest mb-1'>" + title + "</p><p class='text-2xl md:text-3xl font-black text-" + color + "-800'>" + value + "</p></div>";
  }

  window.exportCustomerReportCSV = function () {
    if (window.crFilteredData.length === 0) return alert("No data to export.");
    var csv = "CPN,Name,Phone,Apartment,Block,Door,Status,Value\n";
    
    for (var i = 0; i < window.crFilteredData.length; i++) {
      var c = window.crFilteredData[i];

      // Handle the different structure of the Churn Logs
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

    html2pdf().set(opt).from(tableContainer).save().then(() => {
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