// ==========================================
// WOWDROPS DELIVERY - CORE & AUTH (SUPABASE)
// ==========================================

(function () {
    window.onerror = function (msg, url, line) { alert("App Script Error: " + msg + " (Line " + line + ")"); return false; };

    window.APP_CONFIG = {
        AUTO_SYNC: true,
        LBL_VAN_TO_BLOCK: 'Van to Block (Unload)',
        LBL_BLOCK_TO_VAN: 'Block to Van (Load)',
        ROLE_DRIVER: 'DRIVER',
        ROLE_DELIVERY: 'DELIVERY',
        ROLE_BOTH: 'DRIVERDELIVERY',
        ROLE_BOTH_ADMIN: 'DRIVERDELIVERYADMIN',
        VJ_PRICE: 100
    };

    window.currentUser = null;
    window.pendingData = {};
    window.allData = {};
    window.selectedApt = "";
    window.selectedBlock = "";
    window.db = null;

    var driverSVG = '<svg class="w-5 h-5 driver-icon text-emerald-400 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>';

    async function hashDeliveryPassword(password) {
        if (!password) return "";
        const msgBuffer = new TextEncoder().encode(String(password).trim());
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // NEW: RBAC JSON Parser
    function parseAppRoles(appRolesObj) {
        if (!appRolesObj) return "UNDEFINED";
        let roleStr = "";

        let delRoles = appRolesObj.DELIVERY || [];
        //let admRoles = appRolesObj.ADMIN || [];

        let safeDel = delRoles.map(r => String(r).toUpperCase());

        if (safeDel.includes("DRIVER")) roleStr += "DRIVER";
        if (safeDel.includes("DELIVERY")) roleStr += "DELIVERY";
        //if (admRoles.length > 0) roleStr += "ADMIN";

        return roleStr || "UNDEFINED";
    }

    document.addEventListener("DOMContentLoaded", function () {
        var unloads = document.querySelectorAll('.conf-lbl-unload');
        for (var i = 0; i < unloads.length; i++) { unloads[i].innerHTML = driverSVG + window.APP_CONFIG.LBL_VAN_TO_BLOCK; }
        var unloadsS = document.querySelectorAll('.conf-lbl-unload-short');
        for (var is = 0; is < unloadsS.length; is++) { unloadsS[is].innerText = window.APP_CONFIG.LBL_VAN_TO_BLOCK; }

        var loads = document.querySelectorAll('.conf-lbl-load');
        for (var j = 0; j < loads.length; j++) { loads[j].innerHTML = driverSVG + window.APP_CONFIG.LBL_BLOCK_TO_VAN; }
        var loadsS = document.querySelectorAll('.conf-lbl-load-short');
        for (var js = 0; js < loadsS.length; js++) { loadsS[js].innerText = window.APP_CONFIG.LBL_BLOCK_TO_VAN; }
    });

    window.onload = function () {
        if (window.initDB) {
            window.initDB().then(async function () {
                var today = new Date(); var past = new Date(); past.setDate(today.getDate() - 7);
                var startInput = document.getElementById('filter-start-date'); if (startInput) startInput.value = past.toISOString().split('T')[0];
                var endInput = document.getElementById('filter-end-date'); if (endInput) endInput.value = today.toISOString().split('T')[0];

                var savedUser = localStorage.getItem('wd_staff_user');
                if (savedUser) {
                    try { window.currentUser = JSON.parse(savedUser); } catch (e) { window.currentUser = null; }
                    if (window.currentUser) {
                        try {
                            const { data: userData } = await window.supabase1
                                .from('users')
                                .select('status, app_roles')
                                .eq('username', window.currentUser.username)
                                .maybeSingle();

                            if (!userData || String(userData.status).toUpperCase() !== 'ACTIVE') {
                                window.logout();
                                window.showToast("Your account has been deactivated.", false);
                                return;
                            }

                            // Live-update roles based on JSON
                            let updatedRole = parseAppRoles(userData.app_roles);
                            if (updatedRole === "UNDEFINED") {
                                window.logout();
                                window.showToast("Delivery App access revoked.", false);
                                return;
                            }

                            window.currentUser.role = updatedRole;
                            localStorage.setItem('wd_staff_user', JSON.stringify(window.currentUser));

                            var nameDisplay = document.getElementById('driver-name-display');
                            if (nameDisplay) nameDisplay.innerText = window.currentUser.username;
                            var header = document.getElementById('main-header'); if (header) header.classList.remove('hidden');

                            window.setupRoleBasedUI();
                            if (window.loadLocalData) window.loadLocalData();
                            if (window.updateSyncCount) window.updateSyncCount();
                            window.switchView('view-dashboard');
                        } catch (e) {
                            window.setupRoleBasedUI();
                            if (window.loadLocalData) window.loadLocalData();
                            window.switchView('view-dashboard');
                        }
                    }
                }
            });
        }
    };

    window.addEventListener('online', function () { document.body.classList.remove('is-offline'); if (window.APP_CONFIG.AUTO_SYNC && window.currentUser && window.syncData) { window.syncData(); } if (window.updateSyncCount) window.updateSyncCount(); });
    window.addEventListener('offline', function () { document.body.classList.add('is-offline'); var banner = document.getElementById('sync-reminder-banner'); if (banner) banner.classList.add('hidden'); });

    window.showLoader = function (text) {
        var loader = document.getElementById('global-loader');
        var txt = document.getElementById('global-loader-text');
        if (txt) txt.innerText = text || "Processing...";
        if (loader) { loader.classList.remove('hidden'); loader.classList.add('flex'); }
    };

    window.hideLoader = function () {
        var loader = document.getElementById('global-loader');
        if (loader) { loader.classList.add('hidden'); loader.classList.remove('flex'); }
    };

    window.handleLogin = async function () {
        try {
            var userEl = document.getElementById('login-user');
            var passEl = document.getElementById('login-pass');
            if (!userEl || !passEl) { alert("Error: Inputs missing"); return; }

            var id = userEl.value.trim().toLowerCase();
            var pass = passEl.value;
            if (!id || !pass) { window.showToast("Enter credentials.", false); return; }

            window.showLoader('Authenticating...');
            const inputHash = await hashDeliveryPassword(pass);

            // --- NEW: SECURE RPC CALL ---
            const { data: result, error } = await window.supabase1.rpc('authenticate_user_secure', {
                p_username: id,
                p_password_hash: inputHash,
                p_module: 'DELIVERY'
            });

            window.hideLoader();

            if (error) throw error;

            // --- HANDLE RPC RESPONSES ---
            if (!result.success) {
                if (result.error === 'REQUIRES_SETUP') {
                    window.showForgotPassword();
                    document.getElementById('otp-step-1').classList.add('hidden');
                    document.getElementById('otp-step-2').classList.remove('hidden');
                    document.getElementById('fp-user').value = result.mail_id;
                    return window.showToast("Account activation required. Setup access via OTP.", true);
                }
                if (result.error === 'ACCOUNT_INACTIVE') return window.showToast("Account is disabled or terminated.", false);
                if (result.error === 'NO_ROLE_ASSIGNED') return window.showToast("Access Denied: You do not have Delivery App permissions.", false);

                return window.showToast("Invalid Username or Password.", false);
            }

            // --- SUCCESS! BUILD DELIVERY SESSION ---
            // result.app_roles contains the full JSON (e.g. {"ADMIN": [], "DELIVERY": ["DRIVER"]})
            let roleString = parseAppRoles(result.app_roles);

            if (roleString === "UNDEFINED") {
                window.showToast("Access Denied: Role parsing failed.", false);
                return;
            }

            var sessionData = {
                username: result.username,
                role: roleString,
                mailid: result.mail_id
            };

            window.currentUser = sessionData;
            localStorage.setItem('wd_staff_user', JSON.stringify(sessionData));

            document.getElementById('driver-name-display').innerText = sessionData.username;
            document.getElementById('main-header').classList.remove('hidden');
            window.setupRoleBasedUI();
            window.switchView('view-dashboard');

            if (window.fetchOrdersFromServer) window.fetchOrdersFromServer();

        } catch (e) {
            window.hideLoader();
            alert("Login Error: " + e.message);
        }
    };

    window.logout = function () {
        localStorage.removeItem('wd_staff_user'); localStorage.removeItem('wd_pending_data'); localStorage.removeItem('wd_all_data');
        document.getElementById('main-header').classList.add('hidden'); window.switchView('view-login');
    };

    window.factoryResetApp = function () {
        if (confirm("⚠️ WARNING: This will delete any pending offline data, clear your route cache, and log you out. Use this only if the app is stuck.\n\nContinue with Reset?")) {
            localStorage.clear();
            if (window.db) {
                try {
                    var txn = window.db.transaction(["deliveries", "unloads", "loads"], "readwrite");
                    txn.objectStore("deliveries").clear();
                    txn.objectStore("unloads").clear();
                    txn.objectStore("loads").clear();
                    txn.oncomplete = function () { window.location.reload(true); };
                } catch (e) { window.location.reload(true); }
            } else { window.location.reload(true); }
        }
    };

    window.showForgotPassword = function () {
        var currentUserInput = document.getElementById('login-user').value;
        document.getElementById('fp-user').value = currentUserInput;
        document.getElementById('fp-step-1').classList.remove('hidden');
        document.getElementById('fp-step-2').classList.add('hidden');
        document.getElementById('fp-otp').value = '';
        document.getElementById('fp-new-pass').value = '';
        window.switchView('view-forgot-password');
    };

    window.requestOtp = async function () {
        var user = document.getElementById('fp-user').value.trim().toLowerCase();
        if (!user) { window.showToast("Please enter your Username / Email.", false); return; }

        window.showLoader('Sending OTP...');
        try {
            const { data: userData, error: checkErr } = await window.supabase1
                .from('users')
                .select('mail_id')
                .or(`username.eq.${user},mail_id.eq.${user}`)
                .maybeSingle();

            if (checkErr || !userData || !userData.mail_id) {
                window.hideLoader();
                return window.showToast("Email address not found in database.", false);
            }

            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            const expiry = new Date(new Date().getTime() + (10 * 60 * 1000)).toISOString();

            const { error: updateErr } = await window.supabase1
                .from('users')
                .update({ otp: otp, otp_expiry: expiry })
                .eq('mail_id', userData.mail_id);

            if (updateErr) throw updateErr;

            await fetch(GAS_WEBHOOK_URL, {
                method: 'POST',
                body: JSON.stringify({ email: userData.mail_id, otp: otp }),
                headers: { 'Content-Type': 'text/plain;charset=utf-8' }
            });

            window.hideLoader();
            window.showToast("Verification OTP code has been sent.", true);
            document.getElementById('fp-step-1').classList.add('hidden');
            document.getElementById('fp-step-2').classList.remove('hidden');
        } catch (err) {
            window.hideLoader();
            window.showToast("Server Error: " + err.message, false);
        }
    };

    window.verifyOtpAndReset = async function () {
        var user = document.getElementById('fp-user').value.trim().toLowerCase();
        var otp = document.getElementById('fp-otp').value.trim();
        var newPass = document.getElementById('fp-new-pass').value;

        if (!otp || !newPass) { window.showToast("Please enter OTP and New Password.", false); return; }

        window.showLoader('Verifying...');
        try {
            const { data: userData, error } = await window.supabase1
                .from('users')
                .select('mail_id, otp, otp_expiry')
                .or(`username.eq.${user},mail_id.eq.${user}`)
                .maybeSingle();

            if (error || !userData) {
                window.hideLoader();
                return window.showToast("User record not found.", false);
            }

            if (new Date() > new Date(userData.otp_expiry)) {
                window.hideLoader();
                return window.showToast("OTP verification code has expired.", false);
            }

            if (String(userData.otp).trim() !== otp) {
                window.hideLoader();
                return window.showToast("Invalid OTP code entered.", false);
            }

            const hashedPass = await hashDeliveryPassword(newPass);
            const { error: updateErr } = await window.supabase1
                .from('users')
                .update({ password_hash: hashedPass, otp: null, otp_expiry: null })
                .eq('mail_id', userData.mail_id);

            window.hideLoader();
            if (updateErr) throw updateErr;

            window.showToast("Password configured successfully! Please login.", true);
            document.getElementById('login-user').value = user;
            document.getElementById('login-pass').value = '';
            window.switchView('view-login');
        } catch (err) {
            window.hideLoader();
            window.showToast("Server Error: " + err.message, false);
        }
    };

    window.setupRoleBasedUI = function () {
        var r = String(window.currentUser.role || "").toUpperCase();

        // Safety Fallback
        if (r === "UNDEFINED" || r === "NULL" || r === "") {
            r = window.APP_CONFIG.ROLE_BOTH_ADMIN;
        }

        var mDrv = document.getElementById('menu-report-driver'); var mDel = document.getElementById('menu-report-delivery');
        var mBVar = document.getElementById('menu-report-block-var'); var mDVar = document.getElementById('menu-report-door-var');
        var mAud = document.getElementById('menu-report-audit'); var mEod = document.getElementById('menu-report-eod');

        //if (r.includes('DRIVER') || r.includes('ADMIN')) {
        if (r.includes('DRIVER')) {
            if (mDrv) mDrv.classList.remove('hidden'); if (mBVar) mBVar.classList.remove('hidden'); if (mEod) mEod.classList.remove('hidden');
            var sUnload = document.getElementById('section-unload'); if (sUnload) sUnload.classList.remove('hidden');
            var sLoad = document.getElementById('section-load'); if (sLoad) sLoad.classList.remove('hidden');
        }
        //if (r.includes('DELIVERY') || r.includes('ADMIN')) {
        if (r.includes('DELIVERY')) {
            if (mDel) mDel.classList.remove('hidden'); if (mDVar) mDVar.classList.remove('hidden');
            var sDoors = document.getElementById('section-doors'); if (sDoors) sDoors.classList.remove('hidden');
        }
        if (r.includes('DRIVER') && r.includes('DELIVERY')) {
            if (mAud) mAud.classList.remove('hidden');
        }

        if (r === window.APP_CONFIG.ROLE_DRIVER) { document.getElementById('tab-btn-delivery').classList.add('hidden'); window.switchDashTab('driver'); }
        else if (r === window.APP_CONFIG.ROLE_DELIVERY) { document.getElementById('tab-btn-driver').classList.add('hidden'); window.switchDashTab('delivery'); }
        else { window.switchDashTab('driver'); }
    };

    window.switchDashTab = function (tab) {
        document.getElementById('tab-content-driver').classList.add('hidden');
        document.getElementById('tab-content-delivery').classList.add('hidden');
        document.getElementById('tab-content-summary').classList.add('hidden');

        var inactiveClass = "flex-1 py-3.5 text-xs font-black border-b-[3px] border-transparent text-slate-400 flex items-center justify-center gap-1.5 transition hover:text-slate-600 bg-slate-50";
        var activeClass = "flex-1 py-3.5 text-xs font-black border-b-[3px] border-emerald-600 text-emerald-700 flex items-center justify-center gap-1.5 transition bg-white";

        document.getElementById('tab-btn-driver').className = inactiveClass;
        document.getElementById('tab-btn-delivery').className = inactiveClass;
        document.getElementById('tab-btn-summary').className = inactiveClass;

        document.getElementById('tab-content-' + tab).classList.remove('hidden');
        document.getElementById('tab-btn-' + tab).className = activeClass;
    };

    window.switchView = function (viewId) {
        var views = ['view-report-master', 'view-forgot-password', 'view-login', 'view-dashboard', 'view-operations', 'view-processed', 'view-change-password', 'view-report-driver', 'view-report-delivery', 'view-report-block-variance', 'view-report-door-variance', 'view-report-pending-audit', 'view-report-eod', 'view-report-exceptions'];
        for (var i = 0; i < views.length; i++) {
            var v = document.getElementById(views[i]);
            if (v) v.classList.add('hidden');
        }
        var target = document.getElementById(viewId);
        if (target) target.classList.remove('hidden');
        window.scrollTo(0, 0);
    };

    window.showToast = function (msg, isSuccess) {
        var toast = document.getElementById('toast'); toast.innerText = msg;
        toast.className = 'mx-4 mt-4 p-3 rounded-xl text-sm font-bold text-center shadow-md fade-in z-[300] fixed top-2 left-0 right-0 max-w-sm mx-auto ' + (isSuccess ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-red-100 text-red-800 border border-red-200');
        toast.classList.remove('hidden'); setTimeout(function () { toast.classList.add('hidden'); }, 4000);
    };

    window.toggleNavMenu = function (e) { e.stopPropagation(); document.getElementById('dropdown-menu').classList.toggle('hidden'); };
    window.addEventListener('click', function () { var menu = document.getElementById('dropdown-menu'); if (menu) menu.classList.add('hidden'); });

    window.parseImgUrl = function (url) {
        if (!url || String(url).trim() === "") return 'https://via.placeholder.com/100?text=No+Photo';
        if (String(url).startsWith('data:image')) return url;
        var match = String(url).match(/[-\w]{25,}/);
        if (match && match[0]) return 'https://lh3.googleusercontent.com/d/' + match[0];
        return url;
    };

    window.initLightbox = function () {
        if (document.getElementById('del-lightbox')) return;
        var lb = document.createElement('div');
        lb.id = 'del-lightbox';
        lb.className = 'fixed inset-0 z-[300] bg-slate-900/95 hidden flex flex-col items-center justify-center backdrop-blur-sm transition-opacity opacity-0';
        lb.innerHTML = '<div class="absolute top-4 right-4 flex gap-4 z-50"><button onclick="window.resetZoom()" class="bg-white/10 text-white font-bold px-4 py-2 rounded-lg hover:bg-white/20 transition">Reset Zoom</button><button onclick="window.closeLightbox()" class="bg-rose-500 text-white font-black px-4 py-2 rounded-lg hover:bg-rose-600 transition shadow-lg">CLOSE [X]</button></div><div id="lb-img-container" class="relative w-full h-full overflow-hidden cursor-grab flex items-center justify-center touch-none"><img id="lb-img" class="max-w-full max-h-full object-contain transition-transform duration-75 origin-center select-none shadow-2xl"></div><p class="absolute bottom-6 text-slate-400 font-bold text-sm bg-slate-900/50 px-4 py-2 rounded-xl pointer-events-none">Pinch to Zoom &bull; Drag to Pan</p>';
        document.body.appendChild(lb);

        var container = document.getElementById('lb-img-container');
        window.lbScale = 1; window.lbPointX = 0; window.lbPointY = 0;
        var isDragging = false, startX, startY;
        var initialPinchDistance = null, initialScale = 1;

        container.onwheel = function (e) {
            e.preventDefault();
            window.lbScale += (e.deltaY < 0 ? 1 : -1) * 0.1;
            if (window.lbScale < 0.5) window.lbScale = 0.5;
            if (window.lbScale > 5) window.lbScale = 5;
            window.applyZoomPan();
        };

        container.onmousedown = function (e) {
            e.preventDefault(); isDragging = true; container.classList.replace('cursor-grab', 'cursor-grabbing');
            startX = e.clientX - window.lbPointX; startY = e.clientY - window.lbPointY;
        };
        container.onmousemove = function (e) {
            if (!isDragging) return;
            window.lbPointX = e.clientX - startX; window.lbPointY = e.clientY - startY; window.applyZoomPan();
        };
        container.onmouseup = function (e) { isDragging = false; container.classList.replace('cursor-grabbing', 'cursor-grab'); };
        container.onmouseleave = function (e) { isDragging = false; container.classList.replace('cursor-grabbing', 'cursor-grab'); };

        container.ontouchstart = function (e) {
            if (e.touches.length === 1) {
                isDragging = true;
                startX = e.touches[0].clientX - window.lbPointX;
                startY = e.touches[0].clientY - window.lbPointY;
            } else if (e.touches.length === 2) {
                isDragging = false;
                initialPinchDistance = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
                initialScale = window.lbScale;
            }
        };

        container.ontouchmove = function (e) {
            e.preventDefault();
            if (isDragging && e.touches.length === 1) {
                window.lbPointX = e.touches[0].clientX - startX; window.lbPointY = e.touches[0].clientY - startY;
                window.applyZoomPan();
            } else if (e.touches.length === 2 && initialPinchDistance) {
                var currentDistance = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
                var zoomFactor = currentDistance / initialPinchDistance;
                window.lbScale = initialScale * zoomFactor;
                if (window.lbScale < 0.5) window.lbScale = 0.5;
                if (window.lbScale > 5) window.lbScale = 5;
                window.applyZoomPan();
            }
        };

        container.ontouchend = function (e) { isDragging = false; initialPinchDistance = null; };
    };

    window.applyZoomPan = function () {
        var img = document.getElementById('lb-img');
        if (img) img.style.transform = 'translate(' + window.lbPointX + 'px, ' + window.lbPointY + 'px) scale(' + window.lbScale + ')';
    };

    window.resetZoom = function () { window.lbScale = 1; window.lbPointX = 0; window.lbPointY = 0; window.applyZoomPan(); };

    window.openLightbox = function (url) {
        if (!url || url.trim() === "") return window.showToast("No photo available.", false);
        window.initLightbox();
        document.getElementById('lb-img').src = window.parseImgUrl(url);
        window.resetZoom();
        var lb = document.getElementById('del-lightbox');
        lb.classList.remove('hidden');
        setTimeout(function () { lb.classList.remove('opacity-0'); }, 10);
    };

    window.closeLightbox = function () {
        var lb = document.getElementById('del-lightbox');
        lb.classList.add('opacity-0');
        setTimeout(function () { lb.classList.add('hidden'); }, 300);
    };

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
            var lb = document.getElementById('del-lightbox');
            if (lb && !lb.classList.contains('hidden')) window.closeLightbox();
        }
    });

    window.openChangePasswordView = function () {
        document.getElementById('cp-current-pass').value = "";
        document.getElementById('new-driver-pass').value = "";
        window.switchView('view-change-password');
    };

    window.handlePasswordModificationSubmit = async function () {
        const currentPass = document.getElementById('cp-current-pass').value;
        const newPass = document.getElementById('new-driver-pass').value;

        if (!currentPass || newPass.length < 4) return window.showToast("Provide current and new secure password.", false);

        window.showLoader('Updating Password...');
        try {
            const inputHash = await hashDeliveryPassword(currentPass);
            const { data: uData, error: uErr } = await window.supabase1
                .from('users')
                .select('password_hash')
                .eq('username', window.currentUser.username)
                .single();

            if (uErr || uData.password_hash !== inputHash) {
                window.hideLoader();
                return window.showToast("Current password validation failed.", false);
            }

            const newHash = await hashDeliveryPassword(newPass);
            await window.supabase1
                .from('users')
                .update({ password_hash: newHash })
                .eq('username', window.currentUser.username);

            window.hideLoader();
            window.showToast("Password updated successfully.", true);
            window.switchView('view-dashboard');
        } catch (err) {
            window.hideLoader();
            window.showToast("Error updating password.", false);
        }
    };

    // ===============================================
    // SHIFT_LOG AUTO-CLOCK-IN & GATEKEEPER LOGIC
    // ===============================================
    window.fetchOrdersFromServer = async function () {
        if (!navigator.onLine) { window.showToast("Offline mode.", false); return; }
        window.showLoader('Checking Route & Shift...');

        try {
            const supa = window.supabase1;
            const todayStr = new Date().toISOString().split('T')[0];

            // 1. FETCH ROUTE FIRST (The Multi-Trip Trigger)
            const { data: routeData, error: routeErr } = await supa
                .from('deliveries')
                .select('*')
                .order('apartment', { ascending: true })
                .order('block', { ascending: true })
                .order('door', { ascending: true });

            if (routeErr) throw routeErr;

            // If the table is empty, the driver is done for now. Do NOT create a trip.
            if (!routeData || routeData.length === 0) {
                window.hideLoader();
                document.getElementById('main-header').classList.add('hidden');

                // Clear local storage so dashboard resets
                localStorage.removeItem('wd_pending_data');
                localStorage.removeItem('wd_all_data');
                window.pendingData = {}; window.allData = {}; window.serverSummary = null;

                return window.showToast("✅ No active route found. You are off duty.", true);
            }

            // --- FIX: FETCH VJ_PRICE FIRST BEFORE ANY CALCULATIONS ---
            const { data: setupData } = await supa.from('setup').select('value').eq('key', 'VJ_PRICE').maybeSingle();
            const vjPrice = setupData ? (Number(setupData.value) || window.APP_CONFIG.VJ_PRICE) : window.APP_CONFIG.VJ_PRICE;
            window.APP_CONFIG.VJ_PRICE = vjPrice;
            localStorage.setItem('wd_sys_config', JSON.stringify({ vjPrice: vjPrice }));
            // ---------------------------------------------------------

            // 2. WE HAVE A ROUTE! Now handle the EOD Trip & Shift logic.
            if (window.currentUser && window.currentUser.username) {

                // GATEKEEPER: Check for open shifts from PREVIOUS days
                const { data: activeShifts } = await supa
                    .from('shift_log')
                    .select('id, created_at')
                    .eq('mail_id', window.currentUser.username)
                    .eq('status', 'Active')
                    .order('created_at', { ascending: true });

                if (activeShifts && activeShifts.length > 0) {
                    let oldestShiftDate = activeShifts[0].created_at.split('T')[0];
                    if (oldestShiftDate < todayStr) {
                        window.hideLoader();
                        alert("⛔ GATEKEEPER ACTIVE\n\nYou have an open shift from a previous date (" + oldestShiftDate + ").\n\nYou must enter the EOD Handshake PIN to close that shift before you can load a new route.");
                        return;
                    }
                }

                // Locate or Create today's Active Master Trip
                let activeTripId = null;
                const { data: todayTrips } = await supa
                    .from('eod_log')
                    .select('id')
                    .gte('created_at', todayStr + 'T00:00:00')
                    .in('status', ['Active', 'Pending Handover'])
                    .order('created_at', { ascending: true })
                    .limit(1);

                if (todayTrips && todayTrips.length > 0) {
                    activeTripId = todayTrips[0].id;
                } else {
                    // 1. Calculate Dispatch Requirements using the safely fetched vjPrice
                    let routeDispatchVj = 0;
                    let routeDispatchNvj = 0;
                    (routeData || []).forEach(row => {
                        let ordD = Number(row.ord_d || 0);
                        let repQty = Number(row.replace_qty || 0);
                        let totalNeeded = ordD + repQty; // Add replacements to the morning load!

                        let advance = Number(row.can_deposit || row.advance_amount || 0);
                        let maxVj = Math.floor(advance / vjPrice);
                        let expVj = Math.min(maxVj, totalNeeded);

                        routeDispatchVj += expVj;
                        routeDispatchNvj += (totalNeeded - expVj);
                    });

                    let driverEmail = window.currentUser.role.includes('DRIVER') ? window.currentUser.username : 'AUTO_CREATED_FOR_TEAM';

                    // 2. Create the Active Trip in eod_log
                    const { data: newTrip, error: tripErr } = await supa
                        .from('eod_log')
                        .insert([{
                            driver_mail_id: driverEmail,
                            status: 'Active'
                        }])
                        .select('id')
                        .single();
                    if (tripErr) throw tripErr;
                    activeTripId = newTrip.id;

                    // 3. Log the morning load in van_dispatch_log to trigger Inventory Movement!
                    await supa.from('van_dispatch_log').insert([{
                        dispatch_date: todayStr,
                        driver_mail_id: driverEmail,
                        load_full_vj: routeDispatchVj,
                        load_full_nvj: routeDispatchNvj
                    }]);
                }

                // Ensure user is clocked in to THIS specific trip
                const { data: myShift } = await supa
                    .from('shift_log')
                    .select('id')
                    .eq('mail_id', window.currentUser.username)
                    .eq('trip_id', activeTripId)
                    .maybeSingle();

                if (!myShift) {
                    await supa.from('shift_log').insert([{
                        trip_id: activeTripId,
                        mail_id: window.currentUser.username,
                        role: window.currentUser.role,
                        status: 'Active'
                    }]);
                }
            }

            window.showLoader('Processing Route...');

            var pendingOrders = {};
            var allOrders = {};
            var summary = {
                totalBlocks: 0, completedBlocks: 0, pendingBlocks: 0,
                totalDoors: 0, completedDoors: 0, pendingDoors: 0,
                actualDVj: 0, actualDNvj: 0, actualEVj: 0, actualENvj: 0,
                pendingDVj: 0, pendingDNvj: 0, pendingE: 0,
                totalOrdDVj: 0, totalOrdDNvj: 0, totalOrdE: 0
            };

            var uniqueBlocks = {};
            var pendingBlocksSet = {};

            (routeData || []).forEach(row => {
                var apt = String(row.apartment || "").trim();
                var blk = String(row.block || "").trim();
                if (!apt || !blk) return;

                var blockKey = apt + "_" + blk;
                uniqueBlocks[blockKey] = true;

                var v2bLink = String(row.van_to_block_link || "").trim();
                var b2vLink = String(row.block_to_van_link || "").trim();
                var deliveryEnterOn = row.delivery_entered_at;

                var isPending = (!deliveryEnterOn || v2bLink === "" || b2vLink === "");
                if (isPending) pendingBlocksSet[blockKey] = true;

                var doorDone = !!deliveryEnterOn;
                summary.totalDoors++;

                var ordD = Number(row.ord_d || 0);
                var ordE = Number(row.ord_e || 0);
                var advance = Number(row.can_deposit || row.advance_amount || 0);

                var maxVj = Math.floor(advance / vjPrice);
                var expVj = Math.min(maxVj, ordD);
                var expNvj = ordD - expVj;

                summary.totalOrdDVj += expVj;
                summary.totalOrdDNvj += expNvj;
                summary.totalOrdE += ordE;

                var actVj = 0, actNvj = 0, actEVj = 0, actENvj = 0;

                if (doorDone) {
                    summary.completedDoors++;
                    actVj = Number(row.act_d_vj || 0);
                    actNvj = Number(row.act_d_nvj || 0);
                    actEVj = Number(row.act_e_vj || 0);
                    actENvj = Number(row.act_e_nvj || 0);

                    summary.actualDVj += actVj; summary.actualDNvj += actNvj;
                    summary.actualEVj += actEVj; summary.actualENvj += actENvj;
                } else {
                    summary.pendingDoors++;
                    summary.pendingDVj += expVj; summary.pendingDNvj += expNvj;
                    summary.pendingE += ordE;
                }

                var formatTime = (ts) => ts ? new Date(ts).toLocaleString('en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : "";

                var doorObj = {
                    sno: row.id,
                    door: row.door || "",
                    cpnno: row.cpn_no || "",
                    ordDate: formatTime(row.order_date),
                    ordD: ordD,
                    ordE: ordE,
                    replaceQty: Number(row.replace_qty || 0),
                    replaceReason: row.replace_reason || "",
                    replaceActVj: Number(row.replace_act_vj || 0),
                    replaceActNvj: Number(row.replace_act_nvj || 0),
                    ordComment: row.order_comment || "",
                    uniqueNo: String(row.unique_no || "").trim(),
                    advance: advance,
                    expVj: expVj,
                    expNvj: expNvj,
                    actDVj: actVj, actDNvj: actNvj, actEVj: actEVj, actENvj: actENvj,
                    actD: Number(row.act_d || 0), actE: Number(row.act_e || 0),
                    delComment: row.delivery_comment || "",
                    doorLink: row.door_delivery_link || "",
                    unloadOn: formatTime(row.unload_on), unloadBy: row.unload_by || "",
                    loadOn: formatTime(row.load_on), loadBy: row.load_by || "",
                    delOn: formatTime(deliveryEnterOn), delBy: row.delivery_entered_by || "",
                    doorDone: doorDone,
                    v2bDone: (v2bLink !== ""),
                    b2vDone: (b2vLink !== ""),
                    v2bLink: v2bLink,
                    b2vLink: b2vLink,
                    v2bFulls: Number(row.van_to_block_full_can_count || 0),
                    b2vFulls: Number(row.block_to_van_full_count || 0),
                    b2vEmpties: Number(row.block_to_van_empty_count || 0)
                };

                if (!allOrders[apt]) allOrders[apt] = {};
                if (!allOrders[apt][blk]) allOrders[apt][blk] = [];
                allOrders[apt][blk].push(doorObj);

                if (isPending) {
                    if (!pendingOrders[apt]) pendingOrders[apt] = {};
                    if (!pendingOrders[apt][blk]) pendingOrders[apt][blk] = [];
                    pendingOrders[apt][blk].push(doorObj);
                }
            });

            summary.totalBlocks = Object.keys(uniqueBlocks).length;
            summary.pendingBlocks = Object.keys(pendingBlocksSet).length;
            summary.completedBlocks = summary.totalBlocks - summary.pendingBlocks;

            window.pendingData = pendingOrders;
            window.allData = allOrders;
            window.serverSummary = summary;

            localStorage.setItem('wd_pending_data', JSON.stringify(window.pendingData));
            localStorage.setItem('wd_all_data', JSON.stringify(window.allData));
            localStorage.setItem('wd_server_summary', JSON.stringify(window.serverSummary));
            localStorage.setItem('wd_last_sync_ts', new Date().toLocaleTimeString());

            window.loadLocalData();

            window.hideLoader();
            window.showToast("Route Synced & Trip Active!", true);
        } catch (err) {
            window.hideLoader();
            alert("Failed to fetch route: " + err.message);
        }
    };

    // ===============================================
    // HANDSHAKE & CLOCK OUT LOGIC
    // ===============================================
    window.openHandshakeModal = async function () {
        var pinEl = document.getElementById('hs-pin');
        if (pinEl) pinEl.value = '';
        var modal = document.getElementById('modal-handshake');
        if (modal) modal.classList.remove('hidden');

        if (window.currentUser && window.currentUser.role.includes('DRIVER')) {
            const todayStr = new Date().toISOString().split('T')[0];
            const { data: activeTrip } = await window.supabase1.from('eod_log')
                .select('id')
                .gte('created_at', todayStr + 'T00:00:00')
                .eq('status', 'Active')
                .maybeSingle();

            if (activeTrip) {
                await window.supabase1.from('eod_log')
                    .update({ status: 'Pending Handover' })
                    .eq('id', activeTrip.id);
            }
        }
    };

    window.closeHandshakeModal = function () {
        var modal = document.getElementById('modal-handshake');
        if (modal) modal.classList.add('hidden');
    };

    window.submitHandshake = async function () {
        var btn = document.querySelector('#modal-handshake button.bg-emerald-600');
        var pin = document.getElementById('hs-pin').value.trim();

        if (pin === '') return window.showToast("Admin PIN is mandatory.", false);

        if (btn) { btn.disabled = true; btn.innerText = 'VERIFYING...'; btn.classList.replace('bg-emerald-600', 'bg-slate-400'); }
        window.showLoader('Verifying Handshake...');

        try {
            // 1. Verify Admin PIN (Must match precisely)
            const { data: adminData, error: adminErr } = await window.supabase1
                .from('users')
                .select('username, pin_expiry')
                .eq('pin', pin)
                .not('pin', 'is', null)
                .maybeSingle();

            if (!adminData || adminErr) throw new Error("Invalid PIN. Ensure the Admin has generated a new PIN.");

            // 2. Security Check: Has the 60-minute window closed?
            if (new Date() > new Date(adminData.pin_expiry)) {
                throw new Error("This PIN has expired. Please ask the Admin to generate a new one.");
            }

            // 3. Find the active personal shift for this specific user
            let activeShiftId = null;
            const { data: activeShifts } = await window.supabase1
                .from('shift_log')
                .select('id')
                .eq('mail_id', window.currentUser.username)
                .eq('status', 'Active')
                .order('created_at', { ascending: true })
                .limit(1);

            if (activeShifts && activeShifts.length > 0) {
                activeShiftId = activeShifts[0].id;
            } else {
                // Auto-heal logic: If a helper was never officially clocked in, find today's active trip and clock them out of it
                const todayStr = new Date().toISOString().split('T')[0];
                const { data: eodLogs } = await window.supabase1.from('eod_log')
                    .select('id')
                    .gte('created_at', todayStr + 'T00:00:00')
                    .order('created_at', { ascending: false }).limit(1);

                if (!eodLogs || eodLogs.length === 0) throw new Error("No active trip found to clock out of.");

                const { data: newShift, error: insErr } = await window.supabase1.from('shift_log').insert([{
                    trip_id: eodLogs[0].id,
                    mail_id: window.currentUser.username,
                    role: window.currentUser.role,
                    status: 'Active'
                }]).select('id').single();

                if (insErr) throw insErr;
                activeShiftId = newShift.id;
            }

            // 4. Mark the individual shift_log as Completed (DO NOT touch eod_log here)
            const { error: updateErr } = await window.supabase1
                .from('shift_log')
                .update({
                    status: 'Completed',
                    clock_out: new Date().toISOString()
                })
                .eq('id', activeShiftId);

            if (updateErr) throw updateErr;

            window.hideLoader();
            window.showToast("Shift Closed! You are clocked out.", true);
            window.closeHandshakeModal();

            // Reload the app to clear out the shift from their local view
            setTimeout(function () { window.location.reload(true); }, 2000);

        } catch (err) {
            window.hideLoader();
            window.showToast(err.message, false);
        } finally {
            if (btn) { btn.disabled = false; btn.innerText = 'CONFIRM HANDOVER'; btn.classList.replace('bg-slate-400', 'bg-emerald-600'); }
        }
    };

})();