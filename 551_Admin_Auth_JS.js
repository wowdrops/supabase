
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

// Role Permissions Mapping (Preserved from source)[cite: 5]
const ROLE_PERMISSIONS = {
    "Super Admin": ["ALL"],
    "Admin": [
        "dashboard", "dormant-crm", "update-can", "outstanding", "dormant", "reports",
        "sales", "pays", "orders", "delivery", "tran-order", "tran-delivery",
        "tran-escalations", "crm-reports", "master-customer", "reports-customer", "sales-cal", "user-access",
        "tran-sales-crud", "tran-pays-crud", "phonepe-dash",
        "current-stock", "sys-config", "users", "push-notifications", "handshake-log"
    ],
    "DRIVERDELIVERYADMIN": [
        "orders", "delivery", "update-can", "dormant", "tran-order", "tran-delivery",
        "sales", "pays", "outstanding", "crm-reports", "reports-customer",
        "master-customer", "handshake-log"
    ],
    "Manager": [
        "dashboard", "sales", "pays", "outstanding", "sales-cal", "dormant", "delivery",
        "reports-customer", "master-customer:view"
    ],
    "Data Entry": [
        "update-can", "tran-order", "tran-delivery"
    ],
    "CRM Agent": [
        "dormant-crm", "tran-escalations", "crm-reports", "sys-config"
    ]
};

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

window.assertWorkspaceDeployment = function () {
    var viewAuth = document.getElementById('view-auth');
    var viewWorkspace = document.getElementById('view-workspace');
    var dispAdmin = document.getElementById('disp-admin-name');

    if (viewAuth) viewAuth.classList.add('hidden');
    if (viewWorkspace) viewWorkspace.classList.remove('hidden');
    if (dispAdmin && window.activeAdminSession) {
        dispAdmin.innerText = "User: " + window.activeAdminSession.username;
    }

    window.applyRolePermissions();
    var allowed = window.activeAdminSession ? (window.activeAdminSession.allowedTabs || []) : [];
    var firstTab = (allowed.includes('ALL') || allowed.includes('dashboard')) ? 'dashboard' : allowed[0];
    firstTab = firstTab || 'password';
    window.goToReport(firstTab);
};

window.applyRolePermissions = function () {
    if (!window.activeAdminSession) return;
    var allowed = window.activeAdminSession.allowedTabs || [];
    var isSuper = allowed.includes("ALL");
    var allTabs = Object.keys(window.tabActions);

    // 1. Hide individual buttons
    for (var i = 0; i < allTabs.length; i++) {
        var tab = allTabs[i];
        var btn = document.getElementById('nav-tab-' + tab);
        if (!btn) continue;
        if (!isSuper && !allowed.includes(tab)) {
            btn.classList.add('hidden');
        } else {
            btn.classList.remove('hidden');
        }
    }

    // 2. Hide empty accordions automatically (MISSING IN SUPABASE VERSION)
    var accordions = ['dash', 'master', 'trans', 'reports', 'utilities'];
    accordions.forEach(function (acc) {
        var container = document.getElementById('acc-' + acc);
        if (container) {
            var visibleBtns = container.querySelectorAll('button:not(.hidden)');
            var headerBtn = container.previousElementSibling;
            if (visibleBtns.length === 0) {
                if (headerBtn) headerBtn.classList.add('hidden');
                container.classList.add('hidden');
            } else {
                if (headerBtn) headerBtn.classList.remove('hidden');
                container.classList.remove('hidden');
            }
        }
    });
};


// Single Source of Truth for Routing
window.tabActions = {
    'dashboard': function () { 
        if (typeof window.switchDashTab === 'function') window.switchDashTab(1);
        if (typeof window.loadDashboardData === 'function') window.loadDashboardData(); // <-- ADD THIS LINE
    },
    'dormant-crm': function() { 
        if(typeof window.switchCRMDashTab === 'function') window.switchCRMDashTab(1); 
        var d7 = document.getElementById('dormant-7');
        if (d7 && d7.innerText === '0') { 
            if (typeof window.fetchDormantSummaryCards === 'function') window.fetchDormantSummaryCards(); 
            if (typeof window.fetchCRMDashboardStats === 'function') window.fetchCRMDashboardStats(); 
        } 
    },
    'master-customer': function () { if (typeof window.loadMasterCustomers === 'function') window.loadMasterCustomers(); },
    'update-can': function () { },
    'tran-order': function() { 
        if(typeof window.resetOrd2Form === 'function') window.resetOrd2Form();
        if(typeof window.loadTranOrdersData === 'function') window.loadTranOrdersData(); 
    },
    'tran-delivery': function () { if (typeof window.loadDeliveryQCData === 'function') window.loadDeliveryQCData(); },
    'tran-escalations': function () { if (typeof window.loadEscalationsData === 'function') window.loadEscalationsData(); },
    'tran-sales-crud': function () { if (typeof window.loadSalesCrudData === 'function') window.loadSalesCrudData(); },
    'tran-pays-crud': function () { if (typeof window.loadPaysCrudData === 'function') window.loadPaysCrudData(); },
    'reports': function () { },
    'outstanding': function () { if (typeof window.loadOutstandingData === 'function') window.loadOutstandingData(); },
    'dormant': function () { if (typeof window.loadDormantData === 'function') window.loadDormantData(); },
    'sales': function (arg) { if (!arg && typeof window.loadSalesData === 'function') window.loadSalesData(); },
    'pays': function (arg) { if (!arg && typeof window.loadPaysData === 'function') window.loadPaysData(); },
    'orders': function () { if (typeof window.loadOrdersData === 'function') window.loadOrdersData(); },
    'delivery': function (arg) { if (typeof window.loadDeliveryData === 'function') window.loadDeliveryData(arg); },
    'crm-reports': function () { if (typeof window.generateDormantConversionReport === 'function') window.generateDormantConversionReport(); },
    'reports-customer': function () { if (typeof window.loadCustomerAnalyticsData === 'function') window.loadCustomerAnalyticsData(); },
    'sales-cal': function () { if (typeof window.loadSalesCalendar === 'function') window.loadSalesCalendar(); },
    'user-access': function () { if (typeof window.loadSystemAccessMap === 'function') window.loadSystemAccessMap(); },
    'current-stock': function () { if (typeof window.loadCurrentStock === 'function') window.loadCurrentStock(); },
    'sys-config': function () { if (typeof window.loadSysConfig === 'function') window.loadSysConfig(); },
    'users': function () { if (typeof window.loadUsersData === 'function') window.loadUsersData(); },
    'push-notifications': function () { if (typeof window.loadNotificationLogs === 'function') window.loadNotificationLogs(); },
    'handshake-log': function () { if (typeof window.loadHandshakeLog === 'function') window.loadHandshakeLog(); }
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
    if (brand) brand.innerHTML = "<a href='https://wowdrops.github.io/supabase' target='_blank' rel='noopener noreferrer' class='shrink-0 flex items-center'><img src='wowLogo.jpg' class='h-16 w-auto' alt='Logo'></a>";
    window._executeRouting(tabName, filterArg);
};

window.navigateFromDashboard = function (reportId, filterArg) {
    var dash2 = document.getElementById('dash-content-2');
    window.dashboardReturnState = (dash2 && dash2.classList.contains('hidden')) ? 1 : 2;
    window.dashboardLeaveTime = new Date().getTime();
    
    var brand = document.getElementById('header-brand-area');
    if(brand) brand.innerHTML = "<button onclick='window.returnToDashboard()' class='text-lg md:text-xl font-black text-indigo-700 hover:text-indigo-900 flex items-center gap-2'><svg class='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path stroke-linecap='round' stroke-linejoin='round' stroke-width='3' d='M10 19l-7-7m0 0l7-7m-7 7h18'></path></svg> Back to Dashboard</button>";
    
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
    if(brand) brand.innerHTML = "<a href='https://wowdrops.github.io/supabase' target='_blank' rel='noopener noreferrer' class='shrink-0 flex items-center'><img src='wowLogo.jpg' class='h-16 w-auto' alt='Logo'></a>";
    window._executeRouting('dashboard');
    if(typeof window.switchDashTab === 'function') window.switchDashTab(window.dashboardReturnState || 1);
    if ((new Date().getTime() - window.dashboardLeaveTime) > 60000 && typeof window.loadDashboardData === 'function') window.loadDashboardData(true);
};

window._executeRouting = function (tabName, filterArg) {
    var allowed = window.activeAdminSession ? (window.activeAdminSession.allowedTabs || []) : [];
    if (!allowed.includes('ALL') && !allowed.includes(tabName) && tabName !== 'password') {
        return alert("Access Denied: Your role does not have permission to view this module.");
    }

    var tabs = Object.keys(window.tabActions).concat(['password']);
    for (var i = 0; i < tabs.length; i++) {
        var tabEl = document.getElementById('tab-' + tabs[i]);
        if (tabEl) tabEl.classList.add('hidden');
        var btn = document.getElementById('nav-tab-' + tabs[i]);
        if (btn) {
            btn.classList.remove('text-white', 'bg-slate-800/50');
            btn.classList.add('text-slate-400');
        }
    }

    var activeTab = document.getElementById('tab-' + tabName);
    if (activeTab) activeTab.classList.remove('hidden');

    var aBtn = document.getElementById('nav-tab-' + tabName);
    if (aBtn) {
        aBtn.classList.remove('text-slate-400');
        aBtn.classList.add('text-white', 'bg-slate-800/50');
    }

    if (window.innerWidth < window.windowWidthBabu && window.isSidebarOpen) {
        window.toggleSidebar();
    }

    if (window.tabActions[tabName]) window.tabActions[tabName](filterArg);
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

// --- SUPABASE AUTHENTICATION ---
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

        document.getElementById('btn-login').innerText = "Sign In";

        if (error || !userData) {
            return window.showNotif(errBox, "User not found.", false);
        }

        var dbPassword = String(userData.password_hash || '').trim();
        if (dbPassword === "" || dbPassword === "undefined") {
            window.openForgotPasswordView();
            document.getElementById('otp-step-1').classList.add('hidden');
            document.getElementById('otp-step-2').classList.remove('hidden');
            document.getElementById('first-time-notice').classList.remove('hidden');
            document.getElementById('reset-email').value = userData.mail_id;
            window.showNotif(document.getElementById('reset-msg'), "Account initialization caught. Setup access via OTP verification.", true);
            return;
        }

        if (dbPassword === inputHash) {
            var rowRole = String(userData.role || '').trim();
            var rawTabs = ROLE_PERMISSIONS[rowRole] || [];
            var allowedTabs = [];
            var readOnlyTabs = [];

            if (rawTabs.includes("ALL")) {
                allowedTabs = ["ALL"];
            } else {
                for (var t = 0; t < rawTabs.length; t++) {
                    var tabItem = rawTabs[t];
                    if (tabItem.indexOf(":view") > -1) {
                        var baseName = tabItem.split(":")[0];
                        allowedTabs.push(baseName);
                        readOnlyTabs.push(baseName);
                    } else {
                        allowedTabs.push(tabItem);
                    }
                }
            }

            window.activeAdminSession = {
                username: userData.username,
                role: rowRole,
                mailid: userData.mail_id,
                allowedTabs: allowedTabs,
                readOnlyTabs: readOnlyTabs
            };
            localStorage.setItem('wowdrops_admin_session_payload', JSON.stringify(window.activeAdminSession));
            window.assertWorkspaceDeployment();
        } else {
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

        // 1. Save the OTP to Supabase
        const { error } = await supabase1
            .from('users')
            .update({ otp: otp, otp_expiry: expiry })
            .eq('mail_id', mail);

        if (error) throw error;

        // 2. Ping the GAS Webhook to send the email
        await fetch(GAS_WEBHOOK_URL, {
            method: 'POST',
            body: JSON.stringify({ email: mail, otp: otp }),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' } // text/plain prevents CORS preflight errors
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

// Replace "window.onload = function () {" with:
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
