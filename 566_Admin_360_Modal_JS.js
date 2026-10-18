// =====================================
  // GLOBAL CUSTOMER 360 MODAL ENGINE
  // =====================================
  window.active360TimerInterval = null;

  window.format360Date = function(isoStr) {
    if (!isoStr) return "-";
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return String(d.getDate()).padStart(2, '0') + "-" + months[d.getMonth()] + "-" + d.getFullYear();
  };

  window.openCustomer360 = async function(cpn) {
    if (!cpn) return;
    cpn = cpn.trim().toUpperCase();

    var modal = document.getElementById('admin-360-modal');
    if (modal) modal.classList.remove('hidden');
    var container = document.getElementById('modal-360-content');

    // Skeletons UI while fetching
    if (container) {
      container.innerHTML = `
        <div class="p-6 bg-slate-800/40 border border-slate-800 rounded-2xl animate-pulse h-32"></div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="p-6 bg-slate-800/40 border border-slate-800 rounded-2xl animate-pulse h-40"></div>
          <div class="p-6 bg-slate-800/40 border border-slate-800 rounded-2xl animate-pulse h-40"></div>
        </div>
        <div class="p-6 bg-slate-800/40 border border-slate-800 rounded-2xl animate-pulse h-48"></div>
      `;
    }

    var startTime = performance.now();
    if (window.active360TimerInterval) clearInterval(window.active360TimerInterval);
    window.active360TimerInterval = setInterval(function() {
      var curr = ((performance.now() - startTime) / 1000).toFixed(2);
      var badge = document.getElementById('modal-360-timer');
      if (badge) badge.innerText = curr + "s";
    }, 50);

    try {
      // 1. Fetch concurrently from Supabase (Profile, Sales, Pays, CRM Logs)
      const [profRes, salesRes, paysRes, logsRes] = await Promise.all([
        supabase1.from('ac_customers').select('*').eq('cpn_no', cpn).maybeSingle(),
        supabase1.from('sales').select('del_date, act_d, act_e, amount').eq('cpn_no', cpn).order('del_date', {ascending: false}).limit(5),
        supabase1.from('pays').select('payment_date, mode, amount').eq('cpn_no', cpn).order('payment_date', {ascending: false}).limit(5),
        supabase1.from('ac_automation_logs').select('*').eq('triggered_by', cpn).order('created_at', {ascending: false}).limit(5)
      ]);

      if (profRes.error) throw profRes.error;

      // 2. Format Profile
      const pData = profRes.data;
      const profile = pData ? {
          name: pData.poc1 || "Unknown", apt: pData.apartment || "-", blk: pData.block || "-", door: pData.door || "-", 
          phone: pData.con1 || "-", status: pData.final_status || "UNKNOWN", rate: pData.default_rate || 0,
          canDeposit: pData.can_deposit || 0
      } : null;

      const liveData = { outstanding: pData ? (Number(pData.os) || 0) : 0 };
      
      // 3. Format Lists
      const salesArr = (salesRes.data || []).map(s => ({
          date: window.format360Date(s.del_date), actD: s.act_d, actE: s.act_e, amt: s.amount
      }));
      
      const paysArr = (paysRes.data || []).map(p => ({
          date: window.format360Date(p.payment_date), mode: p.mode, amt: p.amount
      }));

      // NOTE: Adjust 'logsArr' mapping depending on how you store CRM logs in `ac_automation_logs`
      const logsArr = (logsRes.data || []).map(l => ({
          date: window.format360Date(l.created_at), status: l.date_range || 'Update', actionBy: l.staff_generated || 'System',
          prevStatus: "-", newStatus: "-", reason: l.supplier_generated || "-", remark: "-", lastUpdated: window.format360Date(l.created_at)
      }));

      // Render View
      clearInterval(window.active360TimerInterval);
      if (document.getElementById('modal-360-timer')) {
          document.getElementById('modal-360-timer').innerText = ((performance.now() - startTime) / 1000).toFixed(2) + "s";
      }
      
      renderCustomer360UI(cpn, {profile, liveData}, {sales: salesArr, pays: paysArr}, logsArr);

    } catch (err) {
      console.error(err);
      clearInterval(window.active360TimerInterval);
      if (container) container.innerHTML = '<p class="text-center text-rose-400 font-bold py-12">Error loading 360 view: ' + err.message + '</p>';
    }
  };

  window.closeCustomer360 = function() {
    if(window.active360TimerInterval) clearInterval(window.active360TimerInterval);
    var modal = document.getElementById('admin-360-modal');
    if (modal) modal.classList.add('hidden');
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