window.onerror = function (msg, url, line) { alert("App Error: " + msg + " (Line " + line + ")"); return false; };
window.windowWidthBabu = 1024;
window.activeAdminSession = null;
window.isSidebarOpen = window.innerWidth >= window.windowWidthBabu;

// Global Data Caches
window.activeReportData = { delivery: [] };
window.masterOutstandingData = [];
window.monthHeadersConfig = {};
window.activeRowMonthFilter = 'ALL';
window.visCols = { m1: true, m2: true, m3: true, m4: true, adv: true };

window.dashboardReturnState = 1;
window.dashboardLeaveTime = 0;
window.defaultersData = { highest: [], oldest: [] };

window.dormantMinDays = 7;
window.dormantMaxDays = 30;
window.sortDirection = true;

window.masterSalesData = [];
window.salesDisplayCount = 50;

window._lastWindowWidth = window.innerWidth;

// GLOBAL ROUTING REGISTRY (Modules will register themselves here)
window.tabActions = {};

// Utility Functions
window.getUniqueArray = function (arr) { var res = []; for (var i = 0; i < arr.length; i++) { if (res.indexOf(arr[i]) === -1 && arr[i]) res.push(arr[i]); } return res; };
window.trimMonth = function (str) { if (!str) return 'M'; return str.toUpperCase().replace("PEND", "").trim().substring(0, 3); };

window.hasWriteAccess = function (tabName) {
    if (!window.activeAdminSession) return false;
    if (window.activeAdminSession.allowedTabs.includes("ALL")) return true;
    var readOnlyList = window.activeAdminSession.readOnlyTabs || [];
    return !readOnlyList.includes(tabName);
};

// Browser Crypto SHA-256 Hashing for Supabase
async function hashPassword(password) {
    if (!password) return "";
    const msgBuffer = new TextEncoder().encode(String(password).trim());
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

window.assertWorkspaceDeployment = async function () {
    var viewAuth = document.getElementById('view-auth');
    var viewWorkspace = document.getElementById('view-workspace');
    var dispAdmin = document.getElementById('disp-admin-name');

    if (viewAuth) viewAuth.classList.add('hidden');
    if (viewWorkspace) viewWorkspace.classList.remove('hidden');
    if (dispAdmin && window.activeAdminSession) {
        dispAdmin.innerText = "User: " + window.activeAdminSession.username;
    }

    // Wait for the sidebar to finish building dynamically before routing
    await window.applyRolePermissions();
    
    var allowed = window.activeAdminSession ? (window.activeAdminSession.allowedTabs || []) : [];
    var firstTab = (allowed.includes('ALL') || allowed.includes('dashboard')) ? 'dashboard' : allowed[0];
    firstTab = firstTab || 'password';
    window.goToReport(firstTab);
};

window.applyRolePermissions = async function () {
    if (!window.activeAdminSession) return;
    var allowed = window.activeAdminSession.allowedTabs || [];
    var isSuper = allowed.includes("ALL");

    // Fetch the architecture for the ADMIN module
    const { data: menus } = await window.supabase1.from('sys_menus').select('*').eq('module_name', 'ADMIN').order('sort_order');
    const { data: pages } = await window.supabase1.from('sys_pages').select('*').eq('module_name', 'ADMIN').eq('show_in_sidebar', true).order('page_title');

    var navContainer = document.querySelector('#app-sidebar nav');
    if (!navContainer) return;

    var html = "";
    var mainMenus = (menus || []).filter(m => !m.parent_menu_id);

    mainMenus.forEach(m => {
        var directPages = (pages || []).filter(p => p.menu_id === m.id && (isSuper || allowed.includes(p.page_id)));
        var subMenus = (menus || []).filter(sub => sub.parent_menu_id === m.id);
        var subMenuHtml = "";
        
        subMenus.forEach(sub => {
            var subPages = (pages || []).filter(p => p.menu_id === sub.id && (isSuper || allowed.includes(p.page_id)));
            if (subPages.length > 0) {
                var defaultSubIcon = '<svg class="w-3.5 h-3.5 shrink-0 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>';
                subMenuHtml += `
                  <div onclick="window.toggleSubAccordion('sub-menu-${sub.id}', 'icon-sub-${sub.id}')" class="flex justify-between items-center px-2 py-1.5 mt-1 cursor-pointer rounded-lg hover:bg-slate-800/50 transition">
                    <div class="flex items-center gap-1.5">
                      ${sub.icon_svg || defaultSubIcon}
                      <span class="text-[12px] font-bold text-emerald-400 uppercase tracking-wide">${sub.menu_label}</span>
                    </div>
                    <svg id="icon-sub-${sub.id}" class="w-3.5 h-3.5 shrink-0 transition-transform duration-200 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                  </div>
                  <div id="sub-menu-${sub.id}" class="hidden">
                    <div class="flex flex-col pl-4 space-y-1">
                      ${subPages.map(p => `
                        <button onclick="window.goToReport('${p.page_id}')" id="nav-tab-${p.page_id}" class="flex items-center gap-2 w-full text-left py-1.5 px-2 rounded-lg text-[13px] font-semibold text-slate-400 hover:text-white hover:bg-slate-800/50 transition">
                          <span class="truncate">${p.page_title}</span>
                        </button>
                      `).join('')}
                    </div>
                  </div>
                `;
            }
        });

        if (directPages.length > 0 || subMenuHtml !== "") {
            var defaultMainIcon = '<svg class="w-5 h-5 shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012-2h-2a2 2 0 01-2-2v-2zM4 16a2 2 0 012-2h2a2 2 0 012-2h-2a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012-2h-2a2 2 0 01-2-2v-2z"></path></svg>';
            html += `
            <div>
              <button onclick="window.toggleAccordion('acc-main-${m.id}', 'icon-main-${m.id}')" class="w-full flex justify-between items-center px-3 py-2.5 rounded-xl text-sm font-bold text-slate-300 hover:bg-slate-800 hover:text-white transition">
                <div class="flex items-center gap-2">
                  ${m.icon_svg || defaultMainIcon}
                  <span class="truncate">${m.menu_label}</span>
                </div>
                <svg id="icon-main-${m.id}" class="w-4 h-4 shrink-0 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
              </button>
              <div id="acc-main-${m.id}" class="accordion-content">
                <div class="overflow-hidden">
                  <div class="flex flex-col pl-6 pr-2 py-1 space-y-1">
                    ${directPages.map(p => `
                        <button onclick="window.goToReport('${p.page_id}')" id="nav-tab-${p.page_id}" class="flex items-center gap-2 w-full text-left py-1.5 px-2 rounded-lg text-[13px] font-semibold text-slate-400 hover:text-white hover:bg-slate-800/50 transition">
                          <span class="truncate">${p.page_title}</span>
                        </button>
                    `).join('')}
                    ${subMenuHtml}
                  </div>
                </div>
              </div>
            </div>`;
        }
    });

    navContainer.innerHTML = html;
};

window.toggleSidebar = function () { window.isSidebarOpen = !window.isSidebarOpen; window.applySidebarState(); };

window.toggleSubAccordion = function (contentId, iconId) {
    var content = document.getElementById(contentId);
    var icon = document.getElementById(iconId);
    var parentContent = content.closest('.accordion-content');
    content.classList.toggle('hidden');
    icon.classList.toggle('rotate-180');
    if (parentContent) parentContent.style.maxHeight = "none";
};

window.toggleAccordion = function (cId, iId) {
    var c = document.getElementById(cId), i = document.getElementById(iId);
    if (!c) return;
    if (c.classList.contains('open')) {
        c.classList.remove('open'); c.style.maxHeight = null; if (i) i.classList.remove('rotate-180');
    } else {
        c.classList.add('open'); c.style.maxHeight = "none"; if (i) i.classList.add('rotate-180');
    }
};

window.handleSidebarResize = function (isInitialLoad) {
    if (isInitialLoad === true || window.innerWidth !== window._lastWindowWidth) {
        window._lastWindowWidth = window.innerWidth;
        window.isSidebarOpen = window.innerWidth >= window.windowWidthBabu;
        window.applySidebarState();
    }
};

window.applySidebarState = function () {
    var sb = document.getElementById('app-sidebar');
    var bd = document.getElementById('sidebar-backdrop');
    if (!sb || !bd) return;
    if (window.isSidebarOpen) {
        sb.classList.remove('-translate-x-full', 'w-0', 'lg:w-0');
        sb.classList.add('w-64', 'lg:w-64');
        if (window.innerWidth < window.windowWidthBabu) bd.classList.remove('opacity-0', 'pointer-events-none', 'hidden');
    } else {
        sb.classList.add('-translate-x-full');
        if (window.innerWidth >= window.windowWidthBabu) {
            sb.classList.remove('w-64', 'lg:w-64');
            sb.classList.add('w-0', 'lg:w-0');
        }
        bd.classList.add('opacity-0', 'pointer-events-none');
        setTimeout(function () { if (!window.isSidebarOpen) bd.classList.add('hidden'); }, 300);
    }
};

window.showNotif = function (el, msg, success) {
    if (!el) return;
    el.innerText = msg; el.classList.remove('hidden');
    el.className = "text-sm md:text-lg text-center font-bold mt-4 p-4 rounded-xl border-2 block " + (success ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200') + " fade-in";
};

window.goToReport = function (tabName, filterArg) {
    var brand = document.getElementById('header-brand-area');
    var backBtn = document.getElementById('btn-back-dashboard');
    
    if (brand) brand.classList.remove('hidden');
    if (backBtn) backBtn.classList.add('hidden');
    
    if (tabName === 'dashboard' && !filterArg) {
        window.dashboardReturnState = 1;
        if (typeof window.loadDashboardData === 'function') window.loadDashboardData(true);
    }
    
    window._executeRouting(tabName, filterArg);
};

window.navigateFromDashboard = function (reportId, filterArg) {
    var dash1 = document.getElementById('dash-content-1');
    var dash2 = document.getElementById('dash-content-2');
    var dash3 = document.getElementById('dash-content-3');
    
    if (dash1 && !dash1.classList.contains('hidden')) window.dashboardReturnState = 1;
    else if (dash2 && !dash2.classList.contains('hidden')) window.dashboardReturnState = 2;
    else if (dash3 && !dash3.classList.contains('hidden')) window.dashboardReturnState = 3;
    else window.dashboardReturnState = 1;

    window.dashboardLeaveTime = new Date().getTime();
    
    var brand = document.getElementById('header-brand-area');
    var backBtn = document.getElementById('btn-back-dashboard');
    if (brand) brand.classList.add('hidden');
    if (backBtn) backBtn.classList.remove('hidden');
    
    window._executeRouting(reportId, filterArg);
    
    if (reportId === 'sales' || reportId === 'pays') {
        var targetDate = (filterArg === 'latest') ? window._latestActionDate1 : window._latestActionDate2;
        if (targetDate) {
            var sStart = document.getElementById(reportId + '-start'); if(sStart) sStart.value = targetDate;
            var sEnd = document.getElementById(reportId + '-end'); if(sEnd) sEnd.value = targetDate;
            if (reportId === 'sales' && typeof window.loadSalesData === 'function') window.loadSalesData();
            if (reportId === 'pays' && typeof window.loadPaysData === 'function') window.loadPaysData();
        }
    } 
};

window.returnToDashboard = function () {
    var brand = document.getElementById('header-brand-area');
    var backBtn = document.getElementById('btn-back-dashboard');
    if (brand) brand.classList.remove('hidden');
    if (backBtn) backBtn.classList.add('hidden');
    
    window._executeRouting('dashboard');
    if(typeof window.switchDashTab === 'function') window.switchDashTab(window.dashboardReturnState || 1);
    if ((new Date().getTime() - window.dashboardLeaveTime) > 60000 && typeof window.loadDashboardData === 'function') window.loadDashboardData(true);
};

// =====================================
// THE NEW DYNAMIC ROUTER
// =====================================
window._executeRouting = function (tabName, filterArg) {
    var allowed = window.activeAdminSession ? (window.activeAdminSession.allowedTabs || []) : [];
    
    if (!allowed.includes('ALL') && !allowed.includes(tabName) && tabName !== 'password') {
        return alert("Access Denied: Your role does not have permission to view this module.");
    }

    // Hide all tabs dynamically
    var allTabs = document.querySelectorAll('div[id^="tab-"]');
    allTabs.forEach(t => t.classList.add('hidden'));

    // Reset all sidebar buttons
    var allNavBtns = document.querySelectorAll('button[id^="nav-tab-"]');
    allNavBtns.forEach(btn => {
        btn.classList.remove('text-white', 'bg-slate-800/50');
        btn.classList.add('text-slate-400');
    });

    // Show active tab
    var activeTab = document.getElementById('tab-' + tabName);
    if (activeTab) activeTab.classList.remove('hidden');

    // Highlight active button
    var aBtn = document.getElementById('nav-tab-' + tabName);
    if (aBtn) {
        aBtn.classList.remove('text-slate-400');
        aBtn.classList.add('text-white', 'bg-slate-800/50');
    }

    if (window.innerWidth < window.windowWidthBabu && window.isSidebarOpen) {
        window.toggleSidebar();
    }

    // Execute Module Logic
    if (window.tabActions && typeof window.tabActions[tabName] === 'function') {
        window.tabActions[tabName](filterArg);
    }
};

window.openForgotPasswordView = function () {
    document.getElementById('auth-login').classList.add('hidden'); document.getElementById('auth-forgot').classList.remove('hidden');
    document.getElementById('otp-step-1').classList.remove('hidden'); document.getElementById('otp-step-2').classList.add('hidden');
    document.getElementById('first-time-notice').classList.add('hidden');
    document.getElementById('reset-email').value = ""; document.getElementById('reset-otp').value = ""; document.getElementById('reset-new-pass').value = "";
    document.getElementById('reset-msg').classList.add('hidden');
};

window.backToLoginState = function () {
    document.getElementById('auth-forgot').classList.add('hidden'); document.getElementById('auth-login').classList.remove('hidden');
    document.getElementById('login-err').classList.add('hidden');
};

window.logoutAdmin = function () {
    localStorage.removeItem('wowdrops_admin_session_payload'); window.activeAdminSession = null;
    document.getElementById('view-workspace').classList.add('hidden'); document.getElementById('view-auth').classList.remove('hidden');
    document.getElementById('auth-forgot').classList.add('hidden'); document.getElementById('auth-login').classList.remove('hidden');
    document.getElementById('admin-id').value = ''; document.getElementById('admin-pass').value = '';
    window.showNotif(document.getElementById('login-err'), "Successfully logged out.", true);
};

// --- SUPABASE AUTHENTICATION (JSONB Multi-Module Upgrade) ---
window.handleAdminLogin = async function () {
    var id = document.getElementById('admin-id').value.trim().toLowerCase();
    var pass = document.getElementById('admin-pass').value;
    var errBox = document.getElementById('login-err');
    if (!id) return window.showNotif(errBox, "Please enter your username or email.", false);

    document.getElementById('btn-login').innerText = "Verifying...";
    try {
        const inputHash = await hashPassword(pass);
        const { data: userData, error } = await supabase1
            .from('users')
            .select('*')
            .or(`username.eq.${id},mail_id.eq.${id}`)
            .maybeSingle();

        if (error || !userData) {
            document.getElementById('btn-login').innerText = "Sign In";
            return window.showNotif(errBox, "User not found.", false);
        }

        var dbPassword = String(userData.password_hash || '').trim();
        if (dbPassword === "" || dbPassword === "undefined") {
            document.getElementById('btn-login').innerText = "Sign In";
            window.openForgotPasswordView();
            document.getElementById('otp-step-1').classList.add('hidden');
            document.getElementById('otp-step-2').classList.remove('hidden');
            document.getElementById('first-time-notice').classList.remove('hidden');
            document.getElementById('reset-email').value = userData.mail_id;
            window.showNotif(document.getElementById('reset-msg'), "Account initialization caught. Setup access via OTP verification.", true);
            return;
        }

        if (dbPassword === inputHash) {
            var appRoles = userData.app_roles || {};
            var adminRolesArray = appRoles['ADMIN'] || [];

            if (adminRolesArray.length === 0) {
                document.getElementById('btn-login').innerText = "Sign In";
                return window.showNotif(errBox, "Access Denied: No Admin Portal roles assigned.", false);
            }

            const { data: perms } = await supabase1
                .from('sys_role_permissions')
                .select('page_id, can_edit')
                .eq('module_name', 'ADMIN')
                .in('role_name', adminRolesArray);

            var allowedTabs = [];
            var readOnlyTabs = [];
            var isSuper = adminRolesArray.includes("Super Admin");

            if (isSuper) {
                allowedTabs = ["ALL"];
            } else {
                (perms || []).forEach(p => {
                    if (!allowedTabs.includes(p.page_id)) allowedTabs.push(p.page_id);
                    if (!p.can_edit && !readOnlyTabs.includes(p.page_id)) readOnlyTabs.push(p.page_id);
                    if (p.can_edit) readOnlyTabs = readOnlyTabs.filter(id => id !== p.page_id);
                });
            }

            window.activeAdminSession = {
                username: userData.username,
                roles: adminRolesArray,
                mailid: userData.mail_id,
                allowedTabs: allowedTabs,
                readOnlyTabs: readOnlyTabs
            };
            
            localStorage.setItem('wowdrops_admin_session_payload', JSON.stringify(window.activeAdminSession));
            window.assertWorkspaceDeployment();
        } else {
            document.getElementById('btn-login').innerText = "Sign In";
            window.showNotif(errBox, "Invalid Password.", false);
        }
    } catch (err) {
        document.getElementById('btn-login').innerText = "Sign In";
        window.showNotif(errBox, "Login error: " + err.message, false);
    }
};

window.requestOTP = async function () {
    var mail = document.getElementById('reset-email').value.trim();
    var msgBox = document.getElementById('reset-msg');
    if (!mail) return window.showNotif(msgBox, "Email address is required.", false);

    document.getElementById('btn-otp').innerText = "Sending Code...";
    try {
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiry = new Date(new Date().getTime() + (10 * 60 * 1000)).toISOString();

        const { error } = await supabase1
            .from('users')
            .update({ otp: otp, otp_expiry: expiry })
            .eq('mail_id', mail);

        if (error) throw error;

        await fetch(GAS_WEBHOOK_URL, {
            method: 'POST',
            body: JSON.stringify({ email: mail, otp: otp }),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });

        document.getElementById('btn-otp').innerText = "Send OTP Code";
        document.getElementById('otp-step-1').classList.add('hidden');
        document.getElementById('otp-step-2').classList.remove('hidden');
        window.showNotif(msgBox, "Verification OTP code has been sent.", true);

    } catch (err) {
        document.getElementById('btn-otp').innerText = "Send OTP Code";
        window.showNotif(msgBox, "Failed to send OTP: " + err.message, false);
    }
};

window.confirmPasswordReset = async function () {
    var email = document.getElementById('reset-email').value.trim();
    var otp = document.getElementById('reset-otp').value.trim();
    var pass = document.getElementById('reset-new-pass').value;
    var msgBox = document.getElementById('reset-msg');

    if (!otp || pass.length < 4) return window.showNotif(msgBox, "Provide valid OTP and secure password.", false);

    document.getElementById('btn-reset').innerText = "Configuring...";
    try {
        const { data: userData, error } = await supabase1
            .from('users')
            .select('otp, otp_expiry')
            .eq('mail_id', email)
            .maybeSingle();

        if (error || !userData) throw new Error("User record not found.");

        if (new Date() > new Date(userData.otp_expiry)) {
            return window.showNotif(msgBox, "OTP verification code has expired.", false);
        }
        if (String(userData.otp).trim() !== otp) {
            return window.showOpenNotice ? window.showOpenNotice() : window.showNotif(msgBox, "Invalid OTP code entered.", false);
        }

        const hashedPass = await hashPassword(pass);
        const { error: updateErr } = await supabase1
            .from('users')
            .update({ password_hash: hashedPass, otp: null, otp_expiry: null })
            .eq('mail_id', email);

        document.getElementById('btn-reset').innerText = "Apply Password";
        if (updateErr) throw updateErr;

        window.showNotif(msgBox, "Password configured successfully!", true);
        setTimeout(window.backToLoginState, 2200);
    } catch (err) {
        document.getElementById('btn-reset').innerText = "Apply Password";
        window.showNotif(msgBox, "Password reset failed: " + err.message, false);
    }
};

window.initAdminAuth = function () {
    var storedSession = localStorage.getItem('wowdrops_admin_session_payload');
    if (storedSession) { 
        window.activeAdminSession = JSON.parse(storedSession); 
        window.assertWorkspaceDeployment(); 
    }

    var today = new Date(); 
    var todayStr = today.toISOString().split('T')[0];
    var monthStr = today.getFullYear() + "-" + (today.getMonth() + 1).toString().padStart(2, '0');

    var elReportMonth = document.getElementById('report-month'); if (elReportMonth) elReportMonth.value = monthStr;
    var elSalesStart = document.getElementById('sales-start'); if (elSalesStart) elSalesStart.value = todayStr;
    var elSalesEnd = document.getElementById('sales-end'); if (elSalesEnd) elSalesEnd.value = todayStr;
    var elPaysStart = document.getElementById('pays-start'); if (elPaysStart) elPaysStart.value = todayStr;
    var elPaysEnd = document.getElementById('pays-end'); if (elPaysEnd) elPaysEnd.value = todayStr;

    var lastWeek = new Date(); 
    lastWeek.setDate(today.getDate() - 7);
    var elLogStart = document.getElementById('log-start'); if (elLogStart) elLogStart.value = lastWeek.toISOString().split('T')[0];
    var elLogEnd = document.getElementById('log-end'); if (elLogEnd) elLogEnd.value = todayStr;

    var d = new Date();
    var elCrmEnd = document.getElementById('crm-rep-end'); if (elCrmEnd) elCrmEnd.value = d.toISOString().split('T')[0];
    d.setDate(d.getDate() - 30);
    var elCrmStart = document.getElementById('crm-rep-start'); if (elCrmStart) elCrmStart.value = d.toISOString().split('T')[0];

    window.handleSidebarResize(true); 
    window.addEventListener('resize', window.handleSidebarResize);
};

// Execute immediately upon file load:
window.initAdminAuth();