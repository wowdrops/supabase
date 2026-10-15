// ==========================================
// MODULE: MANAGE ORDERS BACKEND
// ==========================================

function getManageOrdersData() {
  try {
    var tz = Session.getScriptTimeZone();
    var ssEntry = SpreadsheetApp.openById(ENTRY_SPREADSHEET_ID);
    
    // --- FETCH SETUP CAPACITY METRICS (1 API Call) ---
    var setupConfig = { totalAllowed: 0, restrictQty: 0, minQty: 0 };
    try {
      var setupSheet = ssEntry.getSheetByName('SETUP');
      if (setupSheet) {
        var setupData = setupSheet.getDataRange().getValues();
        for (var i = 0; i < setupData.length; i++) {
          var row = setupData[i];
          for(var j = 0; j < row.length - 1; j++) {
             var cellVal = String(row[j]).trim().toLowerCase();
             if (cellVal === "per day can count") setupConfig.totalAllowed = Number(row[j+1]) || 0;
             if (cellVal === "lookup restrict can qty") setupConfig.restrictQty = Number(row[j+1]) || 0;
             if (cellVal === "minimum entry qty") setupConfig.minQty = Number(row[j+1]) || 0;
          }
        }
      }
    } catch(e) {}
    // ------------------------------------

    // --- BATCH READ ORD2 (1 API Call) ---
    var ordSheet = ssEntry.getSheetByName('ORD2');
    var ordData = ordSheet.getDataRange().getValues();
    if (ordData.length < 3) return { success: true, data: [], headers: {}, setupConfig: setupConfig };
    
    var hIdx = 2; 
    for(var h=0; h<Math.min(5, ordData.length); h++){
       if(String(ordData[h].join("")).toUpperCase().indexOf("CPN") > -1) { hIdx = h; break; }
    }
    var ordHeaders = ordData[hIdx]; 
    var ordColMap = {};
    ordHeaders.forEach((col, idx) => { if (col) ordColMap[String(col).trim().toUpperCase().replace(/\s+/g, '')] = idx; });

    var cpnIdx = ordColMap['CPNNO'] !== undefined ? ordColMap['CPNNO'] : (ordColMap['CPN'] !== undefined ? ordColMap['CPN'] : 11);
    var dateIdx = ordColMap['ORDDATE'];
    var ordDIdx = ordColMap['ORDD'];
    var ordEIdx = ordColMap['ORDE'];
    var pendIdx = ordColMap['PENDINGQTY'] !== undefined ? ordColMap['PENDINGQTY'] : ordColMap['PENDING_QTY'];
    var repIdx = ordColMap['REPLACEQTY'] !== undefined ? ordColMap['REPLACEQTY'] : ordColMap['REPLACE_QTY'];
    var repReaIdx = ordColMap['REPLACEREASON'] !== undefined ? ordColMap['REPLACEREASON'] : ordColMap['REPLACE_REASON'];
    var rateIdx = ordColMap['RATE'];
    var canDepIdx = ordColMap['CANDEPOSIT'] !== undefined ? ordColMap['CANDEPOSIT'] : ordColMap['CAN_DEPOSIT'];
    var cmtIdx = ordColMap['ORDCOMMENT'];
    var uniqueIdx = ordColMap['UNIQUENO'];
    var timeIdx = ordColMap['ENTERON'];
    var aptIdx = ordColMap['APARTMENT'];
    var blkIdx = ordColMap['BLK'] !== undefined ? ordColMap['BLK'] : ordColMap['BLOCK'];
    var doorIdx = ordColMap['DOOR'];
    var nameIdx = ordColMap['NAME'];
    var contactIdx = ordColMap['CONTACT'];

    // --- BATCH READ OUTSTANDING (1 API Call) ---
    var outSheet = SpreadsheetApp.openById(HISTORY_SPREADSHEET_ID).getSheetByName('OUTSTANDING');
    var outData = outSheet.getDataRange().getValues();
    var outHeaders = outData[5] || []; 
    var outLen = outHeaders.length;
    
    var outCpnIdx = 6; 
    for (var c = 0; c < outLen; c++) {
      if (String(outHeaders[c]).toUpperCase().indexOf('CPN') > -1) { outCpnIdx = c; break; }
    }
    
    var idxM1 = 16; var idxM2 = 17; var idxM3 = 18; var idxM4 = 19; var idxCans = 20; 

    var hOut = { 
      ab: String(outHeaders[idxM1] || "Very Old"), 
      ac: String(outHeaders[idxM2] || "Older"), 
      ad: String(outHeaders[idxM3] || "Previous"), 
      ae: String(outHeaders[idxM4] || "Current"), 
      af: String(outHeaders[idxCans] || "Can Count") 
    };

    var outDict = {};
    for (var i = 6; i < outData.length; i++) { 
      var outCpn = String(outData[i][outCpnIdx]).trim().toUpperCase();
      if (outCpn) {
        outDict[outCpn] = {
          m1: Number(outData[i][idxM1]) || 0, m2: Number(outData[i][idxM2]) || 0,
          m3: Number(outData[i][idxM3]) || 0, m4: Number(outData[i][idxM4]) || 0, cans: Number(outData[i][idxCans]) || 0
        };
      }
    }

    var orders = [];
    // 100% IN-MEMORY PROCESSING (Zero API Calls)
    for (var j = hIdx + 1; j < ordData.length; j++) {
      var ordCpn = String(ordData[j][cpnIdx] || "").trim().toUpperCase();
      var uniqueNo = (uniqueIdx !== undefined) ? ordData[j][uniqueIdx] : ('TEMP_' + j);
      
      if (!uniqueNo && !ordCpn) continue;

      var ledger = outDict[ordCpn] || { m1: 0, m2: 0, m3: 0, m4: 0, cans: 0 };
      var totalDue = ledger.m1 + ledger.m2 + ledger.m3 + ledger.m4;
      
      var ordDQuantity = (ordDIdx !== undefined) ? (Number(ordData[j][ordDIdx]) || 0) : 0;
      var ordRate = (rateIdx !== undefined) ? (Number(ordData[j][rateIdx]) || 0) : 0;

      orders.push({
        id: uniqueNo, rowIdx: j + 1,
        date: (dateIdx !== undefined && ordData[j][dateIdx]) ? Utilities.formatDate(new Date(ordData[j][dateIdx]), tz, "dd-MMM-yyyy") : "",
        time: (timeIdx !== undefined && ordData[j][timeIdx]) ? Utilities.formatDate(new Date(ordData[j][timeIdx]), tz, "dd/MMM HH:mm") : "",
        apt: (aptIdx !== undefined) ? ordData[j][aptIdx] : "",
        blk: (blkIdx !== undefined) ? ordData[j][blkIdx] : "",
        door: (doorIdx !== undefined) ? ordData[j][doorIdx] : "",
        cpn: ordCpn,
        name: (nameIdx !== undefined) ? ordData[j][nameIdx] : "",     
        phone: (contactIdx !== undefined) ? ordData[j][contactIdx] : "", 
        ordD: ordDQuantity,
        ordE: (ordEIdx !== undefined) ? (Number(ordData[j][ordEIdx]) || 0) : 0,
        pendQty: (pendIdx !== undefined) ? (Number(ordData[j][pendIdx]) || 0) : 0,
        repQty: (repIdx !== undefined) ? (Number(ordData[j][repIdx]) || 0) : 0,
        repReason: (repReaIdx !== undefined) ? String(ordData[j][repReaIdx]) : "",
        rate: ordRate, estAmt: ordDQuantity * ordRate,
        canDeposit: (canDepIdx !== undefined) ? (Number(ordData[j][canDepIdx]) || 0) : 0,
        outTotal: totalDue,
        outAB: ledger.m1, outAC: ledger.m2, outAD: ledger.m3, outAE: ledger.m4, outAF: ledger.cans,
        cmt: (cmtIdx !== undefined) ? ordData[j][cmtIdx] : ""
      });
    }
    return { success: true, data: orders.reverse(), headers: hOut, setupConfig: setupConfig };
  } catch (e) { return { success: false, message: e.toString() }; }
}

function insertAdminOrder(cpn, ordD, ordE, pendQty, repQty, repReason, comment, adminName, profile) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    
    // --- BACKEND FAILSAFE: ZERO ORDER BLOCKER ---
    if (Number(ordD) === 0 && Number(ordE) === 0 && Number(pendQty) === 0 && Number(repQty) === 0) {
      return { success: false, message: "Server Error: Cannot submit completely empty order quantities." };
    }
    
    // --- BACKEND FAILSAFE: MATH PROTECTOR ---
    if (Number(pendQty) > Number(ordD)) { ordD = pendQty; }
    
    var tz = Session.getScriptTimeZone();
    
    var ordSheet = SpreadsheetApp.openById(ENTRY_SPREADSHEET_ID).getSheetByName('ORD2');
    var ordData = ordSheet.getDataRange().getValues();
    
    var hIdx = 2; 
    for(var h=0; h<Math.min(5, ordData.length); h++){
       if(String(ordData[h].join("")).toUpperCase().indexOf("CPN") > -1) { hIdx = h; break; }
    }
    var ordHeader = ordData[hIdx]; 
    
    var cleanCpn = String(cpn).trim().toUpperCase();
    var ordColMap = {};
    ordHeader.forEach((col, idx) => { if (col) ordColMap[String(col).trim().toUpperCase().replace(/\s+/g, '')] = idx + 1; });
    var cpnTargetIndex = ordColMap['CPNNO'] ? ordColMap['CPNNO'] - 1 : (ordColMap['CPN'] ? ordColMap['CPN'] - 1 : 11); 

    for (var r = hIdx + 1; r < ordData.length; r++) {
      if (String(ordData[r][cpnTargetIndex]).trim().toUpperCase() === cleanCpn) return { success: false, message: "Order exists. Please edit it." };
    }

    var now = new Date();
    var uniqueNo = "ORD2_" + Utilities.formatDate(now, "IST", "yyyyMMddHHmmss") + "_" + Math.random().toString().replace(".", "_");
    var currentUser = adminName || "Admin"; 
    
    var targetRow = Math.max(ordSheet.getLastRow() + 1, hIdx + 2);
    while (ordData[targetRow - 1] && String(ordData[targetRow - 1][cpnTargetIndex] || "") !== "") { targetRow++; }

    var newRowData = new Array(ordHeader.length).fill("");
    
    if (ordColMap['APARTMENT']) newRowData[ordColMap['APARTMENT'] - 1] = profile.apt || "";
    if (ordColMap['BLK']) newRowData[ordColMap['BLK'] - 1] = profile.blk || "";
    else if (ordColMap['BLOCK']) newRowData[ordColMap['BLOCK'] - 1] = profile.blk || "";
    if (ordColMap['DOOR']) newRowData[ordColMap['DOOR'] - 1] = profile.door || "";
    if (ordColMap['NAME']) newRowData[ordColMap['NAME'] - 1] = profile.name || "";
    if (ordColMap['CONTACT']) newRowData[ordColMap['CONTACT'] - 1] = profile.contact || "";
    if (ordColMap['RATE']) newRowData[ordColMap['RATE'] - 1] = profile.rate || 0;
    if (ordColMap['CPNNO']) newRowData[ordColMap['CPNNO'] - 1] = cleanCpn;
    else if (ordColMap['CPN']) newRowData[ordColMap['CPN'] - 1] = cleanCpn;
    if (ordColMap['ORDDATE']) newRowData[ordColMap['ORDDATE'] - 1] = Utilities.formatDate(now, tz, "dd/MMM/yy");
    if (ordColMap['ORDD']) newRowData[ordColMap['ORDD'] - 1] = Number(ordD) || 0;
    if (ordColMap['ORDE']) newRowData[ordColMap['ORDE'] - 1] = Number(ordE) || 0;
    if (ordColMap['PENDINGQTY']) newRowData[ordColMap['PENDINGQTY'] - 1] = Number(pendQty) || 0;
    else if (ordColMap['PENDING_QTY']) newRowData[ordColMap['PENDING_QTY'] - 1] = Number(pendQty) || 0;
    if (ordColMap['REPLACEQTY']) newRowData[ordColMap['REPLACEQTY'] - 1] = Number(repQty) || 0;
    else if (ordColMap['REPLACE_QTY']) newRowData[ordColMap['REPLACE_QTY'] - 1] = Number(repQty) || 0;
    if (ordColMap['REPLACEREASON']) newRowData[ordColMap['REPLACEREASON'] - 1] = String(repReason).trim();
    else if (ordColMap['REPLACE_REASON']) newRowData[ordColMap['REPLACE_REASON'] - 1] = String(repReason).trim();
    if (ordColMap['ORDCOMMENT']) newRowData[ordColMap['ORDCOMMENT'] - 1] = String(comment || "").trim();
    if (ordColMap['UNIQUENO']) newRowData[ordColMap['UNIQUENO'] - 1] = uniqueNo;
    if (ordColMap['ENTERON']) newRowData[ordColMap['ENTERON'] - 1] = now;
    if (ordColMap['ENTERBY']) newRowData[ordColMap['ENTERBY'] - 1] = currentUser;
    if (ordColMap['CHECKBOX']) newRowData[ordColMap['CHECKBOX'] - 1] = false;
    if (ordColMap['CANDEPOSIT']) newRowData[ordColMap['CANDEPOSIT'] - 1] = profile.advanceDepositAmount;
    if (ordColMap['STATUS']) newRowData[ordColMap['STATUS'] - 1] = "NEW";
    
    var estAmt = (Number(ordD) || 0) * (profile.rate || 0);
    if (ordColMap['AMOUNT']) newRowData[ordColMap['AMOUNT'] - 1] = estAmt;

    ordSheet.getRange(targetRow, 1, 1, ordHeader.length).setValues([newRowData]);

    return { 
      success: true, message: "Order logged instantly.",
      data: {
        id: uniqueNo, rowIdx: targetRow,
        date: Utilities.formatDate(now, tz, "dd-MMM-yyyy"), time: Utilities.formatDate(now, tz, "dd/MMM HH:mm"),
        apt: profile.apt || "", blk: profile.blk || "", door: profile.door || "", cpn: cleanCpn,
        name: profile.name || "", phone: profile.contact || "",
        ordD: Number(ordD) || 0, ordE: Number(ordE) || 0, pendQty: Number(pendQty) || 0, repQty: Number(repQty) || 0, repReason: String(repReason).trim(),
        rate: profile.rate || 0, estAmt: estAmt, canDeposit: profile.advanceDepositAmount || 0,
        outTotal: profile.outTotal || 0, outAB: profile.outM1 || 0, outAC: profile.outM2 || 0, outAD: profile.outM3 || 0, outAE: profile.outM4 || 0, outAF: profile.cans || 0,          
        cmt: String(comment || "").trim()
      }
    };
  } catch (e) { return { success: false, message: e.toString() }; } finally { lock.releaseLock(); }
}

function updateAdminOrder(uniqueId, rowIdx, cpn, ordD, ordE, pendQty, repQty, repReason, comment, adminName, profile) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    
    // --- BACKEND FAILSAFE: ZERO ORDER BLOCKER ---
    if (Number(ordD) === 0 && Number(ordE) === 0 && Number(pendQty) === 0 && Number(repQty) === 0) {
      return { success: false, message: "Server Error: Cannot submit completely empty order quantities." };
    }
    
    // --- BACKEND FAILSAFE: MATH PROTECTOR ---
    if (Number(pendQty) > Number(ordD)) { ordD = pendQty; }
    
    var tz = Session.getScriptTimeZone();
    
    var ordSheet = SpreadsheetApp.openById(ENTRY_SPREADSHEET_ID).getSheetByName('ORD2');
    var ordData = ordSheet.getDataRange().getValues();
    
    var hIdx = 2; 
    for(var h=0; h<Math.min(5, ordData.length); h++){
       if(String(ordData[h].join("")).toUpperCase().indexOf("CPN") > -1) { hIdx = h; break; }
    }
    var ordHeader = ordData[hIdx]; 
    
    var ordColMap = {};
    ordHeader.forEach((col, idx) => { if (col) ordColMap[String(col).trim().toUpperCase().replace(/\s+/g, '')] = idx + 1; });
    var cleanCpn = String(cpn).trim().toUpperCase();
    var targetRowNo = -1;
    var existingRowData = null;

    if (ordColMap['UNIQUENO'] && uniqueId) {
      for (var r = hIdx + 1; r < ordData.length; r++) {
        if (String(ordData[r][ordColMap['UNIQUENO'] - 1]).trim() === String(uniqueId).trim()) {
          targetRowNo = r + 1;
          existingRowData = ordData[r];
          break;
        }
      }
    }

    if (targetRowNo === -1 && rowIdx) {
      var fallbackRowData = ordData[rowIdx - 1]; 
      var fallbackCpn = fallbackRowData ? String(fallbackRowData[ordColMap['CPNNO'] ? ordColMap['CPNNO'] - 1 : (ordColMap['CPN'] ? ordColMap['CPN'] - 1 : 11)]).trim().toUpperCase() : "";
      if (fallbackCpn === cleanCpn) {
        targetRowNo = rowIdx; 
        existingRowData = fallbackRowData;
        var newUniqueId = "ORD2_" + Utilities.formatDate(new Date(), "IST", "yyyyMMddHHmmss") + "_FIX";
        if (ordColMap['UNIQUENO']) existingRowData[ordColMap['UNIQUENO'] - 1] = newUniqueId; 
      }
    }

    if (targetRowNo === -1) return { success: false, message: "Order not found in database." };

    var now = new Date();
    var currentUser = adminName || "Admin";

    if (ordColMap['APARTMENT']) existingRowData[ordColMap['APARTMENT'] - 1] = profile.apt || "";
    if (ordColMap['BLK']) existingRowData[ordColMap['BLK'] - 1] = profile.blk || "";
    else if (ordColMap['BLOCK']) existingRowData[ordColMap['BLOCK'] - 1] = profile.blk || "";
    if (ordColMap['DOOR']) existingRowData[ordColMap['DOOR'] - 1] = profile.door || "";
    if (ordColMap['NAME']) existingRowData[ordColMap['NAME'] - 1] = profile.name || "";
    if (ordColMap['CONTACT']) existingRowData[ordColMap['CONTACT'] - 1] = profile.contact || "";
    if (ordColMap['RATE']) existingRowData[ordColMap['RATE'] - 1] = profile.rate || 0;
    if (ordColMap['CPNNO']) existingRowData[ordColMap['CPNNO'] - 1] = cleanCpn;
    else if (ordColMap['CPN']) existingRowData[ordColMap['CPN'] - 1] = cleanCpn;
    if (ordColMap['ORDDATE']) existingRowData[ordColMap['ORDDATE'] - 1] = Utilities.formatDate(now, tz, "dd/MMM/yy");
    if (ordColMap['ORDD']) existingRowData[ordColMap['ORDD'] - 1] = Number(ordD) || 0;
    if (ordColMap['ORDE']) existingRowData[ordColMap['ORDE'] - 1] = Number(ordE) || 0;
    if (ordColMap['PENDINGQTY']) existingRowData[ordColMap['PENDINGQTY'] - 1] = Number(pendQty) || 0;
    else if (ordColMap['PENDING_QTY']) existingRowData[ordColMap['PENDING_QTY'] - 1] = Number(pendQty) || 0;
    if (ordColMap['REPLACEQTY']) existingRowData[ordColMap['REPLACEQTY'] - 1] = Number(repQty) || 0;
    else if (ordColMap['REPLACE_QTY']) existingRowData[ordColMap['REPLACE_QTY'] - 1] = Number(repQty) || 0;
    if (ordColMap['REPLACEREASON']) existingRowData[ordColMap['REPLACEREASON'] - 1] = String(repReason).trim();
    else if (ordColMap['REPLACE_REASON']) existingRowData[ordColMap['REPLACE_REASON'] - 1] = String(repReason).trim();
    if (ordColMap['ORDCOMMENT']) {
        if (comment !== undefined && comment !== null) existingRowData[ordColMap['ORDCOMMENT'] - 1] = String(comment).trim();
    }
    if (ordColMap['ENTERON']) existingRowData[ordColMap['ENTERON'] - 1] = now;
    if (ordColMap['ENTERBY']) existingRowData[ordColMap['ENTERBY'] - 1] = currentUser;
    if (ordColMap['CANDEPOSIT']) existingRowData[ordColMap['CANDEPOSIT'] - 1] = profile.advanceDepositAmount;
    if (ordColMap['STATUS']) existingRowData[ordColMap['STATUS'] - 1] = "MODIFIED";
    if (ordColMap['AMOUNT']) existingRowData[ordColMap['AMOUNT'] - 1] = (Number(ordD) || 0) * (profile.rate || 0);

    ordSheet.getRange(targetRowNo, 1, 1, ordHeader.length).setValues([existingRowData]);
    return { success: true, message: "Order updated successfully by " + currentUser };
  } catch (e) { return { success: false, message: e.toString() }; } finally { lock.releaseLock(); }
}

function batchTransferOrd2ToDel2(selectedRowIndices) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    var ssEntry = SpreadsheetApp.openById(ENTRY_SPREADSHEET_ID);

    var delSheet = ssEntry.getSheetByName('DEL2');
    if (delSheet.getLastRow() >= 4) {
      return { success: false, message: "CRITICAL: DEL2 is not empty. You must complete Delivery QC before transferring new orders." };
    }

    var ordSheet = ssEntry.getSheetByName('ORD2');
    var ordData = ordSheet.getDataRange().getValues();
    
    var ordHIdx = 2; 
    for(var h=0; h<Math.min(5, ordData.length); h++){
       if(String(ordData[h].join("")).toUpperCase().indexOf("CPN") > -1) { ordHIdx = h; break; }
    }
    var ordHeaders = ordData[ordHIdx]; 
    var ordColMap = {};
    ordHeaders.forEach((h, i) => { if(h) ordColMap[String(h).trim().toUpperCase().replace(/\s+/g, '')] = i; });

    var delData = delSheet.getDataRange().getValues();
    var delHIdx = 2; 
    for(var h=0; h<Math.min(5, delData.length); h++){
       if(String(delData[h].join("")).toUpperCase().indexOf("CPN") > -1) { delHIdx = h; break; }
    }
    var delHeaders = delData[delHIdx]; 
    var delColMap = {};
    delHeaders.forEach((h, i) => { if(h) delColMap[String(h).trim().toUpperCase().replace(/\s+/g, '')] = i; });

    var timestamp = new Date();
    var currentUser = Session.getActiveUser().getEmail() || "Admin";
    var newDelRows = [];
    
    var numericRowIndices = selectedRowIndices.map(Number);

    for (var i = 0; i < numericRowIndices.length; i++) {
      var rowIdx = numericRowIndices[i] - 1;
      var row = ordData[rowIdx];
      var delRow = new Array(delHeaders.length).fill("");

      function copyCol(hNameStr, fallbackVal) {
        var hName = hNameStr.toUpperCase().replace(/\s+/g, '');
        var ordIdx = ordColMap[hName];
        var delIdx = delColMap[hName];
        if (delIdx !== undefined) {
          if (ordIdx !== undefined && row[ordIdx] !== undefined && row[ordIdx] !== "") {
            delRow[delIdx] = row[ordIdx];
          } else if (fallbackVal !== undefined) {
            delRow[delIdx] = fallbackVal;
          }
        }
      }

      copyCol('SNO'); copyCol('APARTMENT'); copyCol('BLK'); copyCol('BLOCK'); copyCol('DOOR');
      copyCol('NAME'); copyCol('CONTACT'); copyCol('DEFRATE'); copyCol('CANDEPOSIT'); copyCol('RESERVE1');
      copyCol('RESERVE2'); copyCol('RESERVE3'); copyCol('RESERVED5');
      copyCol('CPNNO'); copyCol('CPN'); copyCol('ORDDATE'); copyCol('ORDD'); copyCol('ORDE');
      copyCol('RATE'); copyCol('ORDCOMMENT');
      copyCol('STATUS'); copyCol('PENDINGQTY'); copyCol('PENDING_QTY'); 
      copyCol('REPLACEQTY'); copyCol('REPLACE_QTY'); copyCol('REPLACEREASON'); copyCol('REPLACE_REASON');

      var ordDVal = (ordColMap['ORDD'] !== undefined) ? (Number(row[ordColMap['ORDD']]) || 0) : 0;
      var rateVal = (ordColMap['RATE'] !== undefined) ? (Number(row[ordColMap['RATE']]) || 0) : 0;
      var amtVal = (ordColMap['AMOUNT'] !== undefined && row[ordColMap['AMOUNT']] !== "") ? row[ordColMap['AMOUNT']] : (ordDVal * rateVal);
      if (delColMap['AMOUNT'] !== undefined) delRow[delColMap['AMOUNT']] = amtVal;

      var uniqueNo = (ordColMap['UNIQUENO'] !== undefined && row[ordColMap['UNIQUENO']]) 
        ? String(row[ordColMap['UNIQUENO']]).trim() 
        : "ORD2_" + Utilities.formatDate(timestamp, "IST", "yyyyMMddHHmmss") + "_" + Math.random().toString().replace(".", "_");
      if (delColMap['UNIQUENO'] !== undefined) delRow[delColMap['UNIQUENO']] = uniqueNo;

      if (delColMap['ORDERENTERON'] !== undefined) delRow[delColMap['ORDERENTERON']] = row[ordColMap['ENTERON']] || timestamp;
      else if (delColMap['ENTERON'] !== undefined) delRow[delColMap['ENTERON']] = row[ordColMap['ENTERON']] || timestamp;

      if (delColMap['ORDERENTERBY'] !== undefined) delRow[delColMap['ORDERENTERBY']] = row[ordColMap['ENTERBY']] || currentUser;
      else if (delColMap['ENTERBY'] !== undefined) delRow[delColMap['ENTERBY']] = row[ordColMap['ENTERBY']] || currentUser;

      newDelRows.push(delRow);
    }

    var delTargetRow = Math.max(delSheet.getLastRow() + 1, delHIdx + 2);
    if (newDelRows.length > 0) {
      delSheet.getRange(delTargetRow, 1, newDelRows.length, delHeaders.length).setValues(newDelRows);
    }

    var remainingOrdData = [];
    for (var r = 0; r < ordData.length; r++) {
       if (numericRowIndices.indexOf(r + 1) === -1) {
           remainingOrdData.push(ordData[r]);
       }
    }

    // --- CALCULATE AND INJECT TOTALS INTO ROW 2 (Index 1) ---
    var sumOrdD = 0, sumOrdE = 0, sumAmt = 0;
    
    var idxOrdD = ordColMap['ORDD'] !== undefined ? ordColMap['ORDD'] : 13;
    var idxOrdE = ordColMap['ORDE'] !== undefined ? ordColMap['ORDE'] : 14;
    var idxAmt = ordColMap['AMOUNT'] !== undefined ? ordColMap['AMOUNT'] : 23;

    for (var r = ordHIdx + 1; r < remainingOrdData.length; r++) {
       sumOrdD += Number(remainingOrdData[r][idxOrdD]) || 0;
       sumOrdE += Number(remainingOrdData[r][idxOrdE]) || 0;
       sumAmt  += Number(remainingOrdData[r][idxAmt])  || 0;
    }

    if (remainingOrdData.length > 1) {
       remainingOrdData[1][idxOrdD] = sumOrdD;
       remainingOrdData[1][idxOrdE] = sumOrdE;
       remainingOrdData[1][idxAmt]  = sumAmt;
    }

    if (remainingOrdData.length > 0) {
      ordSheet.getRange(1, 1, remainingOrdData.length, ordData[0].length).setValues(remainingOrdData);
    }

    var totalRowsInSheet = ordSheet.getLastRow();
    if (totalRowsInSheet > remainingOrdData.length) {
      var diff = totalRowsInSheet - remainingOrdData.length;
      ordSheet.getRange(remainingOrdData.length + 1, 1, diff, ordData[0].length).clearContent();
    }

    return { success: true, count: selectedRowIndices.length };
  } catch (e) { return { success: false, message: e.toString() }; } finally { lock.releaseLock(); }
}

function deleteRowFromOrd2(rowIdx) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var sheet = SpreadsheetApp.openById(ENTRY_SPREADSHEET_ID).getSheetByName('ORD2');
    
    sheet.deleteRow(rowIdx);
    sheet.insertRowsAfter(sheet.getMaxRows(), 1); 
    
    return { success: true };
  } catch (e) { return { success: false, message: e.toString() }; } finally { lock.releaseLock(); }
}