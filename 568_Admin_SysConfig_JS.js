window.activeSysTimerInterval = null;
window.sysStartTime = 0;

// --- SECTION TOGGLE LOGIC ---
window.toggleSysSection = function(headerEl) {
    const bodyEl = headerEl.nextElementSibling;
    const chevron = headerEl.querySelector('.chevron-icon');
    
    if (bodyEl.classList.contains('hidden')) {
        // Open it
        bodyEl.classList.remove('hidden');
        chevron.classList.add('rotate-180');
    } else {
        // Close it
        bodyEl.classList.add('hidden');
        chevron.classList.remove('rotate-180');
    }
};

// --- UI Timers & Loaders ---
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

// --- DYNAMIC RENDERING LOGIC ---
window.loadSysConfig = async function() {
  window.setSysLoader(true);
  window.startSysTimer('Loading');
  
  try {
      const supa = window.supabase1;
      if (!supa) throw new Error("Supabase not initialized");

      // Fetch all columns, sort by tabname first, then key
      const { data, error } = await supa.from('setup').select('*').order('tabname', { ascending: true, nullsFirst: false }).order('key', { ascending: true });
      if (error) throw error;

      // Group data intelligently by tabname
      const groupedData = {};
      (data || []).forEach(row => {
          const tab = (row.tabname && row.tabname.trim() !== '') ? row.tabname.toUpperCase() : 'GENERAL SETUP';
          if (!groupedData[tab]) groupedData[tab] = [];
          groupedData[tab].push(row);
      });

      const container = document.getElementById('sys-dynamic-container');
      
      // Clear out the container but leave the loader element intact
      const loaderHtml = document.getElementById('sys-config-loader').outerHTML;
      container.innerHTML = loaderHtml;

      // Build the UI completely dynamically
      for (const tabName in groupedData) {
          const itemCount = groupedData[tabName].length;
          
          let sectionHtml = `
            <div class="mb-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
               
               <!-- Clickable Accordion Header -->
               <div onclick="window.toggleSysSection(this)" class="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900/80 transition-colors select-none">
                 <div class="flex items-center gap-3">
                   <div class="w-2 h-6 bg-cyan-500 rounded-full shrink-0"></div>
                   <h4 class="text-lg font-black text-slate-800 dark:text-white uppercase tracking-widest">${tabName} <span class="text-xs text-slate-400 dark:text-slate-500 font-bold tracking-normal ml-2">(${itemCount} items)</span></h4>
                 </div>
                 <div class="text-slate-400 transition-transform duration-300 transform chevron-icon">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M19 9l-7 7-7-7"></path></svg>
                 </div>
               </div>
               
               <!-- Collapsible Body (Hidden by default) -->
               <div class="section-body p-4 md:p-6 space-y-4 hidden">
          `;

          groupedData[tabName].forEach(row => {
              const safeId = row.id || '';
              const safeKey = row.key || '';
              const safeValue = row.value || '';
              const safeRemark = row.remark || '';
              const safeTab = row.tabname || '';
              const safeBy = row.created_by || 'SYSTEM';
              
              let safeDate = '--';
              if (row.created_at) {
                 const dt = new Date(row.created_at);
                 safeDate = dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
              }

              sectionHtml += `
                <div class="config-row p-5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl relative transition-colors shadow-sm" data-id="${safeId}">
                   <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
                      
                      <div class="lg:col-span-1">
                        <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">Key Name</label>
                        <input type="text" class="cfg-key w-full p-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-black text-slate-500 dark:text-slate-400 cursor-not-allowed shadow-inner" value="${safeKey}" readonly title="System Keys cannot be renamed.">
                      </div>
                      
                      <div class="lg:col-span-2">
                        <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">Value / Payload</label>
                        <textarea rows="1" class="cfg-val w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-cyan-500 transition-colors resize-y shadow-inner">${safeValue}</textarea>
                      </div>

                      <div class="lg:col-span-1">
                        <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">Tab Grouping</label>
                        <input type="text" class="cfg-tab w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-cyan-500 transition-colors shadow-inner" value="${safeTab}">
                      </div>
                      
                      <div class="lg:col-span-2">
                        <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">Remark / Usage Info</label>
                        <input type="text" class="cfg-remark w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-500 dark:text-slate-400 outline-none focus:ring-2 focus:ring-cyan-500 transition-colors shadow-inner" value="${safeRemark}">
                      </div>

                      <div class="lg:col-span-1">
                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">Created By</label>
                        <input type="text" disabled class="w-full p-3 bg-transparent border-none rounded-xl text-xs font-bold text-slate-400 cursor-not-allowed uppercase px-0" value="${safeBy}">
                      </div>

                      <div class="lg:col-span-1">
                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">Created Date</label>
                        <input type="text" disabled class="w-full p-3 bg-transparent border-none rounded-xl text-xs font-bold text-slate-400 cursor-not-allowed px-0" value="${safeDate}">
                      </div>

                   </div>
                </div>
              `;
          });

          sectionHtml += `</div></div>`;
          container.insertAdjacentHTML('beforeend', sectionHtml);
      }

      window.setSysLoader(false);
      window.stopSysTimer('Loaded', false);

  } catch (err) {
      window.setSysLoader(false);
      window.stopSysTimer('Failed', true);
      if(window.showToast) window.showToast("Database Fetch Error: " + err.message, "error");
      console.error(err);
  }
};

// --- ADD NEW CONFIGURATION BLOCK IN UI ---
window.addNewSysConfig = function() {
    const container = document.getElementById('sys-dynamic-container');
    
    // Create an "UNSAVED NEW CONFIGS" section if it doesn't exist
    let newSection = document.getElementById('section-UNSAVED');
    if (!newSection) {
        newSection = document.createElement('div');
        newSection.id = 'section-UNSAVED';
        newSection.className = 'mb-10 bg-indigo-50 dark:bg-indigo-900/20 rounded-3xl border-2 border-indigo-200 dark:border-indigo-800 overflow-hidden shadow-lg';
        newSection.innerHTML = `
          <div onclick="window.toggleSysSection(this)" class="bg-indigo-100 dark:bg-indigo-950 border-b border-indigo-200 dark:border-indigo-800 px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-indigo-200/50 dark:hover:bg-indigo-900/50 transition-colors select-none">
             <div class="flex items-center gap-3">
                 <div class="w-2 h-6 bg-indigo-500 rounded-full shrink-0"></div>
                 <h4 class="text-lg font-black text-indigo-800 dark:text-indigo-400 uppercase tracking-widest">✨ New Unsaved Configurations</h4>
             </div>
             <div class="text-indigo-400 transition-transform duration-300 transform rotate-180 chevron-icon">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M19 9l-7 7-7-7"></path></svg>
             </div>
          </div>
          <div class="section-body p-4 md:p-6 space-y-4"></div>
        `;
        // Inject right after the loader
        document.getElementById('sys-config-loader').insertAdjacentElement('afterend', newSection);
    }

    const rowHtml = `
      <div class="config-row p-5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm relative transition-colors" data-id="">
         <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
            <div class="lg:col-span-1">
              <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">Key Name</label>
              <input type="text" class="cfg-key w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-black text-indigo-600 dark:text-indigo-400 outline-none focus:ring-2 focus:ring-indigo-500 transition-colors" placeholder="e.g. NEW_API_KEY">
            </div>
            <div class="lg:col-span-2">
              <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">Value / Payload</label>
              <textarea rows="1" class="cfg-val w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500 transition-colors resize-y" placeholder="Value string or JSON"></textarea>
            </div>
            <div class="lg:col-span-1">
              <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">Tab Grouping</label>
              <input type="text" class="cfg-tab w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500 transition-colors" placeholder="e.g. NOTIFICATION">
            </div>
            <div class="lg:col-span-3">
              <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">Remark / Usage Info</label>
              <input type="text" class="cfg-remark w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-500 dark:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500 transition-colors" placeholder="Description of this key">
            </div>
            <div class="lg:col-span-1 flex items-end">
               <button type="button" onclick="this.closest('.config-row').remove()" class="w-full text-xs font-black text-rose-500 hover:text-white bg-rose-50 hover:bg-rose-500 px-4 py-3 rounded-xl transition-colors tracking-widest uppercase shadow-sm">🗑️ Discard</button>
            </div>
         </div>
      </div>
    `;
    
    // Ensure section body is open before adding row
    const sectionBody = newSection.querySelector('.section-body');
    const chevron = newSection.querySelector('.chevron-icon');
    sectionBody.classList.remove('hidden');
    chevron.classList.add('rotate-180');

    sectionBody.insertAdjacentHTML('beforeend', rowHtml);
    
    // Scroll to the new entry
    newSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

// --- BULK UPSERT ALL DATA TO SUPABASE ---
window.saveSysConfig = async function() {
  if (!confirm("Are you sure you want to update the global database configurations? This affects live operations.")) return;
  
  window.setSysLoader(true);
  window.startSysTimer('Saving');

  try {
      const supa = window.supabase1;
      if (!supa) throw new Error("Supabase not initialized");
      const currentUser = window.activeAdminSession ? window.activeAdminSession.username : 'ADMIN';

      const updatePayload = [];
      
      // Iterate through every rendered config row on the screen
      document.querySelectorAll('.config-row').forEach(row => {
          const id = row.getAttribute('data-id');
          const key = row.querySelector('.cfg-key').value.trim();
          
          if (!key) return; // Skip entirely blank rows

          const payloadObj = {
              key: key,
              value: row.querySelector('.cfg-val').value.trim(),
              remark: row.querySelector('.cfg-remark').value.trim(),
              tabname: row.querySelector('.cfg-tab').value.trim() || 'GENERAL SETUP' 
          };

          // If this is a brand new row (no existing ID), stamp the created_by user
          if (!id) {
              payloadObj.created_by = currentUser;
          }
          
          updatePayload.push(payloadObj);
      });

      // Upsert using 'key'
      const { error } = await supa.from('setup').upsert(updatePayload, { onConflict: 'key' });
      if (error) throw error;

      if(window.showToast) window.showToast("Global configurations securely updated.", "success");

      // Reload the screen to fetch fresh IDs and rearrange any changed tab groups
      await window.loadSysConfig();

  } catch (err) {
      window.setSysLoader(false);
      window.stopSysTimer('Failed', true);
      if(window.showToast) window.showToast("Connection Error: " + err.message, "error");
      console.error(err);
  }
};

window.tabActions['sys-config'] = window.loadSysConfig;