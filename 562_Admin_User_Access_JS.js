window.rbacState = {
    activeModule: 'ADMIN',
    users: [],
    roles: [],
    menus: [],
    pages: [],
    permissions: [],
    selectedRoleForMatrix: null,
    editingUserId: null,
    iconPickerTarget: 'menu'
};

window.RBAC_ICON_LIBRARY = [
    {
        category: "Navigation & Layout",
        icons: [
            { name: "Dashboard Grid", path: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path>` },
            { name: "Database / Master", path: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"></path>` },
            { name: "Folder", path: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path>` },
            { name: "Layers / Stack", path: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>` },
            { name: "Home", path: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path>` },
            { name: "Lightning / Quick", path: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>` },
            { name: "Globe / Portal", path: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"></path>` },
            { name: "Bookmark", path: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"></path>` }
        ]
    },
    {
        category: "Operations, Inventory & Delivery",
        icons: [
            { name: "Transactions Arrows", path: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path>` },
            { name: "3D Box / Inventory", path: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>` },
            { name: "Delivery Truck", path: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"></path>` },
            { name: "Clipboard Check / QC", path: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path>` },
            { name: "Shopping Cart / Order", path: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path>` },
            { name: "Map Pin / Route", path: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>` },
            { name: "Refresh / Sync", path: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>` },
            { name: "Check Circle / Handshake", path: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>` }
        ]
    },
    {
        category: "Finance, Sales & Billing",
        icons: [
            { name: "Currency Circle", path: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>` },
            { name: "Credit Card / PhonePe", path: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path>` },
            { name: "Cash / Banknotes", path: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path>` },
            { name: "Receipt / Invoice", path: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"></path>` },
            { name: "Calculator / Ledger", path: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>` },
            { name: "Trending Up / Sales", path: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>` },
            { name: "Scale / Balance", path: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"></path>` },
            { name: "Tag / Pricing", path: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path>` }
        ]
    },
    {
        category: "Customers, CRM & Support",
        icons: [
            { name: "User Group / CRM", path: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>` },
            { name: "Users / Customers", path: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path>` },
            { name: "Phone Call", path: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path>` },
            { name: "Warning / Escalation", path: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>` },
            { name: "Chat / Feedback", path: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path>` },
            { name: "Clock / Dormant", path: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>` }
        ]
    },
    {
        category: "Reports, MIS & Utilities",
        icons: [
            { name: "Bar Chart / Reports", path: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>` },
            { name: "Pie Chart / Analytics", path: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"></path>` },
            { name: "Calendar / Weekly", path: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>` },
            { name: "Document Report", path: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>` },
            { name: "Cog / Utilities", path: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>` },
            { name: "Sliders / Sys Config", path: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path>` },
            { name: "Bell / Notifications", path: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>` },
            { name: "Shield / Security", path: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>` },
            { name: "Key / Access", path: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4v-3.25l7.75-7.75A6 6 0 0115 7z"></path>` }
        ]
    }
];

window.rbacLoadCurrentContext = async function() {
    var moduleSelect = document.getElementById('rbac-module-select');
    window.rbacState.activeModule = moduleSelect ? moduleSelect.value : 'ADMIN';
    var modLabel = document.getElementById('rbac-modal-module-label');
    if (modLabel) modLabel.innerText = window.rbacState.activeModule;
    
    document.getElementById('rbac-loading').classList.remove('hidden');
    
    try {
        const supa = window.supabase1;
        const mod = window.rbacState.activeModule;

        const [usersRes, rolesRes, menusRes, pagesRes, permsRes] = await Promise.all([
            supa.from('users').select('id, username, mail_id, phone, status, app_roles').order('username'),
            supa.from('sys_roles').select('*').eq('module_name', mod).order('role_name'),
            supa.from('sys_menus').select('*').eq('module_name', mod),
            supa.from('sys_pages').select('*').eq('module_name', mod),
            supa.from('sys_role_permissions').select('*').eq('module_name', mod)
        ]);

        if (usersRes.error) throw usersRes.error;
        if (rolesRes.error) throw rolesRes.error;
        
        window.rbacState.users = usersRes.data || [];
        window.rbacState.roles = rolesRes.data || [];
        window.rbacState.menus = (menusRes.data || []).sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999) || a.id - b.id);
        window.rbacState.pages = (pagesRes.data || []).sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999) || (a.page_title || '').localeCompare(b.page_title || ''));
        window.rbacState.permissions = permsRes.data || [];

        window.rbacRenderUsers();
        window.rbacRenderRolesList();
        window.rbacRenderMenuTree();
        window.rbacPopulateDropdowns();

        document.getElementById('rbac-loading').classList.add('hidden');
    } catch (err) {
        document.getElementById('rbac-loading').classList.add('hidden');
        if(window.showToast) window.showToast("Failed to sync architecture: " + err.message, "error");
        console.error(err);
    }
};

window.rbacSwitchTab = function(tabName) {
    var tabs = ['users', 'roles', 'menus'];
    for (var i = 0; i < tabs.length; i++) {
        var t = tabs[i];
        document.getElementById('rbac-view-' + t).classList.add('hidden');
        var btn = document.getElementById('btn-rbac-' + t);
        btn.className = "flex-1 px-4 py-2.5 rounded-xl text-sm font-black text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors";
    }
    document.getElementById('rbac-view-' + tabName).classList.remove('hidden');
    document.getElementById('btn-rbac-' + tabName).className = "flex-1 px-4 py-2.5 rounded-xl text-sm font-black bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-sm transition-colors";
};

window.loadSystemAccessMap = function() {
    window.rbacSwitchTab('users');
    window.rbacLoadCurrentContext();
};

window.rbacRenderUsers = function(searchTerm = "") {
    var tbody = document.getElementById('rbac-users-tbody');
    if (!tbody) return;
    var html = "";
    var mod = window.rbacState.activeModule;

    var filteredUsers = window.rbacState.users.filter(u => 
        (u.username || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
        (u.mail_id || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    if(filteredUsers.length === 0) {
        tbody.innerHTML = "<tr><td colspan='5' class='px-6 py-12 text-center text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest transition-colors'>No users found.</td></tr>";
        return;
    }

    for (var i = 0; i < filteredUsers.length; i++) {
        var u = filteredUsers[i];
        var appRoles = u.app_roles || {};
        var modRoles = appRoles[mod] || [];
        
        var roleBadges = modRoles.length > 0 
            ? modRoles.map(r => `<span class="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-400 px-2.5 py-1 rounded-lg text-xs border border-indigo-200 dark:border-indigo-800 transition-colors">${r}</span>`).join(' ')
            : `<span class="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-bold transition-colors">No roles for ${mod}</span>`;

        var currentStatus = String(u.status || 'ACTIVE').toUpperCase();
        var statusBadge = currentStatus === 'ACTIVE' 
            ? `<button onclick="window.rbacToggleUserStatus('${u.id}', 'ACTIVE')" title="Click to mark INACTIVE" class="bg-emerald-100 dark:bg-emerald-900/30 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 text-emerald-800 dark:text-emerald-400 px-3 py-1 rounded-lg text-[10px] font-black tracking-widest border border-emerald-300 dark:border-emerald-800 transition-colors shadow-sm outline-none">● ACTIVE</button>`
            : `<button onclick="window.rbacToggleUserStatus('${u.id}', 'INACTIVE')" title="Click to mark ACTIVE" class="bg-rose-100 dark:bg-rose-900/30 hover:bg-rose-200 dark:hover:bg-rose-900/50 text-rose-800 dark:text-rose-400 px-3 py-1 rounded-lg text-[10px] font-black tracking-widest border border-rose-300 dark:border-rose-800 transition-colors shadow-sm outline-none">○ INACTIVE</button>`;

        html += `<tr class="hover:bg-slate-50 dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700/50 transition-colors">
            <td class="px-6 py-4 font-black text-slate-800 dark:text-white transition-colors">${u.username}</td>
            <td class="px-6 py-4"><div class="text-xs font-bold text-slate-500 dark:text-slate-400 transition-colors">${u.mail_id || '-'}</div><div class="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-0.5 transition-colors">${u.phone || '-'}</div></td>
            <td class="px-6 py-4"><div class="flex flex-wrap gap-1.5 transition-colors">${roleBadges}</div></td>
            <td class="px-6 py-4 text-center transition-colors">${statusBadge}</td>
            <td class="px-6 py-4 text-right transition-colors">
                <button onclick="window.rbacOpenUserModal('${u.id}')" class="bg-slate-100 dark:bg-slate-900/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-slate-600 dark:text-slate-400 hover:text-indigo-700 dark:hover:text-indigo-400 border border-slate-200 dark:border-slate-700 px-4 py-1.5 rounded-lg text-xs font-black tracking-widest uppercase transition-colors outline-none shadow-sm">Edit</button>
            </td>
        </tr>`;
    }
    tbody.innerHTML = html;
};

window.rbacToggleUserStatus = async function(userId, currentStatus) {
    var u = window.rbacState.users.find(x => String(x.id) === String(userId));
    if (!u) return;

    var nextStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    if (window.activeAdminSession && u.username === window.activeAdminSession.username && nextStatus === 'INACTIVE') {
        if(window.showToast) return window.showToast("Safety Block: You cannot deactivate your own account.", "warning");
        return;
    }

    if (!confirm(`Switch user "${u.username}" from ${currentStatus} to ${nextStatus}?`)) return;

    try {
        document.getElementById('rbac-loading').classList.remove('hidden');
        const { error } = await window.supabase1
            .from('users')
            .update({ status: nextStatus })
            .eq('id', userId);
        if (error) throw error;

        if(window.showToast) window.showToast(`User ${u.username} is now ${nextStatus}.`, "success");
        await window.rbacLoadCurrentContext();
    } catch (err) {
        document.getElementById('rbac-loading').classList.add('hidden');
        if(window.showToast) window.showToast("Failed to update user status: " + err.message, "error");
    }
};

window.rbacFilterUsers = function() {
    var term = document.getElementById('rbac-user-search').value;
    window.rbacRenderUsers(term);
};

window.rbacOpenUserModal = function(userId) {
    window.rbacState.editingUserId = userId;
    var u = window.rbacState.users.find(x => String(x.id) === String(userId)) || {};
    
    document.getElementById('rbac-modal-title').innerText = userId ? "Edit User" : "Create User";
    document.getElementById('rbac-modal-username').value = u.username || "";
    document.getElementById('rbac-modal-status').value = String(u.status || "ACTIVE").toUpperCase();
    document.getElementById('rbac-modal-email').value = u.mail_id || "";
    document.getElementById('rbac-modal-phone').value = u.phone || "";
    document.getElementById('rbac-modal-pass').value = "";

    var passSection = document.getElementById('rbac-modal-pass-section');
    if(!userId) {
       passSection.innerHTML = '<label class="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest transition-colors">Initial Password *</label><input type="text" id="rbac-modal-pass" placeholder="Enter temporary password" class="w-full mt-1 p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-inner rounded-lg font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-400 dark:focus:border-indigo-500 transition-colors">';
    } else {
       passSection.innerHTML = '<label class="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest transition-colors">Password (Leave blank to keep unchanged)</label><input type="text" id="rbac-modal-pass" placeholder="Enter new password to override" class="w-full mt-1 p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-inner rounded-lg font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-400 dark:focus:border-indigo-500 transition-colors">';
    }

    var rolesHtml = "";
    var currentModRoles = (u.app_roles || {})[window.rbacState.activeModule] || [];
    window.rbacState.roles.forEach(r => {
        var checked = currentModRoles.includes(r.role_name) ? "checked" : "";
        rolesHtml += `<label class="flex items-center gap-3 p-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg cursor-pointer transition-colors">
            <input type="checkbox" value="${r.role_name}" class="rbac-role-check w-4 h-4 accent-indigo-600 dark:accent-indigo-500 shadow-sm transition-colors" ${checked}>
            <span class="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide transition-colors">${r.role_name}</span>
        </label>`;
    });
    document.getElementById('rbac-modal-roles-container').innerHTML = rolesHtml || "<p class='text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-bold py-2 transition-colors'>No roles created for this module yet.</p>";

    if(typeof window.toggleScrollLock === 'function') window.toggleScrollLock(true);
    document.getElementById('rbac-user-modal').classList.remove('hidden');
};

window.rbacSaveUser = async function() {
    var supa = window.supabase1;
    var id = window.rbacState.editingUserId;
    var mod = window.rbacState.activeModule;
    var uName = document.getElementById('rbac-modal-username').value.trim();
    var uStatus = document.getElementById('rbac-modal-status').value;
    var email = document.getElementById('rbac-modal-email').value.trim();
    var phone = document.getElementById('rbac-modal-phone').value.trim();
    var rawPass = document.getElementById('rbac-modal-pass').value.trim();
    
    var selectedRoles = Array.from(document.querySelectorAll('.rbac-role-check:checked')).map(cb => cb.value);

    if (!uName) {
        if(window.showToast) return window.showToast("Username is required.", "warning");
        return;
    }
    if (!id && !rawPass) {
        if(window.showToast) return window.showToast("Initial password is required for new users.", "warning");
        return;
    }

    if (window.activeAdminSession && uName === window.activeAdminSession.username && uStatus === 'INACTIVE') {
        if(window.showToast) return window.showToast("Safety Block: You cannot mark your own account as INACTIVE.", "error");
        return;
    }

    try {
        document.getElementById('rbac-loading').classList.remove('hidden');

        var appRoles = {};
        if (id) {
            var existing = window.rbacState.users.find(x => String(x.id) === String(id));
            appRoles = (existing && existing.app_roles) ? JSON.parse(JSON.stringify(existing.app_roles)) : {};
        }
        appRoles[mod] = selectedRoles;

        var payload = {
            username: uName,
            status: uStatus,
            mail_id: email,
            phone: phone,
            app_roles: appRoles
        };

        if (rawPass) {
            payload.password_hash = await window.hashPassword(rawPass);
        }

        if (id) {
            const { error } = await supa.from('users').update(payload).eq('id', id);
            if (error) throw error;
        } else {
            const { error } = await supa.from('users').insert([payload]);
            if (error) throw error;
        }

        window.closeModal('rbac-user-modal');
        await window.rbacLoadCurrentContext();
        if(window.showToast) window.showToast("User saved successfully!", "success");
    } catch(err) {
        document.getElementById('rbac-loading').classList.add('hidden');
        if(window.showToast) window.showToast("Error saving user: " + err.message, "error");
    }
};

window.rbacPromptNewRole = async function() {
    var rName = prompt("Enter new Role Name (e.g. Sales Manager):");
    if (!rName || !rName.trim()) return;
    
    try {
        document.getElementById('rbac-loading').classList.remove('hidden');
        const { error } = await window.supabase1.from('sys_roles').insert([{
            role_name: rName.trim(),
            module_name: window.rbacState.activeModule
        }]);
        if (error) throw error;
        if(window.showToast) window.showToast("Role created.", "success");
        await window.rbacLoadCurrentContext();
    } catch(err) {
        document.getElementById('rbac-loading').classList.add('hidden');
        if(window.showToast) window.showToast("Failed to create role: " + err.message, "error");
    }
};

window.rbacRenderRolesList = function() {
    var list = document.getElementById('rbac-roles-list');
    if (!list) return;
    var html = "";
    if(window.rbacState.roles.length === 0) {
        list.innerHTML = "<p class='text-[10px] text-center text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest py-4 transition-colors'>No roles found</p>";
        return;
    }
    
    window.rbacState.roles.forEach(r => {
        var isActive = window.rbacState.selectedRoleForMatrix === r.role_name ? "bg-indigo-600 dark:bg-indigo-700 text-white shadow-md" : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-slate-700/50 border border-slate-200 dark:border-slate-700 shadow-sm";
        html += `<button onclick="window.rbacSelectRole('${r.role_name}')" class="w-full text-left px-4 py-3 rounded-xl font-black transition-colors ${isActive} uppercase tracking-widest text-xs outline-none">${r.role_name}</button>`;
    });
    list.innerHTML = html;
};

window.rbacSelectRole = function(roleName) {
    window.rbacState.selectedRoleForMatrix = roleName;
    document.getElementById('rbac-active-role-title').innerText = roleName + " Permissions";
    window.rbacRenderRolesList();
    
    var container = document.getElementById('rbac-matrix-container');
    var modPages = window.rbacState.pages;
    var rolePerms = window.rbacState.permissions.filter(p => p.role_name === roleName);
    
    var html = `<table class="w-full text-left border-collapse transition-colors">
        <thead class="bg-slate-100 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 font-black uppercase text-[10px] tracking-widest sticky top-0 z-10 shadow-sm transition-colors">
            <tr>
                <th class="p-3 pl-6 border-b border-slate-200 dark:border-slate-700">Page / Screen</th>
                <th class="p-3 text-center border-b border-slate-200 dark:border-slate-700">Has Access</th>
                <th class="p-3 text-center border-b border-slate-200 dark:border-slate-700">Can Edit (Read/Write)</th>
            </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50 text-sm font-bold text-slate-700 dark:text-slate-300 transition-colors">`;

    var noMenuPages = modPages.filter(p => !p.menu_id);
    if (noMenuPages.length > 0) {
        html += window._buildMatrixRows("Uncategorized / Hidden Pages", noMenuPages, rolePerms);
    }

    window.rbacState.menus.forEach(m => {
        var pgs = modPages.filter(p => String(p.menu_id) === String(m.id));
        if (pgs.length > 0) html += window._buildMatrixRows(m.menu_label, pgs, rolePerms);
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
};

window._buildMatrixRows = function(groupName, pagesArray, rolePerms) {
    var html = `<tr class="bg-slate-50/80 dark:bg-slate-900/50 transition-colors"><td colspan="3" class="p-2.5 pl-4 text-[10px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest border-t border-b border-slate-200 dark:border-slate-700 shadow-inner transition-colors">${groupName}</td></tr>`;
    pagesArray.forEach(p => {
        var perm = rolePerms.find(x => x.page_id === p.page_id);
        var hasAccess = perm ? "checked" : "";
        var canEdit = (perm && perm.can_edit) ? "checked" : "";
        
        html += `<tr class="hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 transition-colors">
            <td class="p-3 pl-6 transition-colors">
               <span class="font-black">${p.page_title}</span>
               <span class="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-bold ml-2 transition-colors">(${p.page_id})</span>
            </td>
            <td class="p-3 text-center transition-colors"><input type="checkbox" class="rbac-access-cb w-4 h-4 accent-indigo-600 dark:accent-indigo-500 cursor-pointer shadow-sm transition-colors" data-pid="${p.page_id}" ${hasAccess}></td>
            <td class="p-3 text-center transition-colors"><input type="checkbox" class="rbac-edit-cb w-4 h-4 accent-emerald-600 dark:accent-emerald-500 cursor-pointer shadow-sm transition-colors" data-pid="${p.page_id}" ${canEdit}></td>
        </tr>`;
    });
    return html;
};

window.rbacSavePermissions = async function() {
    var rName = window.rbacState.selectedRoleForMatrix;
    var mod = window.rbacState.activeModule;
    if (!rName) {
        if(window.showToast) window.showToast("Please select a role first.", "warning");
        return;
    }

    document.getElementById('rbac-loading').classList.remove('hidden');
    
    var payload = [];
    var rows = document.querySelectorAll('.rbac-access-cb:checked');
    rows.forEach(cb => {
        var pId = cb.getAttribute('data-pid');
        var editCb = document.querySelector(`.rbac-edit-cb[data-pid="${pId}"]`);
        payload.push({
            module_name: mod,
            role_name: rName,
            page_id: pId,
            can_edit: editCb ? editCb.checked : false
        });
    });

    try {
        var supa = window.supabase1;
        const { error: delErr } = await supa.from('sys_role_permissions')
            .delete()
            .eq('role_name', rName)
            .eq('module_name', mod);
        if (delErr) throw delErr;

        if (payload.length > 0) {
            const { error: insErr } = await supa.from('sys_role_permissions').insert(payload);
            if (insErr) throw insErr;
        }

        await window.rbacLoadCurrentContext();
        window.rbacSelectRole(rName);
        if (typeof window.applyRolePermissions === 'function') await window.applyRolePermissions();
        if(window.showToast) window.showToast("Permissions saved successfully!", "success");
    } catch(err) {
        document.getElementById('rbac-loading').classList.add('hidden');
        if(window.showToast) window.showToast("Save failed: " + err.message, "error");
    }
};

window.rbacRenderMenuTree = function() {
    var container = document.getElementById('rbac-tree-container');
    if (!container) return;
    var html = "";
    var menus = window.rbacState.menus || [];
    var pages = window.rbacState.pages || [];

    var mainMenus = menus.filter(m => !m.parent_menu_id);
    if (mainMenus.length === 0 && pages.length === 0) {
        container.innerHTML = `<p class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center py-6 transition-colors">No menus or pages registered for ${window.rbacState.activeModule} yet.</p>`;
        return;
    }

    mainMenus.forEach(m => {
        var defaultMainIcon = `<svg class="w-5 h-5 text-indigo-400 dark:text-indigo-500 shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg>`;
        html += `<div class="bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm mb-4 transition-colors">`;
        
        html += `<div class="flex items-center justify-between gap-2 transition-colors">
            <div class="font-black text-slate-800 dark:text-white text-base flex items-center gap-3 transition-colors">
                <span class="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center shrink-0 shadow-inner transition-colors">${m.icon_svg || defaultMainIcon}</span>
                <span class="uppercase tracking-widest text-sm transition-colors">${m.menu_label}</span>
                <span class="bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-[9px] font-black px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 uppercase transition-colors">Order: ${m.sort_order ?? 0}</span>
            </div>
            <div class="flex items-center gap-1.5 transition-colors">
                <button onclick="window.rbacEditMenu('${m.id}')" title="Edit Menu" class="p-1.5 text-xs bg-slate-100 dark:bg-slate-900 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-slate-600 dark:text-slate-400 hover:text-indigo-700 dark:hover:text-indigo-300 rounded-lg transition-colors outline-none">✏️</button>
                <button onclick="window.rbacDeleteMenu('${m.id}')" title="Delete Empty Menu" class="p-1.5 text-xs bg-slate-100 dark:bg-slate-900 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-slate-600 dark:text-slate-400 hover:text-rose-700 dark:hover:text-rose-300 rounded-lg transition-colors outline-none">🗑️</button>
            </div>
        </div>`;
        
        html += window._buildPageListForMenu(m.id, pages, "pl-4 mt-3 ml-4 border-l-2 border-slate-200 dark:border-slate-700");

        var subMenus = menus.filter(sub => String(sub.parent_menu_id) === String(m.id));
        if (subMenus.length > 0) {
            html += `<div class="pl-6 mt-4 space-y-3 border-l-2 border-indigo-100 dark:border-indigo-900/30 ml-4 transition-colors">`;
            subMenus.forEach(sub => {
                var defaultSubIcon = `<svg class="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-500 shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>`;
                html += `<div class="flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-900/50 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-colors">
                    <div class="font-bold text-slate-700 dark:text-slate-300 text-xs flex items-center gap-2 transition-colors">
                        <span class="w-6 h-6 rounded-md bg-slate-900 flex items-center justify-center shrink-0 shadow-inner transition-colors">${sub.icon_svg || defaultSubIcon}</span>
                        <span class="uppercase tracking-widest text-[11px] font-black transition-colors">${sub.menu_label}</span>
                        <span class="bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 text-[9px] font-black px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 uppercase transition-colors">Order: ${sub.sort_order ?? 0}</span>
                    </div>
                    <div class="flex items-center gap-1.5 transition-colors">
                        <button onclick="window.rbacEditMenu('${sub.id}')" title="Edit Sub-Menu" class="p-1 text-[11px] hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded transition-colors outline-none">✏️</button>
                        <button onclick="window.rbacDeleteMenu('${sub.id}')" title="Delete Empty Sub-Menu" class="p-1 text-[11px] hover:bg-rose-100 dark:hover:bg-rose-900/50 rounded transition-colors outline-none">🗑️</button>
                    </div>
                </div>`;
                html += window._buildPageListForMenu(sub.id, pages, "pl-5 mt-2 ml-3 border-l-2 border-slate-200 dark:border-slate-700");
            });
            html += `</div>`;
        }
        
        html += `</div>`;
    });

    var orphanPages = pages.filter(p => !p.menu_id);
    if (orphanPages.length > 0) {
        html += `<div class="bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-800 rounded-2xl p-4 shadow-sm mb-3 transition-colors">`;
        html += `<div class="font-black text-amber-800 dark:text-amber-400 text-xs uppercase tracking-widest mb-3 transition-colors">Hidden / Unassigned Pages</div>`;
        html += window._buildPageListForMenu(null, orphanPages, "pl-2 mt-1", true);
        html += `</div>`;
    }

    container.innerHTML = html;
};

window._buildPageListForMenu = function(menuId, pagesArray, extraClasses = "pl-6 mt-1 ml-2 border-l-2 border-slate-100 dark:border-slate-700/50", isOrphan = false) {
    var pgs = isOrphan ? pagesArray : pagesArray.filter(p => String(p.menu_id) === String(menuId));
    if (pgs.length === 0) return "";
    var h = `<ul class="${extraClasses} space-y-2 transition-colors">`;
    pgs.forEach(p => {
        var vis = p.show_in_sidebar ? "" : `<span class="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest border border-amber-200 dark:border-amber-800 transition-colors">Hidden</span>`;
        var iconThumb = p.icon_svg 
            ? `<span class="w-5 h-5 rounded bg-slate-900 flex items-center justify-center shrink-0 shadow-inner transition-colors">${p.icon_svg}</span>` 
            : `<span class="text-slate-300 dark:text-slate-600 font-black transition-colors">•</span>`;
        h += `<li class="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center justify-between gap-2 bg-slate-50/70 dark:bg-slate-900/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors shadow-sm">
            <div class="flex items-center gap-2 truncate transition-colors">
                ${iconThumb}
                <span class="truncate text-slate-800 dark:text-white font-black text-[11px] uppercase tracking-wider transition-colors">${p.page_title}</span>
                <span class="font-bold text-slate-400 dark:text-slate-500 text-[9px] uppercase tracking-widest transition-colors">(${p.page_id})</span>
                <span class="bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 text-[9px] font-black px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 uppercase transition-colors">Order: ${p.sort_order ?? 0}</span>
                ${vis}
            </div>
            <div class="flex items-center gap-1 shrink-0 transition-colors">
                <button onclick="window.rbacEditPage('${p.page_id}')" title="Edit / Reassign Page" class="p-1 text-[11px] hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded transition-colors outline-none">✏️</button>
                <button onclick="window.rbacDeletePage('${p.page_id}')" title="Delete Page" class="p-1 text-[11px] hover:bg-rose-100 dark:hover:bg-rose-900/50 rounded transition-colors outline-none">🗑️</button>
            </div>
        </li>`;
    });
    h += `</ul>`;
    return h;
};

window.rbacPopulateDropdowns = function() {
    var menus = window.rbacState.menus || [];
    var editingMenuId = document.getElementById('rbac-edit-menu-id') ? document.getElementById('rbac-edit-menu-id').value : "";
    
    var parentSelect = document.getElementById('rbac-new-menu-parent');
    var phtml = `<option value="">-- Main Folder (Top Level) --</option>`;
    menus.filter(m => !m.parent_menu_id && String(m.id) !== String(editingMenuId)).forEach(m => {
        phtml += `<option value="${m.id}">${m.menu_label}</option>`;
    });
    if (parentSelect) parentSelect.innerHTML = phtml;

    var pageSelect = document.getElementById('rbac-new-page-menu');
    var mhtml = `<option value="">-- Do Not Assign (Hidden / Standalone) --</option>`;
    menus.filter(m => !m.parent_menu_id).forEach(m => {
        mhtml += `<option value="${m.id}" class="font-black uppercase tracking-widest text-slate-800 dark:text-slate-200">📁 ${m.menu_label}</option>`;
        menus.filter(sub => String(sub.parent_menu_id) === String(m.id)).forEach(sub => {
            mhtml += `<option value="${sub.id}" class="font-bold text-slate-600 dark:text-slate-400">&nbsp;&nbsp;&nbsp;↳ ${sub.menu_label}</option>`;
        });
    });
    if (pageSelect) pageSelect.innerHTML = mhtml;
};

window.rbacEditMenu = function(menuId) {
    var m = window.rbacState.menus.find(x => String(x.id) === String(menuId));
    if (!m) return;

    document.getElementById('rbac-edit-menu-id').value = m.id;
    window.rbacPopulateDropdowns();

    document.getElementById('rbac-new-menu-label').value = m.menu_label || "";
    document.getElementById('rbac-new-menu-sort').value = m.sort_order ?? 10;
    document.getElementById('rbac-new-menu-parent').value = m.parent_menu_id || "";
    document.getElementById('rbac-new-menu-icon').value = m.icon_svg || "";
    window.rbacUpdateIconPreview('menu');

    document.getElementById('rbac-menu-form-title').innerText = "Edit Menu: " + m.menu_label;
    document.getElementById('rbac-btn-save-menu').innerText = "Update Menu";
    document.getElementById('rbac-btn-cancel-menu').classList.remove('hidden');
    document.getElementById('rbac-menu-form-card').classList.add('ring-4', 'ring-amber-300', 'dark:ring-amber-500');
    
    if(typeof window.scrollAdminTo === 'function') window.scrollAdminTo('bottom');
};

window.rbacResetMenuForm = function() {
    document.getElementById('rbac-edit-menu-id').value = "";
    window.rbacPopulateDropdowns();
    document.getElementById('rbac-new-menu-label').value = "";
    document.getElementById('rbac-new-menu-sort').value = "10";
    document.getElementById('rbac-new-menu-parent').value = "";
    document.getElementById('rbac-new-menu-icon').value = "";
    window.rbacUpdateIconPreview('menu');

    document.getElementById('rbac-menu-form-title').innerText = "Add Sidebar Menu";
    document.getElementById('rbac-btn-save-menu').innerText = "Create Menu";
    document.getElementById('rbac-btn-cancel-menu').classList.add('hidden');
    document.getElementById('rbac-menu-form-card').classList.remove('ring-4', 'ring-amber-300', 'dark:ring-amber-500');
};

window.rbacSaveMenu = async function() {
    var editId = document.getElementById('rbac-edit-menu-id').value;
    var label = document.getElementById('rbac-new-menu-label').value.trim();
    var sortOrder = parseInt(document.getElementById('rbac-new-menu-sort').value, 10);
    if (isNaN(sortOrder)) sortOrder = 10;
    var parent = document.getElementById('rbac-new-menu-parent').value || null;
    var iconSvg = document.getElementById('rbac-new-menu-icon').value.trim() || null;
    var mod = window.rbacState.activeModule;

    if (!label) {
        if(window.showToast) return window.showToast("Menu label is required.", "warning");
        return;
    }

    var payload = {
        module_name: mod,
        menu_label: label,
        sort_order: sortOrder,
        parent_menu_id: parent ? Number(parent) : null,
        icon_svg: iconSvg
    };

    document.getElementById('rbac-loading').classList.remove('hidden');
    try {
        if (editId) {
            const { error } = await window.supabase1.from('sys_menus').update(payload).eq('id', editId);
            if (error) throw error;
        } else {
            const { error } = await window.supabase1.from('sys_menus').insert([payload]);
            if (error) throw error;
        }
        
        window.rbacResetMenuForm();
        await window.rbacLoadCurrentContext();
        if (typeof window.applyRolePermissions === 'function') await window.applyRolePermissions();
        if(window.showToast) window.showToast("Menu saved successfully.", "success");
    } catch(err) {
        document.getElementById('rbac-loading').classList.add('hidden');
        if(window.showToast) window.showToast("Failed to save menu: " + err.message, "error");
    }
};

window.rbacDeleteMenu = async function(menuId) {
    var m = window.rbacState.menus.find(x => String(x.id) === String(menuId));
    if (!m) return;

    var childMenus = window.rbacState.menus.filter(sub => String(sub.parent_menu_id) === String(menuId));
    if (childMenus.length > 0) {
        if(window.showToast) return window.showToast(`Cannot delete "${m.menu_label}": Contains sub-menus.`, "error");
        return;
    }

    var attachedPages = window.rbacState.pages.filter(p => String(p.menu_id) === String(menuId));
    if (attachedPages.length > 0) {
        if(window.showToast) return window.showToast(`Cannot delete "${m.menu_label}": Has attached pages.`, "error");
        return;
    }

    if (!confirm(`Are you sure you want to permanently delete the empty menu "${m.menu_label}"?`)) return;

    document.getElementById('rbac-loading').classList.remove('hidden');
    try {
        const { error } = await window.supabase1.from('sys_menus').delete().eq('id', menuId);
        if (error) throw error;

        if (String(document.getElementById('rbac-edit-menu-id').value) === String(menuId)) {
            window.rbacResetMenuForm();
        }
        await window.rbacLoadCurrentContext();
        if (typeof window.applyRolePermissions === 'function') await window.applyRolePermissions();
        if(window.showToast) window.showToast("Menu deleted.", "success");
    } catch(err) {
        document.getElementById('rbac-loading').classList.add('hidden');
        if(window.showToast) window.showToast("Failed to delete menu: " + err.message, "error");
    }
};

window.rbacEditPage = function(pageId) {
    var p = window.rbacState.pages.find(x => x.page_id === pageId);
    if (!p) return;

    document.getElementById('rbac-edit-page-mode').value = p.page_id;
    var idInput = document.getElementById('rbac-new-page-id');
    idInput.value = p.page_id;
    idInput.readOnly = true;
    idInput.classList.add('bg-slate-200', 'dark:bg-slate-700', 'text-slate-500', 'cursor-not-allowed', 'border-slate-300', 'dark:border-slate-600', 'shadow-none');

    document.getElementById('rbac-new-page-title').value = p.page_title || "";
    document.getElementById('rbac-new-page-menu').value = p.menu_id || "";
    document.getElementById('rbac-new-page-sort').value = p.sort_order ?? 10;
    document.getElementById('rbac-new-page-icon').value = p.icon_svg || "";
    document.getElementById('rbac-new-page-visible').checked = p.show_in_sidebar !== false;
    document.getElementById('rbac-new-page-filepath').value = p.file_path || "";
    window.rbacUpdateIconPreview('page');

    document.getElementById('rbac-page-form-title').innerText = "Edit Page: " + p.page_title;
    document.getElementById('rbac-btn-save-page').innerText = "Update Page";
    document.getElementById('rbac-btn-cancel-page').classList.remove('hidden');
    document.getElementById('rbac-page-form-card').classList.add('ring-4', 'ring-amber-300', 'dark:ring-amber-500');
    
    if(typeof window.scrollAdminTo === 'function') window.scrollAdminTo('bottom');
};

window.rbacResetPageForm = function() {
    document.getElementById('rbac-edit-page-mode').value = "";
    var idInput = document.getElementById('rbac-new-page-id');
    idInput.value = "";
    idInput.readOnly = false;
    idInput.classList.remove('bg-slate-200', 'dark:bg-slate-700', 'text-slate-500', 'cursor-not-allowed', 'border-slate-300', 'dark:border-slate-600', 'shadow-none');

    document.getElementById('rbac-new-page-title').value = "";
    document.getElementById('rbac-new-page-menu').value = "";
    document.getElementById('rbac-new-page-sort').value = "10";
    document.getElementById('rbac-new-page-icon').value = "";
    document.getElementById('rbac-new-page-visible').checked = true;
    document.getElementById('rbac-new-page-filepath').value = "";
    window.rbacUpdateIconPreview('page');

    document.getElementById('rbac-page-form-title').innerText = "Register App Page";
    document.getElementById('rbac-btn-save-page').innerText = "Register Page";
    document.getElementById('rbac-btn-cancel-page').classList.add('hidden');
    document.getElementById('rbac-page-form-card').classList.remove('ring-4', 'ring-amber-300', 'dark:ring-amber-500');
};

window.rbacSavePage = async function() {
    var editPageId = document.getElementById('rbac-edit-page-mode').value;
    var pId = document.getElementById('rbac-new-page-id').value.trim().toLowerCase();
    var title = document.getElementById('rbac-new-page-title').value.trim();
    var menuId = document.getElementById('rbac-new-page-menu').value || null;
    var sortOrder = parseInt(document.getElementById('rbac-new-page-sort').value, 10);
    if (isNaN(sortOrder)) sortOrder = 10;
    var iconSvg = document.getElementById('rbac-new-page-icon').value.trim() || null;
    var filePath = document.getElementById('rbac-new-page-filepath').value.trim() || null;
    var vis = document.getElementById('rbac-new-page-visible').checked;
    var mod = window.rbacState.activeModule;

    if (!pId || !title || !filePath) {
        if(window.showToast) return window.showToast("Page ID, Title, and File Path are required.", "warning");
        return;
    }

    var payload = {
        page_title: title,
        menu_id: menuId ? Number(menuId) : null,
        sort_order: sortOrder,
        icon_svg: iconSvg,
        file_path: filePath,
        show_in_sidebar: vis
    };

    document.getElementById('rbac-loading').classList.remove('hidden');
    try {
        if (editPageId) {
            const { error } = await window.supabase1
                .from('sys_pages')
                .update(payload)
                .eq('page_id', editPageId)
                .eq('module_name', mod);
            if (error) throw error;
        } else {
            payload.page_id = pId;
            payload.module_name = mod;
            const { error } = await window.supabase1.from('sys_pages').insert([payload]);
            if (error) throw error;
        }
        
        window.rbacResetPageForm();
        await window.rbacLoadCurrentContext();
        if (typeof window.applyRolePermissions === 'function') await window.applyRolePermissions();
        if(window.showToast) window.showToast("Page saved successfully.", "success");
    } catch(err) {
        document.getElementById('rbac-loading').classList.add('hidden');
        if(window.showToast) window.showToast("Failed to save page: " + err.message, "error");
    }
};

window.rbacDeletePage = async function(pageId) {
    var p = window.rbacState.pages.find(x => x.page_id === pageId);
    if (!p) return;
    var mod = window.rbacState.activeModule;

    if (!confirm(`Delete page "${p.page_title}" (${p.page_id})? This will also remove its role permissions.`)) return;

    document.getElementById('rbac-loading').classList.remove('hidden');
    try {
        await window.supabase1.from('sys_role_permissions').delete().eq('page_id', pageId).eq('module_name', mod);
        const { error } = await window.supabase1.from('sys_pages').delete().eq('page_id', pageId).eq('module_name', mod);
        if (error) throw error;

        if (document.getElementById('rbac-edit-page-mode').value === pageId) {
            window.rbacResetPageForm();
        }
        await window.rbacLoadCurrentContext();
        if (typeof window.applyRolePermissions === 'function') await window.applyRolePermissions();
        if(window.showToast) window.showToast("Page deleted.", "success");
    } catch(err) {
        document.getElementById('rbac-loading').classList.add('hidden');
        if(window.showToast) window.showToast("Failed to delete page: " + err.message, "error");
    }
};

window.rbacOpenIconPicker = function(targetType) {
    window.rbacState.iconPickerTarget = targetType;
    var sizeSelect = document.getElementById('rbac-icon-size-select');
    if (sizeSelect) {
        if (targetType === 'page') {
            sizeSelect.value = 'w-4 h-4';
        } else {
            var hasParent = document.getElementById('rbac-new-menu-parent').value !== "";
            sizeSelect.value = hasParent ? 'w-3.5 h-3.5' : 'w-5 h-5';
        }
    }
    window.rbacRenderIconPickerGrid();
    if(typeof window.toggleScrollLock === 'function') window.toggleScrollLock(true);
    document.getElementById('rbac-icon-picker-modal').classList.remove('hidden');
};

window.rbacRenderIconPickerGrid = function() {
    var grid = document.getElementById('rbac-icon-picker-grid');
    if (!grid) return;
    var colorClass = document.getElementById('rbac-icon-color-select').value || 'text-indigo-400';
    var sizeClass = document.getElementById('rbac-icon-size-select').value || 'w-5 h-5';

    var html = "";
    window.RBAC_ICON_LIBRARY.forEach((group, cIdx) => {
        html += `<div class="transition-colors">
            <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-700 pb-2 pl-2 transition-colors">${group.category}</h4>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">`;
        group.icons.forEach((ic, iIdx) => {
            var svgCode = `<svg class="${sizeClass} shrink-0 ${colorClass} transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">${ic.path}</svg>`;
            html += `<button type="button" onclick="window.rbacSelectIconFromModal(${cIdx}, ${iIdx})" class="flex items-center gap-3 p-3 rounded-xl bg-slate-900 hover:bg-slate-700 text-white border border-slate-700 hover:border-indigo-400 transition-colors text-left group shadow-sm outline-none">
                <div class="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform shadow-inner">
                    ${svgCode}
                </div>
                <span class="text-[10px] font-bold text-slate-400 group-hover:text-white uppercase tracking-widest leading-tight transition-colors">${ic.name}</span>
            </button>`;
        });
        html += `</div></div>`;
    });

    grid.innerHTML = html;
};

window.rbacSelectIconFromModal = function(cIdx, iIdx) {
    var group = window.RBAC_ICON_LIBRARY[cIdx];
    if (!group || !group.icons[iIdx]) return;
    var ic = group.icons[iIdx];

    var colorClass = document.getElementById('rbac-icon-color-select').value || 'text-indigo-400';
    var sizeClass = document.getElementById('rbac-icon-size-select').value || 'w-5 h-5';
    var fullSvg = `<svg class="${sizeClass} shrink-0 ${colorClass}" fill="none" stroke="currentColor" viewBox="0 0 24 24">${ic.path}</svg>`;

    var target = window.rbacState.iconPickerTarget;
    var inputId = target === 'page' ? 'rbac-new-page-icon' : 'rbac-new-menu-icon';
    document.getElementById(inputId).value = fullSvg;
    window.rbacUpdateIconPreview(target);

    window.closeModal('rbac-icon-picker-modal');
};

window.rbacUpdateIconPreview = function(targetType) {
    var inputId = targetType === 'page' ? 'rbac-new-page-icon' : 'rbac-new-menu-icon';
    var previewId = targetType === 'page' ? 'rbac-page-icon-preview' : 'rbac-menu-icon-preview';
    var raw = (document.getElementById(inputId).value || "").trim();
    var previewBox = document.getElementById(previewId);
    if (!previewBox) return;

    if (raw && raw.startsWith('<svg') && raw.endsWith('</svg>')) {
        previewBox.innerHTML = raw;
    } else if (!raw) {
        previewBox.innerHTML = `<span class="text-[10px] font-bold text-slate-500 uppercase tracking-widest transition-colors">None</span>`;
    } else {
        previewBox.innerHTML = `<span class="text-[9px] font-bold text-amber-400 uppercase tracking-widest transition-colors">Invalid</span>`;
    }
};

window.rbacClearIconField = function(targetType) {
    var inputId = targetType === 'page' ? 'rbac-new-page-icon' : 'rbac-new-menu-icon';
    document.getElementById(inputId).value = "";
    window.rbacUpdateIconPreview(targetType);
};

window.tabActions['user-access'] = window.loadSystemAccessMap;