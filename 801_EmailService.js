// =================================================================
// 801_EmailService.js - AUTOMATED EMAIL FACTORY
// =================================================================

function getCustomerEmailByCPN(cpn) {
  try {
    var ss = SpreadsheetApp.openById(MASTER_SPREADSHEET_ID);
    var sheet = ss.getSheetByName("CUSTOMERS"); // ⚠️ Update if your sheet name is different
    if (!sheet) return null;
    
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === String(cpn).trim()) {
        var email = String(data[i][4]).trim(); // ⚠️ Assuming Email is in Column E (Index 4)
        if (email && email.indexOf("@") !== -1) {
          return email;
        }
        break;
      }
    }
  } catch (e) {
    Logger.log("Email Lookup Failed: " + e.message);
  }
  return null;
}

function sendWowDropsEmail(eventType, cpn, dataObj) {
  var customerEmail = getCustomerEmailByCPN(cpn);
  var adminEmail = "wowdropsfoodandbeverages@gmail.com";
  
  // If no customer email, we only send to the admin to save quota
  var toAddress = customerEmail ? customerEmail : adminEmail;
  var bccAddress = customerEmail ? adminEmail : ""; 

  var subject = "";
  var bannerBg = "";
  var bannerText = "";
  var bannerTitle = "";
  var customMsg = "";
  var tableHtml = "";

  // 1. CONFIGURATION BASED ON EVENT TYPE
  switch(eventType) {
    case "PAYMENT_SUCCESS":
      subject = "✅ Payment Successful - WOW DROPS";
      bannerBg = "#ecfdf5"; // emerald-50
      bannerText = "#065f46"; // emerald-800
      bannerTitle = "PAYMENT SUCCESSFUL";
      customMsg = "We have securely received your payment and updated your ledger.";
      tableHtml = generateEmailRow("Amount Paid", "₹" + dataObj.amount) +
                  generateEmailRow("Transaction ID", dataObj.txnId) +
                  generateEmailRow("Date & Time", dataObj.date);
      break;

    case "PAYMENT_FAILED":
      subject = "⚠️ Payment Failed - WOW DROPS";
      bannerBg = "#fef2f2"; // red-50
      bannerText = "#991b1b"; // red-800
      bannerTitle = "PAYMENT FAILED";
      customMsg = "Your recent payment attempt was unsuccessful or cancelled.";
      tableHtml = generateEmailRow("Amount Attempted", "₹" + dataObj.amount) +
                  generateEmailRow("Transaction ID", dataObj.txnId) +
                  generateEmailRow("Date & Time", dataObj.date);
      break;

    case "ORDER_PLACED":
      subject = "⚡ Order Placed Successfully - WOW DROPS";
      bannerBg = "#eef2ff"; // indigo-50
      bannerText = "#3730a3"; // indigo-800
      bannerTitle = "ORDER CONFIRMED";
      customMsg = "Your request has been received and is being processed.";
      tableHtml = generateEmailRow("Order ID", dataObj.uniqueNo) +
                  generateEmailRow("Cans Ordered", dataObj.cans) +
                  generateEmailRow("Empties Ready", dataObj.empties) +
                  generateEmailRow("Date", dataObj.date);
      break;

    case "ORDER_CANCELLED":
      subject = "🚫 Order Cancelled - WOW DROPS";
      bannerBg = "#f8fafc"; // slate-50
      bannerText = "#334155"; // slate-700
      bannerTitle = "ORDER CANCELLED";
      customMsg = "Your pending order has been successfully cancelled as requested.";
      tableHtml = generateEmailRow("Order ID", dataObj.uniqueNo) +
                  generateEmailRow("Date Cancelled", dataObj.date);
      break;
      
    case "DELIVERY_COMPLETED":
      subject = "🚚 Delivery Completed - WOW DROPS";
      bannerBg = "#f0fdfa"; // teal-50
      bannerText = "#115e59"; // teal-800
      bannerTitle = "DELIVERY SUCCESSFUL";
      customMsg = "Your water delivery has been successfully completed.";
      tableHtml = generateEmailRow("Order ID", dataObj.uniqueNo) +
                  generateEmailRow("Delivered Cans", dataObj.delCans) +
                  generateEmailRow("Collected Empties", dataObj.colEmpties) +
                  generateEmailRow("Billed Amount", "₹" + dataObj.amount);
      break;

    default:
      return; // Stop if unknown event
  }

  // 2. BUILD THE HTML TEMPLATE
  var htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
      
      <!-- Dark Blue Header -->
      <div style="background-color: #0f172a; padding: 24px; text-align: center;">
        <h2 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 900; letter-spacing: 1px;">WOW DROPS</h2>
      </div>
      
      <!-- Status Banner -->
      <div style="background-color: ${bannerBg}; color: ${bannerText}; padding: 16px; text-align: center; font-size: 16px; font-weight: 900; letter-spacing: 1px; border-bottom: 1px solid #e2e8f0;">
        ${bannerTitle}
      </div>
      
      <!-- Body Content -->
      <div style="padding: 24px; color: #334155;">
        <p style="margin-top: 0; font-size: 14px; font-weight: bold; color: #1e293b;">Hello (CPN: ${cpn}),</p>
        <p style="font-size: 14px; line-height: 1.5; color: #475569;">${customMsg}</p>
        
        <!-- Data Table -->
        <div style="margin-top: 24px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px;">
          ${tableHtml}
        </div>
      </div>
      
      <!-- Footer -->
      <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px; text-align: center; font-size: 11px; color: #64748b; font-weight: bold;">
        WOW DROPS FOOD AND BEVERAGES<br>
        <a href="mailto:wowdropsfoodandbeverages@gmail.com" style="color: #4f46e5; text-decoration: none; margin-top: 4px; display: inline-block;">Contact Support</a>
      </div>
    </div>
  `;

  // 3. SEND THE EMAIL (Wrapped in try/catch to prevent quota crashes)
  try {
    MailApp.sendEmail({
      to: toAddress,
      bcc: bccAddress,
      subject: subject,
      htmlBody: htmlBody,
      name: "WOW DROPS System"
    });
  } catch (e) {
    Logger.log("Email Quota Exceeded or Error: " + e.message);
  }
}

// Helper to generate a clean table row for the email
function generateEmailRow(label, value) {
  return `
    <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 8px;">
      <span style="font-size: 12px; font-weight: bold; color: #64748b; text-transform: uppercase;">${label}</span>
      <span style="font-size: 13px; font-weight: 900; color: #0f172a;">${value}</span>
    </div>
  `;
}