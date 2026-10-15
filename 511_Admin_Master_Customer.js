// ==========================================
// 511_Admin_Master_Customer.gs
// MANAGE MASTER CUSTOMER DATABASE
// ==========================================

function fetchMasterCustomers() {
  try {
    var ss = SpreadsheetApp.openById(MASTER_SPREADSHEET_ID);
    var sheet = ss.getSheetByName('DATABASE');
    var data = sheet.getDataRange().getValues();
    
    var customers = [];
    for (var i = 3; i < data.length; i++) {
      if (!String(data[i][1]).trim()) continue; 
      
      customers.push({
        sno: data[i][0],
        cpn: data[i][1],
        apt: data[i][2],
        blk: data[i][3],
        door: data[i][4],
        sheetName: data[i][5],
        poc1: data[i][6],
        con1: data[i][7],
        poc2: data[i][8],
        con2: data[i][9],
        con3: data[i][10],
        payType: data[i][11],
        clientStatus: data[i][12],
        gc: data[i][13],
        os: data[i][14],
        createdDate: (data[i][15] instanceof Date) ? Utilities.formatDate(data[i][15], "Asia/Kolkata", "dd-MMM-yyyy") : data[i][15],
        clientStatusNew: data[i][17],
        finalStatus: data[i][18],
        inactiveReason: data[i][19],
        defaultRate: data[i][26],
        delColor: data[i][27],
        delRemark: data[i][28],
        passwordSet: (String(data[i][32]).trim() !== ""),
        advance: Number(data[i][33]) || 0,
        overdueWaiver: data[i][34],
        maxOrdD: data[i][35],
        maxOrdE: data[i][36],
        email: data[i][37],
        prevMonWaiver: data[i][40],
        prevMonWaiverDays: data[i][41],
        rowIdx: i + 1
      });
    }
    return { success: true, data: customers.reverse() };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

function fetchDynamicStatuses() {
  try {
    var ss = SpreadsheetApp.openById(MASTER_SPREADSHEET_ID);
    var setupSheet = ss.getSheetByName('SETUP');
    if (!setupSheet) return { success: false, data: ['Active', 'Inactive'] };
    
    // Column AG is 33
    var data = setupSheet.getRange(3, 33, setupSheet.getLastRow() - 2, 1).getValues();
    var statuses = [];
    for (var i = 0; i < data.length; i++) {
      if (data[i][0] && String(data[i][0]).trim() !== "") {
        statuses.push(String(data[i][0]).trim());
      }
    }
    return { success: true, data: statuses };
  } catch (e) {
    return { success: false, data: ['Active', 'Inactive'] };
  }
}

function insertNewCustomer(payload) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    var ss = SpreadsheetApp.openById(MASTER_SPREADSHEET_ID);
    var sheet = ss.getSheetByName('DATABASE');
    var data = sheet.getDataRange().getValues();
    
    // --- 🚨 STRICT DUPLICATE CON 1 CHECK 🚨 ---
    var incomingCon = String(payload.con1).trim();
    for (var d = 3; d < data.length; d++) {
      var existingCon = String(data[d][7]).trim(); // Column H (CON 1)
      if (existingCon === incomingCon && incomingCon !== "") {
        return { success: false, message: "Duplicate Alert: Contact number " + incomingCon + " is already registered to " + String(data[d][1]).trim() + "." };
      }
    }
    // ------------------------------------------
    
    var maxSno = 0;
    for (var i = 3; i < data.length; i++) {
      var currentSno = parseInt(data[i][0], 10);
      if (!isNaN(currentSno) && currentSno > maxSno) maxSno = currentSno;
    }
    
    var newSno = maxSno + 1;
    var newCpn = "CPN" + newSno;
    var targetRow = sheet.getLastRow() + 1;
    var today = new Date();
    
    var newRow = new Array(42).fill("");
    newRow[0] = newSno;                // A: SNO
    newRow[1] = newCpn;                // B: CPNNO
    newRow[2] = payload.apt;           // C: APARTMENT
    newRow[3] = payload.blk;           // D: BLOCK
    newRow[4] = payload.door;          // E: DOOR
    newRow[5] = payload.sheetName;     // F: SHEET NAME
    newRow[6] = payload.poc1;          // G: POC1
    newRow[7] = payload.con1;          // H: CON 1
    newRow[8] = payload.poc2;          // I: POC 2
    newRow[11] = payload.payType;      // L: PAY TYPE
    newRow[15] = today;                // P: CREATED DATE
    newRow[18] = "Active";             // S: FINAL STATUS (Default)
    newRow[26] = payload.defaultRate;  // AA: DEFAULT RATE
    newRow[27] = payload.delColor;     // AB: DELIVERY COLOR
    newRow[28] = payload.delRemark;    // AC: DELIVERY REMARK
    newRow[33] = payload.advance;      // AH: ADVANCE
    newRow[34] = payload.overdueWaiver;// AI: OVERDUE WAIVER
    newRow[35] = payload.maxOrdD;      // AJ: MAX ORD D
    newRow[36] = payload.maxOrdE;      // AK: MAX ORD E
    newRow[37] = payload.email;        // AL: EMAIL ID
    newRow[40] = payload.prevMonWaiver;// AO: PREV MON WAIVER
    newRow[41] = payload.prevMonWaiverDays; // AP: PREV MON WAIVER DAYS
    
    sheet.getRange(targetRow, 1, 1, 42).setValues([newRow]);
    return { success: true, message: "Customer " + newCpn + " added successfully!", newCpn: newCpn };
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

function updateCustomerPart(cpn, partNo, payload) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var ss = SpreadsheetApp.openById(MASTER_SPREADSHEET_ID);
    var sheet = ss.getSheetByName('DATABASE');
    var data = sheet.getDataRange().getValues();
    var targetRow = -1;
    
    for (var i = 3; i < data.length; i++) {
      if (String(data[i][1]).trim().toUpperCase() === String(cpn).trim().toUpperCase()) {
        targetRow = i + 1;
        break;
      }
    }
    
    if (targetRow === -1) return { success: false, message: "CPN not found." };
    
    if (partNo === 1) { 
      // --- 🚨 STRICT DUPLICATE CON 1 CHECK (EXCLUDING CURRENT CPN) 🚨 ---
      var incomingCon = String(payload.con1).trim();
      var cleanCpn = String(cpn).trim().toUpperCase();
      
      for (var j = 3; j < data.length; j++) {
        var existingCpn = String(data[j][1]).trim().toUpperCase();
        var existingCon = String(data[j][7]).trim(); // Column H (CON 1)
        
        if (existingCon === incomingCon && existingCpn !== cleanCpn && incomingCon !== "") {
           return { success: false, message: "Duplicate Alert: Contact number " + incomingCon + " is already in use by " + existingCpn + "." };
        }
      }
      // ------------------------------------------------------------------
      
      var p1 = [[payload.apt, payload.blk, payload.door, payload.sheetName, payload.poc1, payload.con1, payload.poc2, payload.con2, payload.con3, payload.payType, payload.clientStatus, payload.gc, payload.os]];
      sheet.getRange(targetRow, 3, 1, 13).setValues(p1);
      sheet.getRange(targetRow, 18).setValue(payload.clientStatusNew);
      sheet.getRange(targetRow, 38).setValue(payload.email);
    }
    else if (partNo === 2) { 
      sheet.getRange(targetRow, 19, 1, 2).setValues([[payload.finalStatus, payload.inactiveReason]]); 
    } 
    else if (partNo === 3) { 
      sheet.getRange(targetRow, 27, 1, 3).setValues([[payload.defaultRate, payload.delColor, payload.delRemark]]); 
    } 
    else if (partNo === 4) { 
      sheet.getRange(targetRow, 33).clearContent(); 
    } 
    else if (partNo === 5) { 
      sheet.getRange(targetRow, 34).setValue(payload.advance); 
    } 
    else if (partNo === 6) { 
      sheet.getRange(targetRow, 35, 1, 3).setValues([[payload.overdueWaiver, payload.maxOrdD, payload.maxOrdE]]); 
      sheet.getRange(targetRow, 41, 1, 2).setValues([[payload.prevMonWaiver, payload.prevMonWaiverDays]]); 
    }

    return { success: true, message: "Profile updated successfully." };
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

function validateAndDeleteCustomer(cpn) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var cleanCpn = String(cpn).trim().toUpperCase();

    // 1. Check ORD2 (Active Orders)
    var ordSheet = SpreadsheetApp.openById(ENTRY_SPREADSHEET_ID).getSheetByName('ORD2');
    if (ordSheet && ordSheet.getLastRow() >= 3) {
      var ordData = ordSheet.getDataRange().getValues();
      for (var i = 3; i < ordData.length; i++) {
        if (String(ordData[i][11] || ordData[i][3] || "").trim().toUpperCase() === cleanCpn) {
          return { success: false, message: "Deletion blocked: Active entry found in ORD2." };
        }
      }
    }

    // 2. Check DEL2 (Active Deliveries)
    var delSheet = SpreadsheetApp.openById(ENTRY_SPREADSHEET_ID).getSheetByName('DEL2');
    if (delSheet && delSheet.getLastRow() >= 3) {
      var delData = delSheet.getDataRange().getValues();
      for (var d = 3; d < delData.length; d++) {
        if (String(delData[d][11] || "").trim().toUpperCase() === cleanCpn) {
          return { success: false, message: "Deletion blocked: Active entry found in DEL2." };
        }
      }
    }

    // 3. Check SALES History
    var salesSheet = SpreadsheetApp.openById(HISTORY_SPREADSHEET_ID).getSheetByName('SALES');
    if (salesSheet && salesSheet.getLastRow() >= 2) {
      var salesData = salesSheet.getDataRange().getValues();
      for (var s = 1; s < salesData.length; s++) {
        if (String(salesData[s][11] || "").trim().toUpperCase() === cleanCpn) {
          return { success: false, message: "Deletion blocked: Historical records exist in SALES." };
        }
      }
    }

    // 4. Check PAYS History
    var paysSheet = SpreadsheetApp.openById(HISTORY_SPREADSHEET_ID).getSheetByName('PAYS');
    if (paysSheet && paysSheet.getLastRow() >= 2) {
      var paysData = paysSheet.getDataRange().getValues();
      for (var p = 2; p < paysData.length; p++) {
        if (String(paysData[p][11] || "").trim().toUpperCase() === cleanCpn) {
          return { success: false, message: "Deletion blocked: Historical records exist in PAYS." };
        }
      }
    }

    // 5. Safe to Delete from DATABASE
    var dbSheet = SpreadsheetApp.openById(MASTER_SPREADSHEET_ID).getSheetByName('DATABASE');
    var dbData = dbSheet.getDataRange().getValues();
    for (var r = 3; r < dbData.length; r++) {
      if (String(dbData[r][1] || "").trim().toUpperCase() === cleanCpn) {
        dbSheet.deleteRow(r + 1);
        return { success: true, message: "Customer " + cleanCpn + " successfully deleted from Master Database." };
      }
    }

    return { success: false, message: "Customer profile row not located." };
  } catch (e) {
    return { success: false, message: "Validation error: " + e.toString() };
  } finally {
    lock.releaseLock();
  }
}