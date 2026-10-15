// ==========================================
// 512_Admin_Reports_Customer.gs
// CUSTOMER ANALYTICS & REPORTING
// ==========================================

function fetchCustomerReportData() {
  try {
    var ss = SpreadsheetApp.openById(MASTER_SPREADSHEET_ID);
    
    // 1. Fetch Statuses
    var setupSheet = ss.getSheetByName('SETUP');
    var statuses = ['ACTIVE', 'INACTIVE']; // Default
    if (setupSheet) {
      var setupData = setupSheet.getRange(3, 33, setupSheet.getLastRow() - 2, 1).getValues();
      statuses = [];
      for (var s = 0; s < setupData.length; s++) {
        if (setupData[s][0] && String(setupData[s][0]).trim() !== "") statuses.push(String(setupData[s][0]).trim());
      }
    }

    // 2. Fetch Customer Data
    var sheet = ss.getSheetByName('DATABASE');
    var data = sheet.getDataRange().getValues();
    var customers = [];
    
    for (var i = 3; i < data.length; i++) {
      if (!String(data[i][1]).trim()) continue; // Skip empty
 
      customers.push({
        cpn: String(data[i][1]).trim(),
        apt: String(data[i][2]).trim(),
        blk: String(data[i][3]).trim(),
        door: String(data[i][4]).trim(),
        poc1: String(data[i][6]).trim(),
        con1: String(data[i][7]).trim(),
        finalStatus: String(data[i][18]).trim(),
        defaultRate: Number(data[i][26]) || 0,
        delColor: String(data[i][27]).trim(),
        passwordSet: (String(data[i][32]).trim() !== ""),
        advance: Number(data[i][33]) || 0,
        overdueWaiver: String(data[i][34]).trim() || "No",
        maxOrdD: Number(data[i][35]) || 0,
        maxOrdE: Number(data[i][36]) || 0,
        email: String(data[i][37]).trim(),
        prevMonWaiver: String(data[i][40]).trim() || "No",
        payType: String(data[i][11]).trim() || "NO PAY TYPE", //CASH, ONLINE, NO PAY TYPE 
        createdDate: parseValidDate(data[i][15])
      });
    }
    
    return { success: true, statuses: statuses, customers: customers };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

function parseValidDate(val) {
  if (!val) return null;

  var d;

  // Case 1: Already a JavaScript Date object (from getValues)
  if (val instanceof Date) {
    d = val;
  } 
  // Case 2: Google Sheets serial number (e.g. 45595 or "45595")
  else if (!isNaN(val) && Number(val) > 30000 && Number(val) < 100000) {
    // Convert Google Sheets serial date to JS timestamp
    d = new Date((Number(val) - 25569) * 86400 * 1000);
  } 
  // Case 3: Standard date string
  else {
    d = new Date(val);
  }

  // Validate the date and reject corrupt years (e.g., year 45595 or invalid dates)
  if (d instanceof Date && !isNaN(d.getTime())) {
    var year = d.getFullYear();
    if (year >= 2000 && year <= 2099) {
      return d.toISOString();
    }
  }

  return null; // Return null if date is out of reasonable range or invalid
}