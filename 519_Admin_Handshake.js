// ==========================================
// EOD HANDSHAKE LOG (BACKEND)
// ==========================================
function getHandshakeLogs(startDateStr, endDateStr) {
  try {
    var ss = SpreadsheetApp.openById(HISTORY_SPREADSHEET_ID);
    var sheet = ss.getSheetByName('EOD_LOG');
    if (!sheet) return { success: false, message: "EOD_LOG sheet not found." };
    
    var data = sheet.getDataRange().getValues();
    if (data.length < 2) return { success: true, logs: [] };

    // Set Date Boundaries
    var startD = new Date(startDateStr); startD.setHours(0,0,0,0);
    var endD = new Date(endDateStr); endD.setHours(23,59,59,999);

    var logs = [];
    var tz = Session.getScriptTimeZone();

    // Loop backwards to show newest entries first
    for (var i = data.length - 1; i > 0; i--) {
       var row = data[i];
       
       // Skip entirely blank rows
       if (!row[0] && !row[1] && !row[9]) continue; 

       // Parse the row's date for filtering
       var rowDate = new Date(row[0]);
       // Fallback for raw text strings (e.g. "14/08/2026 08:25:32")
       if (isNaN(rowDate.getTime())) {
           var parts = String(row[0]).split(" ")[0].split("/");
           if(parts.length === 3) rowDate = new Date(parts[2], parts[1]-1, parts[0]);
       }

       // Only push if it falls within the requested dates
       if (rowDate >= startD && rowDate <= endD) {
           var timeStr = "";
           if (row[0] instanceof Date) {
              timeStr = Utilities.formatDate(row[0], tz, "dd/MM/yyyy HH:mm:ss");
           } else {
              timeStr = String(row[0]);
           }

           logs.push({
             timestamp: timeStr,
             driver: String(row[1]).trim(),
             manager: String(row[2]).trim(),
             fullVj: Number(row[3]) || 0,
             fullNvj: Number(row[4]) || 0,
             empVj: Number(row[5]) || 0,
             empNvj: Number(row[6]) || 0,
             repVj: Number(row[7]) || 0,
             repNvj: Number(row[8]) || 0,
             status: String(row[9]).trim()
           });
       }
    }
    
    return { success: true, logs: logs };
  } catch(e) {
    return { success: false, message: e.toString() };
  }
}