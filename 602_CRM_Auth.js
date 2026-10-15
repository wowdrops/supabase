// ==========================================
// 602_CRM_Auth.gs - CRM Authentication & OTP
// ==========================================

function hashCRMPassword(password) {
  if (!password) return "";
  var rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(password).trim(), Utilities.Charset.UTF_8);
  var txtHash = '';
  for (var i = 0; i < rawHash.length; i++) {
    var hashVal = rawHash[i];
    if (hashVal < 0) { hashVal += 256; }
    if (hashVal.toString(16).length == 1) { txtHash += '0'; }
    txtHash += hashVal.toString(16);
  }
  return txtHash;
}

function authenticateCRMUser(username, password) {
  var ss = SpreadsheetApp.openById(MASTER_SPREADSHEET_ID);
  var sheet = ss.getSheetByName('CRM_USERS');
  var data = sheet.getDataRange().getValues();
  var inputHash = hashCRMPassword(password);
  
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim().toLowerCase() === String(username).trim().toLowerCase()) {
      var dbPassword = String(data[i][1]).trim();
      
      // First Time Setup Logic
      if (dbPassword === "" || dbPassword === "undefined") {
        return { success: false, status: "FIRST_TIME_SETUP", message: "Account activation required.", mailid: data[i][3] };
      }
      
      if (dbPassword === inputHash && String(data[i][4]).toUpperCase() === 'ACTIVE') {
        return { success: true, adminData: { username: data[i][0], role: data[i][2], mailid: data[i][3] } };
      }
      return { success: false, message: "Invalid Password or Inactive Account." };
    }
  }
  return { success: false, message: "User not found." };
}

function sendCRMOTP(mailid) {
  var ss = SpreadsheetApp.openById(MASTER_SPREADSHEET_ID);
  var sheet = ss.getSheetByName('CRM_USERS');
  var data = sheet.getDataRange().getValues();
  var targetRow = -1;
  
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][3]).trim().toLowerCase() === String(mailid).trim().toLowerCase()) {
      targetRow = i + 1;
      break;
    }
  }
  
  if (targetRow === -1) return { success: false, message: "Email not found." };
  
  var otp = Math.floor(100000 + Math.random() * 900000).toString();
  var expiry = new Date().getTime() + (10 * 60 * 1000);
  
  sheet.getRange(targetRow, 6).setValue(otp); // Col F
  sheet.getRange(targetRow, 7).setValue(new Date(expiry)); // Col G
  
  MailApp.sendEmail({
    to: mailid,
    subject: "WOWDROPS CRM - Verification OTP",
    htmlBody: "Your CRM activation OTP is: " + otp + ". This expires in 10 minutes."
  });
  return { success: true, message: "OTP sent to your email." };
}

function resetCRMPassword(mailid, otp, newPassword) {
  var ss = SpreadsheetApp.openById(MASTER_SPREADSHEET_ID);
  var sheet = ss.getSheetByName('CRM_USERS');
  var data = sheet.getDataRange().getValues();
  
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][3]).trim().toLowerCase() === String(mailid).trim().toLowerCase()) {
      var savedOtp = String(sheet.getRange(i + 1, 6).getValue()).trim();
      var cellExpiry = sheet.getRange(i + 1, 7).getValue();
      var expiryTime = cellExpiry instanceof Date ? cellExpiry.getTime() : Number(cellExpiry) || 0;
      
      if (new Date().getTime() > expiryTime) return { success: false, message: "OTP expired." };
      if (savedOtp !== String(otp).trim()) return { success: false, message: "Invalid OTP." };
      
      sheet.getRange(i + 1, 2).setValue(hashCRMPassword(newPassword));
      sheet.getRange(i + 1, 6).clearContent();
      sheet.getRange(i + 1, 7).clearContent();
      
      return { success: true, message: "Password updated successfully!" };
    }
  }
  return { success: false, message: "User not found." };
}