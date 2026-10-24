window.activeSysTimerInterval = null;
window.sysStartTime = 0;

// Tab Switching Logic
window.switchSysTab = function(tabId) {
    // Hide all content blocks
    document.querySelectorAll('.sys-tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById('sys-tab-' + tabId).classList.remove('hidden');

    // Reset button styles
    document.querySelectorAll('.sys-tab-btn').forEach(btn => {
        btn.className = "sys-tab-btn w-full text-left px-4 py-3 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-all border border-transparent shrink-0 md:shrink";
    });

    // Apply active styles to selected tab
    var activeBtn = document.getElementById('sys-tab-btn-' + tabId);
    if (activeBtn) {
        activeBtn.className = "sys-tab-btn w-full text-left px-4 py-3 rounded-xl font-black text-sm transition-all bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 shadow-sm shrink-0 md:shrink";
    }
};

// UI Timer & Loaders
window.startSysTimer = function(actionLabel) {
  var badge = document.getElementById('sys-live-timer');
  if (!badge) return;
  badge.outerHTML = '<span id="sys-live-timer" class="bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300 font-black px-3 py-1.5 rounded-lg text-xs tracking-widest uppercase border border-cyan-200 dark:border-cyan-800 shadow-inner flex items-center gap-1.5 min-w-max"><svg class="w-4 h-4 animate-spin text-cyan-500" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>' + actionLabel + ': <span id="sys-timer-sec">0.00</span>s</span>';
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
      badge.outerHTML = '<span id="sys-live-timer" class="bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 font-black px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-800 text-[10px] uppercase tracking-widest shadow-sm min-w-max">Failed</span>';
    } else {
      badge.outerHTML = '<span id="sys-live-timer" class="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 font-black px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 text-[10px] uppercase tracking-widest shadow-sm min-w-max">' + successLabel + ' in ' + finalTime + 's</span>';
    }
  }
};

window.setSysLoader = function(show) {
   var loader = document.getElementById('sys-config-loader');
   if(show) loader.classList.remove('hidden');
   else loader.classList.add('hidden');
};

// 1. DYNAMIC LOAD ALL DATA FROM SUPABASE
window.loadSysConfig = async function() {
  window.setSysLoader(true);
  window.startSysTimer('Loading');
  
  try {
      const supa = window.supabase1;
      if (!supa) throw new Error("Supabase not initialized");

      const { data, error } = await supa.from('setup').select('key, value');
      if (error) throw error;

      // Build mapping
      const configMap = {};
      (data || []).forEach(row => {
          configMap[row.key] = row.value;
      });

      // --- MAP OPERATIONS ---
      document.getElementById('cfg-per-day-can').value = configMap['per day can count'] || '';
      document.getElementById('cfg-lookup-restrict').value = configMap['lookup restrict can qty'] || '';
      document.getElementById('cfg-min-entry').value = configMap['minimum entry qty'] || '';
      var onOffVal = String(configMap['per day onoff'] || 'OFF').trim().toUpperCase();
      document.getElementById('cfg-per-day-onoff').value = (onOffVal === 'ON') ? 'ON' : 'OFF';
      document.getElementById('cfg-vj-price').value = configMap['VJ_PRICE'] || '';

      // --- MAP CRM LIMITS ---
      document.getElementById('cfg-crm-threshold').value = configMap['Dormant_Queue_Threshold'] || '';
      document.getElementById('cfg-crm-edit-rec').value = configMap['Editable_Recent_Records'] || '';
      document.getElementById('cfg-crm-max-comp').value = configMap['Max_Completed_Limit'] || '';

      // --- MAP CRM TEXT LISTS ---
      document.getElementById('cfg-crm-call-stat').value = configMap['Call_Statuses'] || '';
      document.getElementById('cfg-crm-cust-stat').value = configMap['Customer_Statuses'] || '';
      document.getElementById('cfg-crm-wip-stat').value = configMap['WIP_Statuses'] || '';
      document.getElementById('cfg-crm-comp-stat').value = configMap['Completed_Statuses'] || '';
      document.getElementById('cfg-crm-dorm-reasons').value = configMap['Dormancy_Reasons'] || '';
      document.getElementById('cfg-crm-feedback').value = configMap['Feedback_Categories'] || '';

      window.setSysLoader(false);
      window.stopSysTimer('Loaded', false);

  } catch (err) {
      window.setSysLoader(false);
      window.stopSysTimer('Failed', true);
      if(window.showToast) window.showToast("Database Fetch Error: " + err.message, "error");
      console.error(err);
  }
};

// 2. BULK UPSERT ALL DATA TO SUPABASE
window.saveSysConfig = async function() {
  if (!confirm("Are you sure you want to update these global configurations? This affects live operations.")) return;
  
  window.setSysLoader(true);
  window.startSysTimer('Saving');

  try {
      const supa = window.supabase1;
      if (!supa) throw new Error("Supabase not initialized");
      const currentUser = window.activeAdminSession ? window.activeAdminSession.username : 'ADMIN';

      // Build payload mapping exact keys to UI elements
      const updatePayload = [
          // Operations
          { key: 'per day can count', value: document.getElementById('cfg-per-day-can').value, created_by: currentUser },
          { key: 'lookup restrict can qty', value: document.getElementById('cfg-lookup-restrict').value, created_by: currentUser },
          { key: 'minimum entry qty', value: document.getElementById('cfg-min-entry').value, created_by: currentUser },
          { key: 'per day onoff', value: document.getElementById('cfg-per-day-onoff').value, created_by: currentUser },
          { key: 'VJ_PRICE', value: document.getElementById('cfg-vj-price').value, created_by: currentUser },
          
          // CRM 
          { key: 'Dormant_Queue_Threshold', value: document.getElementById('cfg-crm-threshold').value, created_by: currentUser },
          { key: 'Editable_Recent_Records', value: document.getElementById('cfg-crm-edit-rec').value, created_by: currentUser },
          { key: 'Max_Completed_Limit', value: document.getElementById('cfg-crm-max-comp').value, created_by: currentUser },
          { key: 'Call_Statuses', value: document.getElementById('cfg-crm-call-stat').value, created_by: currentUser },
          { key: 'Customer_Statuses', value: document.getElementById('cfg-crm-cust-stat').value, created_by: currentUser },
          { key: 'WIP_Statuses', value: document.getElementById('cfg-crm-wip-stat').value, created_by: currentUser },
          { key: 'Completed_Statuses', value: document.getElementById('cfg-crm-comp-stat').value, created_by: currentUser },
          { key: 'Dormancy_Reasons', value: document.getElementById('cfg-crm-dorm-reasons').value, created_by: currentUser },
          { key: 'Feedback_Categories', value: document.getElementById('cfg-crm-feedback').value, created_by: currentUser }
      ];

      const { error } = await supa.from('setup').upsert(updatePayload, { onConflict: 'key' });
      if (error) throw error;

      window.setSysLoader(false);
      window.stopSysTimer('Saved', false);
      
      if(window.showToast) window.showToast("Global configurations securely updated.", "success");

  } catch (err) {
      window.setSysLoader(false);
      window.stopSysTimer('Failed', true);
      if(window.showToast) window.showToast("Connection Error: " + err.message, "error");
      console.error(err);
  }
};

window.tabActions['sys-config'] = window.loadSysConfig;