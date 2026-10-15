
  window.active360TimerInterval = null;

  window.openCustomer360 = function(cpn) {
    var modal = document.getElementById('admin-360-modal');
    modal.classList.remove('hidden');
    var container = document.getElementById('modal-360-content');

    // Skeletons UI
    container.innerHTML = `
      <div class="p-6 bg-slate-800/40 border border-slate-800 rounded-2xl animate-pulse h-32"></div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="p-6 bg-slate-800/40 border border-slate-800 rounded-2xl animate-pulse h-40"></div>
        <div class="p-6 bg-slate-800/40 border border-slate-800 rounded-2xl animate-pulse h-40"></div>
      </div>
      <div class="p-6 bg-slate-800/40 border border-slate-800 rounded-2xl animate-pulse h-48"></div>
    `;

    var startTime = performance.now();
    if(window.active360TimerInterval) clearInterval(window.active360TimerInterval);
    window.active360TimerInterval = setInterval(function() {
      var curr = ((performance.now() - startTime) / 1000).toFixed(2);
      var badge = document.getElementById('modal-360-timer');
      if(badge) badge.innerText = curr + "s";
    }, 50);

    var jobsCompleted = 0;
    var profileData = null, salesPaysData = null, historyData = null;

    function checkComplete() {
      jobsCompleted++;
      if (jobsCompleted === 3) {
        clearInterval(window.active360TimerInterval);
        var finalTime = ((performance.now() - startTime) / 1000).toFixed(2);
        document.getElementById('modal-360-timer').innerText = finalTime + "s";
        renderCustomer360UI(cpn, profileData, salesPaysData, historyData);
      }
    }

    google.script.run.withSuccessHandler(function(res) { profileData = res; checkComplete(); }).getProfileAndAlerts(cpn);
    google.script.run.withSuccessHandler(function(res) { salesPaysData = res; checkComplete(); }).getSalesAndPays(cpn);
    google.script.run.withSuccessHandler(function(res) { historyData = res; checkComplete(); }).getCRMHistory(cpn);
  };

  window.closeCustomer360 = function() {
    if(window.active360TimerInterval) clearInterval(window.active360TimerInterval);
    document.getElementById('admin-360-modal').classList.add('hidden');
  };

  function renderCustomer360UI(cpn, resProfile, resSalesPays, historyLogs) {
    var p = resProfile.profile;
    var container = document.getElementById('modal-360-content');
    
    if (!p) {
      container.innerHTML = '<p class="text-center text-rose-400 font-bold py-12">Customer profile missing for CPN: ' + cpn + '</p>';
      return;
    }

    var html = `
      <div class="bg-slate-800/60 border border-slate-700/60 p-5 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div class="flex items-center gap-3">
             <span class="bg-indigo-900 text-indigo-300 font-black px-2.5 py-1 rounded-md text-xs">${cpn}</span>
             <span class="bg-slate-900 border border-slate-700 text-slate-300 font-black px-2.5 py-1 rounded-md text-xs uppercase tracking-widest">${p.status}</span>
          </div>
          <h4 class="text-2xl font-black text-white mt-2">${p.name}</h4>
          <p class="text-sm font-bold text-slate-400 mt-0.5">${p.apt} &bull; Block ${p.blk} &bull; Door ${p.door} &bull; Ph: ${p.phone}</p>
        </div>
        <div class="flex gap-4">
          <div class="bg-slate-900/80 border border-slate-800 p-3 rounded-xl text-right">
            <p class="text-[10px] uppercase font-black text-slate-500">Can Deposit</p>
            <p class="text-lg font-black ${p.canDeposit > 0 ? 'text-rose-600' : 'text-emerald-600'}">₹${p.canDeposit.toLocaleString('en-IN')}</p>
          </div>
          <div class="bg-slate-900/80 border border-slate-800 p-3 rounded-xl text-right">
            <p class="text-[10px] uppercase font-black text-slate-500">Outstanding</p>
            <p class="text-lg font-black ${resProfile.liveData.outstanding > 0 ? 'text-rose-400' : 'text-emerald-400'}">₹${resProfile.liveData.outstanding.toLocaleString('en-IN')}</p>
          </div>
          <div class="bg-slate-900/80 border border-slate-800 p-3 rounded-xl text-right">
            <p class="text-[10px] uppercase font-black text-slate-500">Default Rate</p>
            <p class="text-lg font-black text-indigo-300">₹${p.rate}</p>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="bg-slate-800/40 border border-slate-800 p-4 rounded-2xl">
          <h5 class="text-xs font-black uppercase tracking-widest text-slate-400 mb-3 border-b border-slate-800 pb-2">Recent Deliveries (Sales)</h5>
          <div class="space-y-2">`;
    
    if (resSalesPays.sales.length === 0) html += '<p class="text-xs text-slate-500 italic">No recent sales records.</p>';
    else {
      resSalesPays.sales.forEach(s => {
        html += `<div class="flex justify-between items-center bg-slate-900/50 p-2.5 rounded-xl border border-slate-800/80 text-xs">
          <div><span class="font-black text-slate-200">${s.date}</span> <span class="text-slate-400 ml-2">(${s.actD} Full / ${s.actE} Emp)</span></div>
          <span class="font-black text-emerald-400">₹${s.amt}</span>
        </div>`;
      });
    }

    html += `</div></div>
        <div class="bg-slate-800/40 border border-slate-800 p-4 rounded-2xl">
          <h5 class="text-xs font-black uppercase tracking-widest text-slate-400 mb-3 border-b border-slate-800 pb-2">Payment History</h5>
          <div class="space-y-2">`;

    if (resSalesPays.pays.length === 0) html += '<p class="text-xs text-slate-500 italic">No recent payments recorded.</p>';
    else {
      resSalesPays.pays.forEach(pay => {
        html += `<div class="flex justify-between items-center bg-slate-900/50 p-2.5 rounded-xl border border-slate-800/80 text-xs">
          <div><span class="font-black text-slate-200">${pay.date}</span> <span class="bg-slate-800 px-1.5 py-0.5 rounded text-[9px] text-indigo-300 uppercase ml-2">${pay.mode}</span></div>
          <span class="font-black text-emerald-400">₹${pay.amt}</span>
        </div>`;
      });
    }

    html += `</div></div></div>
      <div class="bg-slate-800/40 border border-slate-800 p-4 rounded-2xl">
          <h5 class="text-xs font-black uppercase tracking-widest text-slate-400 mb-3 border-b border-slate-800 pb-2">CRM Interaction Logs</h5>
          <div class="space-y-2 max-h-40 overflow-y-auto hide-scrollbar">`;

    if (historyLogs.length === 0) html += '<p class="text-xs text-slate-500 italic">No CRM interactions logged.</p>';
    else {
      historyLogs.forEach(log => {
        html += `<div class="bg-slate-900/50 p-3 rounded-xl border border-slate-800/80 text-xs mb-2">
            <div class="flex justify-between border-b border-slate-800 pb-2 mb-2"><span class="font-black text-slate-300">${log.date} - ${log.status}</span><span class="font-bold text-slate-500">${log.lastUpdated} by ${log.actionBy}</span></div>
            <div class="grid grid-cols-2 gap-3 mb-2"><p><span class="text-slate-500 font-bold uppercase text-[9px] tracking-widest">Change</span> <br><span class="font-black text-indigo-400">${log.prevStatus} &rarr; ${log.newStatus}</span></p><p><span class="text-slate-500 font-bold uppercase text-[9px] tracking-widest">Reason</span> <br><span class="font-bold text-slate-300">${log.reason}</span></p></div>
            <div class="bg-slate-950 p-2 rounded-lg border border-slate-800/50"><p class="font-medium text-slate-400">${log.remark}</p></div>
        </div>`;
      });
    }

    html += `</div></div>`;
    container.innerHTML = html;
  }
