window.handleGlobalCpnSearch = function(event) {
  // Only trigger if the user presses the 'Enter' key (Keycode 13)
  if (event.key === 'Enter' || event.keyCode === 13) {
    event.preventDefault();
    
    var inputField = document.getElementById('global-cpn-search');
    var rawCpn = inputField.value.trim().toUpperCase();
    
    // Ensure it's not empty before trying to fetch
    if (rawCpn !== "") {
      // Blur the input to hide the mobile keyboard if applicable
      inputField.blur();
      
      // Open the existing 360 modal using your current function
      if (typeof window.openCustomer360 === 'function') {
        window.openCustomer360(rawCpn);
      } else {
        if (window.showToast) window.showToast("Customer 360 module is not loaded.", "error");
        else alert("Customer 360 module is not loaded on this page.");
      }
      
      // clear the input after search
      inputField.value = '';
    }
  }
};