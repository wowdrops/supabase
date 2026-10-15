
    window.updatePasswordInternal = function () { 
      var cur = document.getElementById('cp-current').value; var nPass = document.getElementById('cp-new').value; 
      var cPass = document.getElementById('cp-confirm').value; var fb = document.getElementById('cp-msg'); 
      if (!cur || !nPass || !cPass) return window.showNotif(fb, "All fields are mandatory.", false); 
      if (nPass !== cPass) return window.showNotif(fb, "Passwords mismatch.", false); 
      document.getElementById('btn-change-pass').innerText = "Saving..."; 
      google.script.run.withSuccessHandler(function (res) { 
          document.getElementById('btn-change-pass').innerText = "Save Password"; 
          if (res.success) { window.showNotif(fb, res.message, true); document.getElementById('cp-current').value = ""; document.getElementById('cp-new').value = ""; document.getElementById('cp-confirm').value = ""; } 
          else window.showNotif(fb, res.message, false); 
      }).changePasswordDirectly(window.activeAdminSession.username, cur, nPass); 
  };
