window.active360TimerInterval = null;

window.format360Date = function(isoStr) {
  if (!isoStr) return "-";
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return String(d.getDate()).padStart(2, '0') + "-" + months[d.getMonth()] + "-" + d.getFullYear();
};

window.openCustomer360 = async function(cpn, isInline = false) {
  if (!cpn) return;
  cpn = cpn.trim().toUpperCase();

  var targetId = isInline ? 'crm-inline-profile' : 'modal-360-content';
  var container = document.getElementById(targetId);
  
  if (!isInline) {
      var modal = document.getElementById('admin-360-modal');
      if (modal) modal.classList.remove('hidden');
      if (typeof window.toggleScrollLock === 'function') window.toggleScrollLock(true);
  }

  // Skeleton Loader with Dark Mode classes
  if (container) {
    container.innerHTML = `
      <div class="p-6 bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl animate-pulse h-32 transition-colors"></div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <div class="p-6 bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl animate-pulse h-40 transition-colors"></div>
        <div class="p-6 bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl animate-pulse h-40 transition-colors"></div>
      </div>
    `;
  }

  var startTime = performance.now();
  if (!isInline) {
      if (window.active360TimerInterval) clearInterval(window.active360TimerInterval);
      window.active360TimerInterval = setInterval(function() {
        var badge = document.getElementById('modal-360-timer');
        if (badge) badge.innerText = ((performance.now() - startTime) / 1000).toFixed(2) + "s";
      }, 50);
  }

  try {
    // 1. Fetch all data concurrently including the new notification_logs
    let [profRes, outRes, ordRes, delRes, salesRes, paysRes, logsRes, notiRes] = await Promise.all([
        window.supabase1.from('ac_customers').select('*').eq('cpn_no', cpn).maybeSingle(),
        window.supabase1.from('v_customer_outstanding').select('current_balance, cans').eq('cpn_no', cpn).maybeSingle(),
        window.supabase1.from('orders').select('*').eq('cpn_no', cpn).maybeSingle(),
        window.supabase1.from('deliveries').select('*').eq('cpn_no', cpn).order('created_at', {ascending: false}).limit(1).maybeSingle(),
        window.supabase1.from('sales').select('del_date, act_d, act_e, amount').eq('cpn_no', cpn).order('del_date', {ascending: false}).limit(5),
        window.supabase1.from('pays').select('payment_date, mode, amount').eq('cpn_no', cpn).order('payment_date', {ascending: false}).limit(5),
        window.supabase1.from('crm_dormant_call_logs').select('*').eq('cpn_no', cpn).order('last_updated', {ascending: false}).limit(5),
        window.supabase1.from('notification_logs').select('*').eq('cpn_no', cpn).order('created_at', {ascending: false}).limit(5)
    ]);

    if (profRes.error || !profRes.data) throw new Error("Customer not found in Master DB");

    const pData = profRes.data;
    const profile = {
        name: pData.poc1 || "Unknown", apt: pData.apartment || "-", blk: pData.block || "-", door: pData.door || "-", 
        phone: pData.con1 || "-", status: pData.final_status || "UNKNOWN", rate: pData.default_rate || 0, canDeposit: pData.can_deposit || 0
    };

    if (isInline) {
        var hiddenCpn = document.getElementById('crm-hidden-cpn');
        var hiddenStatus = document.getElementById('crm-hidden-prev-status');
        var dropdownStatus = document.getElementById('crm-cust-status');
        if (hiddenCpn) hiddenCpn.value = cpn;
        if (hiddenStatus) hiddenStatus.value = profile.status;
        if (dropdownStatus) dropdownStatus.value = profile.status;
    }

    const liveData = { 
        outstanding: outRes.data ? (Number(outRes.data.current_balance) || 0) : 0, 
        cansHeld: outRes.data ? (Number(outRes.data.cans) || 0) : 0 
    };
    
    const activeOrder = (ordRes && ordRes.data) ? {
        date: window.format360Date(ordRes.data.order_entered_at || ordRes.data.created_at),
        d: ordRes.data.ord_d || 0, e: ordRes.data.ord_e || 0, p: ordRes.data.pending_qty || 0,
        r: ordRes.data.replace_qty || 0, amt: ordRes.data.amount || 0, cmt: ordRes.data.order_comment || ""
    } : null;

    const activeDelivery = (delRes && delRes.data && delRes.data.status === 'NEW') ? {
        date: window.format360Date(delRes.data.del_date || delRes.data.order_date || delRes.data.created_at),
        d: delRes.data.ord_d || 0, e: delRes.data.ord_e || 0, p: delRes.data.pending_qty || 0,
        r: delRes.data.replace_qty || 0, amt: (Number(delRes.data.ord_d) || 0) * (Number(delRes.data.rate) || 0), cmt: delRes.data.delivery_comment || delRes.data.order_comment || ""
    } : null;

    const salesArr = (salesRes.data || []).map(s => ({ date: window.format360Date(s.del_date), actD: s.act_d, actE: s.act_e, amt: s.amount }));
    const paysArr = (paysRes.data || []).map(p => ({ date: window.format360Date(p.payment_date), mode: p.mode, amt: p.amount }));

    const logsArr = (logsRes.data || []).map(l => ({
        date: window.format360Date(l.last_updated), status: l.call_status || 'Pending', actionBy: l.action_taken_by || 'System',
        prevStatus: l.previous_customer_status || "-", newStatus: l.new_customer_status || "-", reason: l.reason_for_dormancy || "-", remark: l.telecaller_feedback || "-", lastUpdated: window.format360Date(l.last_updated)
    }));

    // Map Notification Logs
    const notiArr = (notiRes.data || []).map(n => ({
        date: window.format360Date(n.created_at), channel: String(n.channel).toUpperCase(), type: n.message_type || "-",
        status: String(n.status).toUpperCase(), cost: Number(n.estimated_cost || 0)
    }));

    if (!isInline) {
        clearInterval(window.active360TimerInterval);
        var badge = document.getElementById('modal-360-timer');
        if (badge) badge.innerText = ((performance.now() - startTime) / 1000).toFixed(2) + "s";
    }
    
    renderCustomer360UI(cpn, {profile, liveData}, activeOrder, activeDelivery, {sales: salesArr, pays: paysArr}, logsArr, notiArr, targetId, isInline);
    
    return { activeOrder: activeOrder };

  } catch (err) {
    console.error(err);
    if (!isInline) clearInterval(window.active360TimerInterval);
    if (window.showToast) window.showToast("360 Fetch Error: " + err.message, "error");
    if (container) container.innerHTML = '<p class="text-center text-rose-500 font-bold py-12 uppercase tracking-widest text-xs">Failed to load profile data: ' + err.message + '</p>';
  }
};

function renderCustomer360UI(cpn, resProfile, activeOrder, activeDelivery, resSalesPays, historyLogs, notiLogs, targetId, isInline) {
  var p = resProfile.profile;
  var container = document.getElementById(targetId);
  
  if (!p) {
    container.innerHTML = '<p class="text-center text-rose-500 font-bold py-12 uppercase tracking-widest text-xs">Customer profile missing.</p>';
    return;
  }

  const t_card = "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800";
  const t_text = "text-slate-800 dark:text-white";
  const t_sub  = "text-slate-500 dark:text-slate-400";
  const t_box  = "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800";
  const t_lbl  = "text-slate-400 dark:text-slate-500";

  var html = `
    <div class="${t_card} border p-5 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm transition-colors">
      <div>
        <div class="flex items-center gap-3">
           <span class="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 font-black px-2.5 py-1 rounded-md text-xs border border-indigo-200 dark:border-indigo-800 transition-colors">${cpn}</span>
           <span class="bg-slate-100 border border-slate-300 text-slate-600 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300 font-black px-2.5 py-1 rounded-md text-xs uppercase tracking-widest shadow-sm transition-colors">${p.status}</span>
        </div>
        <h4 class="text-xl font-black ${t_text} mt-2 uppercase tracking-wide transition-colors">${p.name}</h4>
        <p class="text-xs font-bold ${t_sub} mt-0.5 transition-colors">${p.apt} &bull; Block ${p.blk} &bull; Door ${p.door} &bull; Ph: ${p.phone}</p>
      </div>
      <div class="flex flex-wrap gap-2 md:gap-4 justify-start md:justify-end">
        <div class="${t_box} border p-2.5 rounded-xl text-right shadow-sm transition-colors">
          <p class="text-[9px] uppercase font-black ${t_lbl} tracking-widest">Cans Held</p>
          <p class="text-base font-black text-sky-500">${resProfile.liveData.cansHeld}</p>
        </div>
        <div class="${t_box} border p-2.5 rounded-xl text-right shadow-sm transition-colors">
          <p class="text-[9px] uppercase font-black ${t_lbl} tracking-widest">Can Deposit</p>
          <p class="text-base font-black ${p.canDeposit > 0 ? 'text-rose-500' : 'text-emerald-500'}">₹${p.canDeposit.toLocaleString('en-IN')}</p>
        </div>
        <div class="${t_box} border p-2.5 rounded-xl text-right shadow-sm transition-colors">
          <p class="text-[9px] uppercase font-black ${t_lbl} tracking-widest">Outstanding</p>
          <p class="text-base font-black ${resProfile.liveData.outstanding > 0 ? 'text-rose-500' : 'text-emerald-500'}">₹${resProfile.liveData.outstanding.toLocaleString('en-IN')}</p>
        </div>
        <div class="${t_box} border p-2.5 rounded-xl text-right shadow-sm transition-colors">
          <p class="text-[9px] uppercase font-black ${t_lbl} tracking-widest">Rate</p>
          <p class="text-base font-black text-indigo-600 dark:text-indigo-400">₹${p.rate}</p>
        </div>
      </div>
    </div>
  `;

  if (activeOrder) {
    let cmtHtml = activeOrder.cmt ? `<p class="mt-2 text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 p-2 rounded-lg border border-indigo-200 dark:border-indigo-500/20 w-full truncate" title="${activeOrder.cmt}">💬 ${activeOrder.cmt}</p>` : '';    

    html += `
    <div class="mt-4 bg-gradient-to-r from-indigo-50 dark:from-indigo-950/40 to-white dark:to-slate-900 border border-indigo-200 dark:border-indigo-800 p-4 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm transition-colors">
      <div class="w-full md:w-auto">
         <p class="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1 flex items-center gap-1.5 transition-colors"><span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Active Pending Order</p>
         <p class="text-sm font-bold text-slate-700 dark:text-slate-300 transition-colors">Placed: ${activeOrder.date}</p>
         ${cmtHtml}
      </div>
      <div class="flex gap-3 md:gap-5 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl shadow-inner w-full md:w-auto overflow-x-auto transition-colors">
         <div class="px-2"><p class="text-[9px] font-bold ${t_lbl} uppercase tracking-widest">ORD D</p><p class="font-black text-xl text-sky-500">${activeOrder.d}</p></div>
         <div class="px-2 border-l border-slate-200 dark:border-slate-800"><p class="text-[9px] font-bold ${t_lbl} uppercase tracking-widest">ORD E</p><p class="font-black text-xl ${t_text}">${activeOrder.e}</p></div>
         <div class="px-2 border-l border-slate-200 dark:border-slate-800"><p class="text-[9px] font-bold ${t_lbl} uppercase tracking-widest">PEND</p><p class="font-black text-xl text-amber-500">${activeOrder.p}</p></div>
         <div class="px-2 border-l border-slate-200 dark:border-slate-800"><p class="text-[9px] font-bold ${t_lbl} uppercase tracking-widest">REP</p><p class="font-black text-xl text-rose-500">${activeOrder.r}</p></div>
         <div class="px-2 border-l border-slate-200 dark:border-slate-800"><p class="text-[9px] font-bold ${t_lbl} uppercase tracking-widest">Est Amt</p><p class="font-black text-xl text-emerald-500">₹${activeOrder.amt}</p></div>
      </div>
    </div>`;
  }

  if (activeDelivery) {
    let cmtHtml = activeDelivery.cmt ? `<p class="mt-2 text-xs font-bold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/50 p-2 rounded-lg border border-sky-200 dark:border-sky-500/20 w-full truncate" title="${activeDelivery.cmt}">💬 ${activeDelivery.cmt}</p>` : '';
    
    html += `
    <div class="mt-4 bg-gradient-to-r from-sky-50 dark:from-sky-950/40 to-white dark:to-slate-900 border border-sky-200 dark:border-sky-800 p-4 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm transition-colors">
      <div class="w-full md:w-auto">
         <p class="text-[10px] font-black text-sky-600 dark:text-sky-400 uppercase tracking-widest mb-1 flex items-center gap-1.5 transition-colors"><span class="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span> Out For Delivery</p>
         <p class="text-sm font-bold text-slate-700 dark:text-slate-300 transition-colors">Scheduled: ${activeDelivery.date}</p>
         ${cmtHtml}
      </div>
      <div class="flex gap-3 md:gap-5 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl shadow-inner w-full md:w-auto overflow-x-auto transition-colors">
         <div class="px-2"><p class="text-[9px] font-bold ${t_lbl} uppercase tracking-widest">ORD D</p><p class="font-black text-xl text-sky-500">${activeDelivery.d}</p></div>
         <div class="px-2 border-l border-slate-200 dark:border-slate-800"><p class="text-[9px] font-bold ${t_lbl} uppercase tracking-widest">ORD E</p><p class="font-black text-xl ${t_text}">${activeDelivery.e}</p></div>
         <div class="px-2 border-l border-slate-200 dark:border-slate-800"><p class="text-[9px] font-bold ${t_lbl} uppercase tracking-widest">PEND</p><p class="font-black text-xl text-amber-500">${activeDelivery.p}</p></div>
         <div class="px-2 border-l border-slate-200 dark:border-slate-800"><p class="text-[9px] font-bold ${t_lbl} uppercase tracking-widest">REP</p><p class="font-black text-xl text-rose-500">${activeDelivery.r}</p></div>
         <div class="px-2 border-l border-slate-200 dark:border-slate-800"><p class="text-[9px] font-bold ${t_lbl} uppercase tracking-widest">Est Amt</p><p class="font-black text-xl text-emerald-500">₹${activeDelivery.amt}</p></div>
      </div>
    </div>`;
  }

  html += `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
      <div class="${t_card} border p-4 rounded-2xl shadow-sm transition-colors">
        <h5 class="text-xs font-black uppercase tracking-widest ${t_sub} mb-3 border-b border-slate-200 dark:border-slate-800 pb-2">Recent Deliveries</h5>
        <div class="space-y-2">`;
  
  if (resSalesPays.sales.length === 0) html += `<p class="text-xs ${t_sub} italic font-bold py-2">No recent sales records.</p>`;
  else {
    resSalesPays.sales.forEach(s => {
      html += `<div class="flex justify-between items-center ${t_box} p-3 rounded-xl border text-xs shadow-sm transition-colors">
        <div><span class="font-black ${t_text}">${s.date}</span> <span class="${t_sub} font-bold ml-2">(${s.actD} Full / ${s.actE} Emp)</span></div>
        <span class="font-black text-emerald-500">₹${s.amt}</span>
      </div>`;
    });
  }

  html += `</div></div>
      <div class="${t_card} border p-4 rounded-2xl shadow-sm transition-colors">
        <h5 class="text-xs font-black uppercase tracking-widest ${t_sub} mb-3 border-b border-slate-200 dark:border-slate-800 pb-2">Payment History</h5>
        <div class="space-y-2">`;

  if (resSalesPays.pays.length === 0) html += `<p class="text-xs ${t_sub} italic font-bold py-2">No recent payments recorded.</p>`;
  else {
    resSalesPays.pays.forEach(pay => {
      html += `<div class="flex justify-between items-center ${t_box} p-3 rounded-xl border text-xs shadow-sm transition-colors">
        <div><span class="font-black ${t_text}">${pay.date}</span> <span class="bg-indigo-50 dark:bg-slate-800 border border-indigo-200 dark:border-slate-700 px-2 py-0.5 rounded text-[9px] font-black text-indigo-600 dark:text-indigo-300 uppercase ml-2">${pay.mode}</span></div>
        <span class="font-black text-emerald-500">₹${pay.amt}</span>
      </div>`;
    });
  }

  // Row 3: History & Notification Logs side-by-side
  html += `</div></div></div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
      <div class="${t_card} border p-4 rounded-2xl shadow-sm transition-colors flex flex-col">
        <h5 class="text-xs font-black uppercase tracking-widest ${t_sub} mb-3 border-b border-slate-200 dark:border-slate-800 pb-2">Telecaller History Logs</h5>
        <div class="space-y-2.5 max-h-48 overflow-y-auto pr-1">`;

  if (historyLogs.length === 0) html += `<p class="text-xs ${t_sub} italic font-bold py-2">No CRM interactions logged.</p>`;
  else {
    historyLogs.forEach(log => {
      html += `<div class="${t_box} p-3.5 rounded-xl border text-xs shadow-sm transition-colors">
          <div class="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-2 mb-2"><span class="font-black ${t_text}">${log.date} - ${log.status}</span><span class="font-bold ${t_sub} text-[10px] uppercase tracking-wider">${log.lastUpdated} by ${log.actionBy}</span></div>
          <div class="grid grid-cols-2 gap-3 mb-2"><p><span class="${t_lbl} font-black uppercase text-[9px] tracking-widest">Change</span> <br><span class="font-black text-indigo-600 dark:text-indigo-400">${log.prevStatus} &rarr; ${log.newStatus}</span></p><p><span class="${t_lbl} font-black uppercase text-[9px] tracking-widest">Reason</span> <br><span class="font-bold ${t_text}">${log.reason}</span></p></div>
          <div class="bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2.5 rounded-lg transition-colors"><p class="font-medium ${t_sub}">${log.remark}</p></div>
      </div>`;
    });
  }

  html += `</div></div>
      <div class="${t_card} border p-4 rounded-2xl shadow-sm transition-colors flex flex-col">
        <h5 class="text-xs font-black uppercase tracking-widest ${t_sub} mb-3 border-b border-slate-200 dark:border-slate-800 pb-2 flex justify-between items-center">
            <span>Notification & Delivery Logs</span>
            <span class="bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded text-[9px]">OMNICHANNEL</span>
        </h5>
        <div class="space-y-2.5 max-h-48 overflow-y-auto pr-1">`;

  if (notiLogs.length === 0) html += `<p class="text-xs ${t_sub} italic font-bold py-2">No messages sent yet.</p>`;
  else {
    notiLogs.forEach(n => {
      // Dynamic styling based on channel & status
      let badgeColor = n.channel === 'WHATSAPP' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' :
                       n.channel === 'FIREBASE' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border-amber-200 dark:border-amber-800' :
                       'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400 border-sky-200 dark:border-sky-800';
      
      let statColor = n.status === 'SUCCESS' || n.status === 'DELIVERED' ? 'text-emerald-500' : 
                     (n.status === 'FAILED' ? 'text-rose-500' : 'text-amber-500');

      html += `<div class="${t_box} p-3.5 rounded-xl border text-xs shadow-sm transition-colors">
          <div class="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-2 mb-2">
              <span class="font-black ${t_text}">${n.date}</span>
              <span class="font-black border px-2 py-0.5 rounded text-[9px] uppercase tracking-wider shadow-sm ${badgeColor}">${n.channel}</span>
          </div>
          <div class="flex justify-between items-start">
              <div>
                 <p class="${t_lbl} font-black uppercase text-[9px] tracking-widest">Trigger Event</p>
                 <p class="font-bold ${t_text} mt-0.5">${n.type}</p>
              </div>
              <div class="text-right">
                  <p class="font-black uppercase text-[10px] tracking-widest ${statColor}">${n.status}</p>
                  <p class="${t_lbl} font-black text-[9px] tracking-widest mt-0.5">Est. Cost: ₹${n.cost.toFixed(2)}</p>
              </div>
          </div>
      </div>`;
    });
  }

  html += `</div></div></div>`;
  
  container.innerHTML = html;
}