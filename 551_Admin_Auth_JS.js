window.onerror = function (msg, url, line) {
    if (window.showToast) window.showToast("App Error: " + msg, "error");
    else alert("App Error: " + msg + " (Line " + line + ")");
    return false;
};
window.windowWidthBabu = 1024;
window.activeAdminSession = null;
window.isSidebarOpen = window.innerWidth >= window.windowWidthBabu;
window._sessionHeartbeatTimer = null;
window.sysPagesMap = [];

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
window.tabActions = {};

window.getUniqueArray = function (arr) { var res = []; for (var i = 0; i < arr.length; i++) { if (res.indexOf(arr[i]) === -1 && arr[i]) res.push(arr[i]); } return res; };
window.trimMonth = function (str) { if (!str) return 'M'; return str.toUpperCase().replace("PEND", "").trim().substring(0, 3); };

window.hasWriteAccess = function (tabName) {
    if (!window.activeAdminSession) return false;
    if (window.activeAdminSession.allowedTabs.includes("ALL")) return true;
    var readOnlyList = window.activeAdminSession.readOnlyTabs || [];
    return !readOnlyList.includes(tabName);
};

window.hashPassword = async function (password) {
    if (!password) return "";
    const msgBuffer = new TextEncoder().encode(String(password).trim());
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

window.verifyLiveUserStatus = async function () {
    if (!window.activeAdminSession || !window.activeAdminSession.username) return true;
    try {
        const { data: userData, error } = await window.supabase1
            .from('users')
            .select('status, app_roles')
            .eq('username', window.activeAdminSession.username)
            .maybeSingle();

        if (error || !userData) return true;

        var currentStatus = String(userData.status || 'ACTIVE').toUpperCase();
        var appRoles = userData.app_roles || {};
        var adminRolesArray = appRoles['ADMIN'] || [];

        if (currentStatus !== 'ACTIVE' || adminRolesArray.length === 0) {
            window.logoutAdmin("Session terminated: Your account has been marked INACTIVE or permissions were revoked.");
            return false;
        }
        return true;
    } catch (e) {
        return true;
    }
};

window.startSessionHeartbeat = function () {
    if (window._sessionHeartbeatTimer) clearInterval(window._sessionHeartbeatTimer);
    window._sessionHeartbeatTimer = setInterval(function () {
        window.verifyLiveUserStatus();
    }, 60000);
};

window.assertWorkspaceDeployment = async function () {
    var isStillActive = await window.verifyLiveUserStatus();
    if (!isStillActive) return;

    var viewAuth = document.getElementById('view-auth');
    var viewWorkspace = document.getElementById('view-workspace');
    var dispAdmin = document.getElementById('disp-admin-name');

    if (viewAuth) viewAuth.classList.add('hidden');
    if (viewWorkspace) viewWorkspace.classList.remove('hidden');
    if (dispAdmin && window.activeAdminSession) {
        dispAdmin.innerText = "User: " + window.activeAdminSession.username;
    }

    window.startSessionHeartbeat();
    await window.applyRolePermissions();

    var allowed = window.activeAdminSession ? (window.activeAdminSession.allowedTabs || []) : [];
    var firstTab = (allowed.includes('ALL') || allowed.includes('dashboard')) ? 'dashboard' : allowed[0];
    firstTab = firstTab || 'password';

    var hashTab = window.location.hash.replace('#', '');

    if (hashTab && (allowed.includes('ALL') || allowed.includes(hashTab))) {
        window.goToReport(hashTab);
    } else {
        window.goToReport(firstTab);
    }
};

window.applyRolePermissions = async function () {
    if (!window.activeAdminSession) return;
    var allowed = window.activeAdminSession.allowedTabs || [];
    var isSuper = allowed.includes("ALL");

    const [menusRes, pagesRes] = await Promise.all([
        window.supabase1.from('sys_menus').select('*').eq('module_name', 'ADMIN'),
        window.supabase1.from('sys_pages').select('*').eq('module_name', 'ADMIN')
    ]);

    window.sysPagesMap = pagesRes.data || [];
    var menus = (menusRes.data || []).sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999) || a.id - b.id);
    var sidebarPages = window.sysPagesMap.filter(p => p.show_in_sidebar === true).sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999) || (a.page_title || '').localeCompare(b.page_title || ''));

    var navContainer = document.querySelector('#app-sidebar nav');
    if (!navContainer) return;

    var html = "";
    var mainMenus = menus.filter(m => !m.parent_menu_id);

    mainMenus.forEach((m, index) => {
        var directPages = sidebarPages.filter(p => String(p.menu_id) === String(m.id) && (isSuper || allowed.includes(p.page_id)));
        var subMenus = menus.filter(sub => String(sub.parent_menu_id) === String(m.id));
        var subMenuHtml = "";

        subMenus.forEach(sub => {
            var subPages = sidebarPages.filter(p => String(p.menu_id) === String(sub.id) && (isSuper || allowed.includes(p.page_id)));
            if (subPages.length > 0) {
                var defaultSubIcon = '<svg class="w-3.5 h-3.5 shrink-0 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>';
                subMenuHtml += `
                  <div onclick="window.toggleSubAccordion('sub-menu-${sub.id}', 'icon-sub-${sub.id}')" class="flex justify-between items-center px-2 py-1.5 mt-1 cursor-pointer rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800/50 transition">
                    <div class="flex items-center gap-1.5">
                      ${sub.icon_svg || defaultSubIcon}
                      <span class="text-[12px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">${sub.menu_label}</span>
                    </div>
                    <svg id="icon-sub-${sub.id}" class="w-3.5 h-3.5 shrink-0 transition-transform duration-200 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                  </div>
                  <div id="sub-menu-${sub.id}" class="hidden">
                    <div class="flex flex-col pl-4 space-y-1 mt-1">
                      ${subPages.map(p => {
                    var clickAction = p.page_id === 'phonepe-dash' ? `window.open('https://business.phonepe.com/dashboard', '_blank')` : `window.goToReport('${p.page_id}')`;
                    return `
                        <button onclick="${clickAction}" id="nav-tab-${p.page_id}" class="flex items-center gap-2 w-full text-left py-1.5 px-2 rounded-lg text-[13px] font-semibold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-white hover:bg-indigo-50 dark:hover:bg-slate-800/50 transition">
                          ${p.icon_svg ? `<span class="shrink-0 flex items-center">${p.icon_svg}</span>` : ''}
                          <span class="truncate">${p.page_title}</span>
                        </button>`;
                }).join('')}
                    </div>
                  </div>
                `;
            }
        });

        if (directPages.length > 0 || subMenuHtml !== "") {
            var isFirstOpen = index === 0 ? "open" : "";
            var isFirstRotate = index === 0 ? "rotate-180" : "";
            var defaultMainIcon = '<svg class="w-5 h-5 shrink-0 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012-2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012-2h-2a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012-2h-2a2 2 0 01-2-2v-2z"></path></svg>';
            
            html += `
            <div>
              <button onclick="window.toggleAccordion('acc-main-${m.id}', 'icon-main-${m.id}')" class="w-full flex justify-between items-center px-3 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-white transition">
                <div class="flex items-center gap-2">
                  ${m.icon_svg || defaultMainIcon}
                  <span class="sidebar-text whitespace-nowrap overflow-hidden transition-all duration-300">${m.menu_label}</span>
                </div>
                <svg id="icon-main-${m.id}" class="w-4 h-4 shrink-0 transition-transform duration-200 ${isFirstRotate}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
              </button>
              <div id="acc-main-${m.id}" class="accordion-content ${isFirstOpen}">
                <div class="overflow-hidden">
                  <div class="flex flex-col pl-6 pr-2 py-1 space-y-1">
                    ${directPages.map(p => {
                var clickAction = p.page_id === 'phonepe-dash' ? `window.open('https://business.phonepe.com/dashboard', '_blank')` : `window.goToReport('${p.page_id}')`;
                return `
                        <button onclick="${clickAction}" id="nav-tab-${p.page_id}" class="flex items-center gap-2 w-full text-left py-1.5 px-2 rounded-lg text-[13px] font-semibold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-white hover:bg-indigo-50 dark:hover:bg-slate-800/50 transition">
                          ${p.icon_svg ? `<span class="shrink-0 flex items-center">${p.icon_svg}</span>` : ''}
                          <span class="truncate">${p.page_title}</span>
                        </button>`;
            }).join('')}
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
    if (!content) return;
    var parentContent = content.closest('.accordion-content');
    content.classList.toggle('hidden');
    if (icon) icon.classList.toggle('rotate-180');
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
        sb.classList.remove('sidebar-collapsed');
        sb.classList.remove('-translate-x-full', 'w-0', 'lg:w-0');
        sb.classList.add('w-64', 'lg:w-64');
        if (window.innerWidth < window.windowWidthBabu) bd.classList.remove('opacity-0', 'pointer-events-none', 'hidden');
    } else {
        sb.classList.add('sidebar-collapsed');
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
    el.className = "text-sm md:text-lg text-center font-bold mt-4 p-4 rounded-xl border-2 block transition-colors " + (success ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800') + " fade-in";
};

// =====================================
// GLOBAL TOAST NOTIFICATION (SPA Dark Mode)
// =====================================
window.showToast = function (msg, type = 'success') {
    var container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none';
        document.body.appendChild(container);
    }

    var bgColor = type === 'success' ? 'bg-emerald-600 dark:bg-emerald-700' : (type === 'warning' ? 'bg-amber-500 dark:bg-amber-600' : 'bg-rose-600 dark:bg-rose-700');
    var icon = type === 'success'
        ? '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>'
        : '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>';

    var toast = document.createElement('div');
    toast.className = `${bgColor} text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 font-black text-sm tracking-widest uppercase pointer-events-auto transform transition-all duration-300 translate-y-10 opacity-0`;
    toast.innerHTML = `${icon} <span>${msg}</span>`;

    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.remove('translate-y-10', 'opacity-0');
        toast.classList.add('translate-y-0', 'opacity-100');
    });

    setTimeout(() => {
        toast.classList.remove('translate-y-0', 'opacity-100');
        toast.classList.add('translate-y-10', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

window.toggleScrollLock = function (isLocked) {
    var scrollArea = document.getElementById('scroll-area');
    if (scrollArea) {
        if (isLocked) scrollArea.classList.add('overflow-hidden');
        else scrollArea.classList.remove('overflow-hidden');
    }
};

window.closeModal = function (id) {
    var modal = document.getElementById(id);
    if (modal) modal.classList.add('hidden');
    window.toggleScrollLock(false);
};

// =====================================
// GLOBAL NAVIGATION CONTROLLER
// =====================================
window.activeDashboardModule = 'dashboard';

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

window.navigateFromDashboard = function (reportId, filterArg, sourceDashLabel) {
    var isCRM = document.getElementById('tab-dormant-crm') && !document.getElementById('tab-dormant-crm').classList.contains('hidden');

    if (isCRM) {
        window.activeDashboardModule = 'dormant-crm';
        var crmDash2 = document.getElementById('crm-dash-content-2');
        window.dashboardReturnState = (crmDash2 && !crmDash2.classList.contains('hidden')) ? 2 : 1;
    } else {
        window.activeDashboardModule = 'dashboard';
        var dash1 = document.getElementById('dash-content-1');
        var dash2 = document.getElementById('dash-content-2');
        var dash3 = document.getElementById('dash-content-3');

        if (dash1 && !dash1.classList.contains('hidden')) window.dashboardReturnState = 1;
        else if (dash2 && !dash2.classList.contains('hidden')) window.dashboardReturnState = 2;
        else if (dash3 && !dash3.classList.contains('hidden')) window.dashboardReturnState = 3;
        else window.dashboardReturnState = 1;
    }

    window.dashboardLeaveTime = new Date().getTime();

    var brand = document.getElementById('header-brand-area');
    var backBtn = document.getElementById('btn-back-dashboard');
    var backBtnText = document.getElementById('lbl-back-dashboard');

    if (brand) brand.classList.add('hidden');
    if (backBtn) {
        backBtn.classList.remove('hidden'); 
        if (backBtnText) backBtnText.innerText = "Back to " + (sourceDashLabel || (isCRM ? "CRM" : "Operations"));
    }

    window._executeRouting(reportId, filterArg);

    if (reportId === 'sales' || reportId === 'pays') {
        var targetDate = (filterArg === 'latest') ? window._latestActionDate1 : window._latestActionDate2;
        if (targetDate) {
            var sStart = document.getElementById(reportId + '-start'); if (sStart) sStart.value = targetDate;
            var sEnd = document.getElementById(reportId + '-end'); if (sEnd) sEnd.value = targetDate;
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

    var targetDash = window.activeDashboardModule || 'dashboard';
    window._executeRouting(targetDash);

    if (targetDash === 'dashboard' && typeof window.switchDashTab === 'function') {
        window.switchDashTab(window.dashboardReturnState || 1);
        if ((new Date().getTime() - window.dashboardLeaveTime) > 60000 && typeof window.loadDashboardData === 'function') window.loadDashboardData(true);
    } else if (targetDash === 'dormant-crm' && typeof window.switchCRMDashTab === 'function') {
        window.switchCRMDashTab(window.dashboardReturnState || 1);
        if ((new Date().getTime() - window.dashboardLeaveTime) > 60000 && typeof window.fetchCRMDashboardStats === 'function') window.fetchCRMDashboardStats();
    }
};

window._executeRouting = async function (tabName, filterArg) {
    window.verifyLiveUserStatus();

    var allowed = window.activeAdminSession ? (window.activeAdminSession.allowedTabs || []) : [];
    if (!allowed.includes('ALL') && !allowed.includes(tabName) && tabName !== 'password') {
        if (window.showToast) return window.showToast("Access Denied: Your role does not have permission.", "error");
        else return alert("Access Denied.");
    }

    if (window.location.hash !== '#' + tabName) {
        history.pushState({ tab: tabName, arg: filterArg }, '', '#' + tabName);
    }

    var workspace = document.getElementById('dynamic-module-workspace');
    var targetTab = document.getElementById('tab-' + tabName);

    var pageRecord = window.sysPagesMap ? window.sysPagesMap.find(p => p.page_id === tabName) : null;
    var filePath = pageRecord ? pageRecord.file_path : null;

    if (!targetTab && filePath) {
        var loadingMsg = document.createElement('div');
        loadingMsg.id = 'lazy-load-msg';
        loadingMsg.className = "text-center py-12 font-black text-indigo-400 dark:text-indigo-500 animate-pulse tracking-widest uppercase text-xl";
        loadingMsg.innerText = "Loading " + (pageRecord.page_title || "Module") + "...";
        if (workspace) workspace.appendChild(loadingMsg);

        try {
            const response = await fetch(filePath);
            if (!response.ok) throw new Error("File not found on server");
            const html = await response.text();

            var tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;

            while (tempDiv.firstChild) {
                if (workspace) workspace.appendChild(tempDiv.firstChild);
            }
            targetTab = document.getElementById('tab-' + tabName);
        } catch (e) {
            console.error("Lazy Load Error:", e);
            if (window.showToast) window.showToast("Failed to load module: " + filePath, "error");
        } finally {
            var msg = document.getElementById('lazy-load-msg');
            if (msg) msg.remove();
        }
    }

    var allTabs = document.querySelectorAll('div[id^="tab-"]');
    allTabs.forEach(t => t.classList.add('hidden'));

    var allNavBtns = document.querySelectorAll('button[id^="nav-tab-"]');
    allNavBtns.forEach(btn => {
        btn.classList.remove('text-indigo-700', 'bg-indigo-50', 'dark:text-white', 'dark:bg-indigo-900/50');
        btn.classList.add('text-slate-500', 'dark:text-slate-400');
    });

    if (targetTab) targetTab.classList.remove('hidden');

    var aBtn = document.getElementById('nav-tab-' + tabName);
    if (aBtn) {
        aBtn.classList.remove('text-slate-500', 'dark:text-slate-400');
        aBtn.classList.add('text-indigo-700', 'bg-indigo-50', 'dark:text-white', 'dark:bg-indigo-900/50');

        // ===============================================
        // NEW: AUTO-EXPAND SIDEBAR ACCORDIONS
        // ===============================================
        
        // 1. Clean slate: Close all menus first to keep sidebar tidy
        document.querySelectorAll('div[id^="sub-menu-"]').forEach(sub => sub.classList.add('hidden'));
        document.querySelectorAll('svg[id^="icon-sub-"]').forEach(icon => icon.classList.remove('rotate-180'));
        
        document.querySelectorAll('.accordion-content').forEach(acc => {
            acc.classList.remove('open');
            acc.style.maxHeight = null;
        });
        document.querySelectorAll('svg[id^="icon-main-"]').forEach(icon => icon.classList.remove('rotate-180'));

        // 2. Snap open the active sub-menu (if applicable)
        var parentSub = aBtn.closest('div[id^="sub-menu-"]');
        if (parentSub) {
            parentSub.classList.remove('hidden');
            var iconSub = document.getElementById(parentSub.id.replace('sub-menu-', 'icon-sub-'));
            if (iconSub) iconSub.classList.add('rotate-180');
        }

        // 3. Snap open the active main menu folder
        var parentMain = aBtn.closest('.accordion-content');
        if (parentMain) {
            parentMain.classList.add('open');
            parentMain.style.maxHeight = "none";
            var iconMain = document.getElementById(parentMain.id.replace('acc-main-', 'icon-main-'));
            if (iconMain) iconMain.classList.add('rotate-180');
        }
    }

    if (window.innerWidth < window.windowWidthBabu && window.isSidebarOpen) {
        window.toggleSidebar();
    }

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

window.logoutAdmin = function (customMsg) {
    if (window._sessionHeartbeatTimer) clearInterval(window._sessionHeartbeatTimer);
    localStorage.removeItem('wowdrops_admin_session_payload');
    window.activeAdminSession = null;

    history.replaceState(null, null, ' ');

    document.getElementById('view-workspace').classList.add('hidden');
    document.getElementById('view-auth').classList.remove('hidden');
    document.getElementById('auth-forgot').classList.add('hidden');
    document.getElementById('auth-login').classList.remove('hidden');
    document.getElementById('admin-id').value = '';
    document.getElementById('admin-pass').value = '';
    var isSuccess = !customMsg;
    window.showNotif(document.getElementById('login-err'), customMsg || "Successfully logged out.", isSuccess);
};

window.handleAdminLogin = async function () {
    var id = document.getElementById('admin-id').value.trim().toLowerCase();
    var pass = document.getElementById('admin-pass').value;
    var errBox = document.getElementById('login-err');
    
    if (!id || !pass) return window.showNotif(errBox, "Please enter your username and password.", false);

    document.getElementById('btn-login').innerText = "Verifying...";
    
    try {
        const inputHash = await window.hashPassword(pass);
        
        // --- NEW: SECURE RPC CALL ---
        const { data: result, error } = await window.supabase1.rpc('authenticate_user_secure', {
            p_username: id,
            p_password_hash: inputHash,
            p_module: 'ADMIN'
        });

        if (error) throw error;

        // --- HANDLE RPC RESPONSES ---
        if (!result.success) {
            document.getElementById('btn-login').innerText = "Sign In";
            
            if (result.error === 'REQUIRES_SETUP') {
                window.openForgotPasswordView();
                document.getElementById('otp-step-1').classList.add('hidden');
                document.getElementById('otp-step-2').classList.remove('hidden');
                document.getElementById('first-time-notice').classList.remove('hidden');
                document.getElementById('reset-email').value = result.mail_id;
                return window.showNotif(document.getElementById('reset-msg'), "Account initialization caught. Setup access via OTP verification.", true);
            }
            if (result.error === 'ACCOUNT_INACTIVE') return window.showNotif(errBox, "Access Denied: Your account is currently INACTIVE.", false);
            if (result.error === 'NO_ROLE_ASSIGNED') return window.showNotif(errBox, "Access Denied: No Admin Portal roles assigned.", false);
            
            return window.showNotif(errBox, "Invalid Username or Password.", false);
        }

        // --- SUCCESS! BUILD ADMIN SESSION ---
        const adminRolesArray = result.module_roles; // Example: ["Super Admin", "Manager"]
        const isSuper = adminRolesArray.includes("Super Admin");

        // Fetch Page Permissions based on roles (Safe to do client-side as it only reads sys_role_permissions)
        const { data: perms } = await window.supabase1
            .from('sys_role_permissions')
            .select('page_id, can_edit')
            .eq('module_name', 'ADMIN')
            .in('role_name', adminRolesArray);

        var allowedTabs = [];
        var readOnlyTabs = [];

        if (isSuper) {
            allowedTabs = ["ALL"];
        } else {
            (perms || []).forEach(p => {
                if (!allowedTabs.includes(p.page_id)) allowedTabs.push(p.page_id);
                if (!p.can_edit && !readOnlyTabs.includes(p.page_id)) readOnlyTabs.push(p.page_id);
                if (p.can_edit) readOnlyTabs = readOnlyTabs.filter(pageId => pageId !== p.page_id);
            });
        }

        window.activeAdminSession = {
            id: result.id,
            username: result.username,
            roles: adminRolesArray,
            mailid: result.mail_id,
            allowedTabs: allowedTabs,
            readOnlyTabs: readOnlyTabs
        };

        document.getElementById('btn-login').innerText = "Sign In";
        localStorage.setItem('wowdrops_admin_session_payload', JSON.stringify(window.activeAdminSession));
        window.assertWorkspaceDeployment();

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

        const { error } = await window.supabase1
            .from('users')
            .update({ otp: otp, otp_expiry: expiry })
            .eq('mail_id', mail);

        if (error) throw error;

        await fetch(window.GAS_WEBHOOK_URL, {
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
        const { data: userData, error } = await window.supabase1
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

        const hashedPass = await window.hashPassword(pass);
        const { error: updateErr } = await window.supabase1
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

window.handleGlobalScroll = function () {
    var scrollArea = document.getElementById('scroll-area');
    if (!scrollArea) return;

    if (scrollArea.scrollTop + scrollArea.clientHeight >= scrollArea.scrollHeight - 100) {
        var activeTab = document.querySelector('div[id^="tab-"]:not(.hidden)');
        if (!activeTab) return;

        if (activeTab.id === 'tab-master-customer' && typeof window.loadMoreCustomers === 'function') {
            if (window.customerDisplayLimit < window.filteredCustomers.length) {
                window.loadMoreCustomers();
            }
        }
    }
};

window.addEventListener('popstate', function (event) {
    if (!window.activeAdminSession) return;
    var hashTab = window.location.hash.replace('#', '');
    if (hashTab) {
        var arg = event.state ? event.state.arg : null;
        var backBtn = document.getElementById('btn-back-dashboard');
        var brand = document.getElementById('header-brand-area');
        if (backBtn) backBtn.classList.add('hidden');
        if (brand) brand.classList.remove('hidden');

        window._executeRouting(hashTab, arg);
    }
});

setTimeout(function () {
    var mainScrollArea = document.getElementById('scroll-area');
    if (mainScrollArea) {
        mainScrollArea.addEventListener('scroll', window.handleGlobalScroll);
    }
}, 1000);

// =====================================
// UI PREFERENCES (THEME & FONT SIZE)
// =====================================
window.currentFontSize = localStorage.getItem('wowdrops_fontsize') || 'normal';

window.initUIPreferences = function() {
    var savedTheme = localStorage.getItem('wowdrops_theme') || 'light';
    if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }

    var savedFontSize = localStorage.getItem('wowdrops_fontsize') || 'normal';
    var htmlRoot = document.documentElement;
    if (savedFontSize === 'large') {
        htmlRoot.style.fontSize = '18px';
    } else if (savedFontSize === 'xlarge') {
        htmlRoot.style.fontSize = '20px';
    } else {
        htmlRoot.style.fontSize = '16px'; 
    }
};

window.cycleThemeMode = function() {
    var htmlRoot = document.documentElement; 
    var isNowDark = htmlRoot.classList.toggle('dark'); 
    
    if (isNowDark) {
        localStorage.setItem('wowdrops_theme', 'dark');
        if(window.showToast) window.showToast("Dark Mode Enabled", "success");
    } else {
        localStorage.setItem('wowdrops_theme', 'light');
        if(window.showToast) window.showToast("Light Mode Enabled", "success");
    }
};

window.cycleFontSize = function() {
    var htmlRoot = document.documentElement;
    var current = localStorage.getItem('wowdrops_fontsize') || 'normal';
    
    if (current === 'normal') {
        localStorage.setItem('wowdrops_fontsize', 'large');
        htmlRoot.style.fontSize = '18px';
        if(window.showToast) window.showToast("Large Text Enabled", "success");
    } else if (current === 'large') {
        localStorage.setItem('wowdrops_fontsize', 'xlarge');
        htmlRoot.style.fontSize = '20px';
        if(window.showToast) window.showToast("Extra Large Text Enabled", "success");
    } else {
        localStorage.setItem('wowdrops_fontsize', 'normal');
        htmlRoot.style.fontSize = '16px';
        if(window.showToast) window.showToast("Normal Text Enabled", "success");
    }
};

window.initAdminAuth = function () {
    window.initUIPreferences(); 

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

window.initAdminAuth();