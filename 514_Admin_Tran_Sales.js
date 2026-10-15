// ==========================================
// 514_Admin_Tran_Sales.gs - Sales Management
// ==========================================

function fetchSalesCrudRecords(startDateStr, endDateStr) {
  try {
    var sheet = SpreadsheetApp.openById(HISTORY_SPREADSHEET_ID).getSheetByName('SALES');
    var data = sheet.getDataRange().getValues();
    if (data.length < 2) return { success: true, data: [] };

    var records = [];
    var tz = Session.getScriptTimeZone();
    
    // Parse Dates for Filtering
    var startTimestamp = new Date(startDateStr).setHours(0, 0, 0, 0);
    var endTimestamp = new Date(endDateStr).setHours(23, 59, 59, 999);

    //i=2 - data row starts from 2nd row
    for (var i = 2; i < data.length; i++) { 
      var row = data[i];
      
      var cpn = String(row[11] || "").trim(); // CPNNO is Col L (idx 11)
      var isMissingCpn = !cpn;
      if (isMissingCpn) cpn = "⚠️ MISSING CPN"; // Prevents silent ghost rows
      
      var rowDate = row[15]; // DEL DATE is Col P (idx 15)
      var rowTimestamp = new Date(rowDate).getTime();
      var isCorruptedDate = isNaN(rowTimestamp);
      
      // Date Filter Application (Show it if it matches, OR if it's corrupted so Admin can fix it)
      if ((!isCorruptedDate && rowTimestamp >= startTimestamp && rowTimestamp <= endTimestamp) || isMissingCpn || isCorruptedDate) {
        var uniqueNo = String(row[24] || "").trim(); // UNIQUENO is Col Y (idx 24)
        
        records.push({
          rowIdx: i + 1,
          cpn: cpn.toUpperCase(),
          delDate: rowDate instanceof Date ? Utilities.formatDate(rowDate, tz, "yyyy-MM-dd") : String(rowDate || "⚠️ BAD DATE"),
          actD: Number(row[16]) || 0,
          actE: Number(row[17]) || 0,
          rate: Number(row[18]) || 0,
          ordComment: String(row[19] || ""), // Col T
          delComment: String(row[20] || ""), // Col U
          doorLink: String(row[21] || ""),   // Col V
          amount: Number(row[23]) || 0,      // Col X
          uniqueNo: uniqueNo,                // Col Y
          enterOn: row[27] instanceof Date ? Utilities.formatDate(row[27], tz, "yyyy-MM-dd HH:mm") : String(row[27] || ""), // Col AB
          enterBy: String(row[28] || ""),    // Col AC
          vjFull: Number(row[55]) || 0,      // ACT D VJ (Col BD)
          nvjFull: Number(row[56]) || 0,     // ACT D NVJ (Col BE)
          vjEmp: Number(row[57]) || 0,       // ACT E VJ (Col BF)
          nvjEmp: Number(row[58]) || 0       // ACT E NVJ (Col BG)
        });
      }
    }

    return { success: true, data: records.reverse() };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

function saveSalesCrudRecord(payload) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var sheet = SpreadsheetApp.openById(HISTORY_SPREADSHEET_ID).getSheetByName('SALES');
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    
    var timestamp = new Date();
    var currentUser = Session.getActiveUser().getEmail() || "Admin";

    // SERVER-SIDE VALIDATION: Force numbers, fallback to 0 to prevent NaN corruption
    var vjFull = Number(payload.vjFull) || 0;
    var nvjFull = Number(payload.nvjFull) || 0;
    var vjEmp = Number(payload.vjEmp) || 0;
    var nvjEmp = Number(payload.nvjEmp) || 0;
    var rate = Number(payload.rate) || 0;
    
    var actD = vjFull + nvjFull;
    var actE = vjEmp + nvjEmp;
    var amount = actD * rate;
    
    var cleanCpn = String(payload.cpn).trim().toUpperCase();

    if (payload.uniqueNo) {
      // --- UPDATE EXISTING RECORD ---
      var targetRow = -1;
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][24] || "").trim() === payload.uniqueNo) {
          targetRow = i + 1;
          break;
        }
      }
      if (targetRow === -1) return { success: false, message: "Record uniquely identified not found." };

      sheet.getRange(targetRow, 12).setValue(cleanCpn);             // Col L
      sheet.getRange(targetRow, 16).setValue(payload.delDate);      // Col P
      sheet.getRange(targetRow, 17).setValue(actD);                 // Col Q
      sheet.getRange(targetRow, 18).setValue(actE);                 // Col R
      sheet.getRange(targetRow, 19).setValue(rate);                 // Col S
      sheet.getRange(targetRow, 21).setValue(String(payload.delComment || "")); // Col U
      sheet.getRange(targetRow, 22).setValue(String(payload.doorLink || ""));   // Col V
      sheet.getRange(targetRow, 24).setValue(amount);               // Col X
      
      // COMPLETE AUDIT TRAIL: Log who last updated this and when
      sheet.getRange(targetRow, 28).setValue(timestamp);            // Col AB (DELIVERY ENTER ON - Last Mod)
      sheet.getRange(targetRow, 29).setValue(currentUser);          // Col AC (DELIVERY ENTER BY - Last Mod)
      
      sheet.getRange(targetRow, 56).setValue(vjFull);               // Col BD (ACT D VJ)
      sheet.getRange(targetRow, 57).setValue(nvjFull);              // Col BE (ACT D NVJ)
      sheet.getRange(targetRow, 58).setValue(vjEmp);                // Col BF (ACT E VJ)
      sheet.getRange(targetRow, 59).setValue(nvjEmp);               // Col BG (ACT E NVJ)

      return { success: true, message: "Sales record updated successfully." };

    } else {
      // --- CREATE NEW RECORD ---
      var newUniqueNo = "SALES_" + Utilities.formatDate(timestamp, "IST", "yyyyMMddHHmmss") + "_0_" + Math.random().toString().replace(".", "_");
      var newRow = new Array(headers.length).fill("");

      newRow[11] = cleanCpn;                 // Col L
      newRow[15] = payload.delDate;          // Col P
      newRow[16] = actD;                     // Col Q
      newRow[17] = actE;                     // Col R
      newRow[18] = rate;                     // Col S
      newRow[20] = String(payload.delComment || ""); // Col U
      newRow[21] = String(payload.doorLink || "");   // Col V
      newRow[23] = amount;                   // Col X
      newRow[24] = newUniqueNo;              // Col Y
      
      newRow[25] = timestamp;                // Col Z (ORDER ENTER ON)
      newRow[26] = currentUser;              // Col AA (ORDER ENTER BY)
      newRow[27] = timestamp;                // Col AB (DELIVERY ENTER ON)
      newRow[28] = currentUser;              // Col AC (DELIVERY ENTER BY)
      
      newRow[55] = vjFull;                   // Col BD (ACT D VJ)
      newRow[56] = nvjFull;                  // Col BE (ACT D NVJ)
      newRow[57] = vjEmp;                    // Col BF (ACT E VJ)
      newRow[58] = nvjEmp;                   // Col BG (ACT E NVJ)

      sheet.appendRow(newRow);
      return { success: true, message: "New Sales entry created successfully." };
    }
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

function deleteSalesCrudRecord(uniqueNo) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var sheet = SpreadsheetApp.openById(HISTORY_SPREADSHEET_ID).getSheetByName('SALES');
    var data = sheet.getDataRange().getValues();

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][24] || "").trim() === String(uniqueNo).trim()) {
        sheet.deleteRow(i + 1);
        return { success: true, message: "Sales record deleted." };
      }
    }
    return { success: false, message: "Record not found." };
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}