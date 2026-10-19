window.activeSysTimerInterval = null;
  window.sysStartTime = 0;

  window.startSysTimer = function(actionLabel) {
    var badge = document.getElementById('sys-live-timer');
    if (!badge) return;
    badge.outerHTML = '<span id="sys-live-timer" class="bg-cyan-100 text-cyan-800 font-black px-3 py-1.5 rounded-lg text-sm border-2 border-cyan-200 shadow-inner flex items-center gap-1.5 min-w-max"><svg class="w-4 h-4 animate-spin text-cyan-600" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>' + actionLabel + ': <span id="sys-timer-sec">0.00</span>s</span>';
    document.getElementById('sys-live-timer').classList.remove('hidden');
    
    window.sysStartTime = performance.now();
    if(window.activeSysTimerInterval) clearInterval(window.activeSysTimerInterval);
    
    window.activeSysTimerInterval = setInterval(function() {
      var curr = ((performance.now() - window.sysStartTime) / 1000).toFixed(2);
      var secEl = document.getElementById('sys-timer-sec');
      if(secEl) secEl.innerText = curr;
    }, 50);
  };

  window.stopSysTimer = function(successLabel, isError) {
    if(window.activeSysTimerInterval) clearInterval(window.activeSysTimerInterval);
    var finalTime = ((performance.now() - window.sysStartTime) / 1000).toFixed(2);
    var badge = document.getElementById('sys-live-timer');
    
    if(badge) {
      if (isError) {
        badge.outerHTML = '<span id="sys-live-timer" class="bg-red-100 text-red-800 font-bold px-3 py-1.5 rounded-lg border border-red-200 text-xs uppercase tracking-widest whitespace-nowrap shadow-sm min-w-max">Failed</span>';
      } else {
        badge.outerHTML = '<span id="sys-live-timer" class="bg-emerald-100 text-emerald-800 font-bold px-3 py-1.5 rounded-lg border border-emerald-200 text-xs uppercase tracking-widest whitespace-nowrap shadow-sm min-w-max">' + successLabel + ' in ' + finalTime + 's</span>';
      }
    }
  };

  window.setSysLoader = function(show) {
     var loader = document.getElementById('sys-config-loader');
     if(show) loader.classList.remove('hidden');
     else loader.classList.add('hidden');
  };

  // 1. DYNAMIC LOAD FROM SUPABASE (SETUP TABLE)
  window.loadSysConfig = async function() {
    window.setSysLoader(true);
    window.startSysTimer('Loading');
    
    try {
        const supa = window.supabase1;
        if (!supa) throw new Error("Supabase not initialized");

        const { data, error } = await supa.from('setup').select('key, value');
        if (error) throw error;

        // Build a quick lookup map from the database rows
        const configMap = {};
        (data || []).forEach(row => {
            configMap[row.key] = row.value;
        });

        // Map them to the UI inputs using the exact keys from the database
        document.getElementById('cfg-per-day-can').value = configMap['per day can count'] || '';
        document.getElementById('cfg-lookup-restrict').value = configMap['lookup restrict can qty'] || '';
        document.getElementById('cfg-min-entry').value = configMap['minimum entry qty'] || '';
        
        var onOffVal = String(configMap['per day onoff'] || 'OFF').trim().toUpperCase();
        document.getElementById('cfg-per-day-onoff').value = (onOffVal === 'ON') ? 'ON' : 'OFF';
        
        document.getElementById('cfg-vj-price').value = configMap['VJ_PRICE'] || '';

        window.setSysLoader(false);
        window.stopSysTimer('Loaded', false);

    } catch (err) {
        window.setSysLoader(false);
        window.stopSysTimer('Failed', true);
        alert("Database Error: " + err.message);
        console.error(err);
    }
  };

  // 2. DYNAMIC UPSERT TO SUPABASE (SETUP TABLE)
  window.saveSysConfig = async function() {
    if (!confirm("Are you sure you want to update these global configurations?")) return;
    
    window.setSysLoader(true);
    window.startSysTimer('Saving');

    try {
        const supa = window.supabase1;
        if (!supa) throw new Error("Supabase not initialized");

        // Format payload for bulk Upsert using exact table columns
        const updatePayload = [
            { key: 'per day can count', value: document.getElementById('cfg-per-day-can').value },
            { key: 'lookup restrict can qty', value: document.getElementById('cfg-lookup-restrict').value },
            { key: 'minimum entry qty', value: document.getElementById('cfg-min-entry').value },
            { key: 'per day onoff', value: document.getElementById('cfg-per-day-onoff').value },
            { key: 'VJ_PRICE', value: document.getElementById('cfg-vj-price').value }
        ];

        // Perform the Upsert, handling conflict on 'key' column
        const { error } = await supa.from('setup').upsert(updatePayload, { onConflict: 'key' });
        if (error) throw error;

        window.setSysLoader(false);
        window.stopSysTimer('Saved', false);
        
        setTimeout(() => alert("✅ Configurations successfully updated in the database!"), 100);

    } catch (err) {
        window.setSysLoader(false);
        window.stopSysTimer('Failed', true);
        alert("Connection error: " + err.message);
        console.error(err);
    }
  };

  window.tabActions['sys-config'] = window.loadSysConfig;