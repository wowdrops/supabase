
  window.activeHandshakeTimerInterval = null;
  window.handshakeStartTime = 0;

  window.startHandshakeTimer = function(actionLabel) {
    var badge = document.getElementById('handshake-live-timer');
    if (!badge) return;
    badge.outerHTML = '<span id="handshake-live-timer" class="bg-emerald-100 text-emerald-800 font-black px-3 py-1.5 rounded-lg text-sm border-2 border-emerald-200 shadow-inner flex items-center gap-1.5 min-w-max"><svg class="w-4 h-4 animate-spin text-emerald-600" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>' + actionLabel + ': <span id="handshake-timer-sec">0.00</span>s</span>';
    document.getElementById('handshake-live-timer').classList.remove('hidden');
    
    window.handshakeStartTime = performance.now();
    if(window.activeHandshakeTimerInterval) clearInterval(window.activeHandshakeTimerInterval);
    window.activeHandshakeTimerInterval = setInterval(function() {
      var curr = ((performance.now() - window.handshakeStartTime) / 1000).toFixed(2);
      var secEl = document.getElementById('handshake-timer-sec');
      if(secEl) secEl.innerText = curr;
    }, 50);
  };

  window.stopHandshakeTimer = function(successLabel, isError) {
    if(window.activeHandshakeTimerInterval) clearInterval(window.activeHandshakeTimerInterval);
    var finalTime = ((performance.now() - window.handshakeStartTime) / 1000).toFixed(2);
    var badge = document.getElementById('handshake-live-timer');
    if(badge) {
      if (isError) {
        badge.outerHTML = '<span id="handshake-live-timer" class="bg-red-100 text-red-800 font-bold px-3 py-1.5 rounded-lg border border-red-200 text-xs uppercase tracking-widest whitespace-nowrap shadow-sm min-w-max">Failed</span>';
      } else {
        badge.outerHTML = '<span id="handshake-live-timer" class="bg-emerald-100 text-emerald-800 font-bold px-3 py-1.5 rounded-lg border border-emerald-200 text-xs uppercase tracking-widest whitespace-nowrap shadow-sm min-w-max">' + successLabel + ' in ' + finalTime + 's</span>';
      }
    }
  };

  window.toggleHandshakeHeader = function () {
    var col = document.getElementById('handshake-header-collapsible');
    var icon = document.getElementById('handshake-header-icon');
    if (col.classList.contains('hidden')) { col.classList.remove('hidden'); icon.classList.add('rotate-180'); }
    else { col.classList.add('hidden'); icon.classList.remove('rotate-180'); }
  };

  window.loadHandshakeLog = function () {
    // 1. Grab Dates and Set Defaults if Empty
    var fD = document.getElementById('handshake-flt-from');
    var tD = document.getElementById('handshake-flt-to');
    if (!fD.value) fD.value = new Date().toISOString().split('T')[0];
    if (!tD.value) tD.value = new Date().toISOString().split('T')[0];
    
    // Clear the search box upon fresh loads
    var searchBox = document.getElementById('handshake-search');
    if (searchBox) searchBox.value = "";

    window.startHandshakeTimer('Fetching');
    var tbody = document.getElementById('handshake-table-body');
    tbody.innerHTML = '<tr><td colspan="10" class="text-center p-8 font-bold text-slate-500 animate-pulse">Loading Handshake Data...</td></tr>';

    google.script.run
      .withSuccessHandler(function (res) {
        window.stopHandshakeTimer('Loaded', !res.success);
        
        if (!res.success) {
           return tbody.innerHTML = '<tr><td colspan="10" class="text-center p-8 font-black text-red-500">Error: ' + res.message + '</td></tr>';
        }
        
        document.getElementById('handshake-total-count').innerText = res.logs.length;

        if (res.logs.length === 0) {
           return tbody.innerHTML = '<tr><td colspan="10" class="text-center p-8 font-black text-slate-400">No handshake records found for this date range.</td></tr>';
        }

        var html = '';
        res.logs.forEach(function (log) {
          
          var badgeStr = '';
          var s = log.status.toLowerCase();
          if (s.includes("completed")) {
             badgeStr = '<span class="bg-emerald-100 text-emerald-700 px-2 py-1 rounded font-black text-[9px] uppercase tracking-widest shadow-sm">' + log.status + '</span>';
          } else if (s.includes("closed")) {
             badgeStr = '<span class="bg-slate-200 text-slate-600 px-2 py-1 rounded font-black text-[9px] uppercase tracking-widest shadow-sm">' + log.status + '</span>';
          } else {
             badgeStr = '<span class="bg-amber-100 text-amber-700 px-2 py-1 rounded font-black text-[9px] uppercase tracking-widest shadow-sm">' + log.status + '</span>';
          }

          html += '<tr class="hover:bg-slate-50 transition handshake-data-row">' +
            '<td class="p-3 font-bold text-slate-600">' + log.timestamp + '</td>' +
            '<td class="p-3 font-black text-blue-600 uppercase">' + log.driver + '</td>' +
            '<td class="p-3 font-bold text-slate-500 uppercase">' + (log.manager || '-') + '</td>' +
            '<td class="p-3 text-center font-black text-indigo-700 bg-emerald-50/30">' + log.fullVj + '</td>' +
            '<td class="p-3 text-center font-bold text-indigo-500 bg-emerald-50/30">' + log.fullNvj + '</td>' +
            '<td class="p-3 text-center font-black text-amber-700">' + log.empVj + '</td>' +
            '<td class="p-3 text-center font-bold text-amber-500">' + log.empNvj + '</td>' +
            '<td class="p-3 text-center font-black text-rose-700 bg-emerald-50/30">' + log.repVj + '</td>' +
            '<td class="p-3 text-center font-bold text-rose-500 bg-emerald-50/30">' + log.repNvj + '</td>' +
            '<td class="p-3 text-center">' + badgeStr + '</td>' +
            '</tr>';
        });
        tbody.innerHTML = html;
      })
      .withFailureHandler(function (err) {
        window.stopHandshakeTimer('Failed', true);
        tbody.innerHTML = '<tr><td colspan="10" class="text-center p-8 font-black text-red-500">Connection Error: ' + err + '</td></tr>';
      })
      .getHandshakeLogs(fD.value, tD.value); // Pass the dates to the backend!
  };

  // ==========================================
  // PURE JAVASCRIPT LIVE FILTER
  // ==========================================
  window.filterHandshakeTable = function() {
    var searchInput = document.getElementById('handshake-search').value.toLowerCase();
    var rows = document.getElementsByClassName('handshake-data-row');
    var visibleCount = 0;

    for (var i = 0; i < rows.length; i++) {
      // Grabs all the text in the row (Driver name, Timestamp, Status, etc.)
      var rowText = rows[i].innerText.toLowerCase(); 
      
      if (rowText.includes(searchInput)) {
        rows[i].style.display = '';
        visibleCount++;
      } else {
        rows[i].style.display = 'none';
      }
    }
    
    // Live update the badge to show how many rows survived the filter
    var countBadge = document.getElementById('handshake-total-count');
    if (countBadge) countBadge.innerText = visibleCount;
  };
