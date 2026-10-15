// ==========================================
// 515_Admin_Tran_Pays.gs - Pays Management & Double-Entry Accounting
// ==========================================

function fetchPaysCrudRecords(startDateStr, endDateStr) {
  try {
    var sheet = SpreadsheetApp.openById(HISTORY_SPREADSHEET_ID).getSheetByName('PAYS');
    var data = sheet.getDataRange().getValues();
    if (data.length < 3) return { success: true, data: [] };

    var records = [];
    var tz = Session.getScriptTimeZone();
    
    // Parse Dates for Filtering
    var startTimestamp = new Date(startDateStr).setHours(0, 0, 0, 0);
    var endTimestamp = new Date(endDateStr).setHours(23, 59, 59, 999);

    for (var i = 2; i < data.length; i++) { // Row 3 onwards
      var row = data[i];
      var cpn = String(row[11] || "").trim(); // CPNNO is Col L (idx 11)
      if (!cpn) continue;

      var rowDate = row[12]; // PAY DATE is Col M (idx 12)
      var rowTimestamp = new Date(rowDate).getTime();

      // Date Filter Application
      if (rowTimestamp >= startTimestamp && rowTimestamp <= endTimestamp) {
        var uniqueNo = String(row[21] || "").trim(); // Unique ID fallback
        
        records.push({
          rowIdx: i + 1,
          cpn: cpn,
          payDate: rowDate instanceof Date ? Utilities.formatDate(rowDate, tz, "yyyy-MM-dd") : String(rowDate || ""),
          amount: Number(row[13]) || 0,
          mode: String(row[17] || "ONLINE"),
          remark: String(row[18] || ""),
          uniqueNo: uniqueNo || ("PAY_" + i)
        });
      }
    }

    return { success: true, data: records.reverse() };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

function savePaysCrudRecord(payload) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var sheet = SpreadsheetApp.openById(HISTORY_SPREADSHEET_ID).getSheetByName('PAYS');
    var accSs = SpreadsheetApp.openById(ACCOUNTS_SPREADSHEET_ID);
    var cashSheet = accSs.getSheetByName('CASH');

    var timestamp = new Date();
    var tz = Session.getScriptTimeZone();
    var dateTimeStr = Utilities.formatDate(timestamp, tz, "dd/MM/yyyy HH:mm:ss");
    var dateStr = payload.payDate; 
    var currentUser = Session.getActiveUser().getEmail() || "Admin";

    var debitAccount = (payload.mode === "CASH") ? "CASH" : "SOUTH INDIAN BANK";
    var cleanCpn = String(payload.cpn).trim().toUpperCase();

    if (payload.isEdit) {
      var data = sheet.getDataRange().getValues();
      var targetRow = -1;
      for (var i = 2; i < data.length; i++) {
        if (String(data[i][21] || "").trim() === payload.uniqueNo || String("PAY_" + (i + 1)) === payload.uniqueNo) {
          targetRow = i + 1;
          break;
        }
      }
      if (targetRow === -1) return { success: false, message: "Payment row not found for update." };

      sheet.getRange(targetRow, 12).setValue(cleanCpn); // CPNNO
      sheet.getRange(targetRow, 13).setValue(payload.payDate); // Date
      sheet.getRange(targetRow, 14).setValue(payload.amount); // Amount
      sheet.getRange(targetRow, 18).setValue(payload.mode); // Mode
      sheet.getRange(targetRow, 19).setValue(payload.remark); // Remark

      // Double-Entry Sync (Update ACCOUNTS)
      if (cashSheet) {
        var cashData = cashSheet.getDataRange().getValues();
        for (var c = 1; c < cashData.length; c++) {
          var refId = String(cashData[c][10] || "").trim(); // Col K (TxnID)
          if (refId === payload.uniqueNo) {
            // Found Credit Row
            cashSheet.getRange(c + 1, 4).setValue(dateStr); // Date
            cashSheet.getRange(c + 1, 7).setValue(payload.amount); // Credit Amt
            cashSheet.getRange(c + 1, 9).setValue(payload.remark); // Remark
            cashSheet.getRange(c + 1, 12).setValue(cleanCpn); // CPN
            cashSheet.getRange(c + 1, 17).setValue(payload.mode); // Mode
          } else if (refId === payload.uniqueNo + "-DR") {
            // Found Debit Row
            cashSheet.getRange(c + 1, 3).setValue(debitAccount); // Update Account Name
            cashSheet.getRange(c + 1, 4).setValue(dateStr); // Date
            cashSheet.getRange(c + 1, 8).setValue(payload.amount); // Debit Amt
            cashSheet.getRange(c + 1, 9).setValue(payload.remark); // Remark
            cashSheet.getRange(c + 1, 12).setValue(cleanCpn); // CPN
            cashSheet.getRange(c + 1, 17).setValue(payload.mode); // Mode
          }
        }
      }

      return { success: true, message: "Payment & Ledger updated successfully." };

    } else {
      // --- CREATE NEW RECORD ---
      var newUniqueNo = "PAY_" + Utilities.formatDate(timestamp, "IST", "yyyyMMddHHmmss") + "_" + Math.random().toString().replace(".", "_");
      var newRow = new Array(25).fill("");

      newRow[11] = cleanCpn; // CPNNO
      newRow[12] = payload.payDate; // Date
      newRow[13] = payload.amount; // Amount
      newRow[17] = payload.mode; // Mode
      newRow[18] = payload.remark; // Remark
      newRow[21] = newUniqueNo; // Unique reference
      newRow[23] = timestamp;
      newRow[24] = currentUser;

      sheet.appendRow(newRow);

      // Double-Entry Sync (Insert to ACCOUNTS)
      // Format: [Account, Date, Description, Ref, CreditAmt, DebitAmt, Remark, "", Timestamp, CPN, TxnID, Timestamp, User, "", Mode]
      var customerCreditRow = [
        "CUSTOMER", payload.payDate, payload.mode + " Collection", "PAY: " + newUniqueNo, payload.amount, "", payload.remark, "", dateTimeStr, cleanCpn, newUniqueNo, dateTimeStr, currentUser, "", payload.mode
      ];

      var gatewayDebitRow = [
        debitAccount, payload.payDate, "Collection from " + cleanCpn, "PAY: " + newUniqueNo, "", payload.amount, payload.remark, "", dateTimeStr, cleanCpn, newUniqueNo + "-DR", dateTimeStr, currentUser, "", payload.mode
      ];

      if (cashSheet) {
        var accLastRow = cashSheet.getLastRow();
        cashSheet.getRange(accLastRow + 1, 3, 1, 15).setValues([customerCreditRow]);
        cashSheet.getRange(accLastRow + 2, 3, 1, 15).setValues([gatewayDebitRow]);
      }

      return { success: true, message: "Payment logged and synced to General Ledger successfully." };
    }
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

function deletePaysCrudRecord(uniqueNo) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    
    // 1. Delete from PAYS
    var sheet = SpreadsheetApp.openById(HISTORY_SPREADSHEET_ID).getSheetByName('PAYS');
    var data = sheet.getDataRange().getValues();
    for (var i = 2; i < data.length; i++) {
      if (String(data[i][21] || "").trim() === String(uniqueNo).trim() || String("PAY_" + (i + 1)) === String(uniqueNo)) {
        sheet.deleteRow(i + 1);
        break;
      }
    }

    // 2. Delete from ACCOUNTS (Double Entry Cleanup)
    var accSs = SpreadsheetApp.openById(ACCOUNTS_SPREADSHEET_ID);
    var cashSheet = accSs.getSheetByName('CASH');
    if (cashSheet) {
      var cashData = cashSheet.getDataRange().getValues();
      var rowsToDelete = [];
      for (var c = 1; c < cashData.length; c++) {
        var refId = String(cashData[c][10] || "").trim(); // Col K (TxnID)
        if (refId === uniqueNo || refId === uniqueNo + "-DR") {
          rowsToDelete.push(c + 1);
        }
      }
      
      // Delete from bottom to top to preserve row indices
      rowsToDelete.sort(function(a, b){return b - a});
      for (var r = 0; r < rowsToDelete.length; r++) {
        cashSheet.deleteRow(rowsToDelete[r]);
      }
    }

    return { success: true, message: "Payment record and ledger entries completely deleted." };
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}