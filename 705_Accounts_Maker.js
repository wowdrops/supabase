// 705_Accounts_Maker.js

/**
 * Fetch Ledgers for the Maker Desk Dropdowns
 */
function accounts_getLedgerMaster() {
  try {
    // Hardcoded to ensure it strictly hits "WOW DROPS WEB ACCOUNTS"
    var ss = SpreadsheetApp.openById(WEBACCOUNTS_SPREADSHEET_ID);
    var sheet = ss.getSheetByName('LEDGER_MASTER');

    if (!sheet) {
      return { success: false, message: "LEDGER_MASTER sheet not found in the database." };
    }

    var data = sheet.getDataRange().getValues();
    var ledgers = [];

    // Headers: Ledger_ID, Ledger_Name, Account_Group, Expense_Category, Status
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][1]) {
        ledgers.push({
          code: data[i][0].toString().trim(),
          name: data[i][1].toString().trim(),
          group: data[i][2] ? data[i][2].toString().trim() : 'Uncategorized'
        });
      }
    }

    ledgers.sort(function (a, b) {
      return a.name.localeCompare(b.name);
    });

    return { success: true, data: ledgers };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

/**
 * Post the transaction to the database using the Two-Row Double-Entry Method
 */
function accounts_postTransaction(payload) {
  try {
    var ss = SpreadsheetApp.openById(WEBACCOUNTS_SPREADSHEET_ID);
    var txnSheet = ss.getSheetByName('TRANSACTIONS');
    var masterSheet = ss.getSheetByName('LEDGER_MASTER');
    
    if (!txnSheet || !masterSheet) {
        return { success: false, message: "Database sheets not found." };
    }

    // --- SECURITY CHECK: VERIFY ACCOUNTING RULES ---
    var masterData = masterSheet.getDataRange().getValues();
    var drGroup = "";
    var crGroup = "";

    // Lookup the groups for the submitted ledgers
    for (var i = 1; i < masterData.length; i++) {
      if (masterData[i][0].toString() === payload.drAccount) drGroup = masterData[i][2] ? masterData[i][2].toString().toLowerCase() : "";
      if (masterData[i][0].toString() === payload.crAccount) crGroup = masterData[i][2] ? masterData[i][2].toString().toLowerCase() : "";
    }

    var drIsCashBank = drGroup.includes('cash') || drGroup.includes('bank');
    var crIsCashBank = crGroup.includes('cash') || crGroup.includes('bank');

    // Enforce Strict Rules
    if (payload.voucherType === 'RECEIPT' && !drIsCashBank) {
      return { success: false, message: "SECURITY BLOCK: Receipt Debit must be a Cash or Bank ledger." };
    }
    if (payload.voucherType === 'PAYMENT' && !crIsCashBank) {
      return { success: false, message: "SECURITY BLOCK: Payment Credit must be a Cash or Bank ledger." };
    }
    if (payload.voucherType === 'CONTRA' && (!drIsCashBank || !crIsCashBank)) {
      return { success: false, message: "SECURITY BLOCK: Contra requires Cash or Bank on both sides." };
    }
    if (payload.voucherType === 'JOURNAL' && (drIsCashBank || crIsCashBank)) {
      return { success: false, message: "SECURITY BLOCK: Journals cannot contain Cash or Bank ledgers." };
    }
    // --- END SECURITY CHECK ---

    var newVoucherID = accounts_generateVoucherID(payload.voucherType);
    var linkedJvId = newVoucherID;
    var txnIdDr = newVoucherID + "-DR";
    var txnIdCr = newVoucherID + "-CR";

    var timestamp = new Date();
    var amount = parseFloat(payload.amount);

    // ROW 1: THE DEBIT ENTRY
    var drRow = [
      txnIdDr, new Date(payload.date), timestamp, payload.voucherType, "MANUAL_ENTRY", 
      payload.drAccount, amount, 0, "", payload.narration, 
      payload.maker, "", "PENDING_APPROVAL", "", linkedJvId
    ];

    // ROW 2: THE CREDIT ENTRY
    var crRow = [
      txnIdCr, new Date(payload.date), timestamp, payload.voucherType, "MANUAL_ENTRY", 
      payload.crAccount, 0, amount, "", payload.narration, 
      payload.maker, "", "PENDING_APPROVAL", "", linkedJvId
    ];

    txnSheet.getRange(txnSheet.getLastRow() + 1, 1, 2, 15).setValues([drRow, crRow]);

    return { success: true, message: "Transaction posted successfully.", vchNo: linkedJvId };

  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

/**
 * Fetch PENDING_MAKER, PENDING_APPROVAL, and REJECTED vouchers for the Maker Dashboard
 */
function accounts_getMakerQueue() {
  try {
    var ss = SpreadsheetApp.openById(WEBACCOUNTS_SPREADSHEET_ID);
    var txnSheet = ss.getSheetByName('TRANSACTIONS');
    var masterSheet = ss.getSheetByName('LEDGER_MASTER');
    
    var txnData = txnSheet.getDataRange().getValues();
    var masterData = masterSheet.getDataRange().getValues();

    var ledgerMap = {};
    for (var i = 1; i < masterData.length; i++) {
      if (masterData[i][0]) {
        ledgerMap[masterData[i][0].toString().trim()] = masterData[i][1] ? masterData[i][1].toString().trim() : masterData[i][0].toString().trim();
      }
    }

    var groupedMaker = {};
    var groupedApproval = {};
    var groupedRejected = {};

    for (var i = 1; i < txnData.length; i++) {
      var row = txnData[i];
      if (!row || row.length < 15) continue; 

      var status = row[12] ? row[12].toString().trim() : ""; 
      
      if (status !== "PENDING_MAKER" && status !== "PENDING_APPROVAL" && status !== "REJECTED") continue;

      var jvId = row[14].toString().trim();
      var targetGroup;
      
      if (status === "PENDING_MAKER") targetGroup = groupedMaker;
      else if (status === "PENDING_APPROVAL") targetGroup = groupedApproval;
      else targetGroup = groupedRejected;

      if (!targetGroup[jvId]) {
        targetGroup[jvId] = {
          jvId: jvId, date: row[1], type: row[3],
          drAccountCode: "", drAccountName: "",
          crAccountCode: "", crAccountName: "",
          amount: 0, narration: row[9] || ""
        };
      }

      var ledgerId = row[5] ? row[5].toString().trim() : "";
      var amtIn = parseFloat(row[6]) || 0;
      var amtOut = parseFloat(row[7]) || 0;

      if (amtIn > 0) {
        targetGroup[jvId].drAccountCode = ledgerId;
        targetGroup[jvId].drAccountName = ledgerMap[ledgerId] || ledgerId;
        targetGroup[jvId].amount = amtIn; 
      }
      if (amtOut > 0) {
        targetGroup[jvId].crAccountCode = ledgerId;
        targetGroup[jvId].crAccountName = ledgerMap[ledgerId] || ledgerId;
      }
    }

    // Format Dates and Convert to Arrays
    function formatQueue(groupObj) {
      var list = [];
      for (var key in groupObj) {
         var d = new Date(groupObj[key].date);
         groupObj[key].formattedDate = !isNaN(d.getTime()) ? d.toLocaleDateString('en-GB') : "N/A";
         
         // THE CRITICAL FIX: Convert the native Date object to a string before returning!
         groupObj[key].date = groupObj[key].date ? groupObj[key].date.toString() : "";
         
         list.push(groupObj[key]);
      }
      return list.sort(function(a, b) { return new Date(b.date) - new Date(a.date); });
    }

    return { 
      success: true, 
      data: {
        pendingMaker: formatQueue(groupedMaker),
        pendingApproval: formatQueue(groupedApproval),
        rejected: formatQueue(groupedRejected)
      }
    };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

/**
 * Maker edits a PENDING_APPROVAL or REJECTED voucher. 
 * Re-enforces strict accounting rules before saving.
 */
function accounts_editSubmittedVoucher(payload) {
  try {
    var ss = SpreadsheetApp.openById(WEBACCOUNTS_SPREADSHEET_ID);
    var txnSheet = ss.getSheetByName('TRANSACTIONS');
    var masterSheet = ss.getSheetByName('LEDGER_MASTER');
    var txnData = txnSheet.getDataRange().getValues();
    
    // --- 1. RE-VERIFY ACCOUNTING RULES ---
    var masterData = masterSheet.getDataRange().getValues();
    var drGroup = "", crGroup = "";
    for (var i = 1; i < masterData.length; i++) {
      if (masterData[i][0].toString() === payload.drAccount) drGroup = masterData[i][2] ? masterData[i][2].toString().toLowerCase() : "";
      if (masterData[i][0].toString() === payload.crAccount) crGroup = masterData[i][2] ? masterData[i][2].toString().toLowerCase() : "";
    }

    var drIsCashBank = drGroup.includes('cash') || drGroup.includes('bank');
    var crIsCashBank = crGroup.includes('cash') || crGroup.includes('bank');

    if (payload.type === 'RECEIPT' && !drIsCashBank) return { success: false, message: "Receipt Debit must be Cash or Bank." };
    if (payload.type === 'PAYMENT' && !crIsCashBank) return { success: false, message: "Payment Credit must be Cash or Bank." };
    if (payload.type === 'CONTRA' && (!drIsCashBank || !crIsCashBank)) return { success: false, message: "Contra requires Cash or Bank on both sides." };
    if (payload.type === 'JOURNAL' && (drIsCashBank || crIsCashBank)) return { success: false, message: "Journals cannot contain Cash or Bank." };

    // --- 2. FIND AND UPDATE ROWS ---
    var rowsToUpdate = [];
    for (var r = 1; r < txnData.length; r++) {
      var currentStatus = txnData[r][12] ? txnData[r][12].toString().trim() : "";
      
      // THE FIX: Allow editing if status is PENDING_APPROVAL OR REJECTED
      if (txnData[r][14] && txnData[r][14].toString().trim() === payload.jvId && 
         (currentStatus === "PENDING_APPROVAL" || currentStatus === "REJECTED")) {
        rowsToUpdate.push(r + 1); 
      }
    }

    if (rowsToUpdate.length !== 2) return { success: false, message: "Voucher locked or already processed by Checker." };

    for (var j = 0; j < rowsToUpdate.length; j++) {
      var rowNum = rowsToUpdate[j];
      var currentAmtIn = txnSheet.getRange(rowNum, 7).getValue();
      var currentAmtOut = txnSheet.getRange(rowNum, 8).getValue();

      if (currentAmtIn > 0) {
          txnSheet.getRange(rowNum, 6).setValue(payload.drAccount); 
          txnSheet.getRange(rowNum, 7).setValue(payload.amount); 
      }
      if (currentAmtOut > 0) {
          txnSheet.getRange(rowNum, 6).setValue(payload.crAccount); 
          txnSheet.getRange(rowNum, 8).setValue(payload.amount); 
      }
      txnSheet.getRange(rowNum, 10).setValue(payload.narration); 
      
      // THE FIX: Push the status back to the Checker's desk!
      txnSheet.getRange(rowNum, 13).setValue("PENDING_APPROVAL"); 
    }

    return { success: true, message: "Voucher updated and resubmitted successfully." };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}