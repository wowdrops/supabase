// Change password from menu link
function changePasswordDirectly(username, currentPlainPass, newPlainPass) {
  var ss = SpreadsheetApp.openById(MASTER_SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Users');
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(username).trim()) {
      var dbHash = String(data[i][1]).trim();
      if (dbHash !== hashPassword(currentPlainPass)) return { success: false, message: "Current password validation failed." };
      sheet.getRange(i + 1, 2).setValue(hashPassword(newPlainPass));
      return { success: true, message: "Password updated successfully." };
    }
  }
  return { success: false, message: "User reference context dropped." };
}

