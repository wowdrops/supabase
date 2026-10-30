// ==========================================
// AUTHENTICATION & PROFILE (Supabase Version)
// ==========================================


// SHA-256 Hashing for Supabase
async function hashCustomerPassword(password) {
  return password;
   /* if (!password) return "";
    const msgBuffer = new TextEncoder().encode(String(password).trim());
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    */
}

function maskEmail(email) {
    if (!email) return "";
    const parts = email.split("@");
    if (parts.length !== 2) return email;
    const name = parts[0];
    const maskedName = name.length > 2 ? name.substring(0, 2) + "***" : name + "***";
    return maskedName + "@" + parts[1];
}

async function handleLogin() {
  var loginId = document.getElementById('login-id').value.trim().toUpperCase();
  var loginPass = document.getElementById('login-pass').value.trim();
  var errorEl = document.getElementById('login-err');

  if (!loginId) return showError(errorEl, "Mobile/CPN field cannot be blank.");
  toggleButtonState('btn-login', true, 'Verifying...');

  try {
    // This currently just returns the plain text based on your JS setup
    const inputHash = await hashCustomerPassword(loginPass);

    // --- NEW: SECURE RPC CALL ---
    const { data: result, error } = await supabase1.rpc('authenticate_customer_secure', {
        p_login_id: loginId,
        p_password: inputHash
    });

    toggleButtonState('btn-login', false, 'Secure Sign In');

    if (error) throw error;

    // --- HANDLE RPC RESPONSES ---
    if (!result.success) {
        if (result.error === 'REQUIRES_SETUP') {
            document.getElementById('login-pass').blur();
            document.getElementById('login-id').blur();
            
            passwordSetupSource = 'login';
            // Cache the required user details for the OTP step
            window.setupUser = result.setup_user; 
            
            showSetupEmailConfirm();
            switchView('view-new-password');
            return;
        }
        if (result.error === 'ACCOUNT_INACTIVE') {
            return showError(errorEl, "Account is inactive. Please contact support.");
        }
        
        return showError(errorEl, "Invalid Credentials. Please try again.");
    }

    // --- REGULAR LOGIN SUCCESS ---
    document.getElementById('login-pass').blur();
    document.getElementById('login-id').blur();
    
    // Build the session from the safe data returned by the database
    activeUserSession = {
      cpn: result.cpn,
      name: result.name,
      phone: result.phone,
      email: result.email,
      whatsapp: result.whatsapp,
      defaultRate: Number(result.defaultRate) || 0,
      apartment: result.apartment,
      block: result.block,
      door: result.door,
      maxClientD: Number(result.maxClientD) || 9999
    };

    localStorage.setItem('wowdrops_customer_session', JSON.stringify(activeUserSession));
    updateHeaderDisplays();
    showDashboardSkeletons();
    switchView('view-dashboard');
    refreshCustomerSessionData(activeUserSession.cpn);

  } catch (err) {
    toggleButtonState('btn-login', false, 'Secure Sign In');
    console.error("Login exception:", err);
    showError(errorEl, "Network error connecting to database.");
  }
}

// --- FIRST-TIME SETUP UI LOGIC ---
function showSetupEmailConfirm() {
  document.getElementById('setup-step-1a').classList.remove('hidden');
  document.getElementById('setup-step-1b').classList.add('hidden');
  document.getElementById('setup-step-2').classList.add('hidden');
  document.getElementById('pass-setup-err').classList.add('hidden');

  var email = window.setupUser.mail_id ;
  if (email) {
      document.getElementById('setup-masked-email').innerText = maskEmail(email);
      document.getElementById('link-cancel-email-change').classList.remove('hidden');
  } else {
      showSetupEmailChange();
      document.getElementById('link-cancel-email-change').classList.add('hidden'); // Cannot cancel if no email exists
  }
}

function showSetupEmailChange() {
  document.getElementById('setup-step-1a').classList.add('hidden');
  document.getElementById('setup-step-1b').classList.remove('hidden');
  document.getElementById('setup-verify-mobile').value = "";
  document.getElementById('setup-new-email').value = "";
  document.getElementById('pass-setup-err').classList.add('hidden');
}

async function sendSetupOTP(isChangingEmail) {
  var errorEl = document.getElementById('pass-setup-err');
  var targetEmail = "";

  if (isChangingEmail) {
      var mobileInput = document.getElementById('setup-verify-mobile').value.trim();
      targetEmail = document.getElementById('setup-new-email').value.trim();
      var dbMobile = String(window.setupUser.con1).trim();

      if (!mobileInput || !targetEmail || targetEmail.indexOf('@') === -1) {
          return showError(errorEl, "Please provide a valid mobile number and email.");
      }
      if (mobileInput !== dbMobile) {
          return showError(errorEl, "Verification failed. Mobile number does not match our records.");
      }

      // --- NEW: DUPLICATE EMAIL CHECK ---
      const { data: dupCheck } = await supabase1
          .from('ac_customers')
          .select('cpn_no')
          .eq('mail_id', targetEmail)
          .neq('cpn_no', window.setupUser.cpn_no)
          .maybeSingle();

      if (dupCheck) {
          return showError(errorEl, "This Email ID is already registered to another account.");
      }
      // ----------------------------------


      toggleButtonState('btn-setup-otp-2', true, 'Verifying...');
  } else {
      targetEmail = window.setupUser.mail_id ;
      toggleButtonState('btn-setup-otp-1', true, 'Sending...');
  }

  try {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiry = new Date(new Date().getTime() + (10 * 60 * 1000)).toISOString();
      const payload = { otp: otp, otp_expiry: expiry };
      if (isChangingEmail) payload.mail_id = targetEmail;

      const { error: updateErr } = await supabase1
          .from('ac_customers')
          .update(payload)
          .eq('cpn_no', window.setupUser.cpn_no);

      if (updateErr) throw updateErr;

      await fetch(GAS_WEBHOOK_URL, {
          method: 'POST',
          body: JSON.stringify({ email: targetEmail, otp: otp }),
          headers: { 'Content-Type': 'text/plain;charset=utf-8' }
      });

      if (isChangingEmail) toggleButtonState('btn-setup-otp-2', false, 'Verify & Send OTP');
      else toggleButtonState('btn-setup-otp-1', false, 'Send OTP');
      
      window.setupUser.targetEmail = targetEmail; 
      document.getElementById('setup-target-email').innerText = maskEmail(targetEmail);
      document.getElementById('setup-step-1a').classList.add('hidden');
      document.getElementById('setup-step-1b').classList.add('hidden');
      document.getElementById('setup-step-2').classList.remove('hidden');
      document.getElementById('pass-setup-err').classList.add('hidden');
      
  } catch (err) {
      if (isChangingEmail) toggleButtonState('btn-setup-otp-2', false, 'Verify & Send OTP');
      else toggleButtonState('btn-setup-otp-1', false, 'Send OTP');
      showError(errorEl, "Failed to send OTP: " + err.message);
  }
}

async function submitPasswordSetup() {
  var otpInput = document.getElementById('setup-otp').value.trim();
  var p1 = document.getElementById('new-pass-1').value;
  var p2 = document.getElementById('new-pass-2').value;
  var errorEl = document.getElementById('pass-setup-err');

  // Skip OTP check if triggered from inside the dashboard
  if (passwordSetupSource !== 'dashboard' && !otpInput) return showError(errorEl, "Please enter the 6-digit OTP.");
  
  if (!p1 || p1.length < 4) return showError(errorEl, "Password too short.");
  if (p1 !== p2) return showError(errorEl, "Passwords do not match.");

  toggleButtonState('btn-setup-save', true, 'Saving...');

  try {
      var targetCpn = passwordSetupSource === 'dashboard' ? activeUserSession.cpn : window.setupUser.cpn_no;

      if (passwordSetupSource !== 'dashboard') {
          const { data: checkData, error: checkErr } = await supabase1
              .from('ac_customers')
              .select('otp, otp_expiry')
              .eq('cpn_no', targetCpn)
              .maybeSingle();

          if (checkErr || !checkData) throw new Error("Customer record error.");
          if (new Date() > new Date(checkData.otp_expiry)) throw new Error("OTP has expired.");
          if (String(checkData.otp).trim() !== otpInput) throw new Error("Invalid OTP code.");
      }

      const hashedPass = await hashCustomerPassword(p1);
      const { error } = await supabase1
          .from('ac_customers')
          .update({ password_hash: hashedPass, otp: null, otp_expiry: null })
          .eq('cpn_no', targetCpn);

      if (error) throw error;

      toggleButtonState('btn-setup-save', false, 'Save Password');
      alert("Password saved successfully! Please log in.");
      
      if (passwordSetupSource === 'dashboard') switchView('view-dashboard');
      else {
          document.getElementById('login-id').value = targetCpn;
          document.getElementById('login-pass').value = '';
          switchView('view-login');
      }
      
  } catch (err) {
      toggleButtonState('btn-setup-save', false, 'Save Password');
      showError(errorEl, err.message);
  }
}

function cancelPasswordSetup() {
  if (passwordSetupSource === 'login') {
      window.setupUser = null;
      switchView('view-login');
  } else {
      switchView('view-dashboard');
  }
}

// --- FORGOT PASSWORD FLOW ---
function openForgotPassword() {
  document.getElementById('fp-step-1').classList.remove('hidden');
  document.getElementById('fp-step-2').classList.add('hidden');
  document.getElementById('fp-err-1').classList.add('hidden');
  document.getElementById('fp-id').value = '';
  switchView('view-forgot-password');
}

async function requestOTP() {
  var fpId = document.getElementById('fp-id').value.trim().toUpperCase();
  var errEl = document.getElementById('fp-err-1');
  if (!fpId) return showError(errEl, "Mobile/CPN field cannot be blank.");

  toggleButtonState('btn-fp-otp', true, 'Sending...');

  try {
      const { data, error } = await supabase1
          .from('ac_customers')
          .select('cpn_no, mail_id')
          .or(`cpn_no.eq.${fpId},con1.eq.${fpId}`)
          .maybeSingle();

      if (error || !data) {
          toggleButtonState('btn-fp-otp', false, 'Send Reset OTP to Email');
          return showError(errEl, "Account not found. Check your CPN/Mobile.");
      }

      var targetEmail = data.mail_id ;
      if (!targetEmail) {
          toggleButtonState('btn-fp-otp', false, 'Send Reset OTP to Email');
          return showError(errEl, "No email address registered. Please contact support.");
      }

      window.fpCpnCache = data.cpn_no; // Store CPN for step 2
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiry = new Date(new Date().getTime() + (10 * 60 * 1000)).toISOString();

      const { error: updateErr } = await supabase1
          .from('ac_customers')
          .update({ otp: otp, otp_expiry: expiry })
          .eq('cpn_no', data.cpn_no);

      if (updateErr) throw updateErr;

      await fetch(GAS_WEBHOOK_URL, {
          method: 'POST',
          body: JSON.stringify({ email: targetEmail, otp: otp }),
          headers: { 'Content-Type': 'text/plain;charset=utf-8' }
      });

      toggleButtonState('btn-fp-otp', false, 'Send Reset OTP to Email');
      
      document.getElementById('fp-masked-email').innerText = maskEmail(targetEmail);
      document.getElementById('fp-step-1').classList.add('hidden');
      document.getElementById('fp-step-2').classList.remove('hidden');

  } catch (err) {
      toggleButtonState('btn-fp-otp', false, 'Send Reset OTP to Email');
      showError(errEl, "Server Error: " + err.message);
  }
}

async function verifyAndResetPassword() {
  var otpInput = document.getElementById('fp-otp-input').value.trim();
  var p1 = document.getElementById('fp-new-pass').value;
  var errEl = document.getElementById('fp-err-2');

  if (!otpInput) return showError(errEl, "Please enter the 6-digit OTP.");
  if (!p1 || p1.length < 4) return showError(errEl, "Password too short.");

  toggleButtonState('btn-fp-reset', true, 'Verifying...');

  try {
      const { data: checkData, error: checkErr } = await supabase1
          .from('ac_customers')
          .select('otp, otp_expiry')
          .eq('cpn_no', window.fpCpnCache)
          .maybeSingle();

      if (checkErr || !checkData) throw new Error("Customer record error.");
      if (new Date() > new Date(checkData.otp_expiry)) throw new Error("OTP has expired.");
      if (String(checkData.otp).trim() !== otpInput) throw new Error("Invalid OTP code.");

      const hashedPass = await hashCustomerPassword(p1);
      const { error } = await supabase1
          .from('ac_customers')
          .update({ password_hash: hashedPass, otp: null, otp_expiry: null })
          .eq('cpn_no', window.fpCpnCache);

      if (error) throw error;

      toggleButtonState('btn-fp-reset', false, 'Verify & Reset Password');
      alert("Password reset successfully! Please log in.");
      
      document.getElementById('login-id').value = window.fpCpnCache;
      document.getElementById('login-pass').value = '';
      switchView('view-login');

  } catch (err) {
      toggleButtonState('btn-fp-reset', false, 'Verify & Reset Password');
      showError(errEl, err.message);
  }
}

// ==========================================
// REMAINDER FUNCTIONS (Untouched)
// ==========================================
function logoutCustomer() {
  localStorage.removeItem('wowdrops_customer_session');
  activeUserSession = null;
  document.getElementById('dropdown-menu').classList.add('hidden');
  switchView('view-login');
  var msgEl = document.getElementById('login-msg');
  msgEl.innerText = "You have been successfully logged out.";
  msgEl.classList.remove('hidden');
  setTimeout(function () { msgEl.classList.add('hidden'); }, 4000);
}

function openProfile() {
  document.getElementById('prof-phone').value = activeUserSession.phone || "";
  document.getElementById('prof-cpn').value = activeUserSession.cpn || "";
  document.getElementById('prof-rate').value = activeUserSession.defaultRate || 0;
  document.getElementById('prof-email').value = activeUserSession.email || "";
  document.getElementById('prof-wa').value = activeUserSession.whatsapp || "";
  document.getElementById('prof-msg').classList.add('hidden');
  switchView('view-profile');
}

async function submitProfileUpdate() {
  var email = document.getElementById('prof-email').value.trim();
  var wa = document.getElementById('prof-wa').value.trim();
  var msgEl = document.getElementById('prof-msg');

  toggleButtonState('btn-update-prof', true, 'Updating...');

  try {
    if (email) {
      const { data: existingEmailCheck } = await supabase1
        .from('ac_customers')
        .select('cpn_no')
        .eq('mail_id', email)
        .neq('cpn_no', activeUserSession.cpn)
        .maybeSingle();

      if (existingEmailCheck) {
        toggleButtonState('btn-update-prof', false, 'Update Profile');
        msgEl.innerText = "This Email ID is already registered to another account.";
        msgEl.className = "text-sm font-bold text-center mt-2 block text-red-500";
        return;
      }
    }

    const { error } = await supabase1
      .from('ac_customers')
      .update({ mail_id:email, con2: wa })
      .eq('cpn_no', activeUserSession.cpn);

    toggleButtonState('btn-update-prof', false, 'Update Profile');

    if (error) {
      msgEl.innerText = "Failed to update profile: " + error.message;
      msgEl.className = "text-sm font-bold text-center mt-2 block text-red-500";
      return;
    }

    activeUserSession.email = email;
    activeUserSession.whatsapp = wa;
    localStorage.setItem('wowdrops_customer_session', JSON.stringify(activeUserSession));

    msgEl.innerText = "Profile updated successfully!";
    msgEl.className = "text-sm font-bold text-center mt-2 block text-emerald-600";
    setTimeout(function () { msgEl.classList.add('hidden'); }, 4000);

  } catch (err) {
    toggleButtonState('btn-update-prof', false, 'Update Profile');
    msgEl.innerText = "Network error updating profile.";
    msgEl.className = "text-sm font-bold text-center mt-2 block text-red-500";
  }
}

function openChangePassword() {
  passwordSetupSource = 'dashboard';
  document.getElementById('pass-setup-err').classList.add('hidden');
  document.getElementById('new-pass-1').value = '';
  document.getElementById('new-pass-2').value = '';
  switchView('view-new-password');
}

function checkEmailCollection() {
  if (!activeUserSession.email && sessionStorage.getItem('email_skipped') !== 'true') {
    setTimeout(function () { document.getElementById('email-modal').classList.remove('hidden'); }, 1500);
  } else {
    if (typeof checkNotificationStatus === "function") checkNotificationStatus();
  }
}

function skipEmailCapture() {
  sessionStorage.setItem('email_skipped', 'true');
  document.getElementById('email-modal').classList.add('hidden');
  setTimeout(function() {
    if (typeof checkNotificationStatus === "function") checkNotificationStatus();
  }, 500);
}

async function saveCapturedEmail() {
  var email = document.getElementById('capture-email').value.trim();
  if (!email || email.indexOf('@') === -1) return alert("Please enter a valid email address.");

  toggleButtonState('btn-save-email', true, 'Saving...');

  try {

    // --- NEW: DUPLICATE EMAIL CHECK ---
    const { data: dupCheck } = await supabase1
      .from('ac_customers')
      .select('cpn_no')
      .eq('mail_id', email)
      .neq('cpn_no', activeUserSession.cpn)
      .maybeSingle();

    if (dupCheck) {
      toggleButtonState('btn-save-email', false, 'Save Email');
      return alert("This Email ID is already registered to another account.");
    }
    // ----------------------------------

    const { error } = await supabase1
      .from('ac_customers')
      .update({ mail_id: email })
      .eq('cpn_no', activeUserSession.cpn);

    toggleButtonState('btn-save-email', false, 'Save Email');

    if (error) {
      alert("Failed to save email: " + error.message);
      return;
    }

    activeUserSession.email = email;
    localStorage.setItem('wowdrops_customer_session', JSON.stringify(activeUserSession));
    document.getElementById('email-modal').classList.add('hidden');
    setTimeout(function() {
      if (typeof checkNotificationStatus === "function") checkNotificationStatus();
    }, 500);

  } catch (err) {
    toggleButtonState('btn-save-email', false, 'Save Email');
    alert("Network error saving email.");
  }
}