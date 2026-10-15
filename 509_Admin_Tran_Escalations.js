// ==========================================
// CRM ESCALATION HANDLING
// ==========================================
function fetchCRMEscalations() {
  try {
    var crmSs = SpreadsheetApp.openById(CRM_SPREADSHEET_ID);
    var dormSheet = crmSs.getSheetByName('DORMANT_CALL_LOGS');
    if (!dormSheet) return { success: false, message: "CRM Sheet not found." };
    var data = dormSheet.getDataRange().getValues();
    var escalations = [];
    for (var i = 1; i < data.length; i++) {
      var feedback = String(data[i][11]); 
      if (feedback.indexOf("⚠️ [ADMIN REVIEW REQUESTED]") !== -1) {
        var rawDate = data[i][13];
        var dateStr = (rawDate instanceof Date) ? Utilities.formatDate(rawDate, "Asia/Kolkata", "dd-MMM hh:mm a") : String(rawDate);
        escalations.push({
          logId: data[i][0], cpn: data[i][2], name: data[i][3], phone: data[i][4],
          remark: feedback.replace("⚠️ [ADMIN REVIEW REQUESTED] - ", ""), agent: data[i][12], date: dateStr, rowIdx: i + 1 
        });
      }
    }
    escalations.reverse();
    return { success: true, data: escalations };
  } catch (e) { return { success: false, message: e.toString() }; }
}

function resolveCRMEscalation(logId, rowIdx, adminNotes) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var crmSs = SpreadsheetApp.openById(CRM_SPREADSHEET_ID);
    var dormSheet = crmSs.getSheetByName('DORMANT_CALL_LOGS');
    if (dormSheet.getRange(rowIdx, 1).getValue() !== logId) return { success: false, message: "Database shift detected. Please refresh." };
    var currentFeedback = dormSheet.getRange(rowIdx, 12).getValue();
    var updatedFeedback = currentFeedback.replace("⚠️ [ADMIN REVIEW REQUESTED]", "✅ [RESOLVED by Admin: " + adminNotes + "]");
    dormSheet.getRange(rowIdx, 12).setValue(updatedFeedback);
    return { success: true, message: "Ticket resolved successfully." };
  } catch (e) { return { success: false, message: e.toString() }; } 
  finally { lock.releaseLock(); }
}
