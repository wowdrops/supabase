// ==========================================
// SYSTEM CONFIGURATIONS (SETUP SHEET)
// ==========================================

function getSystemConfigurations() {
  try {
    var ss = SpreadsheetApp.openById(ENTRY_SPREADSHEET_ID);
    var sheet = ss.getSheetByName('SETUP');
    if (!sheet) return { success: false, message: "SETUP sheet not found." };
    
    // Read the exact 5 cells in one batch
    var values = sheet.getRange("BL4:BL8").getValues();
    
    return {
      success: true,
      config: {
        perDayCanCount: values[0][0],      // BL4
        lookupRestrictQty: values[1][0],   // BL5
        minEntryQty: values[2][0],         // BL6
        perDayOnOff: values[3][0],         // BL7
        vjPrice: values[4][0]              // BL8
      }
    };
  } catch(e) {
    return { success: false, message: "Read Error: " + e.toString() };
  }
}

function saveSystemConfigurations(payload) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var ss = SpreadsheetApp.openById(ENTRY_SPREADSHEET_ID);
    var sheet = ss.getSheetByName('SETUP');
    if (!sheet) return { success: false, message: "SETUP sheet not found." };
    
    // Format the payload into a 2D array matching the vertical column structure
    var updateArray = [
      [payload.perDayCanCount],
      [payload.lookupRestrictQty],
      [payload.minEntryQty],
      [String(payload.perDayOnOff).trim().toUpperCase()], // Ensure it's cleanly formatted as ON/OFF
      [payload.vjPrice]
    ];
    
    // Write back to the exact range in one stroke
    sheet.getRange("BL4:BL8").setValues(updateArray);
    
    return { success: true };
  } catch(e) {
    return { success: false, message: "Write Error: " + e.toString() };
  } finally {
    lock.releaseLock();
  }
}