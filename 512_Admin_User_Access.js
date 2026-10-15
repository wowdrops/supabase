// ==========================================
// SYSTEM ACCESS MAP REPORT (Updated for Read-Only Badges)
// ==========================================
function getSystemAccessMapData() {
  try {
    var ss = SpreadsheetApp.openById(MASTER_SPREADSHEET_ID);
    var sheet = ss.getSheetByName('Users');
    if (!sheet) return { success: false, message: "Users sheet not found." };
    
    var data = sheet.getDataRange().getValues();
    var users = [];

    for (var i = 1; i < data.length; i++) {
      var username = String(data[i][0]).trim();
      if (!username) continue;
      
      var role = String(data[i][2]).trim() || "Standard User";
      var mailid = String(data[i][3]).trim();
      var phone = String(data[i][4]).trim();
      
      var rawTabs = ROLE_PERMISSIONS[role] || [];
      var formattedTabs = [];

      if (rawTabs.includes("ALL")) {
        formattedTabs.push("Full Universal Access (All Submenus)");
      } else {
        for (var t = 0; t < rawTabs.length; t++) {
          var tId = rawTabs[t];
          var isViewOnly = tId.indexOf(":view") > -1;
          var baseId = tId.split(":")[0];
          
          var displayName = MENUNAMES[baseId] || baseId;
          if (isViewOnly) displayName += " (Read Only)"; // Tags it on the Access Map!
          
          formattedTabs.push(displayName);
        }
      }

      users.push({
        username: username,
        role: role,
        mailid: mailid || "No Email",
        phone: phone || "No Phone",
        permissions: formattedTabs
      });
    }
    return { success: true, users: users };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
} 