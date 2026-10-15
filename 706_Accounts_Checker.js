// 706_Accounts_Checker.js

function accounts_getPendingVouchers() {
  try {
    if (typeof WEBACCOUNTS_SPREADSHEET_ID === 'undefined') {
      return { success: false, message: "WEBACCOUNTS_SPREADSHEET_ID is not defined." };
    }

    var ss = SpreadsheetApp.openById(WEBACCOUNTS_SPREADSHEET_ID);
    var txnSheet = ss.getSheetByName('TRANSACTIONS');
    var masterSheet = ss.getSheetByName('LEDGER_MASTER');

    if (!txnSheet || !masterSheet) {
        return { success: false, message: "Database sheets 'TRANSACTIONS' or 'LEDGER_MASTER' not found." };
    }

    var txnData = txnSheet.getDataRange().getValues();
    var masterData = masterSheet.getDataRange().getValues();

    // 1. Create a Ledger Dictionary
    var ledgerMap = {};
    for (var i = 1; i < masterData.length; i++) {
      if (masterData[i][0]) {
        ledgerMap[masterData[i][0].toString().trim()] = masterData[i][1] ? masterData[i][1].toString().trim() : masterData[i][0].toString().trim();
      }
    }

    var groupedVouchers = {};

    // 2. Loop through transactions (skip header row)
    for (var i = 1; i < txnData.length; i++) {
      var row = txnData[i];
      if (!row || row.length < 15) continue; 

      var status = row[12]; // Txn_Status (Col M)

      if (status && status.toString().trim() === "PENDING_APPROVAL") {
        var jvId = row[14]; // Linked_JV_ID (Col O)
        if (!jvId) continue;

        jvId = jvId.toString().trim();

        if (!groupedVouchers[jvId]) {
          groupedVouchers[jvId] = {
            jvId: jvId,
            date: row[1],
            type: row[3],
            drAccountCode: "",
            drAccountName: "",
            crAccountCode: "",
            crAccountName: "",
            amount: 0,
            narration: row[9] || "",
            maker: row[10] || ""
          };
        }

        var ledgerId = row[5] ? row[5].toString().trim() : "";
        var amtIn = parseFloat(row[6]) || 0;
        var amtOut = parseFloat(row[7]) || 0;

        if (amtIn > 0) {
          groupedVouchers[jvId].drAccountCode = ledgerId;
          groupedVouchers[jvId].drAccountName = ledgerMap[ledgerId] || ledgerId;
          groupedVouchers[jvId].amount = amtIn; 
        }

        if (amtOut > 0) {
          groupedVouchers[jvId].crAccountCode = ledgerId;
          groupedVouchers[jvId].crAccountName = ledgerMap[ledgerId] || ledgerId;
        }
      }
    }

    var pendingList = [];
    for (var key in groupedVouchers) {
       var d = new Date(groupedVouchers[key].date);
       groupedVouchers[key].formattedDate = !isNaN(d.getTime()) ? d.toLocaleDateString('en-GB') : "N/A";
       pendingList.push(groupedVouchers[key]);
    }

    pendingList.sort(function(a, b) {
       return new Date(b.date) - new Date(a.date);
    });

    for (var i = 0; i < pendingList.length; i++) {
       pendingList[i].date = pendingList[i].date.toString(); 
    }

    // CRITICAL: Always ensure we return a valid object, never null!
    return { success: true, data: pendingList };

  } catch (e) {
    return { success: false, message: "Script Exception: " + e.toString() };
  }
}

function accounts_processVoucherAction(payload) {
  try {
    var ss = SpreadsheetApp.openById(WEBACCOUNTS_SPREADSHEET_ID);
    var txnSheet = ss.getSheetByName('TRANSACTIONS');
    var data = txnSheet.getDataRange().getValues();

    var rowsToUpdate = [];
    for (var i = 1; i < data.length; i++) {
      // Find matching JV ID. Allow PENDING_APPROVAL (Checker view) or REJECTED (Maker view)
      var currentStatus = data[i][12];
      if (data[i][14] && data[i][14].toString().trim() === payload.jvId.toString().trim() && 
         (currentStatus === "PENDING_APPROVAL" || currentStatus === "REJECTED")) {
        rowsToUpdate.push(i + 1); 
      }
    }

    if (rowsToUpdate.length !== 2) {
       return { success: false, message: "Transaction lock error. Could not verify double-entry row pair." };
    }

    for (var r = 0; r < rowsToUpdate.length; r++) {
      var rowNum = rowsToUpdate[r];
      var currentAmtIn = txnSheet.getRange(rowNum, 7).getValue();
      var currentAmtOut = txnSheet.getRange(rowNum, 8).getValue();

      if (payload.action === 'APPROVE' || payload.action === 'EDIT_AND_APPROVE') {
         txnSheet.getRange(rowNum, 13).setValue('APPROVED');
         txnSheet.getRange(rowNum, 12).setValue(payload.userEmail);

         if (payload.action === 'EDIT_AND_APPROVE') {
            if (currentAmtIn > 0) txnSheet.getRange(rowNum, 7).setValue(payload.newAmount);
            if (currentAmtOut > 0) txnSheet.getRange(rowNum, 8).setValue(payload.newAmount);
            txnSheet.getRange(rowNum, 10).setValue(payload.newNarration);
         }
      } 
      else if (payload.action === 'REJECT') {
         txnSheet.getRange(rowNum, 13).setValue('REJECTED');
         txnSheet.getRange(rowNum, 12).setValue(payload.userEmail);
      }
      else if (payload.action === 'VOID') {
         // THE VOID ENGINE: Kill amounts, mark voided, track who did it
         txnSheet.getRange(rowNum, 13).setValue('VOIDED');
         txnSheet.getRange(rowNum, 12).setValue(payload.userEmail);
         
         txnSheet.getRange(rowNum, 7).setValue(0); // Zero Dr
         txnSheet.getRange(rowNum, 8).setValue(0); // Zero Cr
         
         var oldNarration = txnSheet.getRange(rowNum, 10).getValue();
         txnSheet.getRange(rowNum, 10).setValue("[VOIDED] " + oldNarration);
      }
    }

    return { success: true, message: "Voucher processed successfully." };

  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

function accounts_processBulkAction(payload) {
  try {
    var ss = SpreadsheetApp.openById(WEBACCOUNTS_SPREADSHEET_ID);
    var txnSheet = ss.getSheetByName('TRANSACTIONS');
    var data = txnSheet.getDataRange().getValues();
    
    var jvIds = payload.jvIds; // Array of strings
    var action = payload.action;
    var userEmail = payload.userEmail;

    var rowsToUpdate = [];
    
    // Scan the database for matching Pending rows
    for (var i = 1; i < data.length; i++) {
      var currentJv = data[i][14] ? data[i][14].toString().trim() : "";
      var status = data[i][12];
      
      if (jvIds.indexOf(currentJv) > -1 && status === "PENDING_APPROVAL") {
         rowsToUpdate.push(i + 1); 
      }
    }

    if (rowsToUpdate.length === 0) {
      return { success: false, message: "No valid pending transactions found for the selected IDs." };
    }

    var statusVal = (action === 'APPROVE') ? 'APPROVED' : 'REJECTED';

    // Apply the Soft Lock / Rejection
    for (var r = 0; r < rowsToUpdate.length; r++) {
       var rowNum = rowsToUpdate[r];
       txnSheet.getRange(rowNum, 13).setValue(statusVal);
       txnSheet.getRange(rowNum, 12).setValue(userEmail);
    }

    return { success: true, message: rowsToUpdate.length / 2 + " vouchers processed successfully." };

  } catch (e) {
    return { success: false, message: "Bulk Script Exception: " + e.toString() };
  }
}