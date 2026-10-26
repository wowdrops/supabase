// ==========================================
// PAYMENT GATEWAY ROUTING & UI (Supabase Version)
// ==========================================

function checkForPaymentRedirect() {
  const urlParams = new URLSearchParams(window.location.search);
  const txnId = urlParams.get('txnId');

  if (txnId) {
    document.body.insertAdjacentHTML('beforeend', `
      <div id="payment-verify-overlay" class="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center p-4">
        <div class="w-12 h-12 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin mb-4"></div>
        <h3 class="text-white font-bold text-lg">Verifying Payment...</h3>
        <p class="text-indigo-200 text-sm mt-2 text-center max-w-xs">Please do not close this window while we securely confirm your transaction with PhonePe.</p>
      </div>
    `);

    // Clean the URL so a refresh doesn't trigger verification again
    window.history.replaceState({}, document.title, window.location.pathname);

    // Make sure callBackendAPI points to your NEW Webhook URL!
    callBackendAPI("checkPaymentStatus", { txnId: txnId }, 
      function(res) {
        document.getElementById('payment-verify-overlay').remove();
        var amtMatch = res.message ? res.message.match(/₹([0-9.,]+)/) : null;
        var amountExtracted = amtMatch ? amtMatch[1] : null;

        if (res.success) {
          showInlinePaymentMessage(true, amountExtracted, txnId, res.message);
          if (activeUserSession) refreshCustomerSessionData(activeUserSession.cpn);
        } else if (res.status === 'PENDING') {
          showInlinePaymentMessage(true, amountExtracted, txnId, "⏳ Payment is still pending. It will be updated automatically once cleared.");
        } else {
          showInlinePaymentMessage(false, amountExtracted, txnId, res.message || "Payment Failed or Cancelled. Please try again.");
        }
      },
      function(err) {
        document.getElementById('payment-verify-overlay').remove();
        showInlinePaymentMessage(false, null, txnId, "Network error while verifying payment. We will verify it securely in the background.");
      }
    );
  }
}

function showInlinePaymentMessage(isSuccess, amount, txnId, customMessage) {
    var banner = document.getElementById('payment-status-banner');
    if (!banner) return;

    var timeNow = new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
    
    var bgColor = isSuccess ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800';
    var iconColor = isSuccess ? 'text-emerald-500' : 'text-red-500';
    
    var iconSvg = isSuccess 
        ? '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>'
        : '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>';
    
    var title = isSuccess ? 'Payment Successful' : 'Payment Failed';
    var amtDisplay = amount ? `₹${amount}` : 'N/A';
    var txnDisplay = txnId || 'N/A';

    var html = `
        <div class="${bgColor} p-4 rounded-xl border shadow-sm relative fade-in mb-4">
            <button onclick="this.parentElement.style.display='none'" class="absolute top-2 right-2 text-slate-400 hover:text-slate-600 transition">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
            <div class="flex items-start space-x-3">
                <div class="shrink-0 mt-0.5 ${iconColor}">${iconSvg}</div>
                <div class="flex-1">
                    <h4 class="text-base font-black uppercase tracking-wide">${title}</h4>
                    <p class="text-xs font-medium mt-1">${customMessage}</p>
                    <div class="mt-3 bg-white/50 rounded-lg p-2.5 border border-black/5 flex flex-col gap-1.5 text-[10px] font-bold text-slate-600">
                        <div class="flex justify-between border-b border-black/5 pb-1"><span>Amount:</span> <span class="text-black font-black">${amtDisplay}</span></div>
                        <div class="flex justify-between border-b border-black/5 pb-1"><span>Transaction ID:</span> <span class="text-black">${txnDisplay}</span></div>
                        <div class="flex justify-between"><span>Date & Time:</span> <span class="text-black">${timeNow}</span></div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    banner.innerHTML = html;
    banner.classList.remove('hidden');
    banner.style.display = 'block'; 
}

function openPaymentPopup(type = 'total') {
  if (!activeUserSession) return;
  var prevSum = (activeUserSession.older || 0) + (activeUserSession.lastMon || 0);
  document.getElementById('split-older').innerText = "₹" + formatCurrency(activeUserSession.older);
  document.getElementById('split-last').innerText = "₹" + formatCurrency(activeUserSession.lastMon);
  document.getElementById('split-previous').innerText = "₹" + formatCurrency(prevSum);
  document.getElementById('split-curr').innerText = "₹" + formatCurrency(activeUserSession.currentMon);
  document.getElementById('split-total').innerText = "₹" + formatCurrency(activeUserSession.outstanding);

  var radioToSelect = document.querySelector('input[value="' + type + '"]');
  if (radioToSelect) {
    radioToSelect.checked = true;
    updatePayInput(radioToSelect);
  } else {
    document.querySelector('input[value="total"]').checked = true;
    document.getElementById('pay-custom-amt').value = formatCurrency(activeUserSession.outstanding);
  }
  document.getElementById('payment-modal').classList.remove('hidden');
}

function updatePayInput(radio) {
  var val = 0;
  switch (radio.value) {
    case 'older': val = activeUserSession.older || 0; break;
    case 'lastMon': val = activeUserSession.lastMon || 0; break;
    case 'previous': val = (activeUserSession.older || 0) + (activeUserSession.lastMon || 0); break;
    case 'currentMon': val = activeUserSession.currentMon || 0; break;
    case 'total': val = activeUserSession.outstanding || 0; break;
  }
  document.getElementById('pay-custom-amt').value = formatCurrency(val);
}

function handleCustomAmountInput(inputEl) {
    var radios = document.querySelectorAll('input[name="pay-amt"]');
    radios.forEach(r => r.checked = false);
}

function closePaymentPopup() {
  document.getElementById('payment-modal').classList.add('hidden');
}

function triggerUPIPayment() {
  var amt = parseInt(document.getElementById('pay-custom-amt').value, 10);
  if (isNaN(amt) || amt <= 0) return alert("Please enter a valid amount greater than 0.");

  var btn = document.querySelector('#payment-modal button.bg-emerald-500');
  var originalText = btn.innerHTML;
  btn.innerHTML = "<span class='animate-pulse'>Generating Secure Link...</span>";
  btn.disabled = true;
  btn.classList.replace("bg-emerald-500", "bg-slate-400");

  // Dynamically grab the current page URL
  var currentUrl = window.location.origin + window.location.pathname;

  callBackendAPI("initiatePhonePePayment", { cpn: activeUserSession.cpn, amount: amt  },
    function (res) {
      if (res.success) {
        btn.innerHTML = "Redirecting to PhonePe...";
        window.open(res.checkoutUrl, '_top');
      } else {
        btn.innerHTML = originalText;
        btn.disabled = false;
        btn.classList.replace("bg-slate-400", "bg-emerald-500");
        alert("Payment Gateway Failed: " + res.message);
      }
    },
    function (err) {
      btn.innerHTML = originalText;
      btn.disabled = false;
      btn.classList.replace("bg-slate-400", "bg-emerald-500");
      alert("Network Error: Could not connect to gateway.");
    }
  );
}