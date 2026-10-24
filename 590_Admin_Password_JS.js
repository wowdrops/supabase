window.updatePasswordInternal = async function () { 
  var cur = document.getElementById('cp-current').value; 
  var nPass = document.getElementById('cp-new').value; 
  var cPass = document.getElementById('cp-confirm').value; 
  var fb = document.getElementById('cp-msg'); 
  
  if (!cur || !nPass || !cPass) return window.showNotif(fb, "All fields are mandatory.", false); 
  if (nPass !== cPass) return window.showNotif(fb, "Passwords mismatch.", false); 
  
  document.getElementById('btn-change-pass').innerText = "Saving..."; 
  
  try {
      const supa = window.supabase1;
      const username = window.activeAdminSession.username;
      
      if (!supa) throw new Error("Supabase not initialized");
      if (!username) throw new Error("User reference context dropped.");

      const hashPassword = async (plainText) => {
          const encoder = new TextEncoder();
          const data = encoder.encode(plainText);
          const hashBuffer = await crypto.subtle.digest('SHA-256', data);
          return Array.from(new Uint8Array(hashBuffer))
              .map(b => b.toString(16).padStart(2, '0'))
              .join('');
      };

      const hashedCur = await hashPassword(cur);
      const hashedNew = await hashPassword(nPass);

      const { data: user, error: fetchError } = await supa
          .from('users')
          .select('password_hash')
          .eq('username', username)
          .single();

      if (fetchError || !user) throw new Error("User reference context dropped.");

      if (user.password_hash !== hashedCur) {
          throw new Error("Current password validation failed.");
      }

      const { error: updateError } = await supa
          .from('users')
          .update({ password_hash: hashedNew })
          .eq('username', username);

      if (updateError) throw updateError;

      window.showNotif(fb, "Password updated successfully.", true); 
      document.getElementById('cp-current').value = ""; 
      document.getElementById('cp-new').value = ""; 
      document.getElementById('cp-confirm').value = "";

  } catch (err) {
      window.showNotif(fb, err.message, false);
  } finally {
      document.getElementById('btn-change-pass').innerText = "Save Password"; 
  }
};

// FIX: Register the tab with the router so the screen isn't blank
window.tabActions['password'] = function() {
    // Clear fields if the user leaves and comes back
    document.getElementById('cp-current').value = ""; 
    document.getElementById('cp-new').value = ""; 
    document.getElementById('cp-confirm').value = "";
    document.getElementById('cp-msg').classList.add('hidden');
};