// 707_Accounts_Automation.js

function accounts_generateAutomatedVouchers(payload) {
  try {
    var webDb = SpreadsheetApp.openById(WEBACCOUNTS_SPREADSHEET_ID);
    var txnSheet = webDb.getSheetByName('TRANSACTIONS');
    
    // --- 1. LOAD PAYROLL MASTER ---
    var payrollMasterSheet = webDb.getSheetByName('PAYROLL_MASTER');
    if (!payrollMasterSheet) {
      return { success: false, message: "CRITICAL: 'PAYROLL_MASTER' sheet not found in Web Accounts database." };
    }
    var masterData = payrollMasterSheet.getDataRange().getValues();
    var payrollConfig = {};
    
    for (var m = 1; m < masterData.length; m++) {
      var sName = masterData[m][0] ? masterData[m][0].toString().trim() : "";
      if (sName) {
        payrollConfig[sName.toLowerCase()] = {
          originalName: sName,
          role: masterData[m][1] ? masterData[m][1].toString().trim() : "Staff",
          dailyWage: parseFloat(masterData[m][2]) || 0,
          ratePerDelivery: parseFloat(masterData[m][3]) || 0,
          ledgerCode: masterData[m][4] ? masterData[m][4].toString().trim() : "L0002"
        };
      }
    }

    // --- 2. AUDIT LOG CHECK ---
    var logSheet = webDb.getSheetByName('AUTOMATION_LOGS');
    if (!logSheet) {
      logSheet = webDb.insertSheet('AUTOMATION_LOGS');
      logSheet.appendRow(["Timestamp", "Date Range", "Triggered By", "Staff Generated", "Supplier Generated"]);
    }
    
    var logData = logSheet.getDataRange().getValues();
    var dateRangeStr = "EMPLOYEE: " + payload.startDate + " to " + payload.endDate;
    
    for (var i = 1; i < logData.length; i++) {
      if (logData[i][1] === dateRangeStr) {
        return { success: false, message: "SECURITY BLOCK: Vouchers for this date range have already been generated." };
      }
    }

    // --- 3. FETCH SALES DATA ---
    var historyDb = SpreadsheetApp.openById(HISTORY_SPREADSHEET_ID);
    var salesSheet = historyDb.getSheetByName('SALES');
    var salesData = salesSheet.getDataRange().getValues();
    
    var headers = salesData[1];
    var h = {};
    for (var c = 0; c < headers.length; c++) {
      if (headers[c]) {
        h[headers[c].toString().replace(/\s+/g, ' ').trim().toUpperCase()] = c;
      }
    }

    var sParts = payload.startDate.split('-');
    var start = new Date(sParts[0], sParts[1] - 1, sParts[2]).setHours(0,0,0,0);
    var eParts = payload.endDate.split('-');
    var end = new Date(eParts[0], eParts[1] - 1, eParts[2]).setHours(23,59,59,999);

    // --- 4. ACTION TRACKING ENGINE ---
    var staffStats = {}; 
    
    function registerAction(staffName, dateObj, actionType) {
      if (!staffName) return;
      var cleanName = staffName.toLowerCase();
      if (!payrollConfig[cleanName]) return; 

      if (!staffStats[cleanName]) {
        staffStats[cleanName] = { daily: {}, totalDays: 0, totalDeliveries: 0 };
      }
      
      // Format the date nicely for the narration (e.g., "01-Aug")
      var dateParts = dateObj.toDateString().split(' '); 
      var dateKey = dateParts[2] + "-" + dateParts[1]; 

      if (!staffStats[cleanName].daily[dateKey]) {
        staffStats[cleanName].daily[dateKey] = { del: 0, load: 0, unload: 0 };
        staffStats[cleanName].totalDays += 1;
      }

      if (actionType === 'DELIVERY') {
        staffStats[cleanName].daily[dateKey].del += 1;
        staffStats[cleanName].totalDeliveries += 1;
      } else if (actionType === 'LOAD') {
        staffStats[cleanName].daily[dateKey].load += 1;
      } else if (actionType === 'UNLOAD') {
        staffStats[cleanName].daily[dateKey].unload += 1;
      }
    }

    // --- SAFE REVERSE SCANNING LOOP ---
    // Scans backwards but checks every row to ensure 100% payroll accuracy
    for (var r = salesData.length - 1; r >= 2; r--) {
      var row = salesData[r];
      
      // 1. Deliveries
      if (h['DELIVERY ENTER ON'] !== undefined && h['DELIVERY ENTER BY'] !== undefined) {
        var delDateObj = parseSheetDate(row[h['DELIVERY ENTER ON']]);
        if (delDateObj) {
          var delTime = delDateObj.getTime();
          if (delTime >= start && delTime <= end) {
            var staffName = row[h['DELIVERY ENTER BY']] ? row[h['DELIVERY ENTER BY']].toString().trim() : "";
            if (staffName) {
              registerAction(staffName, delDateObj, 'DELIVERY');
            }
          }
        }
      }

      // 2. Loads
      var loadDateIdx = h['LOAD ON'] !== undefined ? h['LOAD ON'] : (h['LOADING ON'] !== undefined ? h['LOADING ON'] : -1);
      var loadByIdx = h['LOAD BY'] !== undefined ? h['LOAD BY'] : -1;
      if (loadDateIdx !== -1 && loadByIdx !== -1) {
        var loadDateObj = parseSheetDate(row[loadDateIdx]);
        if (loadDateObj && loadDateObj.getTime() >= start && loadDateObj.getTime() <= end) {
          var loadStaff = row[loadByIdx] ? row[loadByIdx].toString().trim() : "";
          if (loadStaff) {
             registerAction(loadStaff, loadDateObj, 'LOAD');
          }
        }
      }

      // 3. Unloads
      if (h['UNLOAD ON'] !== undefined && h['UNLOAD BY'] !== undefined) {
        var unlDateObj = parseSheetDate(row[h['UNLOAD ON']]);
        if (unlDateObj && unlDateObj.getTime() >= start && unlDateObj.getTime() <= end) {
          var unlStaff = row[h['UNLOAD BY']] ? row[h['UNLOAD BY']].toString().trim() : "";
          if (unlStaff) {
             registerAction(unlStaff, unlDateObj, 'UNLOAD');
          }
        }
      }
    }

    // --- 5. GENERATE DRAFT ROWS ---
    // --- 5. GENERATE DRAFT ROWS ---
    var timestamp = new Date();
    var staffCount = 0;

    for (var sKey in staffStats) {
      var stats = staffStats[sKey];
      var config = payrollConfig[sKey];
      
      var wageAmount = stats.totalDays * config.dailyWage;
      var pieceRateAmount = stats.totalDeliveries * config.ratePerDelivery;
      var totalAmount = wageAmount + pieceRateAmount;

      if (totalAmount > 0) {
        // Build the Daily Breakdown String
        var dailyStrings = [];
        for (var dKey in stats.daily) {
           var dayData = stats.daily[dKey];
           var acts = [];
           if (dayData.del > 0) acts.push(dayData.del + " Del");
           if (dayData.load > 0) acts.push(dayData.load + " Load");
           if (dayData.unload > 0) acts.push(dayData.unload + " Unload");
           dailyStrings.push(dKey + ": " + acts.join(", "));
        }
        var dailyDetails = dailyStrings.join(" | ");

        // Build the Financial Math String
        var mathDetails = [];
        if (stats.totalDays > 0 && config.dailyWage > 0) {
            mathDetails.push(stats.totalDays + " Days @ Rs" + config.dailyWage);
        }
        if (stats.totalDeliveries > 0 && config.ratePerDelivery > 0) {
            mathDetails.push(stats.totalDeliveries + " Del @ Rs" + config.ratePerDelivery);
        }

        var narration = "Employee Payroll: " + config.originalName + " (" + mathDetails.join(" + ") + " = Rs" + totalAmount + ") || " + dailyDetails + " - " + payload.startDate + " to " + payload.endDate;
        
        // FIX: Generate ID and Write Immediately inside the loop
        var newVoucherID = accounts_generateVoucherID('PAYMENT'); 
        var txnIdDr = newVoucherID + "-DR";
        var txnIdCr = newVoucherID + "-CR";

        var drRow = [txnIdDr, new Date(), timestamp, 'PAYMENT', config.ledgerCode, "PENDING_MAPPING", totalAmount, 0, "", narration, payload.makerEmail, "", "PENDING_MAKER", "", newVoucherID];
        var crRow = [txnIdCr, new Date(), timestamp, 'PAYMENT', "L0012", "PENDING_MAPPING", 0, totalAmount, "", narration, payload.makerEmail, "", "PENDING_MAKER", "", newVoucherID];
        
        // Write to sheet immediately and force refresh so the next ID is unique
        txnSheet.getRange(txnSheet.getLastRow() + 1, 1, 2, 15).setValues([drRow, crRow]);
        SpreadsheetApp.flush(); 
        
        staffCount++;
      }
    }

    if (staffCount > 0) {
      logSheet.appendRow([timestamp, dateRangeStr, payload.makerEmail, staffCount, 0]);
      return { success: true, message: staffCount + " staff payroll draft vouchers staged successfully." };
    } else {
      return { success: false, message: "No staff attendance or deliveries found matching the criteria in this date range." };
    }

  } catch (e) {
    return { success: false, message: "Payroll Automation Error: " + e.toString() };
  }
}

/**
 * Fetch pending vouchers specifically for Maker review (PENDING_MAKER)
 */
function accounts_getPendingMakerVouchers() {
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

    var groupedVouchers = {};

    for (var i = 1; i < txnData.length; i++) {
      var row = txnData[i];
      if (!row || row.length < 15) continue;

      var status = row[12]; // Txn_Status

      if (status && status.toString().trim() === "PENDING_MAKER") {
        var jvId = row[14]; // Linked_JV_ID
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
            source: row[4] || ""
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

    var list = [];
    for (var key in groupedVouchers) {
      var d = new Date(groupedVouchers[key].date);
      groupedVouchers[key].formattedDate = !isNaN(d.getTime()) ? d.toLocaleDateString('en-GB') : "N/A";

      // THE CRITICAL FIX: Convert the native Date object to a string!
      groupedVouchers[key].date = groupedVouchers[key].date ? groupedVouchers[key].date.toString() : "";

      list.push(groupedVouchers[key]);
    }

    return { success: true, data: list };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

/**
 * Maker submits the reviewed draft, pushing status to PENDING_APPROVAL
 */
function accounts_submitPendingMakerVoucher(payload) {
  try {
    var ss = SpreadsheetApp.openById(WEBACCOUNTS_SPREADSHEET_ID);
    var txnSheet = ss.getSheetByName('TRANSACTIONS');
    var data = txnSheet.getDataRange().getValues();

    var rowsToUpdate = [];
    for (var i = 1; i < data.length; i++) {
      // THE FIX: Aggressively trim the JV ID and Status from the database
      var jvIdDb = data[i][14] ? data[i][14].toString().trim() : "";
      var statusDb = data[i][12] ? data[i][12].toString().trim() : "";
      
      if (jvIdDb === payload.jvId.toString().trim() && statusDb === "PENDING_MAKER") {
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

      if (currentAmtIn > 0) {
          txnSheet.getRange(rowNum, 6).setValue(payload.drAccount); 
          txnSheet.getRange(rowNum, 7).setValue(payload.newAmount); 
      }
      if (currentAmtOut > 0) {
          txnSheet.getRange(rowNum, 6).setValue(payload.crAccount); 
          txnSheet.getRange(rowNum, 8).setValue(payload.newAmount); 
      }
      
      txnSheet.getRange(rowNum, 10).setValue(payload.newNarration); 
      txnSheet.getRange(rowNum, 11).setValue(payload.makerEmail);   
      txnSheet.getRange(rowNum, 13).setValue('PENDING_APPROVAL');   
    }

    return { success: true, message: "Voucher submitted for approval successfully." };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

/**
 * Fetches a daily breakdown directly from HISTORY!SALES for a specific Staff or Supplier
 * payload = { entityName: 'muthu', role: 'STAFF', startDate: '2026-08-01', endDate: '2026-08-15' }
 */
function accounts_getPayoutBreakdown(payload) {
  try {
    var historyDb = SpreadsheetApp.openById(HISTORY_SPREADSHEET_ID);
    var salesSheet = historyDb.getSheetByName('SALES');
    var salesData = salesSheet.getDataRange().getValues();
    
    // --- HEADER MAPPING (EXPLICITLY ROW 2 / INDEX 1) ---
    var headers = salesData[1];
    var h = {};
    for (var c = 0; c < headers.length; c++) {
      if (headers[c]) {
        h[headers[c].toString().replace(/\s+/g, ' ').trim().toUpperCase()] = c;
      }
    }

    // TIMEZONE SAFE DATE PARSING
    var sParts = payload.startDate.split('-');
    var start = new Date(sParts[0], sParts[1] - 1, sParts[2]).setHours(0,0,0,0);
    
    var eParts = payload.endDate.split('-');
    var end = new Date(eParts[0], eParts[1] - 1, eParts[2]).setHours(23,59,59,999);
    
    var dailyTotals = {};
    var processedBlocks = new Set(); 

    // DATA STARTS ON ROW 3 / INDEX 2
    for (var r = 2; r < salesData.length; r++) {
      var row = salesData[r];

      if (payload.role === 'STAFF') {
        if (h['DELIVERY ENTER ON'] !== undefined) {
           var delDateObj = parseSheetDate(row[h['DELIVERY ENTER ON']]);
           if (delDateObj) {
             var delDate = delDateObj.getTime();
             var staffName = row[h['DELIVERY ENTER BY']] ? row[h['DELIVERY ENTER BY']].toString().trim() : "";
             
             // Check Date & Staff Name (case-insensitive)
             if (delDate >= start && delDate <= end && staffName.toLowerCase() === payload.entityName.toLowerCase()) {
               var dateStr = delDateObj.toLocaleDateString('en-GB');
               dailyTotals[dateStr] = (dailyTotals[dateStr] || 0) + 1; 
             }
           }
        }
      } 
      else if (payload.role === 'SUPPLIER') {
        if (h['UNLOAD ON'] !== undefined) {
           var unloadDateObj = parseSheetDate(row[h['UNLOAD ON']]);
           if (unloadDateObj) {
             var unlDate = unloadDateObj.getTime();
             var supplierName = row[h['UNLOAD BY']] ? row[h['UNLOAD BY']].toString().trim() : "";

             if (unlDate >= start && unlDate <= end && supplierName.toLowerCase() === payload.entityName.toLowerCase()) {
               var blockLink = row[h['VAN TO BLOCK LINK']] ? row[h['VAN TO BLOCK LINK']].toString().trim() : "";
               var canCount = parseFloat(row[h['VAN TO BLOCK FULL CAN COUNT']]) || 0;
               var dateStr = unloadDateObj.toLocaleDateString('en-GB');
               
               var uniqueBlockKey = blockLink + "_" + unloadDateObj.toDateString(); 
               if (blockLink && !processedBlocks.has(uniqueBlockKey)) {
                 processedBlocks.add(uniqueBlockKey);
                 dailyTotals[dateStr] = (dailyTotals[dateStr] || 0) + canCount;
               }
             }
           }
        }
      }
    }

    var breakdownArray = [];
    for (var dateKey in dailyTotals) {
      breakdownArray.push({ date: dateKey, count: dailyTotals[dateKey] });
    }

    breakdownArray.sort(function(a, b) {
       var aParts = a.date.split('/');
       var bParts = b.date.split('/');
       return new Date(aParts[2], aParts[1]-1, aParts[0]) - new Date(bParts[2], bParts[1]-1, bParts[0]);
    });

    return { success: true, data: breakdownArray };

  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

function accounts_clearAutomatedDrafts() {
  try {
    var webDb = SpreadsheetApp.openById(WEBACCOUNTS_SPREADSHEET_ID);
    var txnSheet = webDb.getSheetByName('TRANSACTIONS');
    var logSheet = webDb.getSheetByName('AUTOMATION_LOGS');

    var txnData = txnSheet.getDataRange().getValues();
    var logsToDelete = {}; // Stores the exact log strings we need to target
    var rowsToDelete = []; // Stores row indices for bulk deletion

    // --- 1. IDENTIFY PENDING DRAFTS & REVERSE-ENGINEER THE LOGS ---
    for (var r = txnData.length - 1; r >= 1; r--) {
      var row = txnData[r];
      var status = row[12] ? row[12].toString().trim() : ""; 
      var narration = row[9] ? row[9].toString().trim() : ""; 

      if (status === 'PENDING_MAKER') {
        var isEmployee = narration.indexOf('Employee Payroll:') > -1;
        var isSupplier = narration.indexOf('Supplier Purchase:') > -1;

        if (isEmployee || isSupplier) {
          rowsToDelete.push(r + 1); // Target this row for deletion

          // Extract the Date Range suffix from the narration
          var parts = narration.split(' - ');
          if (parts.length > 1) {
            var dateRange = parts[parts.length - 1].trim();
            // Recreate the exact string saved in the log sheet
            var logString = (isEmployee ? "EMPLOYEE: " : "SUPPLIER: ") + dateRange;
            logsToDelete[logString] = true; 
          }
        }
      }
    }

    // --- 2. HIGH-PERFORMANCE BULK DELETE (TRANSACTIONS) ---
    if (rowsToDelete.length > 0) {
      var startRow = rowsToDelete[0];
      var numRows = 1;
      
      // Group contiguous rows together to minimize Google Sheets API calls
      for (var i = 1; i < rowsToDelete.length; i++) {
        if (rowsToDelete[i] === startRow - 1) {
          startRow = rowsToDelete[i];
          numRows++;
        } else {
          txnSheet.deleteRows(startRow, numRows);
          startRow = rowsToDelete[i];
          numRows = 1;
        }
      }
      // Delete the final batch
      txnSheet.deleteRows(startRow, numRows); 
    }

    // --- 3. SELECTIVE LOG CLEANUP (AUTOMATION_LOGS) ---
    if (logSheet && Object.keys(logsToDelete).length > 0) {
      var logData = logSheet.getDataRange().getValues();
      var logRowsToDelete = [];
      
      for (var i = logData.length - 1; i >= 1; i--) {
        var logDateRange = logData[i][1] ? logData[i][1].toString().trim() : "";
        if (logsToDelete[logDateRange]) {
          logRowsToDelete.push(i + 1);
        }
      }

      // Delete targeted logs from bottom to top
      logRowsToDelete.forEach(function(rowIdx) {
        logSheet.deleteRow(rowIdx);
      });
    }

    var actualDrafts = rowsToDelete.length / 2;
    return { success: true, message: "Successfully deleted " + actualDrafts + " pending drafts and selectively cleared their logs." };
    
  } catch (e) {
    return { success: false, message: "Reset Error: " + e.toString() };
  }
}

function accounts_getSupplierUnloadData(startDate, endDate) {
  try {
    var historyDb = SpreadsheetApp.openById(HISTORY_SPREADSHEET_ID);
    var salesSheet = historyDb.getSheetByName('SALES');
    
    // 1. OPEN WEB ACCOUNTS TO FETCH MASTER DATA
    var webDb = SpreadsheetApp.openById(WEBACCOUNTS_SPREADSHEET_ID);
    var supMaster = webDb.getSheetByName('SUPPLIER_MASTER');
    
    if (!salesSheet || !supMaster) {
      return { success: false, message: "Could not find required database sheets." };
    }

    // 2. FETCH DYNAMIC ACTIVE SUPPLIERS
    var supData = supMaster.getDataRange().getValues();
    var activeSuppliers = [];
    
    for(var i = 1; i < supData.length; i++) {
        var sName = supData[i][0] ? supData[i][0].toString().trim() : "";
        var sStatus = supData[i][3] ? supData[i][3].toString().trim().toUpperCase() : "";
        
        if(sName && sStatus === 'ACTIVE') {
            activeSuppliers.push({
                name: sName,
                rate: parseFloat(supData[i][1]) || 0,
                ledgerCode: supData[i][2] ? supData[i][2].toString().trim() : ""
            });
        }
    }

    if (activeSuppliers.length === 0) {
       return { success: false, message: "No ACTIVE suppliers found in SUPPLIER_MASTER." };
    }

    // 3. FETCH UNLOAD DATA
    var salesData = salesSheet.getDataRange().getValues();
    var headers = salesData[1];
    var h = {};
    for (var c = 0; c < headers.length; c++) {
      if (headers[c]) h[headers[c].toString().replace(/\s+/g, ' ').trim().toUpperCase()] = c;
    }

    var sParts = startDate.split('-');
    var start = new Date(sParts[0], sParts[1] - 1, sParts[2]).setHours(0,0,0,0);
    var eParts = endDate.split('-');
    var end = new Date(eParts[0], eParts[1] - 1, eParts[2]).setHours(23,59,59,999);

    var dailyTotals = {};

    // Reverse scan without break for absolute safety
    for (var r = salesData.length - 1; r >= 2; r--) {
      var row = salesData[r];
      var unlDateVal = row[h['UNLOAD ON']];
      
      if (unlDateVal) {
        var unlDateObj = parseSheetDate(unlDateVal);
        if (unlDateObj) {
          var unlTime = unlDateObj.getTime();
          if (unlTime >= start && unlTime <= end) {
            var padMonth = ("0" + (unlDateObj.getMonth() + 1)).slice(-2);
            var padDay = ("0" + unlDateObj.getDate()).slice(-2);
            var dateKey = unlDateObj.getFullYear() + "-" + padMonth + "-" + padDay;
            
            if (!dailyTotals[dateKey]) dailyTotals[dateKey] = 0;
            dailyTotals[dateKey] += 1; 
          }
        }
      }
    }

    var resultData = [];
    var current = new Date(start);
    while (current <= end) {
      var pMonth = ("0" + (current.getMonth() + 1)).slice(-2);
      var pDay = ("0" + current.getDate()).slice(-2);
      var dKey = current.getFullYear() + "-" + pMonth + "-" + pDay;
      
      if (dailyTotals[dKey] && dailyTotals[dKey] > 0) {
        resultData.push({
          date: dKey,
          displayDate: pDay + "-" + pMonth + "-" + current.getFullYear(),
          totalCans: dailyTotals[dKey]
        });
      }
      current.setDate(current.getDate() + 1);
    }

    if (resultData.length === 0) {
       return { success: false, message: "No unloads found for the selected dates." };
    }

    // Return the Unload Data AND the Active Suppliers!
    return { success: true, data: resultData, suppliers: activeSuppliers };

  } catch (e) {
    return { success: false, message: "Supplier Backend Error: " + e.toString() };
  }
}

function accounts_generateSupplierVouchers(payload) {
  try {
    var webDb = SpreadsheetApp.openById(WEBACCOUNTS_SPREADSHEET_ID);
    var txnSheet = webDb.getSheetByName('TRANSACTIONS');

    // 1. LOAD SUPPLIER MASTER FOR RATES & LEDGERS
    var supMaster = webDb.getSheetByName('SUPPLIER_MASTER');
    var supData = supMaster.getDataRange().getValues();
    var supConfig = {};
    
    for(var i = 1; i < supData.length; i++) {
      var sName = supData[i][0] ? supData[i][0].toString().trim() : "";
      if(sName) {
        supConfig[sName.toLowerCase()] = {
          originalName: sName,
          rate: parseFloat(supData[i][1]) || 0,
          ledgerCode: supData[i][2] ? supData[i][2].toString().trim() : "L0004" // Default to Purchase Ledger
        };
      }
    }

    // 2. AUDIT LOG SECURITY BLOCK
    var logSheet = webDb.getSheetByName('AUTOMATION_LOGS');
    var dateRangeStr = "SUPPLIER: " + payload.startDate + " to " + payload.endDate;
    var logData = logSheet.getDataRange().getValues();
    
    for (var i = 1; i < logData.length; i++) {
      if (logData[i][1] === dateRangeStr) {
        return { success: false, message: "SECURITY BLOCK: Supplier vouchers for this date range have already been generated." };
      }
    }

    // 3. AGGREGATE CANS PER SUPPLIER
    var supplierTotals = {}; 
    
    payload.matrixData.forEach(function(dayRow) {
       var shortDate = dayRow.displayDate.substring(0, 6); // Just gets "03-08" for narration brevity
       dayRow.allocations.forEach(function(alloc) {
          if (alloc.cans > 0) {
             var cleanName = alloc.supplier.toLowerCase();
             if (!supplierTotals[cleanName]) {
                supplierTotals[cleanName] = { totalCans: 0, dailyLogs: [] };
             }
             supplierTotals[cleanName].totalCans += alloc.cans;
             supplierTotals[cleanName].dailyLogs.push(shortDate + ": " + alloc.cans + " Cans");
          }
       });
    });

    // 4. GENERATE DRAFT VOUCHERS
    var timestamp = new Date();
    var supCount = 0;

    for (var sKey in supplierTotals) {
       var stats = supplierTotals[sKey];
       var config = supConfig[sKey];

       if (!config) continue; // Safety check in case a supplier isn't in the master

       var totalAmount = stats.totalCans * config.rate;

       if (totalAmount > 0) {
          var dailyDetails = stats.dailyLogs.join(" | ");
          var narration = "Supplier Purchase: " + config.originalName + " (" + stats.totalCans + " Cans @ Rs" + config.rate + " = Rs" + totalAmount + ") || " + dailyDetails + " - " + payload.startDate + " to " + payload.endDate;

          // Write individually and flush to ensure unique IDs!
          var newVoucherID = accounts_generateVoucherID('PAYMENT');
          var txnIdDr = newVoucherID + "-DR";
          var txnIdCr = newVoucherID + "-CR";

          var drRow = [txnIdDr, new Date(), timestamp, 'PAYMENT', config.ledgerCode, "PENDING_MAPPING", totalAmount, 0, "", narration, payload.makerEmail, "", "PENDING_MAKER", "", newVoucherID];
          var crRow = [txnIdCr, new Date(), timestamp, 'PAYMENT', "L0012", "PENDING_MAPPING", 0, totalAmount, "", narration, payload.makerEmail, "", "PENDING_MAKER", "", newVoucherID];

          txnSheet.getRange(txnSheet.getLastRow() + 1, 1, 2, 15).setValues([drRow, crRow]);
          SpreadsheetApp.flush();
          supCount++;
       }
    }

    if (supCount > 0) {
      logSheet.appendRow([timestamp, dateRangeStr, payload.makerEmail, 0, supCount]);
      return { success: true, message: supCount + " Supplier Draft Vouchers staged successfully." };
    } else {
      return { success: false, message: "No non-zero supplier allocations found to generate." };
    }

  } catch(e) {
     return { success: false, message: "Supplier Draft Error: " + e.toString() };
  }
}