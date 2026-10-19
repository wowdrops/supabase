window.rbacState = {
    activeModule: 'ADMIN',
    users: [],
    roles: [],
    menus: [],
    pages: [],
    permissions: [],
    selectedRoleForMatrix: null,
    editingUserId: null
};

// ==========================================
// CORE INITIALIZATION & NAVIGATION
// ==========================================
window.rbacLoadCurrentContext = async function() {
    var moduleSelect = document.getElementById('rbac-module-select');
    window.rbacState.activeModule = moduleSelect ? moduleSelect.value : 'ADMIN';
    document.getElementById('rbac-modal-module-label').innerText = window.rbacState.activeModule;
    
    document.getElementById('rbac-loading').classList.remove('hidden');
    
    try {
        const supa = window.supabase1;
        const mod = window.rbacState.activeModule;

        // Fetch all architecture data concurrently
        const [usersRes, rolesRes, menusRes, pagesRes, permsRes] = await Promise.all([
            supa.from('users').select('id, username, mail_id, phone, status, app_roles').order('username'),
            supa.from('sys_roles').select('*').eq('module_name', mod).order('role_name'),
            supa.from('sys_menus').select('*').eq('module_name', mod).order('sort_order'),
            supa.from('sys_pages').select('*').eq('module_name', mod).order('page_title'),
            supa.from('sys_role_permissions').select('*').eq('module_name', mod)
        ]);

        if (usersRes.error) throw usersRes.error;
        if (rolesRes.error) throw rolesRes.error;
        
        window.rbacState.users = usersRes.data || [];
        window.rbacState.roles = rolesRes.data || [];
        window.rbacState.menus = menusRes.data || [];
        window.rbacState.pages = pagesRes.data || [];
        window.rbacState.permissions = permsRes.data || [];

        // Re-render active views
        window.rbacRenderUsers();
        window.rbacRenderRolesList();
        window.rbacRenderMenuTree();
        window.rbacPopulateDropdowns();

        document.getElementById('rbac-loading').classList.add('hidden');
    } catch (err) {
        document.getElementById('rbac-loading').classList.add('hidden');
        alert("Failed to sync architecture: " + err.message);
        console.error(err);
    }
};

window.rbacSwitchTab = function(tabName) {
    var tabs = ['users', 'roles', 'menus'];
    for (var i = 0; i < tabs.length; i++) {
        var t = tabs[i];
        document.getElementById('rbac-view-' + t).classList.add('hidden');
        var btn = document.getElementById('btn-rbac-' + t);
        btn.className = "flex-1 px-4 py-2.5 rounded-xl text-sm font-black text-slate-500 hover:text-slate-800 transition";
    }
    document.getElementById('rbac-view-' + tabName).classList.remove('hidden');
    document.getElementById('btn-rbac-' + tabName).className = "flex-1 px-4 py-2.5 rounded-xl text-sm font-black bg-white text-indigo-700 shadow-sm transition";
};

// Auto-run when tab opens
window.loadSystemAccessMap = function() {
    window.rbacSwitchTab('users');
    window.rbacLoadCurrentContext();
};

// ==========================================
// TAB 1: USER MANAGEMENT
// ==========================================
window.rbacRenderUsers = function(searchTerm = "") {
    var tbody = document.getElementById('rbac-users-tbody');
    var html = "";
    var mod = window.rbacState.activeModule;

    var filteredUsers = window.rbacState.users.filter(u => 
        (u.username || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
        (u.mail_id || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    for (var i = 0; i < filteredUsers.length; i++) {
        var u = filteredUsers[i];
        var appRoles = u.app_roles || {};
        var modRoles = appRoles[mod] || [];
        
        var roleBadges = modRoles.length > 0 
            ? modRoles.map(r => `<span class="bg-indigo-100 text-indigo-800 px-2.5 py-1 rounded-lg text-xs border border-indigo-200">${r}</span>`).join(' ')
            : `<span class="text-xs text-slate-400">No roles for ${mod}</span>`;

        var statusBadge = u.status === 'ACTIVE' 
            ? `<span class="bg-emerald-100 text-emerald-800 px-2 py-1 rounded text-xs border border-emerald-200">ACTIVE</span>`
            : `<span class="bg-red-100 text-red-800 px-2 py-1 rounded text-xs border border-red-200">INACTIVE</span>`;

        html += `<tr class="hover:bg-slate-50 border-b-4 border-slate-50">
            <td class="px-6 py-4 font-black text-slate-800">${u.username}</td>
            <td class="px-6 py-4"><div class="text-xs text-slate-500">${u.mail_id || '-'}</div><div class="text-xs">${u.phone || '-'}</div></td>
            <td class="px-6 py-4 flex flex-wrap gap-1">${roleBadges}</td>
            <td class="px-6 py-4 text-center">${statusBadge}</td>
            <td class="px-6 py-4 text-right">
                <button onclick="window.rbacOpenUserModal('${u.id}')" class="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-1.5 rounded-lg text-xs transition">Edit</button>
            </td>
        </tr>`;
    }
    tbody.innerHTML = html;
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
    document.getElementById('rbac-modal-email').value = u.mail_id || "";
    document.getElementById('rbac-modal-phone').value = u.phone || "";
    document.getElementById('rbac-modal-pass').value = ""; // Always blank for security

    // Render Role Checkboxes dynamically based on sys_roles
    var rolesHtml = "";
    var currentModRoles = (u.app_roles || {})[window.rbacState.activeModule] || [];
    window.rbacState.roles.forEach(r => {
        var checked = currentModRoles.includes(r.role_name) ? "checked" : "";
        rolesHtml += `<label class="flex items-center gap-2 p-1.5 hover:bg-slate-100 rounded cursor-pointer">
            <input type="checkbox" value="${r.role_name}" class="rbac-role-check w-4 h-4 accent-indigo-600" ${checked}>
            <span class="text-xs font-bold text-slate-700">${r.role_name}</span>
        </label>`;
    });
    document.getElementById('rbac-modal-roles-container').innerHTML = rolesHtml || "<p class='text-xs text-slate-400'>No roles created for this module yet.</p>";

    document.getElementById('rbac-user-modal').classList.remove('hidden');
};

window.rbacSaveUser = async function() {
    var supa = window.supabase1;
    var id = window.rbacState.editingUserId;
    var mod = window.rbacState.activeModule;
    var uName = document.getElementById('rbac-modal-username').value.trim();
    var email = document.getElementById('rbac-modal-email').value.trim();
    var phone = document.getElementById('rbac-modal-phone').value.trim();
    var rawPass = document.getElementById('rbac-modal-pass').value.trim();
    
    // Gather selected roles
    var selectedRoles = Array.from(document.querySelectorAll('.rbac-role-check:checked')).map(cb => cb.value);

    if (!uName) return alert("Username is required.");
    if (!id && !rawPass) return alert("Initial password is required for new users.");

    try {
        document.getElementById('rbac-loading').classList.remove('hidden');

        // Fetch existing app_roles if editing, else empty object
        var appRoles = {};
        if (id) {
            var existing = window.rbacState.users.find(x => String(x.id) === String(id));
            appRoles = existing.app_roles || {};
        }
        appRoles[mod] = selectedRoles; // Update JSONB for active module

        var payload = {
            username: uName,
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
            payload.status = 'ACTIVE';
            const { error } = await supa.from('users').insert([payload]);
            if (error) throw error;
        }

        document.getElementById('rbac-user-modal').classList.add('hidden');
        await window.rbacLoadCurrentContext(); // Reload to get fresh IDs and data
        alert("User saved successfully!");

    } catch(err) {
        document.getElementById('rbac-loading').classList.add('hidden');
        alert("Error saving user: " + err.message);
    }
};

// Browser Natively Hash Passwords (fallback duplicate if not loaded yet)
if (!window.hashPassword) {
    window.hashPassword = async function(password) {
        if (!password) return "";
        const msgBuffer = new TextEncoder().encode(String(password).trim());
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    };
}


// ==========================================
// TAB 2: ROLE & PERMISSION MATRIX
// ==========================================
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
        await window.rbacLoadCurrentContext();
    } catch(err) {
        document.getElementById('rbac-loading').classList.add('hidden');
        alert("Failed to create role: " + err.message);
    }
};

window.rbacRenderRolesList = function() {
    var list = document.getElementById('rbac-roles-list');
    var html = "";
    window.rbacState.roles.forEach(r => {
        var isActive = window.rbacState.selectedRoleForMatrix === r.role_name ? "bg-indigo-600 text-white shadow-md" : "bg-white text-slate-700 hover:bg-indigo-50";
        html += `<button onclick="window.rbacSelectRole('${r.role_name}')" class="w-full text-left px-4 py-3 rounded-xl font-black transition ${isActive}">${r.role_name}</button>`;
    });
    list.innerHTML = html;
};

window.rbacSelectRole = function(roleName) {
    window.rbacState.selectedRoleForMatrix = roleName;
    document.getElementById('rbac-active-role-title').innerText = roleName + " Permissions";
    window.rbacRenderRolesList(); // update active state colors
    
    var container = document.getElementById('rbac-matrix-container');
    var modPages = window.rbacState.pages;
    var rolePerms = window.rbacState.permissions.filter(p => p.role_name === roleName);
    
    var html = `<table class="w-full text-left">
        <thead class="bg-slate-50 text-slate-500 font-black uppercase text-[10px] tracking-widest sticky top-0">
            <tr>
                <th class="p-3">Page / Screen</th>
                <th class="p-3 text-center">Has Access</th>
                <th class="p-3 text-center">Can Edit (Read/Write)</th>
            </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 text-sm font-bold text-slate-700">`;

    // Group by Menu for cleaner UI
    var noMenuPages = modPages.filter(p => !p.menu_id);
    html += window._buildMatrixRows("Uncategorized Pages", noMenuPages, rolePerms);

    window.rbacState.menus.forEach(m => {
        var pgs = modPages.filter(p => p.menu_id === m.id);
        if(pgs.length > 0) html += window._buildMatrixRows(m.menu_label, pgs, rolePerms);
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
};

window._buildMatrixRows = function(groupName, pagesArray, rolePerms) {
    var html = `<tr class="bg-slate-100/50"><td colspan="3" class="p-2 pl-4 text-xs font-black text-indigo-400 uppercase tracking-widest">${groupName}</td></tr>`;
    pagesArray.forEach(p => {
        var perm = rolePerms.find(x => x.page_id === p.page_id);
        var hasAccess = perm ? "checked" : "";
        var canEdit = (perm && perm.can_edit) ? "checked" : "";
        
        html += `<tr class="hover:bg-indigo-50/30">
            <td class="p-3 pl-6">${p.page_title} <span class="text-[10px] text-slate-400 font-normal ml-2">(${p.page_id})</span></td>
            <td class="p-3 text-center"><input type="checkbox" class="rbac-access-cb w-4 h-4 accent-indigo-600 cursor-pointer" data-pid="${p.page_id}" ${hasAccess}></td>
            <td class="p-3 text-center"><input type="checkbox" class="rbac-edit-cb w-4 h-4 accent-emerald-600 cursor-pointer" data-pid="${p.page_id}" ${canEdit}></td>
        </tr>`;
    });
    return html;
};

window.rbacSavePermissions = async function() {
    var rName = window.rbacState.selectedRoleForMatrix;
    var mod = window.rbacState.activeModule;
    if (!rName) return alert("Please select a role first.");

    document.getElementById('rbac-loading').classList.remove('hidden');
    
    // Gather all checked rows
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
        // 1. Wipe existing permissions for this role + module
        const { error: delErr } = await supa.from('sys_role_permissions')
            .delete()
            .eq('role_name', rName)
            .eq('module_name', mod);
        if (delErr) throw delErr;

        // 2. Insert new ones
        if (payload.length > 0) {
            const { error: insErr } = await supa.from('sys_role_permissions').insert(payload);
            if (insErr) throw insErr;
        }

        await window.rbacLoadCurrentContext();
        window.rbacSelectRole(rName); // Re-render matrix
        alert("Permissions saved successfully!");
    } catch(err) {
        document.getElementById('rbac-loading').classList.add('hidden');
        alert("Save failed: " + err.message);
    }
};

// ==========================================
// TAB 3: MENU & PAGE BUILDER
// ==========================================
window.rbacRenderMenuTree = function() {
    var container = document.getElementById('rbac-tree-container');
    var html = "";
    var menus = window.rbacState.menus;
    var pages = window.rbacState.pages;

    var mainMenus = menus.filter(m => !m.parent_menu_id);
    
    mainMenus.forEach(m => {
        html += `<div class="bg-white border-2 border-slate-200 rounded-xl p-4 shadow-sm mb-3">`;
        html += `<div class="font-black text-slate-800 text-lg flex items-center gap-2"><svg class="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg> ${m.menu_label}</div>`;
        
        // Find submenus
        var subMenus = menus.filter(sub => String(sub.parent_menu_id) === String(m.id));
        if(subMenus.length > 0) {
            html += `<div class="pl-6 mt-2 space-y-2 border-l-2 border-indigo-100 ml-2">`;
            subMenus.forEach(sub => {
                html += `<div class="font-bold text-slate-600 text-sm flex items-center gap-2"><svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg> ${sub.menu_label}</div>`;
                html += window._buildPageListForMenu(sub.id, pages);
            });
            html += `</div>`;
        }
        
        // Find direct pages
        html += window._buildPageListForMenu(m.id, pages, "pl-6 mt-2 ml-2");
        html += `</div>`;
    });

    var orphanPages = pages.filter(p => !p.menu_id);
    if(orphanPages.length > 0) {
        html += `<div class="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 shadow-sm mb-3">`;
        html += `<div class="font-black text-amber-800 text-lg">Hidden / Uncategorized Pages</div>`;
        html += window._buildPageListForMenu(null, orphanPages, "pl-2 mt-2", true);
        html += `</div>`;
    }

    container.innerHTML = html;
};

window._buildPageListForMenu = function(menuId, pagesArray, extraClasses = "pl-6 mt-1 ml-2 border-l-2 border-slate-100", isOrphan = false) {
    var pgs = isOrphan ? pagesArray : pagesArray.filter(p => String(p.menu_id) === String(menuId));
    if (pgs.length === 0) return "";
    var h = `<ul class="${extraClasses} space-y-1">`;
    pgs.forEach(p => {
        var vis = p.show_in_sidebar ? "" : `<span class="bg-slate-200 text-slate-500 text-[9px] px-1.5 rounded ml-2 uppercase tracking-widest">Hidden</span>`;
        h += `<li class="text-xs font-bold text-slate-500 flex items-center gap-2 before:content-['-'] before:text-slate-300">
            ${p.page_title} <span class="font-normal text-slate-400">(${p.page_id})</span> ${vis}
        </li>`;
    });
    h += `</ul>`;
    return h;
};

window.rbacPopulateDropdowns = function() {
    var menus = window.rbacState.menus;
    
    // Parent Menu Dropdown (Only show main menus)
    var parentSelect = document.getElementById('rbac-new-menu-parent');
    var phtml = `<option value="">-- Main Folder (Top Level) --</option>`;
    menus.filter(m => !m.parent_menu_id).forEach(m => {
        phtml += `<option value="${m.id}">${m.menu_label}</option>`;
    });
    if(parentSelect) parentSelect.innerHTML = phtml;

    // Page Assignment Menu Dropdown (Show all, indented)
    var pageSelect = document.getElementById('rbac-new-page-menu');
    var mhtml = `<option value="">-- Do Not Assign (Hidden) --</option>`;
    menus.filter(m => !m.parent_menu_id).forEach(m => {
        mhtml += `<option value="${m.id}" class="font-bold">${m.menu_label}</option>`;
        menus.filter(sub => String(sub.parent_menu_id) === String(m.id)).forEach(sub => {
            mhtml += `<option value="${sub.id}">&nbsp;&nbsp;&nbsp;↳ ${sub.menu_label}</option>`;
        });
    });
    if(pageSelect) pageSelect.innerHTML = mhtml;
};

window.rbacCreateMenu = async function() {
    var label = document.getElementById('rbac-new-menu-label').value.trim();
    var parent = document.getElementById('rbac-new-menu-parent').value || null;
    var mod = window.rbacState.activeModule;

    if (!label) return alert("Menu label is required.");

    document.getElementById('rbac-loading').classList.remove('hidden');
    try {
        const { error } = await window.supabase1.from('sys_menus').insert([{
            module_name: mod,
            menu_label: label,
            parent_menu_id: parent
        }]);
        if (error) throw error;
        
        document.getElementById('rbac-new-menu-label').value = "";
        await window.rbacLoadCurrentContext();
    } catch(err) {
        document.getElementById('rbac-loading').classList.add('hidden');
        alert("Failed to create menu: " + err.message);
    }
};

window.rbacCreatePage = async function() {
    var pId = document.getElementById('rbac-new-page-id').value.trim().toLowerCase();
    var title = document.getElementById('rbac-new-page-title').value.trim();
    var menuId = document.getElementById('rbac-new-page-menu').value || null;
    var vis = document.getElementById('rbac-new-page-visible').checked;
    var mod = window.rbacState.activeModule;

    if (!pId || !title) return alert("Page ID and Title are required.");

    document.getElementById('rbac-loading').classList.remove('hidden');
    try {
        const { error } = await window.supabase1.from('sys_pages').insert([{
            page_id: pId,
            module_name: mod,
            page_title: title,
            menu_id: menuId,
            show_in_sidebar: vis
        }]);
        if (error) throw error;
        
        document.getElementById('rbac-new-page-id').value = "";
        document.getElementById('rbac-new-page-title').value = "";
        await window.rbacLoadCurrentContext();
    } catch(err) {
        document.getElementById('rbac-loading').classList.add('hidden');
        alert("Failed to register page: " + err.message);
    }
};

window.tabActions['user-access'] = window.loadSystemAccessMap;