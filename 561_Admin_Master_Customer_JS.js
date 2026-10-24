window.masterCustomerData = [];
window.filteredCustomers = [];
window.dynamicStatuses = ['ACTIVE', 'INACTIVE'];
window.customerDisplayLimit = 50;
window.activeEditCPN = null;
window.activeEditPart = null;
window.wizardCurrentStep = 1;

window.loadMasterCustomers = async function () {
  var addBtn = document.getElementById('btnMasterCustomerAddNew');
  if (addBtn) {
      if (!window.hasWriteAccess('master-customer')) addBtn.classList.add('hidden');
      else addBtn.classList.remove('hidden');
  }

  var loadingEl = document.getElementById('cust-loading');
  if(loadingEl) loadingEl.classList.remove('hidden');
  
  var listContainer = document.getElementById('customer-list-container');
  if(listContainer) listContainer.innerHTML = '';
  
  try {
    const { data: setupData } = await window.supabase1.from('setup').select('value').eq('key', 'final_status_options').maybeSingle();
    if (setupData && setupData.value) {
        window.dynamicStatuses = setupData.value.split(',').map(s => s.trim());
    }

    const { data: custData, error } = await window.supabase1.from('ac_customers').select('*').order('id', { ascending: false });
    if (error) throw error;

    window.masterCustomerData = custData.map(d => ({
      sno: d.id,
      cpn: String(d.cpn_no || '').trim(),
      apt: d.apartment || '',
      blk: d.block || '',
      door: d.door || '',
      poc1: d.poc1 || '',
      con1: d.con1 || '',
      poc2: d.poc2 || '',
      con2: d.con2 || '',
      con3: d.con3 || '',
      payType: d.pay_type || '',
      clientStatus: d.client_status || '',
      gc: d.gc || '',
      clientStatusNew: d.client_status_new || '',
      finalStatus: d.final_status || 'ACTIVE',
      inactiveReason: d.inactive_reason || '',
      defaultRate: d.default_rate || 0,
      delColor: d.delivery_color || '',
      delRemark: d.delivery_remark || '',
      passwordSet: !!d.password_hash,
      advance: d.can_deposit || 0,
      overdueWaiver: d.overdue_waiver || 'FALSE',
      maxOrdD: d.maximum_ord_d || 0,
      maxOrdE: d.maximum_ord_e || 0,
      email: d.mail_id || '',
      createdAt: d.created_at || ''
    }));

    window.filteredCustomers = window.masterCustomerData;
    window.customerDisplayLimit = 50;
    
    var titleEl = document.getElementById('cust-header-title');
    if(titleEl) titleEl.innerText = "Customer Directory (" + custData.length + " Total)";
    
    window.renderCustomerCards();

  } catch (err) {
    if(window.showToast) window.showToast("Failed to load database: " + err.message, "error");
  } finally {
    if(loadingEl) loadingEl.classList.add('hidden');
  }
};

window.filterCustomers = function () {
  var searchInput = document.getElementById('cust-search');
  var query = searchInput ? searchInput.value.toLowerCase().trim() : "";
  window.customerDisplayLimit = 50; 
  
  if (!query) {
    window.filteredCustomers = window.masterCustomerData;
  } else {
    window.filteredCustomers = window.masterCustomerData.filter(function (c) {
      return (c.cpn.toLowerCase().indexOf(query) > -1) ||
             (String(c.poc1).toLowerCase().indexOf(query) > -1) ||
             (String(c.apt).toLowerCase().indexOf(query) > -1) ||
             (String(c.con1).indexOf(query) > -1);
    });
  }
  window.renderCustomerCards();
};

window.renderCustomerCards = function () {
  var container = document.getElementById('customer-list-container');
  if(!container) return;
  var html = '';
  var limit = Math.min(window.customerDisplayLimit, window.filteredCustomers.length);
  var canEdit = window.hasWriteAccess('master-customer');

  if (window.filteredCustomers.length === 0) {
    container.innerHTML = '<div class="text-center py-12"><div class="text-5xl mb-4 opacity-50">🔍</div><p class="text-xl font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest transition-colors">No customers found.</p></div>';
    return;
  }

  for (var i = 0; i < limit; i++) {
    var c = window.filteredCustomers[i];
    var uId = 'card-cust-' + i;
    var statusBadge = c.finalStatus.toUpperCase() === 'INACTIVE' 
        ? '<span class="px-3 py-1 bg-rose-100 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 shadow-sm text-rose-700 dark:text-rose-400 font-black rounded-lg text-[10px] tracking-widest uppercase transition-colors">INACTIVE</span>'
        : '<span class="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 shadow-sm text-emerald-700 dark:text-emerald-400 font-black rounded-lg text-[10px] tracking-widest uppercase transition-colors">' + c.finalStatus + '</span>';

    var editBtnClass = "absolute top-4 right-4 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 p-1.5 rounded-lg border border-transparent hover:border-indigo-200 dark:hover:border-indigo-800 transition-colors outline-none shadow-sm hover:shadow";
    var editSvg = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>';

    var editBtn1 = canEdit ? '<button onclick="window.openEditPart(\'' + c.cpn + '\', 1)" class="' + editBtnClass + '">' + editSvg + '</button>' : '';
    var editBtn2 = canEdit ? '<button onclick="window.openEditPart(\'' + c.cpn + '\', 2)" class="' + editBtnClass + '">' + editSvg + '</button>' : '';
    var editBtn3 = canEdit ? '<button onclick="window.openEditPart(\'' + c.cpn + '\', 3)" class="' + editBtnClass + '">' + editSvg + '</button>' : '';
    var editBtn5 = canEdit ? '<button onclick="window.openEditPart(\'' + c.cpn + '\', 5)" class="' + editBtnClass + '">' + editSvg + '</button>' : '';
    var editBtn6 = canEdit ? '<button onclick="window.openEditPart(\'' + c.cpn + '\', 6)" class="' + editBtnClass + '">' + editSvg + '</button>' : '';

    var dangerousActionsArea = '';
    if (canEdit) {
        dangerousActionsArea = '<div class="bg-slate-100 dark:bg-slate-900/50 p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 border-dashed flex flex-col justify-center space-y-3 transition-colors">' +
          (c.passwordSet 
            ? '<button onclick="window.triggerActionModal(\'REVOKE\', \'' + c.cpn + '\')" class="w-full py-2.5 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400 border border-amber-300 dark:border-amber-800 shadow-sm font-black rounded-xl hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors text-[10px] tracking-widest uppercase outline-none active:scale-95">Revoke Password</button>'
            : '<div class="w-full py-2.5 bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-300 dark:border-slate-700 font-bold rounded-xl text-center text-[10px] tracking-widest uppercase transition-colors">No Password Set</div>') +
          '<button onclick="window.triggerActionModal(\'DELETE\', \'' + c.cpn + '\')" class="w-full py-2.5 bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 shadow-sm font-black rounded-xl hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors text-[10px] tracking-widest uppercase outline-none active:scale-95"><svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg> Delete Record</button>' +
        '</div>';
    } else {
        dangerousActionsArea = '<div class="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-center h-full shadow-inner transition-colors"><p class="text-slate-400 dark:text-slate-500 font-bold text-sm uppercase tracking-widest">Read Only Mode</p></div>';
    }

    var cleanCpn = String(c.cpn || '').trim().toUpperCase();

    html += '<div class="bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-3xl overflow-hidden shadow-sm transition-colors hover:border-indigo-300 dark:hover:border-indigo-600">' +
      '<div class="flex items-center justify-between p-4 md:p-5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors" onclick="window.toggleAccordion(\'' + uId + '\', \'icon-' + uId + '\')">' +
        '<div class="flex items-center gap-4 md:gap-5">' +
          '<div class="h-12 w-12 md:h-14 md:w-14 bg-indigo-50 dark:bg-indigo-900/30 rounded-full flex items-center justify-center shrink-0 border border-indigo-200 dark:border-indigo-800 shadow-inner transition-colors"><svg class="w-6 h-6 md:w-7 md:h-7 text-indigo-500 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg></div>' +
          '<div>' +
            '<div class="flex flex-wrap items-center gap-2 mb-1"><h4 class="text-lg md:text-xl font-black text-slate-800 dark:text-white uppercase transition-colors">' + (c.poc1 || 'No Name') + '</h4>' + statusBadge + '</div>' +
            '<div class="flex flex-wrap items-center gap-1.5 text-xs md:text-sm font-bold text-slate-500 dark:text-slate-400 tracking-widest uppercase transition-colors">' +
               '<span class="inline-flex items-center gap-1 px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors cursor-pointer group shadow-sm" onclick="event.stopPropagation(); window.openCustomer360(\'' + cleanCpn + '\')">' + cleanCpn + '<svg class="w-3 h-3 text-indigo-400 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg></span>' + 
               '<span class="mx-1 text-slate-300 dark:text-slate-600">&bull;</span> <span class="truncate">' + c.apt + ' ' + c.blk + ' ' + c.door + '</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<svg id="icon-' + uId + '" class="w-6 h-6 text-slate-400 dark:text-slate-500 transition-transform duration-200 shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M19 9l-7 7-7-7"></path></svg>' +
      '</div>' +
      
      '<div id="' + uId + '" class="accordion-content bg-slate-50 dark:bg-slate-900 transition-colors"><div class="overflow-hidden p-4 md:p-6 border-t border-slate-200 dark:border-slate-700 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5 transition-colors">' +
        
        '<div class="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm relative transition-colors">' +
          editBtn1 +
          '<h5 class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 border-b border-slate-100 dark:border-slate-700 pb-2 transition-colors">Part 1: Primary Info</h5>' +
          '<div class="space-y-2">' +
             '<p class="text-sm font-black text-slate-800 dark:text-slate-200 transition-colors"><span class="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block mb-0.5">Location</span> ' + c.apt + ' ' + c.blk + ' ' + c.door + '</p>' +
             '<p class="text-sm font-black text-slate-800 dark:text-slate-200 transition-colors"><span class="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block mb-0.5">Contact</span> ' + c.con1 + '</p>' +
             '<p class="text-sm font-black text-slate-800 dark:text-slate-200 truncate transition-colors" title="'+(c.email || '-')+'"><span class="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block mb-0.5">Email</span> ' + (c.email || '-') + '</p>' +
             '<p class="text-sm font-black text-slate-800 dark:text-slate-200 transition-colors"><span class="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block mb-0.5">Pay Type</span> ' + (c.payType || '-') + '</p>' +
          '</div>' +
        '</div>' +

        '<div class="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm relative transition-colors">' +
          editBtn2 +
          '<h5 class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 border-b border-slate-100 dark:border-slate-700 pb-2 transition-colors">Part 2: Master Status</h5>' +
          '<div class="space-y-2">' +
             '<p class="text-sm font-black text-slate-800 dark:text-slate-200 transition-colors"><span class="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block mb-0.5">Status</span> ' + c.finalStatus + '</p>' +
             '<p class="text-sm font-black text-slate-800 dark:text-slate-200 transition-colors"><span class="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block mb-0.5">Reason Logged</span> ' + (c.inactiveReason || '-') + '</p>' +
          '</div>' +
        '</div>' +

        '<div class="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm relative transition-colors">' +
          editBtn3 +
          '<h5 class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 border-b border-slate-100 dark:border-slate-700 pb-2 transition-colors">Part 3: Delivery Config</h5>' +
          '<div class="space-y-2">' +
             '<p class="text-sm font-black text-indigo-700 dark:text-indigo-400 transition-colors"><span class="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block mb-0.5">Default Rate</span> ₹' + (c.defaultRate || '0') + '</p>' +
             '<p class="text-sm font-black text-slate-800 dark:text-slate-200 transition-colors"><span class="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block mb-0.5">Door Color Tag</span> ' + (c.delColor || 'NONE') + '</p>' +
             '<p class="text-sm font-black text-slate-800 dark:text-slate-200 transition-colors"><span class="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block mb-0.5">Delivery Instruction</span> ' + (c.delRemark || '-') + '</p>' +
          '</div>' +
        '</div>' +

        '<div class="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm relative flex flex-col justify-center text-center transition-colors">' +
          editBtn5 +
          '<h5 class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 border-b border-slate-100 dark:border-slate-700 pb-2 text-left transition-colors">Part 5: Can Deposit</h5>' +
          '<p class="text-4xl md:text-5xl font-black text-emerald-600 dark:text-emerald-400 mt-2 mb-2 drop-shadow-sm transition-colors">₹' + c.advance + '</p>' +
        '</div>' +

        '<div class="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm relative transition-colors">' +
          editBtn6 +
          '<h5 class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 border-b border-slate-100 dark:border-slate-700 pb-2 transition-colors">Part 6: Waivers & Limits</h5>' +
          '<div class="space-y-3">' +
             '<div class="flex gap-4">' +
                '<div><p class="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mb-0.5 transition-colors">Max Ord D</p><p class="text-lg font-black text-slate-800 dark:text-white bg-slate-100 dark:bg-slate-900 px-3 py-1 rounded text-center transition-colors">' + (c.maxOrdD || '0') + '</p></div>' +
                '<div><p class="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mb-0.5 transition-colors">Max Ord E</p><p class="text-lg font-black text-slate-800 dark:text-white bg-slate-100 dark:bg-slate-900 px-3 py-1 rounded text-center transition-colors">' + (c.maxOrdE || '0') + '</p></div>' +
             '</div>' +
             '<p class="text-sm font-black text-slate-800 dark:text-slate-200 transition-colors"><span class="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block mb-0.5">Overdue Waiver Status</span> ' + (c.overdueWaiver || 'No') + '</p>' +
          '</div>' +
        '</div>' +

        dangerousActionsArea +

      '</div></div>' +
    '</div>';
  }

  if (window.customerDisplayLimit < window.filteredCustomers.length) {
    html += '<div class="text-center pt-6"><button onclick="window.loadMoreCustomers()" class="px-8 py-3 bg-slate-800 dark:bg-indigo-600 hover:bg-slate-900 dark:hover:bg-indigo-700 text-white font-black rounded-xl transition-colors shadow-lg tracking-widest uppercase text-sm outline-none active:scale-95">Load More Customers...</button></div>';
  }

  container.innerHTML = html;
};

window.loadMoreCustomers = function() {
  window.customerDisplayLimit += 50;
  window.renderCustomerCards();
};

window.exportMasterCustomersToCSV = function() {
    if (!window.masterCustomerData || window.masterCustomerData.length === 0) {
        if(window.showToast) return window.showToast("No data to export.", "warning");
        return;
    }

    var csvRows = [];
    var headers = ["CPN_NO", "APARTMENT", "BLOCK", "DOOR", "POC1", "CON1", "POC2", "CON2", "CON3", "EMAIL", "PAY_TYPE", "DEFAULT_RATE", "DELIVERY_COLOR", "DELIVERY_REMARK", "CAN_DEPOSIT", "MAX_ORD_D", "MAX_ORD_E", "OVERDUE_WAIVER", "FINAL_STATUS", "INACTIVE_REASON", "HAS_PASSWORD", "CLIENT_STATUS", "CLIENT_STATUS_NEW", "GC", "CREATED_AT"];
    csvRows.push(headers.join(","));

    window.masterCustomerData.forEach(function(row) {
        var values = [
            '"' + (row.cpn || "") + '"',
            '"' + (row.apt || "") + '"',
            '"' + (row.blk || "") + '"',
            '"' + (row.door || "") + '"',
            '"' + (row.poc1 || "") + '"',
            '"' + (row.con1 || "") + '"',
            '"' + (row.poc2 || "") + '"',
            '"' + (row.con2 || "") + '"',
            '"' + (row.con3 || "") + '"',
            '"' + (row.email || "") + '"',
            '"' + (row.payType || "") + '"',
            row.defaultRate || 0,
            '"' + (row.delColor || "") + '"',
            '"' + (row.delRemark || "") + '"',
            row.advance || 0,
            row.maxOrdD || 0,
            row.maxOrdE || 0,
            '"' + (row.overdueWaiver || "FALSE") + '"',
            '"' + (row.finalStatus || "") + '"',
            '"' + (row.inactiveReason || "") + '"',
            row.passwordSet ? '"TRUE"' : '"FALSE"',
            '"' + (row.clientStatus || "") + '"',
            '"' + (row.clientStatusNew || "") + '"',
            '"' + (row.gc || "") + '"',
            '"' + (row.createdAt || "") + '"'
        ];
        csvRows.push(values.join(","));
    });

    var csvString = csvRows.join("\n");
    var blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    
    var link = document.createElement("a");
    if (link.download !== undefined) { 
        var url = URL.createObjectURL(blob);
        var dateStamp = new Date().toISOString().split('T')[0];
        link.setAttribute("href", url);
        link.setAttribute("download", "WOWDROPS_Master_Customers_" + dateStamp + ".csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        if(window.showToast) window.showToast("Export download started.", "success");
    }
};

window.openAddCustomerWizard = function () {
  document.getElementById('add-apt').value = ''; document.getElementById('add-blk').value = ''; document.getElementById('add-door').value = '';
  document.getElementById('add-poc1').value = ''; document.getElementById('add-con1').value = '';
  document.getElementById('add-poc2').value = ''; document.getElementById('add-email').value = ''; document.getElementById('add-paytype').value = '';
  document.getElementById('add-rate').value = '40'; document.getElementById('add-color').value = ''; document.getElementById('add-remark').value = '';
  document.getElementById('add-advance').value = '0'; document.getElementById('add-maxd').value = '3'; document.getElementById('add-maxe').value = '3';
  document.getElementById('add-ow').value = 'FALSE'; 
  
  window.wizardCurrentStep = 1;
  window.updateWizardUI();
  document.getElementById('modal-wizard').classList.remove('hidden');
  if(typeof window.toggleScrollLock === 'function') window.toggleScrollLock(true);
};

window.wizardNext = function () {
  if (window.wizardCurrentStep === 1) {
    if (!document.getElementById('add-apt').value || !document.getElementById('add-blk').value || !document.getElementById('add-door').value || !document.getElementById('add-poc1').value || !document.getElementById('add-con1').value) {
        if(window.showToast) return window.showToast("Please fill all mandatory primary fields.", "warning");
        return;
    }
    window.wizardCurrentStep = 2;
  } else if (window.wizardCurrentStep === 2) {
    if (!document.getElementById('add-rate').value) {
        if(window.showToast) return window.showToast("Default Rate is mandatory.", "warning");
        return;
    }
    window.wizardCurrentStep = 3;
  } else if (window.wizardCurrentStep === 3) {
    var advance = parseFloat(document.getElementById('add-advance').value);
    if (isNaN(advance) || advance < 0) {
        if(window.showToast) return window.showToast("Deposit must be 0 or a positive number.", "warning");
        return;
    }
    if (!document.getElementById('add-maxd').value || !document.getElementById('add-maxe').value) {
        if(window.showToast) return window.showToast("Please fill Limits & Waivers.", "warning");
        return;
    }
    
    document.getElementById('prev-abd').innerText = document.getElementById('add-apt').value + ' / ' + document.getElementById('add-blk').value + ' / ' + document.getElementById('add-door').value;
    document.getElementById('prev-pay').innerText = document.getElementById('add-paytype').value || '-';
    document.getElementById('prev-poc1').innerText = document.getElementById('add-poc1').value + ' (' + document.getElementById('add-con1').value + ')';
    document.getElementById('prev-poc2').innerText = document.getElementById('add-poc2').value || '-';
    document.getElementById('prev-email').innerText = document.getElementById('add-email').value || '-';
    document.getElementById('prev-rate').innerText = '₹' + document.getElementById('add-rate').value;
    document.getElementById('prev-del').innerText = (document.getElementById('add-color').value || 'NONE') + ' | ' + (document.getElementById('add-remark').value || '-');
    document.getElementById('prev-adv').innerText = '₹' + advance;
    document.getElementById('prev-max').innerText = document.getElementById('add-maxd').value + ' / ' + document.getElementById('add-maxe').value;
    document.getElementById('prev-wvr').innerText = document.getElementById('add-ow').value;

    window.wizardCurrentStep = 4;
  }
  window.updateWizardUI();
};

window.wizardBack = function () {
  if (window.wizardCurrentStep > 1) window.wizardCurrentStep--;
  window.updateWizardUI();
};

window.updateWizardUI = function () {
  document.getElementById('wiz-step-1').classList.add('hidden');
  document.getElementById('wiz-step-2').classList.add('hidden');
  document.getElementById('wiz-step-3').classList.add('hidden');
  var step4 = document.getElementById('wiz-step-4');
  if(step4) step4.classList.add('hidden');
  
  var currentStepEl = document.getElementById('wiz-step-' + window.wizardCurrentStep);
  if(currentStepEl) currentStepEl.classList.remove('hidden');
  
  document.getElementById('wiz-ind-1').className = "h-2 flex-1 rounded-full transition-colors shadow-inner " + (window.wizardCurrentStep >= 1 ? "bg-indigo-600 dark:bg-indigo-500" : "bg-slate-200 dark:bg-slate-700");
  document.getElementById('wiz-ind-2').className = "h-2 flex-1 rounded-full transition-colors shadow-inner " + (window.wizardCurrentStep >= 2 ? "bg-indigo-600 dark:bg-indigo-500" : "bg-slate-200 dark:bg-slate-700");
  document.getElementById('wiz-ind-3').className = "h-2 flex-1 rounded-full transition-colors shadow-inner " + (window.wizardCurrentStep >= 3 ? "bg-indigo-600 dark:bg-indigo-500" : "bg-slate-200 dark:bg-slate-700");
  var ind4 = document.getElementById('wiz-ind-4');
  if(ind4) ind4.className = "h-2 flex-1 rounded-full transition-colors shadow-inner " + (window.wizardCurrentStep >= 4 ? "bg-indigo-600 dark:bg-indigo-500" : "bg-slate-200 dark:bg-slate-700");

  document.getElementById('wiz-btn-back').classList.toggle('hidden', window.wizardCurrentStep === 1);
  document.getElementById('wiz-btn-next').classList.toggle('hidden', window.wizardCurrentStep === 4);
  document.getElementById('wiz-btn-save').classList.toggle('hidden', window.wizardCurrentStep !== 4);
};

window.submitNewCustomer = async function () {
  var advance = parseFloat(document.getElementById('add-advance').value);
  var btn = document.getElementById('wiz-btn-save'); 
  btn.innerHTML = '<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Saving...'; 
  btn.disabled = true;
  
  try {
    var con1 = document.getElementById('add-con1').value.trim();
    if (con1) {
      const { data: dupCheck } = await window.supabase1.from('ac_customers').select('cpn_no').eq('con1', con1).limit(1);
      if (dupCheck && dupCheck.length > 0) throw new Error("Duplicate Alert: Contact number " + con1 + " is already registered to " + dupCheck[0].cpn_no + ".");
    }

    const { data: maxCust } = await window.supabase1.from('ac_customers').select('id').order('id', { ascending: false }).limit(1);
    let nextId = (maxCust && maxCust.length > 0) ? maxCust[0].id + 1 : 1;
    let newCpn = "CPN" + nextId;

    const payload = {
      id: nextId,
      cpn_no: newCpn,
      apartment: document.getElementById('add-apt').value,
      block: document.getElementById('add-blk').value,
      door: document.getElementById('add-door').value,
      poc1: document.getElementById('add-poc1').value,
      con1: con1,
      poc2: document.getElementById('add-poc2').value,
      mail_id: document.getElementById('add-email').value,
      pay_type: document.getElementById('add-paytype').value,
      default_rate: document.getElementById('add-rate').value,
      delivery_color: document.getElementById('add-color').value,
      delivery_remark: document.getElementById('add-remark').value,
      can_deposit: advance,
      maximum_ord_d: document.getElementById('add-maxd').value,
      maximum_ord_e: document.getElementById('add-maxe').value,
      overdue_waiver: document.getElementById('add-ow').value,
      final_status: 'ACTIVE',
      created_at: new Date().toISOString(),
      created_by: window.activeAdminSession ? window.activeAdminSession.username : 'SYSTEM'
    };

    const { error } = await window.supabase1.from('ac_customers').insert([payload]);
    if (error) throw error;

    window.closeModal('modal-wizard'); 
    if(window.showToast) window.showToast("Customer " + newCpn + " added successfully!", "success");
    window.loadMasterCustomers();
    
  } catch (err) {
    if(window.showToast) window.showToast(err.message, "error");
    else alert(err.message);
  } finally {
    btn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg> Save & Create'; 
    btn.disabled = false;
  }
};

window.openEditPart = function (cpn, partId) {
  window.activeEditCPN = cpn; window.activeEditPart = partId;
  var c = window.masterCustomerData.find(function(x) { return x.cpn === cpn; });
  if (!c) return;
  
  document.getElementById('edit-modal-cpn').innerText = cpn;
  var body = document.getElementById('edit-modal-body');
  var html = '';

  if (partId === 1) {
    html += '<div class="grid grid-cols-2 gap-4">';
    html += '<div><label class="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest transition-colors">Apt *</label><input type="text" id="ep1-apt" value="' + c.apt + '" class="w-full mt-1 p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-inner rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-400 dark:focus:border-indigo-500 transition-colors"></div>';
    html += '<div><label class="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest transition-colors">Blk *</label><input type="text" id="ep1-blk" value="' + c.blk + '" class="w-full mt-1 p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-inner rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-400 dark:focus:border-indigo-500 transition-colors"></div>';
    html += '<div><label class="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest transition-colors">Door *</label><input type="text" id="ep1-door" value="' + c.door + '" class="w-full mt-1 p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-inner rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-400 dark:focus:border-indigo-500 transition-colors"></div>';
    html += '<div class="col-span-2 border-t border-slate-200 dark:border-slate-700 my-1 transition-colors"></div>';
    html += '<div><label class="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest transition-colors">POC 1 *</label><input type="text" id="ep1-poc1" value="' + c.poc1 + '" class="w-full mt-1 p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-inner rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-400 dark:focus:border-indigo-500 transition-colors"></div>';
    html += '<div><label class="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest transition-colors">Con 1 *</label><input type="text" id="ep1-con1" value="' + c.con1 + '" class="w-full mt-1 p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-inner rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-400 dark:focus:border-indigo-500 transition-colors"></div>';
    html += '<div><label class="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest transition-colors">POC 2</label><input type="text" id="ep1-poc2" value="' + c.poc2 + '" class="w-full mt-1 p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-inner rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-400 dark:focus:border-indigo-500 transition-colors"></div>';
    html += '<div><label class="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest transition-colors">Con 2</label><input type="text" id="ep1-con2" value="' + c.con2 + '" class="w-full mt-1 p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-inner rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-400 dark:focus:border-indigo-500 transition-colors"></div>';
    html += '<div><label class="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest transition-colors">Con 3</label><input type="text" id="ep1-con3" value="' + c.con3 + '" class="w-full mt-1 p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-inner rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-400 dark:focus:border-indigo-500 transition-colors"></div>';
    html += '<div><label class="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest transition-colors">Email</label><input type="email" id="ep1-email" value="' + c.email + '" class="w-full mt-1 p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-inner rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-400 dark:focus:border-indigo-500 transition-colors"></div>';
    html += '<div><label class="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest transition-colors">Pay Type</label><select id="ep1-pt" class="w-full mt-1 p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-inner rounded-xl font-bold text-slate-700 dark:text-white outline-none focus:border-indigo-400 dark:focus:border-indigo-500 color-scheme-dark transition-colors"><option value="">Select</option><option value="ONLINE" '+(c.payType==='ONLINE'?'selected':'')+'>ONLINE</option><option value="CASH" '+(c.payType==='CASH'?'selected':'')+'>CASH</option></select></div>';
    html += '<div><label class="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest transition-colors">Client Status New</label><input type="text" id="ep1-csn" value="' + c.clientStatusNew + '" class="w-full mt-1 p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-inner rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-400 dark:focus:border-indigo-500 transition-colors"></div>';
    html += '<div><label class="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest transition-colors">GC</label><input type="text" id="ep1-gc" value="' + c.gc + '" class="w-full mt-1 p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-inner rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-400 dark:focus:border-indigo-500 transition-colors"></div>';
    html += '<div><label class="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest transition-colors">Client Status</label><input type="text" id="ep1-cs" value="' + c.clientStatus + '" class="w-full mt-1 p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-inner rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-400 dark:focus:border-indigo-500 transition-colors"></div>';
    html += '</div>';
  } 
  else if (partId === 2) {
    html += '<div><label class="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest transition-colors">Final Status *</label><select id="ep2-fs" class="w-full mt-1 p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-inner rounded-xl font-bold text-slate-700 dark:text-white outline-none focus:border-indigo-400 dark:focus:border-indigo-500 color-scheme-dark transition-colors">';
    for (var s = 0; s < window.dynamicStatuses.length; s++) {
      html += '<option value="' + window.dynamicStatuses[s] + '" ' + (c.finalStatus === window.dynamicStatuses[s] ? 'selected' : '') + '>' + window.dynamicStatuses[s] + '</option>';
    }
    html += '</select></div>';
    html += '<div class="mt-4"><label class="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest transition-colors">Inactive Reason</label><textarea id="ep2-ir" class="w-full mt-1 p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-inner rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-400 dark:focus:border-indigo-500 transition-colors" rows="3">' + c.inactiveReason + '</textarea></div>';
  }
  else if (partId === 3) {
    html += '<div><label class="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest transition-colors">Default Rate (₹) *</label><input type="number" id="ep3-rate" value="' + c.defaultRate + '" class="w-full mt-1 p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-inner rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-400 dark:focus:border-indigo-500 transition-colors"></div>';
    html += '<div class="mt-4"><label class="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest transition-colors">Delivery Color</label><input type="text" id="ep3-color" value="' + c.delColor + '" class="w-full mt-1 p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-inner rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-400 dark:focus:border-indigo-500 transition-colors"></div>';
    html += '<div class="mt-4"><label class="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest transition-colors">Delivery Remark</label><textarea id="ep3-rem" class="w-full mt-1 p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-inner rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-400 dark:focus:border-indigo-500 transition-colors">' + c.delRemark + '</textarea></div>';
  }
  else if (partId === 5) {
    html += '<div><label class="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest text-center transition-colors">Can Deposit / Advance (₹) *</label><input type="number" id="ep5-adv" min="0" value="' + c.advance + '" class="w-full mt-2 p-6 bg-emerald-50 dark:bg-emerald-900/20 border-2 border-emerald-200 dark:border-emerald-800 shadow-inner rounded-xl text-5xl font-black text-emerald-700 dark:text-emerald-400 text-center outline-none focus:border-emerald-500 dark:focus:border-emerald-400 transition-colors"></div>';
  }
  else if (partId === 6) {
    html += '<div class="grid grid-cols-2 gap-4">';
    html += '<div><label class="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest transition-colors">Max Ord D *</label><input type="number" id="ep6-md" value="' + c.maxOrdD + '" class="w-full mt-1 p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-inner rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-400 dark:focus:border-indigo-500 transition-colors"></div>';
    html += '<div><label class="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest transition-colors">Max Ord E *</label><input type="number" id="ep6-me" value="' + c.maxOrdE + '" class="w-full mt-1 p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-inner rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-400 dark:focus:border-indigo-500 transition-colors"></div>';
    html += '<div class="col-span-2"><label class="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest transition-colors">Overdue Waiver *</label><select id="ep6-ow" class="w-full mt-1 p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-inner rounded-xl font-bold text-slate-700 dark:text-white outline-none focus:border-indigo-400 dark:focus:border-indigo-500 color-scheme-dark transition-colors">' +
      '<option value="FALSE" ' + (String(c.overdueWaiver).toUpperCase() === 'FALSE' || c.overdueWaiver === false ? 'selected' : '') + '>FALSE</option>' +
      '<option value="TRUE" ' + (String(c.overdueWaiver).toUpperCase() === 'TRUE' || c.overdueWaiver === true ? 'selected' : '') + '>TRUE</option>' +
      '</select></div>';
    html += '</div>';
  }

  body.innerHTML = html;
  document.getElementById('modal-edit').classList.remove('hidden');
  if(typeof window.toggleScrollLock === 'function') window.toggleScrollLock(true);
};

window.saveCustomerEdit = async function () {
  var btn = document.getElementById('btn-save-edit'); 
  var payload = {};
  
  if (window.activeEditPart === 1) {
    if (!document.getElementById('ep1-apt').value || !document.getElementById('ep1-blk').value || !document.getElementById('ep1-door').value || !document.getElementById('ep1-poc1').value || !document.getElementById('ep1-con1').value) {
        if(window.showToast) return window.showToast("Apt, Blk, Door, POC1, and Con1 are mandatory.", "warning");
        return;
    }
    payload = { apartment: document.getElementById('ep1-apt').value, block: document.getElementById('ep1-blk').value, door: document.getElementById('ep1-door').value, poc1: document.getElementById('ep1-poc1').value, con1: document.getElementById('ep1-con1').value, poc2: document.getElementById('ep1-poc2').value, con2: document.getElementById('ep1-con2').value, con3: document.getElementById('ep1-con3').value, pay_type: document.getElementById('ep1-pt').value, client_status_new: document.getElementById('ep1-csn').value, gc: document.getElementById('ep1-gc').value, client_status: document.getElementById('ep1-cs').value, mail_id: document.getElementById('ep1-email').value };
  } else if (window.activeEditPart === 2) {
    payload = { final_status: document.getElementById('ep2-fs').value, inactive_reason: document.getElementById('ep2-ir').value };
    if (payload.final_status.toUpperCase() === 'INACTIVE' && !payload.inactive_reason.trim()) {
        if(window.showToast) return window.showToast("Reason is mandatory for Inactive status.", "warning");
        return;
    }
  } else if (window.activeEditPart === 3) {
    if (!document.getElementById('ep3-rate').value) {
        if(window.showToast) return window.showToast("Rate is mandatory.", "warning");
        return;
    }
    payload = { default_rate: document.getElementById('ep3-rate').value, delivery_color: document.getElementById('ep3-color').value, delivery_remark: document.getElementById('ep3-rem').value };
  } else if (window.activeEditPart === 5) {
    var advance = parseFloat(document.getElementById('ep5-adv').value);
    if (isNaN(advance) || advance < 0) {
        if(window.showToast) return window.showToast("Deposit must be 0 or a positive number.", "warning");
        return;
    }
    payload = { can_deposit: advance };
  } else if (window.activeEditPart === 6) {
    if (!document.getElementById('ep6-md').value || !document.getElementById('ep6-me').value) {
        if(window.showToast) return window.showToast("All Limits fields are mandatory.", "warning");
        return;
    }
    payload = { maximum_ord_d: document.getElementById('ep6-md').value, maximum_ord_e: document.getElementById('ep6-me').value, overdue_waiver: document.getElementById('ep6-ow').value };
  }

  btn.innerText = "Applying..."; btn.disabled = true;
  
  try {
    if (window.activeEditPart === 1 && payload.con1) {
      const { data: dupCheck } = await window.supabase1.from('ac_customers').select('cpn_no').eq('con1', payload.con1).neq('cpn_no', window.activeEditCPN).limit(1);
      if (dupCheck && dupCheck.length > 0) throw new Error("Duplicate Alert: Contact number is already in use by " + dupCheck[0].cpn_no + ".");
    }

    const { error } = await window.supabase1.from('ac_customers').update(payload).eq('cpn_no', window.activeEditCPN);
    if (error) throw error;
    
    window.closeModal('modal-edit');
    if(window.showToast) window.showToast("Profile updated successfully.", "success");
    window.loadMasterCustomers();
  } catch (err) {
    if(window.showToast) window.showToast("Edit Error: " + err.message, "error");
    else alert(err.message);
  } finally {
    btn.innerHTML = 'Apply Updates'; btn.disabled = false;
  }
};

window.triggerActionModal = function (actionType, cpn) {
  window.activeEditCPN = cpn;
  var btn = document.getElementById('btn-action-confirm');
  var icon = document.getElementById('action-icon');
  
  if (actionType === 'REVOKE') {
    document.getElementById('action-title').innerText = "Revoke Password";
    document.getElementById('action-desc').innerText = "This will delete the customer's current password. They will need to set a new one via OTP on their next login.";
    btn.className = "w-full px-6 py-4 font-black text-amber-800 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 hover:bg-amber-200 dark:hover:bg-amber-900/50 border border-amber-300 dark:border-amber-800 rounded-xl transition-colors shadow-sm outline-none";
    icon.className = "mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-amber-50 dark:bg-amber-900/10 mb-6 border-4 border-amber-100 dark:border-amber-900/20 transition-colors";
    icon.innerHTML = '<svg class="h-10 w-10 text-amber-500 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4v-3.25l7.75-7.75A6 6 0 0115 7z"></path></svg>';
    btn.onclick = function() { window.executeRevoke(); };
  } else {
    document.getElementById('action-title').innerText = "Delete Customer";
    document.getElementById('action-desc').innerText = "This action is restricted. Customer will only be deleted if no Sales, Payments, or Order records are found.";
    btn.className = "w-full px-6 py-4 font-black text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-lg outline-none active:scale-95";
    icon.className = "mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-red-100 dark:bg-red-900/30 mb-6 border-4 border-red-50 dark:border-red-900/10 transition-colors";
    icon.innerHTML = '<svg class="h-10 w-10 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>';
    btn.onclick = function() { window.executeDelete(); };
  }
  document.getElementById('modal-action').classList.remove('hidden');
  if(typeof window.toggleScrollLock === 'function') window.toggleScrollLock(true);
};

window.executeRevoke = async function () {
  var btn = document.getElementById('btn-action-confirm'); btn.innerText = "Revoking..."; btn.disabled = true;
  try {
    const { error } = await window.supabase1.from('ac_customers').update({ password_hash: null }).eq('cpn_no', window.activeEditCPN);
    if (error) throw error;
    window.closeModal('modal-action');
    if(window.showToast) window.showToast("Password revoked successfully.", "success");
    window.loadMasterCustomers();
  } catch(err) {
    if(window.showToast) window.showToast("Revoke Error: " + err.message, "error");
  } finally {
    btn.innerText = "Yes, Proceed"; btn.disabled = false;
  }
};

window.executeDelete = async function () {
  var btn = document.getElementById('btn-action-confirm'); btn.innerText = "Validating..."; btn.disabled = true;
  try {
    const cpn = window.activeEditCPN;

    const { count: ordCount, error: ordErr } = await window.supabase1.from('orders').select('*', { count: 'exact', head: true }).eq('cpn_no', cpn);
    if (ordCount > 0) throw new Error("Deletion blocked: Active entry found in orders.");

    const { count: delCount } = await window.supabase1.from('deliveries').select('*', { count: 'exact', head: true }).eq('cpn_no', cpn);
    if (delCount > 0) throw new Error("Deletion blocked: Active entry found in deliveries.");

    const { count: salesCount } = await window.supabase1.from('sales').select('*', { count: 'exact', head: true }).eq('cpn_no', cpn);
    if (salesCount > 0) throw new Error("Deletion blocked: Historical records exist in sales.");

    const { count: paysCount } = await window.supabase1.from('pays').select('*', { count: 'exact', head: true }).eq('cpn_no', cpn);
    if (paysCount > 0) throw new Error("Deletion blocked: Historical records exist in pays.");

    const { error: delErr } = await window.supabase1.from('ac_customers').delete().eq('cpn_no', cpn);
    if (delErr) throw delErr;

    window.closeModal('modal-action');
    if(window.showToast) window.showToast("Customer " + cpn + " successfully deleted.", "success");
    window.loadMasterCustomers();
  } catch (err) {
    if(window.showToast) window.showToast(err.message, "error");
    else alert(err.message);
  } finally {
    btn.innerText = "Yes, Proceed"; btn.disabled = false; 
  }
};

window.tabActions['master-customer'] = function() {
    window.loadMasterCustomers();
};