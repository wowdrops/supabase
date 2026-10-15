
  window.activeNotifTimerInterval = null;
  window.notifStartTime = 0;

  window.startNotifTimer = function(actionLabel) {
    var badge = document.getElementById('notif-live-timer');
    if (!badge) return;
    badge.outerHTML = '<span id="notif-live-timer" class="bg-indigo-100 text-indigo-800 font-black px-3 py-1.5 rounded-lg text-sm border-2 border-indigo-200 shadow-inner flex items-center gap-1.5 min-w-max"><svg class="w-4 h-4 animate-spin text-indigo-600" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>' + actionLabel + ': <span id="notif-timer-sec">0.00</span>s</span>';
    document.getElementById('notif-live-timer').classList.remove('hidden');
    window.notifStartTime = performance.now();
    if(window.activeNotifTimerInterval) clearInterval(window.activeNotifTimerInterval);
    window.activeNotifTimerInterval = setInterval(function() {
      var curr = ((performance.now() - window.notifStartTime) / 1000).toFixed(2);
      var secEl = document.getElementById('notif-timer-sec');
      if(secEl) secEl.innerText = curr;
    }, 50);
  };

  window.stopNotifTimer = function(successLabel, isError) {
    if(window.activeNotifTimerInterval) clearInterval(window.activeNotifTimerInterval);
    var finalTime = ((performance.now() - window.notifStartTime) / 1000).toFixed(2);
    var badge = document.getElementById('notif-live-timer');
    if(badge) {
      if (isError) {
        badge.outerHTML = '<span id="notif-live-timer" class="bg-red-100 text-red-800 font-bold px-3 py-1.5 rounded-lg border border-red-200 text-xs uppercase tracking-widest whitespace-nowrap shadow-sm min-w-max">Failed</span>';
      } else {
        badge.outerHTML = '<span id="notif-live-timer" class="bg-emerald-100 text-emerald-800 font-bold px-3 py-1.5 rounded-lg border border-emerald-200 text-xs uppercase tracking-widest whitespace-nowrap shadow-sm min-w-max">' + successLabel + ' in ' + finalTime + 's</span>';
      }
    }
  };

  window.toggleNotifHeader = function () {
    var col = document.getElementById('notif-header-collapsible');
    var icon = document.getElementById('notif-header-icon');
    if (col.classList.contains('hidden')) { col.classList.remove('hidden'); icon.classList.add('rotate-180'); }
    else { col.classList.add('hidden'); icon.classList.remove('rotate-180'); }
  };

  window.loadNotificationLogs = function () {
    // Set default dates if empty
    var fD = document.getElementById('notif-flt-from');
    var tD = document.getElementById('notif-flt-to');
    if (!fD.value) fD.value = new Date().toISOString().split('T')[0];
    if (!tD.value) tD.value = new Date().toISOString().split('T')[0];

    window.startNotifTimer('Searching');
    document.getElementById('notif-logs-table').innerHTML = '<tr><td colspan="5" class="text-center p-8 font-bold text-slate-500 animate-pulse">Fetching Logs...</td></tr>';

    google.script.run
      .withSuccessHandler(function (res) {
        window.stopNotifTimer('Loaded', !res.success);
        if (!res.success) return alert("Error: " + res.message);
        
        // Update summary badges
        document.getElementById('notif-count-total').innerText = res.counts.total;
        document.getElementById('notif-count-process').innerText = res.counts.process;
        document.getElementById('notif-count-completed').innerText = res.counts.completed;
        document.getElementById('notif-count-reminders').innerText = res.counts.reminders;

        // Render Table
        var html = "";
        if (res.logs.length === 0) {
          html = '<tr><td colspan="5" class="text-center p-8 font-black text-slate-400">No notifications found for this date range.</td></tr>';
        } else {
          res.logs.forEach(function (log) {
            var statusBadge = log.status === 'SENT' 
              ? '<span class="bg-emerald-100 text-emerald-700 px-2 py-1 rounded font-black text-[9px] uppercase tracking-widest shadow-sm">SENT</span>' 
              : '<span class="bg-amber-100 text-amber-700 px-2 py-1 rounded font-black text-[9px] uppercase tracking-widest shadow-sm">' + log.status + '</span>';

            html += '<tr class="hover:bg-slate-50 transition">' +
              '<td class="p-3 font-bold text-slate-600 whitespace-nowrap">' + log.timestamp + '</td>' +
              '<td class="p-3 font-black text-blue-600">' + log.cpn + '</td>' +
              '<td class="p-3 font-black text-slate-700">' + log.category + '</td>' +
              '<td class="p-3">' +
                '<div class="font-black text-slate-900">' + log.title + '</div>' +
                '<div class="text-slate-500 mt-0.5">' + log.message + '</div>' +
              '</td>' +
              '<td class="p-3 text-center">' + statusBadge + '</td>' +
              '</tr>';
          });
        }
        document.getElementById('notif-logs-table').innerHTML = html;
      })
      .withFailureHandler(function (err) {
        window.stopNotifTimer('Failed', true);
        alert("Connection failed: " + err);
      })
      .backendGetNotificationLogs(fD.value, tD.value);
  };

  window.queueAdminBroadcast = function() {
    var title = document.getElementById('notif-broadcast-title').value.trim();
    var msg = document.getElementById('notif-broadcast-msg').value.trim();

    if (!title || !msg) return alert("Please fill in both the Title and Message.");
    if (!confirm("Are you sure you want to broadcast this to ALL subscribed customers?")) return;

    window.startNotifTimer('Queueing');
    google.script.run
      .withSuccessHandler(function (res) {
        window.stopNotifTimer('Queued', !res.success);
        if (res.success) {
          alert("✅ Broadcast successfully added to the queue!\nIt will be dispatched automatically.");
          document.getElementById('notif-broadcast-title').value = "";
          document.getElementById('notif-broadcast-msg').value = "";
          window.loadNotificationLogs(); // Refresh table
        } else {
          alert("Failed: " + res.message);
        }
      })
      .backendQueueAdminBroadcast(title, msg, window.activeAdminSession.username);
  };

  window.triggerManualOrderReminders = function() {
    // Safety lock!
    if (!confirm("Are you sure you want to queue Order Reminders for ALL subscribed customers right now?")) return;
    
    var btn = document.getElementById('btn-manual-reminders');
    var originalText = btn.innerHTML;
    btn.innerHTML = '⏳ Queueing Reminders...';
    btn.disabled = true;
    
    window.startNotifTimer('Queueing');

    google.script.run
      .withSuccessHandler(function (res) {
        btn.innerHTML = originalText;
        btn.disabled = false;
        window.stopNotifTimer('Queued', !res.success);
        
        if (res.success) {
          alert("✅ Successfully queued " + res.count + " reminders!\nThe background processor will dispatch them shortly.");
          window.loadNotificationLogs(); // Refresh the table automatically
        } else {
          alert("Failed to queue: " + res.message);
        }
      })
      .withFailureHandler(function(err) {
        btn.innerHTML = originalText;
        btn.disabled = false;
        window.stopNotifTimer('Failed', true);
        alert("Server Error: " + err);
      })
      .queueDailyOrderReminders();
  };

  window.forceDispatchQueue = function() {
    var btn = document.getElementById('btn-force-queue');
    var originalText = btn.innerHTML;
    
    btn.innerHTML = '⚡ Dispatching...';
    btn.disabled = true;
    
    window.startNotifTimer('Dispatching');

    google.script.run
      .withSuccessHandler(function (res) {
        btn.innerHTML = originalText;
        btn.disabled = false;
        window.stopNotifTimer('Dispatched', !res.success);
        
        if (res.success) {
          if (res.count > 0) {
            alert("✅ Successfully dispatched " + res.count + " queued notifications!");
            window.loadNotificationLogs(); // Refresh the table automatically
          } else {
            alert("Queue is currently empty. Nothing to dispatch.");
          }
        } else {
          alert("Failed to dispatch: " + res.message);
        }
      })
      .withFailureHandler(function(err) {
        btn.innerHTML = originalText;
        btn.disabled = false;
        window.stopNotifTimer('Failed', true);
        alert("Server Error: " + err);
      })
      .forceProcessNotificationQueue(); // Calls our dedicated backend function
  };
