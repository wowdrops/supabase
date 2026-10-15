  window.crMasterData = [];
  window.crFilteredData = [];
  window.crCurrentReportType = '';

  window.loadCustomerAnalyticsData = function () {
    var tb = document.getElementById('rpt-cust-tbody');
    tb.innerHTML = "<tr><td colspan='6' class='px-6 py-12 text-center text-slate-400 font-bold text-2xl animate-pulse'>Fetching Database...</td></tr>";
    
    google.script.run.withSuccessHandler(function (res) {
      // 1. Guard against null or undefined response
      if (!res) {
        alert("Server Error: The backend function returned an empty response or crashed during processing.");
        document.getElementById('rpt-cust-tbody').innerHTML = 
          "<p class='text-red-500 text-xl font-bold'>Failed to load data. Please check Apps Script execution logs.</p>";
        return;
      }

      // 2. Check logical success status
      if (!res.success) {
        alert("Error: " + res.message);
        document.getElementById('rpt-cust-tbody').innerHTML = 
          "<p class='text-red-500 text-xl font-bold'>" + res.message + "</p>";
        return;
      }
      if (res.success) {
        window.crMasterData = res.customers;
        
        // Populate Status Dropdown
        var statusDrop = document.getElementById('rpt-cust-status');
        var html = '<option value="ALL">ALL STATUSES</option>';
        for (var i = 0; i < res.statuses.length; i++) {
          html += '<option value="' + res.statuses[i] + '">' + res.statuses[i] + '</option>';
        }
        statusDrop.innerHTML = html;
        statusDrop.value = "ACTIVE"; // Default to Active

        window.generateCustomerReport();
      } else {
        tb.innerHTML = "<tr><td colspan='6' class='px-6 py-12 text-center text-red-500 font-bold text-2xl'>Error: " + res.message + "</td></tr>";
      }
    }).withFailureHandler(function (err) {
      // Handles server crashes / timeout errors
      alert("Server Script Execution Error: " + err.message);
      document.getElementById('rpt-cust-status').innerHTML = 
        "<p class='text-red-500 text-xl font-bold'>Execution Error: " + err.message + "</p>";
    }).fetchCustomerReportData();
  };

  window.generateCustomerReport = function () {
    if (window.crMasterData.length === 0) return;

    var statusFilter = document.getElementById('rpt-cust-status').value;
    var reportType = document.getElementById('rpt-cust-type').value;
    window.crCurrentReportType = reportType;

    // 1. Apply Filters
    window.crFilteredData = window.crMasterData.filter(function (c) {
      // Check Status
      if (statusFilter !== "ALL" && c.finalStatus !== statusFilter) return false;
      
      // Check Report Type Logic
      switch (reportType) {
        case 'ADVANCE': return c.advance > 0;
        case 'NO_ADVANCE': return c.advance === 0;
        case 'PAY_CASH': return String(c.payType).toUpperCase() === 'CASH';
        case 'PAY_ONLINE': return String(c.payType).toUpperCase() === 'ONLINE';
        case 'PAY_NODATA': return String(c.payType).toUpperCase() === 'NO PAY TYPE';
        case 'HIGH_RISK': return c.advance === 0 && (c.maxOrdD > 3 || c.maxOrdE > 3);
        case 'INACTIVE_NO_REASON': return c.finalStatus.toUpperCase() === 'INACTIVE' && !c.inactiveReason;
        case 'INACTIVE_BY_REASON': return c.finalStatus.toUpperCase() === 'INACTIVE';
        case 'ZERO_RATE': return c.defaultRate === 0;
        case 'NO_CONTACT': return !c.con1 || !c.email;
        case 'NO_PASSWORD': return !c.passwordSet;
        case 'MISSING_DELIVERY': return !c.delColor || !c.apt || !c.blk || !c.door;
        case 'DELIVERY_COLOR': return true; // Show all, sort by color below
        case 'WAIVERS': return c.overdueWaiver === "Yes" || c.prevMonWaiver === "Yes";
        case 'HIGH_LIMIT': return c.maxOrdD > 3 || c.maxOrdE > 3;
        case 'CUSTOMER_LIST': return true;
        case 'CUSTOMER_JOINED_LAST30DAYS': {
          if (!c.createdDate || isNaN(new Date(c.createdDate).getTime())) return false;
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          return new Date(c.createdDate) >= thirtyDaysAgo;
        }
        default: return false;
      }
    });

    // Optional Sorting
    if (reportType === 'DELIVERY_COLOR') {
      window.crFilteredData.sort(function(a, b) { return a.delColor.localeCompare(b.delColor); });
    }
    else if (reportType === 'INACTIVE_BY_REASON') {
      window.crFilteredData.sort(function(a, b) {
        var statA = (a.finalStatus || "").toUpperCase();
        var statB = (b.finalStatus || "").toUpperCase();
        if (statA !== statB) return statA.localeCompare(statB); // Order by Status first
        
        var reasonA = (a.inactiveReason || "UNSPECIFIED").toUpperCase();
        var reasonB = (b.inactiveReason || "UNSPECIFIED").toUpperCase();
        return reasonA.localeCompare(reasonB); // Then Order by Reason
      });
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
      window.crFilteredData.forEach(function(c) { totalAdv += c.advance; });
      kpisHtml = buildKPI('Total Customers', count, 'blue') + buildKPI('Total Deposit Held', '₹' + totalAdv.toLocaleString(), 'emerald');
      headHtml += '<th class="px-6 py-4 text-right border-b-4 border-slate-700">Can Deposit (₹)</th></tr>';
    } 
    else if (reportType === 'NO_ADVANCE') {
      kpisHtml = buildKPI('Zero Deposit', count, 'rose');
      headHtml += '<th class="px-6 py-4 text-center border-b-4 border-slate-700">Deposit Status</th></tr>';
    }
    else if (reportType === 'PAY_CASH') {
      kpisHtml = buildKPI('Cash Customers', count, 'amber');
      headHtml += '<th class="px-6 py-4 text-center border-b-4 border-slate-700">Pay Type</th></tr>';
    }
    else if (reportType === 'PAY_ONLINE') {
      kpisHtml = buildKPI('Online Customers', count, 'amber');
      headHtml += '<th class="px-6 py-4 text-center border-b-4 border-slate-700">Pay Type</th></tr>';
    }
    else if (reportType === 'PAY_NODATA') {
      kpisHtml = buildKPI('NO PAY TYPE', count, 'amber');
      headHtml += '<th class="px-6 py-4 text-center border-b-4 border-slate-700">Pay Type</th></tr>';
    }
    else if (reportType === 'HIGH_RISK') {
      kpisHtml = buildKPI('High Risk Accounts', count, 'rose');
      headHtml += '<th class="px-6 py-4 text-center border-b-4 border-slate-700">Limits / Deposit</th></tr>';
    }
    else if (reportType === 'INACTIVE_NO_REASON') {
      kpisHtml = buildKPI('Missing Reasons', count, 'amber');
      headHtml += '<th class="px-6 py-4 text-center border-b-4 border-slate-700">Inactive Reason</th></tr>';
    }
    else if (reportType === 'INACTIVE_BY_REASON') {
      kpisHtml = buildKPI('Total Inactive', count, 'rose');
      headHtml += '<th class="px-6 py-4 text-left border-b-4 border-slate-700">Contact</th><th class="px-6 py-4 text-center border-b-4 border-slate-700">Inactive Reason</th></tr>';
    }
    else if (reportType === 'NO_CONTACT') {
      var noPhone = 0, noEmail = 0;
      window.crFilteredData.forEach(function(c) { if(!c.con1) noPhone++; if(!c.email) noEmail++; });
      kpisHtml = buildKPI('Total Impacted', count, 'rose') + buildKPI('Missing Phones', noPhone, 'amber') + buildKPI('Missing Emails', noEmail, 'amber');
      headHtml += '<th class="px-6 py-4 text-left border-b-4 border-slate-700">Contact / Email Status</th></tr>';
    }
    else if (reportType === 'ZERO_RATE') {
      kpisHtml = buildKPI('Rate Missing', count, 'rose');
      headHtml += '<th class="px-6 py-4 text-center border-b-4 border-slate-700">Rate Configuration</th></tr>';
    }
    else if (reportType === 'NO_PASSWORD') {
      kpisHtml = buildKPI('Unregistered Users', count, 'indigo');
      headHtml += '<th class="px-6 py-4 text-center border-b-4 border-slate-700">App Registration</th></tr>';
    }
    else if (reportType === 'DELIVERY_COLOR') {
      var colorCount = {};
      window.crFilteredData.forEach(function(c) { var col = c.delColor || 'UNASSIGNED'; colorCount[col] = (colorCount[col] || 0) + 1; });
      kpisHtml = buildKPI('Total in Route', count, 'blue');
      for(var k in colorCount) kpisHtml += buildKPI(k + ' Route', colorCount[k], 'slate');
      headHtml += '<th class="px-6 py-4 text-center border-b-4 border-slate-700">Delivery Color</th></tr>';
    }
    else if (reportType === 'MISSING_DELIVERY') {
      kpisHtml = buildKPI('Incomplete Configs', count, 'rose');
      headHtml += '<th class="px-6 py-4 text-left border-b-4 border-slate-700">Missing Fields</th></tr>';
    }
    else if (reportType === 'WAIVERS') {
      kpisHtml = buildKPI('Waivers Granted', count, 'amber');
      headHtml += '<th class="px-6 py-4 text-center border-b-4 border-slate-700">Overdue / Prev Mon</th></tr>';
    }
    else if (reportType === 'HIGH_LIMIT') {
      kpisHtml = buildKPI('High Consumers', count, 'indigo');
      headHtml += '<th class="px-6 py-4 text-center border-b-4 border-slate-700">Max D / E Limits</th></tr>';
    }
    else if (reportType === 'CUSTOMER_LIST') {
      kpisHtml = buildKPI('CUSTOMERS', count, 'rose');
      headHtml += '<th class="px-6 py-4 text-center border-b-4 border-slate-700">Phone/Rate</th></tr>';
    }
    else if (reportType === 'CUSTOMER_JOINED_LAST30DAYS') {
      kpisHtml = buildKPI('CUSTOMERS JOINED IN LAST 30 DAYS', count, 'rose');
      headHtml += '<th class="px-6 py-4 text-center border-b-4 border-slate-700">Join Date</th></tr>';
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
      var baseRow = "<tr class='hover:bg-slate-50 border-b-4 border-slate-100'>" +
        "<td class='px-6 py-5'><p class='font-black text-slate-800 text-xl'>" + c.poc1 + "</p><p class='text-sm font-bold text-indigo-600 tracking-widest'>" + c.cpn + "</p></td>" +
        "<td class='px-6 py-5'><p class='font-bold text-slate-500 uppercase'>" + c.apt + "</p><p class='font-black text-slate-800 text-lg'>" + c.blk + " / " + c.door + "</p></td>" +
        "<td class='px-6 py-5'><span class='px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest " + (c.finalStatus === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600') + "'>" + c.finalStatus + "</span></td>";

      if (reportType === 'ADVANCE') tbodyHtml += baseRow + "<td class='px-6 py-5 text-right font-black text-emerald-600 text-2xl'>₹" + c.advance.toLocaleString() + "</td></tr>";
      else if (reportType === 'NO_ADVANCE') tbodyHtml += baseRow + "<td class='px-6 py-5 text-center font-black text-rose-500 text-2xl'>₹0</td></tr>";
      else if (reportType === 'PAY_CASH') tbodyHtml += baseRow + "<td class='px-6 py-5 text-center font-black text-amber-600 text-xl'>CASH</td></tr>";
      else if (reportType === 'PAY_ONLINE') tbodyHtml += baseRow + "<td class='px-6 py-5 text-center font-black text-amber-600 text-xl'>ONLINE</td></tr>";
      else if (reportType === 'PAY_NODATA') tbodyHtml += baseRow + "<td class='px-6 py-5 text-center font-black text-amber-600 text-xl'>NA</td></tr>";
      else if (reportType === 'HIGH_RISK') tbodyHtml += baseRow + "<td class='px-6 py-5 text-center font-black text-rose-600 text-xl'>Max D:" + c.maxOrdD + " | Adv: ₹0</td></tr>";
      else if (reportType === 'INACTIVE_NO_REASON') tbodyHtml += baseRow + "<td class='px-6 py-5 text-center font-bold text-rose-500'>MISSING</td></tr>";
      else if (reportType === 'INACTIVE_BY_REASON') tbodyHtml += baseRow + "<td class='px-6 py-5 text-left font-bold text-slate-800'>Ph: " + (c.con1 || "MISSING") + "</td><td class='px-6 py-5 text-center font-black text-rose-600 text-sm'>" + (c.inactiveReason || "UNSPECIFIED") + "</td></tr>";
      else if (reportType === 'NO_CONTACT') tbodyHtml += baseRow + "<td class='px-6 py-5'><p class='font-bold " + (c.con1 ? "text-slate-800" : "text-rose-500") + "'>Ph: " + (c.con1 || "MISSING") + "</p><p class='font-bold " + (c.email ? "text-slate-800" : "text-rose-500") + "'>Em: " + (c.email || "MISSING") + "</p></td></tr>";
      else if (reportType === 'ZERO_RATE') tbodyHtml += baseRow + "<td class='px-6 py-5 text-center font-black text-rose-500 text-2xl'>₹0</td></tr>";
      else if (reportType === 'NO_PASSWORD') tbodyHtml += baseRow + "<td class='px-6 py-5 text-center'><span class='px-4 py-2 bg-rose-100 text-rose-700 font-bold rounded-xl'>NOT SET</span></td></tr>";
      else if (reportType === 'DELIVERY_COLOR') tbodyHtml += baseRow + "<td class='px-6 py-5 text-center font-black text-slate-700 text-xl tracking-widest'>" + (c.delColor || 'UNASSIGNED') + "</td></tr>";
      else if (reportType === 'MISSING_DELIVERY') tbodyHtml += baseRow + "<td class='px-6 py-5 text-left font-bold text-rose-500 text-sm'>Incomplete Route Profile</td></tr>";
      else if (reportType === 'WAIVERS') tbodyHtml += baseRow + "<td class='px-6 py-5 text-center font-black text-amber-600 text-lg'>" + c.overdueWaiver + " / " + c.prevMonWaiver + "</td></tr>";
      else if (reportType === 'HIGH_LIMIT') tbodyHtml += baseRow + "<td class='px-6 py-5 text-center font-black text-indigo-600 text-2xl'>" + c.maxOrdD + " / " + c.maxOrdE + "</td></tr>";
      else if (reportType === 'CUSTOMER_LIST') tbodyHtml += baseRow + "<td class='px-6 py-5 text-center font-black text-indigo-600 text-2xl'>" + c.con1 + " / " + c.defaultRate + "</td></tr>";
      else if (reportType === 'CUSTOMER_JOINED_LAST30DAYS') tbodyHtml += baseRow + "<td class='px-6 py-5 text-center font-black text-indigo-600 text-2xl'>" + (formatDateForDisplay(c.createdDate) || "NO DATE") + "</td></tr>";
    }
    
    tbody.innerHTML = tbodyHtml;
  };

  // Helper for KPI blocks
  function buildKPI(title, value, color) {
    return "<div class='bg-" + color + "-50 border-2 border-" + color + "-200 p-4 rounded-2xl'><p class='text-[10px] font-black text-" + color + "-600 uppercase tracking-widest mb-1'>" + title + "</p><p class='text-2xl md:text-3xl font-black text-" + color + "-800'>" + value + "</p></div>";
  }

  // Exports
  window.exportCustomerReportCSV = function () {
    if (window.crFilteredData.length === 0) return alert("No data to export.");
    
    // UPDATED: Added 'Phone' to the master header row
    var csv = "CPN,Name,Phone,Apartment,Block,Door,Status,Value\n";
    
    for (var i = 0; i < window.crFilteredData.length; i++) {
      var c = window.crFilteredData[i];
      var cleanApt = String(c.apt || "").replace(/,/g, ' ');
      var cleanName = String(c.poc1 || "").replace(/,/g, ' ');
      var cleanPhone = String(c.con1 || "").replace(/,/g, ' '); // Clean phone of commas
      var val = "";
      
      if (window.crCurrentReportType === 'ADVANCE') val = c.advance;
      else if (window.crCurrentReportType === 'DELIVERY_COLOR') val = c.delColor;
      else if (window.crCurrentReportType === 'HIGH_LIMIT') val = "D:" + c.maxOrdD + " E:" + c.maxOrdE;
      else if (window.crCurrentReportType === 'INACTIVE_BY_REASON') val = (c.inactiveReason || "UNSPECIFIED").replace(/,/g, ' ');
      else val = "Matched Filter";

      // UPDATED: Injected cleanPhone into the CSV row format
      csv += c.cpn + "," + cleanName + "," + cleanPhone + "," + cleanApt + "," + c.blk + "," + c.door + "," + c.finalStatus + "," + val + "\n";
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

  // Helper function to format ISO string to "13 Sep 2026"
function formatDateForDisplay(dateStr) {
  if (!dateStr) return "N/A";
  
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "N/A";

  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }); // Output example: "13 Sep 2026"
}
