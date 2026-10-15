
  window.masterCustomerData = [];
  window.filteredCustomers = [];
  window.dynamicStatuses = ['ACTIVE', 'INACTIVE']; // Default fallback
  window.customerDisplayLimit = 50;
  window.activeEditCPN = null;
  window.activeEditPart = null;
  window.wizardCurrentStep = 1;

  window.loadMasterCustomers = function () {

    // 1. HIDE THE ADD BUTTON IMMEDIATELY IF READ-ONLY
    var addBtn = document.getElementById('btnMasterCustomerAddNew');
    if (addBtn) {
        if (!window.hasWriteAccess('master-customer')) {
            addBtn.classList.add('hidden');
        } else {
            addBtn.classList.remove('hidden');
        }
    }

    document.getElementById('cust-loading').classList.remove('hidden');
    document.getElementById('customer-list-container').innerHTML = '';
    
    // Fetch Dynamic Statuses
    google.script.run.withSuccessHandler(function(res) {
      if (res.success) window.dynamicStatuses = res.data;
    }).fetchDynamicStatuses();

    // Fetch Database
    google.script.run.withSuccessHandler(function (res) {
      document.getElementById('cust-loading').classList.add('hidden');
      if (res.success) {
        window.masterCustomerData = res.data;
        window.filteredCustomers = res.data;
        window.customerDisplayLimit = 50;
        document.getElementById('cust-header-title').innerText = "Customer Directory (" + res.data.length + " Total)";
        window.renderCustomerCards();
      } else {
        alert("Failed to load customers: " + res.message);
      }
    }).fetchMasterCustomers();
    
  };

  window.filterCustomers = function () {
    var query = document.getElementById('cust-search').value.toLowerCase().trim();
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
    var html = '';
    var limit = Math.min(window.customerDisplayLimit, window.filteredCustomers.length);

    // CHECK SECURITY ONCE BEFORE BUILDING THE CARDS
    var canEdit = window.hasWriteAccess('master-customer');

    if (window.filteredCustomers.length === 0) {
      container.innerHTML = '<div class="text-center py-12"><p class="text-2xl font-black text-slate-400">No customers found.</p></div>';
      return;
    }

    for (var i = 0; i < limit; i++) {
      var c = window.filteredCustomers[i];
      var uId = 'card-cust-' + i;
      var statusBadge = c.finalStatus.toUpperCase() === 'INACTIVE' 
          ? '<span class="px-3 py-1 bg-rose-100 text-rose-700 font-black rounded-lg text-xs">INACTIVE</span>'
          : '<span class="px-3 py-1 bg-emerald-100 text-emerald-700 font-black rounded-lg text-xs">' + c.finalStatus + '</span>';

      // CONDITIONAL EDIT BUTTONS (Only drawn if canEdit is true)
      var editBtn1 = canEdit ? '<button onclick="window.openEditPart(\'' + c.cpn + '\', 1)" class="absolute top-4 right-4 text-slate-400 hover:text-indigo-600 transition"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg></button>' : '';
      var editBtn2 = canEdit ? '<button onclick="window.openEditPart(\'' + c.cpn + '\', 2)" class="absolute top-4 right-4 text-slate-400 hover:text-indigo-600 transition"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg></button>' : '';
      var editBtn3 = canEdit ? '<button onclick="window.openEditPart(\'' + c.cpn + '\', 3)" class="absolute top-4 right-4 text-slate-400 hover:text-indigo-600 transition"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg></button>' : '';
      var editBtn5 = canEdit ? '<button onclick="window.openEditPart(\'' + c.cpn + '\', 5)" class="absolute top-4 right-4 text-slate-400 hover:text-indigo-600 transition"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg></button>' : '';
      var editBtn6 = canEdit ? '<button onclick="window.openEditPart(\'' + c.cpn + '\', 6)" class="absolute top-4 right-4 text-slate-400 hover:text-indigo-600 transition"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg></button>' : '';

      // CONDITIONAL DANGER ACTION AREA
      var dangerousActionsArea = '';
      if (canEdit) {
          dangerousActionsArea = '<div class="bg-slate-100 p-4 rounded-xl border-2 border-slate-200 border-dashed flex flex-col justify-center space-y-2">' +
            (c.passwordSet 
              ? '<button onclick="window.triggerActionModal(\'REVOKE\', \'' + c.cpn + '\')" class="w-full py-2 bg-amber-100 text-amber-700 font-bold rounded-lg hover:bg-amber-200 transition text-sm tracking-widest uppercase">Revoke Password</button>'
              : '<div class="w-full py-2 bg-slate-200 text-slate-400 font-bold rounded-lg text-center text-sm tracking-widest uppercase">No Password Set</div>') +
            '<button onclick="window.triggerActionModal(\'DELETE\', \'' + c.cpn + '\')" class="w-full py-2 bg-rose-100 text-rose-700 font-bold rounded-lg hover:bg-rose-200 transition text-sm tracking-widest uppercase mt-2"><svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg> Delete Cust</button>' +
          '</div>';
      } else {
          dangerousActionsArea = '<div class="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-center h-full"><p class="text-slate-400 font-bold text-sm uppercase tracking-widest">Read Only Mode</p></div>';
      }

      html += '<div class="bg-white border-2 border-slate-200 rounded-2xl overflow-hidden shadow-sm transition hover:border-indigo-300">' +
        '<div class="flex items-center justify-between p-4 cursor-pointer" onclick="window.toggleAccordion(\'' + uId + '\', \'icon-' + uId + '\')">' +
          '<div class="flex items-center gap-4">' +
            '<div class="h-12 w-12 bg-indigo-100 rounded-full flex items-center justify-center shrink-0 border-2 border-indigo-200"><svg class="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg></div>' +
            '<div>' +
              '<div class="flex items-center gap-2"><h4 class="text-xl font-black text-slate-800">' + (c.poc1 || 'No Name') + '</h4>' + statusBadge + '</div>' +
              '<p class="text-sm font-bold text-indigo-600 tracking-widest">' + c.cpn + ' &bull; <span class="text-slate-500">' + c.apt + ' ' + c.blk + ' ' + c.door + '</span></p>' +
            '</div>' +
          '</div>' +
          '<svg id="icon-' + uId + '" class="w-6 h-6 text-slate-400 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M19 9l-7 7-7-7"></path></svg>' +
        '</div>' +
        '<div id="' + uId + '" class="accordion-content bg-slate-50"><div class="overflow-hidden p-4 border-t border-slate-200 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">' +
          
          '<div class="bg-white p-4 rounded-xl border border-slate-200 relative">' +
            editBtn1 +
            '<h5 class="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Part 1: Primary Info</h5>' +
            '<p class="text-sm font-bold"><span class="text-slate-500">Apt:</span> ' + c.apt + ' ' + c.blk + ' ' + c.door + '</p>' +
            '<p class="text-sm font-bold"><span class="text-slate-500">Contact:</span> ' + c.con1 + '</p>' +
            '<p class="text-sm font-bold"><span class="text-slate-500">Email:</span> ' + (c.email || '-') + '</p>' +
            '<p class="text-sm font-bold"><span class="text-slate-500">Pay Type:</span> ' + (c.payType || '-') + '</p>' +
          '</div>' +

          '<div class="bg-white p-4 rounded-xl border border-slate-200 relative">' +
            editBtn2 +
            '<h5 class="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Part 2: Status</h5>' +
            '<p class="text-sm font-bold"><span class="text-slate-500">Status:</span> ' + c.finalStatus + '</p>' +
            '<p class="text-sm font-bold"><span class="text-slate-500">Reason:</span> ' + (c.inactiveReason || '-') + '</p>' +
          '</div>' +

          '<div class="bg-white p-4 rounded-xl border border-slate-200 relative">' +
            editBtn3 +
            '<h5 class="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Part 3: Delivery Config</h5>' +
            '<p class="text-sm font-bold"><span class="text-slate-500">Rate:</span> ₹' + (c.defaultRate || '0') + '</p>' +
            '<p class="text-sm font-bold"><span class="text-slate-500">Color:</span> ' + (c.delColor || 'NONE') + '</p>' +
            '<p class="text-sm font-bold"><span class="text-slate-500">Remark:</span> ' + (c.delRemark || '-') + '</p>' +
          '</div>' +

          '<div class="bg-white p-4 rounded-xl border border-slate-200 relative">' +
            editBtn5 +
            '<h5 class="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Part 5: Can Deposit</h5>' +
            '<p class="text-3xl font-black text-emerald-600 mt-2">₹' + c.advance + '</p>' +
          '</div>' +

          '<div class="bg-white p-4 rounded-xl border border-slate-200 relative">' +
            editBtn6 +
            '<h5 class="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Part 6: Waivers & Limits</h5>' +
            '<p class="text-sm font-bold"><span class="text-slate-500">Max D / E:</span> ' + (c.maxOrdD || '0') + ' / ' + (c.maxOrdE || '0') + '</p>' +
            '<p class="text-sm font-bold"><span class="text-slate-500">Overdue Wvr:</span> ' + (c.overdueWaiver || 'No') + '</p>' +
          '</div>' +

          dangerousActionsArea +

        '</div></div>' +
      '</div>';
    }

    if (window.customerDisplayLimit < window.filteredCustomers.length) {
      html += '<div class="text-center pt-4"><button onclick="window.loadMoreCustomers()" class="px-6 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition">Load More Customers...</button></div>';
    }

    container.innerHTML = html;
  };
  
  window.loadMoreCustomers = function() {
    window.customerDisplayLimit += 50;
    window.renderCustomerCards();
  };
  
  document.getElementById('scroll-area').addEventListener('scroll', function() {
    if (document.getElementById('tab-master-customer').classList.contains('hidden')) return;
    if (this.scrollTop + this.clientHeight >= this.scrollHeight - 100) {
      if (window.customerDisplayLimit < window.filteredCustomers.length) window.loadMoreCustomers();
    }
  });

  // Modal Controls (Body Scroll Lock removed since modal covers full screen properly now)
  window.toggleScrollLock = function (isLocked) {
    var scrollArea = document.getElementById('scroll-area');
    if (scrollArea) {
      if (isLocked) scrollArea.classList.add('overflow-hidden');
      else scrollArea.classList.remove('overflow-hidden');
    }
  };

  window.closeModal = function (id) { 
    document.getElementById(id).classList.add('hidden'); 
    window.toggleScrollLock(false); // Unlock background scrolling
  };

  // Wizard Logic
  window.openAddCustomerWizard = function () {
    document.getElementById('add-apt').value = ''; document.getElementById('add-blk').value = ''; document.getElementById('add-door').value = '';
    document.getElementById('add-sheetname').value = ''; document.getElementById('add-poc1').value = ''; document.getElementById('add-con1').value = '';
    document.getElementById('add-poc2').value = ''; document.getElementById('add-email').value = ''; document.getElementById('add-paytype').value = '';
    document.getElementById('add-rate').value = '40'; document.getElementById('add-color').value = ''; document.getElementById('add-remark').value = '';
    document.getElementById('add-advance').value = '0'; document.getElementById('add-maxd').value = '3'; document.getElementById('add-maxe').value = '3';
    document.getElementById('add-ow').value = 'No'; document.getElementById('add-pmw').value = 'No'; document.getElementById('add-pmwd').value = '25';
    
    window.wizardCurrentStep = 1;
    window.updateWizardUI();
    document.getElementById('modal-wizard').classList.remove('hidden');
    window.toggleScrollLock(true); // Lock background scrolling
  };

  window.wizardNext = function () {
    if (window.wizardCurrentStep === 1) {
      if (!document.getElementById('add-apt').value || !document.getElementById('add-blk').value || !document.getElementById('add-door').value || !document.getElementById('add-poc1').value || !document.getElementById('add-con1').value) return alert("Please fill all mandatory primary fields (Apt, Blk, Door, POC1, Con1).");
      window.wizardCurrentStep = 2;
    } else if (window.wizardCurrentStep === 2) {
      if (!document.getElementById('add-rate').value) return alert("Default Rate is mandatory.");
      window.wizardCurrentStep = 3;
    } else if (window.wizardCurrentStep === 3) {
      var advance = parseFloat(document.getElementById('add-advance').value);
      if (isNaN(advance) || advance < 0) return alert("Can Deposit (Advance) must be 0 or a positive number.");
      if (!document.getElementById('add-maxd').value || !document.getElementById('add-maxe').value || !document.getElementById('add-pmwd').value) return alert("Please fill all Limits & Waivers fields.");
      
      // Populate Preview
      document.getElementById('prev-abd').innerText = document.getElementById('add-apt').value + ' / ' + document.getElementById('add-blk').value + ' / ' + document.getElementById('add-door').value;
      document.getElementById('prev-sheet').innerText = document.getElementById('add-sheetname').value || '-';
      document.getElementById('prev-pay').innerText = document.getElementById('add-paytype').value || '-';
      document.getElementById('prev-poc1').innerText = document.getElementById('add-poc1').value + ' (' + document.getElementById('add-con1').value + ')';
      document.getElementById('prev-poc2').innerText = document.getElementById('add-poc2').value || '-';
      document.getElementById('prev-email').innerText = document.getElementById('add-email').value || '-';
      document.getElementById('prev-rate').innerText = '₹' + document.getElementById('add-rate').value;
      document.getElementById('prev-del').innerText = (document.getElementById('add-color').value || 'NONE') + ' | ' + (document.getElementById('add-remark').value || '-');
      document.getElementById('prev-adv').innerText = '₹' + advance;
      document.getElementById('prev-max').innerText = document.getElementById('add-maxd').value + ' / ' + document.getElementById('add-maxe').value;
      document.getElementById('prev-wvr').innerText = document.getElementById('add-ow').value + ' / ' + document.getElementById('add-pmw').value;
      document.getElementById('prev-wvrd').innerText = document.getElementById('add-pmwd').value;

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
    
    document.getElementById('wiz-ind-1').className = "h-2 flex-1 rounded-full transition-colors " + (window.wizardCurrentStep >= 1 ? "bg-indigo-600" : "bg-slate-200");
    document.getElementById('wiz-ind-2').className = "h-2 flex-1 rounded-full transition-colors " + (window.wizardCurrentStep >= 2 ? "bg-indigo-600" : "bg-slate-200");
    document.getElementById('wiz-ind-3').className = "h-2 flex-1 rounded-full transition-colors " + (window.wizardCurrentStep >= 3 ? "bg-indigo-600" : "bg-slate-200");
    var ind4 = document.getElementById('wiz-ind-4');
    if(ind4) ind4.className = "h-2 flex-1 rounded-full transition-colors " + (window.wizardCurrentStep >= 4 ? "bg-indigo-600" : "bg-slate-200");

    document.getElementById('wiz-btn-back').classList.toggle('hidden', window.wizardCurrentStep === 1);
    document.getElementById('wiz-btn-next').classList.toggle('hidden', window.wizardCurrentStep === 4);
    document.getElementById('wiz-btn-save').classList.toggle('hidden', window.wizardCurrentStep !== 4);
  };

  window.submitNewCustomer = function () {
    var advance = parseFloat(document.getElementById('add-advance').value);
    if (isNaN(advance) || advance < 0) return alert("Can Deposit (Advance) must be 0 or a positive number.");
    if (!document.getElementById('add-maxd').value || !document.getElementById('add-maxe').value || !document.getElementById('add-pmwd').value) return alert("Please fill all Limits & Waivers fields.");

    var btn = document.getElementById('wiz-btn-save'); btn.innerText = "Saving..."; btn.disabled = true;
    var payload = {
      apt: document.getElementById('add-apt').value, blk: document.getElementById('add-blk').value, door: document.getElementById('add-door').value,
      sheetName: document.getElementById('add-sheetname').value, poc1: document.getElementById('add-poc1').value, con1: document.getElementById('add-con1').value,
      poc2: document.getElementById('add-poc2').value, email: document.getElementById('add-email').value, payType: document.getElementById('add-paytype').value,
      defaultRate: document.getElementById('add-rate').value, delColor: document.getElementById('add-color').value, delRemark: document.getElementById('add-remark').value,
      advance: advance, maxOrdD: document.getElementById('add-maxd').value, maxOrdE: document.getElementById('add-maxe').value,
      overdueWaiver: document.getElementById('add-ow').value, prevMonWaiver: document.getElementById('add-pmw').value, prevMonWaiverDays: document.getElementById('add-pmwd').value
    };
    
    google.script.run.withSuccessHandler(function (res) {
      btn.innerText = "Save & Create Customer"; btn.disabled = false;
      if (res.success) { window.closeModal('modal-wizard'); alert(res.message); window.loadMasterCustomers(); } else alert(res.message);
    }).insertNewCustomer(payload);
  };

  // Dynamic Edit Modals
  window.openEditPart = function (cpn, partId) {
    window.activeEditCPN = cpn; window.activeEditPart = partId;
    var c = window.masterCustomerData.find(function(x) { return x.cpn === cpn; });
    if (!c) return;
    
    document.getElementById('edit-modal-cpn').innerText = cpn;
    document.getElementById('edit-modal-title').innerText = "Edit Part " + partId;
    var body = document.getElementById('edit-modal-body');
    var html = '';

    if (partId === 1) {
      html += '<div class="grid grid-cols-2 gap-4">';
      html += '<div><label class="block text-xs font-bold text-slate-500 uppercase">Apt *</label><input type="text" id="ep1-apt" value="' + c.apt + '" class="w-full p-2.5 bg-slate-50 border rounded-lg font-bold"></div>';
      html += '<div><label class="block text-xs font-bold text-slate-500 uppercase">Blk *</label><input type="text" id="ep1-blk" value="' + c.blk + '" class="w-full p-2.5 bg-slate-50 border rounded-lg font-bold"></div>';
      html += '<div><label class="block text-xs font-bold text-slate-500 uppercase">Door *</label><input type="text" id="ep1-door" value="' + c.door + '" class="w-full p-2.5 bg-slate-50 border rounded-lg font-bold"></div>';
      html += '<div><label class="block text-xs font-bold text-slate-500 uppercase">Sheet Name</label><input type="text" id="ep1-sname" value="' + c.sheetName + '" class="w-full p-2.5 bg-slate-50 border rounded-lg font-bold"></div>';
      html += '<div class="col-span-2"><hr class="my-2"></div>';
      html += '<div><label class="block text-xs font-bold text-slate-500 uppercase">POC 1 *</label><input type="text" id="ep1-poc1" value="' + c.poc1 + '" class="w-full p-2.5 bg-slate-50 border rounded-lg font-bold"></div>';
      html += '<div><label class="block text-xs font-bold text-slate-500 uppercase">Con 1 *</label><input type="text" id="ep1-con1" value="' + c.con1 + '" class="w-full p-2.5 bg-slate-50 border rounded-lg font-bold"></div>';
      html += '<div><label class="block text-xs font-bold text-slate-500 uppercase">POC 2</label><input type="text" id="ep1-poc2" value="' + c.poc2 + '" class="w-full p-2.5 bg-slate-50 border rounded-lg font-bold"></div>';
      html += '<div><label class="block text-xs font-bold text-slate-500 uppercase">Con 2</label><input type="text" id="ep1-con2" value="' + c.con2 + '" class="w-full p-2.5 bg-slate-50 border rounded-lg font-bold"></div>';
      html += '<div><label class="block text-xs font-bold text-slate-500 uppercase">Con 3</label><input type="text" id="ep1-con3" value="' + c.con3 + '" class="w-full p-2.5 bg-slate-50 border rounded-lg font-bold"></div>';
      html += '<div><label class="block text-xs font-bold text-slate-500 uppercase">Email</label><input type="email" id="ep1-email" value="' + c.email + '" class="w-full p-2.5 bg-slate-50 border rounded-lg font-bold"></div>';
      html += '<div><label class="block text-xs font-bold text-slate-500 uppercase">Pay Type</label><select id="ep1-pt" class="w-full p-2.5 bg-slate-50 border rounded-lg font-bold"><option value="">Select</option><option value="ONLINE" '+(c.payType==='ONLINE'?'selected':'')+'>ONLINE</option><option value="CASH" '+(c.payType==='CASH'?'selected':'')+'>CASH</option></select></div>';
      html += '<div><label class="block text-xs font-bold text-slate-500 uppercase">Client Status New</label><input type="text" id="ep1-csn" value="' + c.clientStatusNew + '" class="w-full p-2.5 bg-slate-50 border rounded-lg font-bold"></div>';
      html += '<div><label class="block text-xs font-bold text-slate-500 uppercase">GC</label><input type="text" id="ep1-gc" value="' + c.gc + '" class="w-full p-2.5 bg-slate-50 border rounded-lg font-bold"></div>';
      html += '<div><label class="block text-xs font-bold text-slate-500 uppercase">OS</label><input type="text" id="ep1-os" value="' + c.os + '" class="w-full p-2.5 bg-slate-50 border rounded-lg font-bold"></div>';
      html += '<div><label class="block text-xs font-bold text-slate-500 uppercase">Client Status</label><input type="text" id="ep1-cs" value="' + c.clientStatus + '" class="w-full p-2.5 bg-slate-50 border rounded-lg font-bold"></div>';
      html += '</div>';
    } 
    else if (partId === 2) {
      html += '<div><label class="block text-xs font-bold text-slate-500 uppercase">Final Status *</label><select id="ep2-fs" class="w-full mt-1 p-3 bg-slate-50 border rounded-xl font-bold">';
      for (var s = 0; s < window.dynamicStatuses.length; s++) {
        html += '<option value="' + window.dynamicStatuses[s] + '" ' + (c.finalStatus === window.dynamicStatuses[s] ? 'selected' : '') + '>' + window.dynamicStatuses[s] + '</option>';
      }
      html += '</select></div>';
      html += '<div class="mt-4"><label class="block text-xs font-bold text-slate-500 uppercase">Inactive Reason</label><textarea id="ep2-ir" class="w-full mt-1 p-3 bg-slate-50 border rounded-xl font-bold" rows="3">' + c.inactiveReason + '</textarea></div>';
    }
    else if (partId === 3) {
      html += '<div><label class="block text-xs font-bold text-slate-500 uppercase">Default Rate (₹) *</label><input type="number" id="ep3-rate" value="' + c.defaultRate + '" class="w-full mt-1 p-3 bg-slate-50 border rounded-xl font-bold"></div>';
      html += '<div class="mt-4"><label class="block text-xs font-bold text-slate-500 uppercase">Delivery Color</label><input type="text" id="ep3-color" value="' + c.delColor + '" class="w-full mt-1 p-3 bg-slate-50 border rounded-xl font-bold"></div>';
      html += '<div class="mt-4"><label class="block text-xs font-bold text-slate-500 uppercase">Delivery Remark</label><textarea id="ep3-rem" class="w-full mt-1 p-3 bg-slate-50 border rounded-xl font-bold">' + c.delRemark + '</textarea></div>';
    }
    else if (partId === 5) {
      html += '<div><label class="block text-xs font-bold text-slate-500 uppercase">Can Deposit / Advance (₹) *</label><input type="number" id="ep5-adv" min="0" value="' + c.advance + '" class="w-full mt-1 p-4 bg-slate-50 border-2 rounded-xl text-3xl font-black text-emerald-600 text-center"></div>';
    }
    else if (partId === 6) {
      html += '<div class="grid grid-cols-2 gap-4">';
      html += '<div><label class="block text-xs font-bold text-slate-500 uppercase">Max Ord D *</label><input type="number" id="ep6-md" value="' + c.maxOrdD + '" class="w-full p-2.5 bg-slate-50 border rounded-lg font-bold"></div>';
      html += '<div><label class="block text-xs font-bold text-slate-500 uppercase">Max Ord E *</label><input type="number" id="ep6-me" value="' + c.maxOrdE + '" class="w-full p-2.5 bg-slate-50 border rounded-lg font-bold"></div>';
      html += '<div class="col-span-2"><label class="block text-xs font-bold text-slate-500 uppercase">Overdue Waiver *</label><select id="ep6-ow" class="w-full p-2.5 bg-slate-50 border rounded-lg font-bold"><option value="No" '+(c.overdueWaiver==='No'?'selected':'')+'>No</option><option value="Yes" '+(c.overdueWaiver==='Yes'?'selected':'')+'>Yes</option></select></div>';
      html += '<div><label class="block text-xs font-bold text-slate-500 uppercase">Prev Mon Waiver *</label><select id="ep6-pmw" class="w-full p-2.5 bg-slate-50 border rounded-lg font-bold"><option value="No" '+(c.prevMonWaiver==='No'?'selected':'')+'>No</option><option value="Yes" '+(c.prevMonWaiver==='Yes'?'selected':'')+'>Yes</option></select></div>';
      html += '<div><label class="block text-xs font-bold text-slate-500 uppercase">Prev Mon Waiver Days *</label><input type="number" id="ep6-pmwd" value="' + c.prevMonWaiverDays + '" class="w-full p-2.5 bg-slate-50 border rounded-lg font-bold"></div>';
      html += '</div>';
    }

    body.innerHTML = html;
    document.getElementById('modal-edit').classList.remove('hidden');
    window.toggleScrollLock(true); // Lock background scrolling
  };

  window.saveCustomerEdit = function () {
    var btn = document.getElementById('btn-save-edit'); 
    var payload = {};
    
    if (window.activeEditPart === 1) {
      if (!document.getElementById('ep1-apt').value || !document.getElementById('ep1-blk').value || !document.getElementById('ep1-door').value || !document.getElementById('ep1-poc1').value || !document.getElementById('ep1-con1').value) return alert("Apt, Blk, Door, POC1, and Con1 are mandatory.");
      payload = { apt: document.getElementById('ep1-apt').value, blk: document.getElementById('ep1-blk').value, door: document.getElementById('ep1-door').value, sheetName: document.getElementById('ep1-sname').value, poc1: document.getElementById('ep1-poc1').value, con1: document.getElementById('ep1-con1').value, poc2: document.getElementById('ep1-poc2').value, con2: document.getElementById('ep1-con2').value, con3: document.getElementById('ep1-con3').value, payType: document.getElementById('ep1-pt').value, clientStatusNew: document.getElementById('ep1-csn').value, gc: document.getElementById('ep1-gc').value, os: document.getElementById('ep1-os').value, clientStatus: document.getElementById('ep1-cs').value, email: document.getElementById('ep1-email').value };
    } else if (window.activeEditPart === 2) {
      payload = { finalStatus: document.getElementById('ep2-fs').value, inactiveReason: document.getElementById('ep2-ir').value };
      if (payload.finalStatus.toUpperCase() === 'INACTIVE' && !payload.inactiveReason.trim()) return alert("Reason is mandatory for Inactive status.");
    } else if (window.activeEditPart === 3) {
      if (!document.getElementById('ep3-rate').value) return alert("Rate is mandatory.");
      payload = { defaultRate: document.getElementById('ep3-rate').value, delColor: document.getElementById('ep3-color').value, delRemark: document.getElementById('ep3-rem').value };
    } else if (window.activeEditPart === 5) {
      var advance = parseFloat(document.getElementById('ep5-adv').value);
      if (isNaN(advance) || advance < 0) return alert("Deposit must be 0 or a positive number.");
      payload = { advance: advance };
    } else if (window.activeEditPart === 6) {
      if (!document.getElementById('ep6-md').value || !document.getElementById('ep6-me').value || !document.getElementById('ep6-pmwd').value) return alert("All Limits & Waivers fields are mandatory.");
      payload = { maxOrdD: document.getElementById('ep6-md').value, maxOrdE: document.getElementById('ep6-me').value, overdueWaiver: document.getElementById('ep6-ow').value, prevMonWaiver: document.getElementById('ep6-pmw').value, prevMonWaiverDays: document.getElementById('ep6-pmwd').value };
    }

    btn.innerText = "Applying..."; btn.disabled = true;
    google.script.run.withSuccessHandler(function(res) {
      btn.innerText = "Apply Updates"; btn.disabled = false;
      if (res.success) { window.closeModal('modal-edit'); window.loadMasterCustomers(); } else alert(res.message);
    }).updateCustomerPart(window.activeEditCPN, window.activeEditPart, payload);
  };

  // Action Modals (Revoke & Delete)
  window.triggerActionModal = function (actionType, cpn) {
    window.activeEditCPN = cpn;
    var btn = document.getElementById('btn-action-confirm');
    if (actionType === 'REVOKE') {
      document.getElementById('action-title').innerText = "Revoke Password";
      document.getElementById('action-desc').innerText = "This will delete the customer's current password. They will need to set a new one via OTP on their next login.";
      btn.className = "w-full px-6 py-4 font-black text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition shadow";
      btn.onclick = function() { window.executeRevoke(); };
    } else {
      document.getElementById('action-title').innerText = "Delete Customer";
      document.getElementById('action-desc').innerText = "This action is restricted. Customer will only be deleted if no Sales, Payments, or Accounts records are found.";
      btn.className = "w-full px-6 py-4 font-black text-white bg-red-600 hover:bg-red-700 rounded-xl transition shadow";
      btn.onclick = function() { window.executeDelete(); };
    }
    document.getElementById('modal-action').classList.remove('hidden');
    window.toggleScrollLock(true); // Lock background scrolling
  };

  window.executeRevoke = function () {
    var btn = document.getElementById('btn-action-confirm'); btn.innerText = "Revoking..."; btn.disabled = true;
    google.script.run.withSuccessHandler(function(res) {
      btn.innerText = "Yes, Proceed"; btn.disabled = false; window.closeModal('modal-action');
      if (res.success) window.loadMasterCustomers(); else alert(res.message);
    }).updateCustomerPart(window.activeEditCPN, 4, {});
  };

  window.executeDelete = function () {
    var btn = document.getElementById('btn-action-confirm'); btn.innerText = "Validating..."; btn.disabled = true;
    google.script.run.withSuccessHandler(function(res) {
      btn.innerText = "Yes, Proceed"; btn.disabled = false; window.closeModal('modal-action');
      alert(res.message);
      if (res.success) window.loadMasterCustomers();
    }).validateAndDeleteCustomer(window.activeEditCPN);
  };
