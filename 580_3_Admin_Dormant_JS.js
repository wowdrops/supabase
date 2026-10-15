  
  window.exportDormantPDF = function () {
    // Target the main container
    const element = document.getElementById('tab-dormant');

    // Grab the UI elements we want to hide or modify for the PDF
    const controls = document.getElementById('dormant-controls');
    const buttons = element.querySelectorAll('button');
    const tableContainer = element.querySelector('.overflow-hidden');

    // Hide buttons and controls so they don't print
    if (controls) controls.style.display = 'none';
    buttons.forEach(btn => btn.style.display = 'none');

    // IMPORTANT: Remove overflow-hidden so the PDF doesn't cut off at page 1
    if (tableContainer) tableContainer.classList.remove('overflow-hidden');

    // Configure the professional PDF settings
    const opt = {
      margin: 0.5,
      filename: 'Dormant_Customers_Report.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    // Generate and download the file
    html2pdf().set(opt).from(element).save().then(() => {
      // Restore the UI back to normal after the download
      if (controls) controls.style.display = '';
      buttons.forEach(btn => btn.style.display = '');
      if (tableContainer) tableContainer.classList.add('overflow-hidden');
    });
  };

  window.toggleDormantControls = function () {
    var c = document.getElementById('dormant-controls');
    var i = document.getElementById('dormant-icon');
    c.classList.toggle('hidden');
    i.classList.toggle('rotate-180');
  };

  window.loadDormantData = function (minDays, maxDays, sortText) {
    // If no arguments, do nothing (on load)
    //alert("minDays - " + minDays + ", maxDays - " + maxDays + ", sortText - " + sortText);
    if (minDays === undefined) return;

    // Ensure statuses are loaded on first run
    if (!window.currentDormantStatus) {
      window.loadDormantStatuses();
      return setTimeout(function() { window.loadDormantData(minDays, maxDays, sortText); }, 500);
    }

    if (typeof sortText !== 'undefined' && sortText !== '') {
      minDays = window.dormantMinDays;
      maxDays = window.dormantMaxDays;
      //alert("loadDormantData if 1 - minDays - " + minDays + ", maxDays - " + maxDays + ", sortText - " + sortText);
    }

    // ========================================================
      // NEW UI LOGIC: Highlight active preset button
      // ========================================================
      var rangeBtns = document.querySelectorAll('.dorm-range-btn');
      for (var j = 0; j < rangeBtns.length; j++) {
        // Remove the styling ring from all buttons
        rangeBtns[j].classList.remove('ring-4', 'ring-indigo-600', 'ring-offset-2', 'scale-105');
      }
      
      // Target the exact button using the parameters
      var activeBtn = document.getElementById('btn-dorm-' + minDays + '-' + maxDays);
      if (activeBtn) {
        // Apply the highlight ring and pop the button out slightly
        activeBtn.classList.add('ring-4', 'ring-indigo-600', 'ring-offset-2', 'scale-105');
      }
      // ========================================================

    var tb = document.getElementById('dormant-tbody');
    tb.innerHTML = '<tr><td colspan="6" class="text-center p-12 font-bold text-slate-500 animate-pulse">Loading data...</td></tr>';
    
    // Reset select all checkbox
    document.getElementById('selectAllDormant').checked = false;
    
    // Always fetch from backend using the baseline "7" so we have full data in memory
    // Pass the dynamic status instead of hardcoded 'Active'
    google.script.run.withSuccessHandler(function (res) {
      if (!res.success) return tb.innerHTML = "<tr><td colspan='6' class='text-center p-10'>Error.</td></tr>";

      var filtered = res.data.filter(function (u) {
        var d = (String(u.daysDormant).includes(">")) ? 31 : parseInt(u.daysDormant);
        return d >= minDays && d <= maxDays;
      });

      window.currentDormantData = filtered;

      window.dormantMinDays = minDays;
      window.dormantMaxDays = maxDays;

      if (typeof sortText !== 'undefined' && sortText !== '') { window.sortDormantData(sortText) };

      document.getElementById('dormant-total-count').innerText = filtered.length + " Total";

      if (filtered.length === 0) return tb.innerHTML = "<tr><td colspan='6' class='text-center p-10 font-black text-slate-400'>No customers match this range/status.</td></tr>";

      var h = '';
      for (var i = 0; i < filtered.length; i++) {
        var u = filtered[i];
        var dColor = (parseInt(u.daysDormant) > 14) ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800";
        h += "<tr><td class='px-6 py-5 text-center'><input type='checkbox' class='dormant-cb w-5 h-5 cursor-pointer rounded text-indigo-600 border-slate-300' value='" + u.cpn + "'></td>" +
        "<td class='px-6 py-5'><p class='font-black text-lg'>" + u.name + "</p><p class='text-xs text-blue-600'>" + u.cpn + "</p></td>" +
        "<td class='px-6 py-5 text-sm font-bold'>" + u.apt + " " + u.blk + "</td>" +
        "<td class='px-6 py-5 font-bold'>" + u.lastDateStr + "</td>" +
        "<td class='px-6 py-5 text-center'><span class='px-3 py-1 rounded-lg font-black " + dColor + "'>" + u.daysDormant + "</span></td>" +
        "<td class='px-6 py-5 text-center'>" + u.status + "</td></tr>";
    }
    tb.innerHTML = h;
  }).fetchDormantReport(3, window.currentDormantStatus);
};

  window.sortDormantData = function (key) {
    if (!window.currentDormantData || window.currentDormantData.length === 0) return;

    window.sortDirection = !window.sortDirection;
    
    window.currentDormantData.sort(function (a, b) {
      var valA = a[key];
      var valB = b[key];

      // FIX 1: Handle ">30" by converting it back to 999 so it sorts to the bottom
      if (key === 'daysDormant') {
        valA = String(a.daysDormant).includes(">") ? 999 : parseFloat(a.daysDormant || 0);
        valB = String(b.daysDormant).includes(">") ? 999 : parseFloat(b.daysDormant || 0);
      }
      // FIX 2: Check the correct backend key for the date timestamp
      else if (key === 'lastOrder') {
        valA = a.lastOrderTs || 0;
        valB = b.lastOrderTs || 0;
      }

      if (valA < valB) return window.sortDirection ? -1 : 1;
      if (valA > valB) return window.sortDirection ? 1 : -1;
      return 0;
    });
  };

// Initialize global variable for active status
window.currentDormantStatus = null;

// NEW: Toggle all checkboxes in the dormant table
window.toggleAllDormant = function(source) {
  var checkboxes = document.querySelectorAll('.dormant-cb');
  for (var i = 0; i < checkboxes.length; i++) {
    checkboxes[i].checked = source.checked;
  }
};

// NEW: Load statuses from SETUP sheet and build buttons
window.loadDormantStatuses = function() {
  google.script.run.withSuccessHandler(function(statuses) {
    var container = document.getElementById('dormant-status-filters');
    if (!statuses || statuses.length === 0) statuses = ['Active']; // Fallback
    
    // Default to the first status in the list
    if (!window.currentDormantStatus) {
      window.currentDormantStatus = statuses[0]; 
    }
    
    var html = '<span class="text-xs font-black text-slate-400 uppercase tracking-widest w-full mb-1">Filter by Status</span>';
    
    for(var i = 0; i < statuses.length; i++) {
      var s = statuses[i];
      var safeId = s.replace(/\s+/g, '-');
      var isActive = (s === window.currentDormantStatus);
      var btnClass = isActive 
        ? "bg-indigo-600 text-white border-indigo-600" 
        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50";
        
      html += '<button onclick="window.setDormantStatusFilter(\'' + s + '\')" id="btn-status-' + safeId + '" class="status-filter-btn px-4 py-1.5 rounded-lg text-sm font-bold border-2 transition-colors ' + btnClass + '">' + s + '</button>';
    }
    container.innerHTML = html;
  }).getFinalStatuses();
};

// NEW: Handle clicking a status filter button
window.setDormantStatusFilter = function(status) {
  window.currentDormantStatus = status;
  
  // Re-render button classes for highlight
  var buttons = document.querySelectorAll('.status-filter-btn');
  for(var i = 0; i < buttons.length; i++) {
    buttons[i].className = "status-filter-btn px-4 py-1.5 rounded-lg text-sm font-bold border-2 transition-colors bg-white text-slate-600 border-slate-200 hover:bg-slate-50";
  }
  
  var activeBtn = document.getElementById('btn-status-' + status.replace(/\s+/g, '-'));
  if (activeBtn) {
    activeBtn.className = "status-filter-btn px-4 py-1.5 rounded-lg text-sm font-bold border-2 transition-colors bg-indigo-600 text-white border-indigo-600";
  }
  
  // Reload table data with new status
  window.loadDormantData(window.dormantMinDays, window.dormantMaxDays);
};

window.fetchCustomDormantRange = function() {
    var fromInput = document.getElementById('custom-dormant-from').value;
    var toInput = document.getElementById('custom-dormant-to').value;

    // 1. Check for empty fields
    if (fromInput === "" || toInput === "") {
        return alert("Please enter values in both 'From' and 'To' fields.");
    }

    var fromVal = parseInt(fromInput);
    var toVal = parseInt(toInput);

    // 2. Enforce your business rules
    if (fromVal < 3) {
        return alert("Dormant days must be 3 or greater.");
    }
    if (toVal > 999) {
        return alert("The maximum limit allowed is 999 days.");
    }
    if (fromVal > toVal) {
        return alert("The 'From' day cannot be greater than the 'To' day.");
    }

    // 3. Clear the visual blue rings from the preset buttons 
    // so the admin knows they are using a custom filter
    var rangeBtns = document.querySelectorAll('.dorm-range-btn');
    for (var j = 0; j < rangeBtns.length; j++) {
      rangeBtns[j].classList.remove('ring-4', 'ring-indigo-600', 'ring-offset-2', 'scale-105');
    }

    // 4. Trigger your exact existing data fetch function!
    window.loadDormantData(fromVal, toVal);
  };

  // Add this new function for the CSV export:
  window.exportDormantCSV = function () {
    if (!window.currentDormantData || window.currentDormantData.length === 0) return alert("No data to export.");
    var csv = "Name,CPN,Apt,Block,Days Inactive,Status\n";
    window.currentDormantData.forEach(function (u) {
      csv += u.name + "," + u.cpn + "," + u.apt + "," + u.blk + "," + u.daysDormant + "," + u.status + "\n";
    });
    var blob = new Blob([csv], { type: 'text/csv' });
    var url = window.URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'Dormant_Report_' + new Date().toISOString().split('T')[0] + '.csv';
    a.click();
  };

//580_3
  function pushDormantListToCRM() {
    var checkboxes = document.querySelectorAll('.dormant-cb:checked');
    if (checkboxes.length === 0) return alert("Select at least one customer to push.");

    var selectedCpns = [];
    for (var i = 0; i < checkboxes.length; i++) {
      selectedCpns.push(checkboxes[i].value);
    }

    // 1. Filter the data to only include checked CPNs
    // 2. Map the filtered data to your payload structure
    var payload = window.currentDormantData
      .filter(function (cust) {
        // String() is used here just in case cust.cpn is a number in your data, 
        // since checkbox values are always strings.
        return selectedCpns.includes(String(cust.cpn));
      })
      .map(function (cust) {
        return {
          cpn: cust.cpn,
          name: cust.name,
          phone: cust.contact || "No Number",
          days: cust.daysDormant || 0,
          currentStatus: cust.status || "ACTIVE"
        };
      });


    var forcePush = document.getElementById('force-push-crm').checked;


    if (!window.currentDormantData || window.currentDormantData.length === 0) return alert("No dormant customers currently loaded to push.");
    var btn = document.getElementById('btn-push-crm');
    var originalText = btn.innerText; btn.innerText = "Pushing to CRM..."; btn.disabled = true;


    google.script.run.withSuccessHandler(function (res) {
      alert(res.message); btn.innerText = originalText; btn.disabled = false;
    })
    .withFailureHandler(function (err) {
      alert("Error pushing to CRM: " + err.message); 
      btn.innerText = originalText; 
      btn.disabled = false;
    }).pushDormantToCRMQueue(payload, forcePush);
  }