
function fetchDormantReport(daysThreshold, status_fetch) {
  try {
    var masterSS = SpreadsheetApp.openById(MASTER_SPREADSHEET_ID);
    var dbSheet = masterSS.getSheetByName('DATABASE');
    var dbData = dbSheet.getDataRange().getValues();
    
    var idxMap = {};
    for (var c = 0; c < dbData[2].length; c++) { 
        idxMap[String(dbData[2][c]).trim().toUpperCase()] = c; 
    }
    
    var activeCpns = {};
    for (var r = 3; r < dbData.length; r++) {
      if (String(dbData[r][idxMap['FINAL STATUS']]).trim().toUpperCase() === status_fetch.trim().toUpperCase()) {
        // FIX: Force CPN to uppercase to prevent matching errors
        var cpn = String(dbData[r][idxMap['CPNNO']]).trim().toUpperCase();
        if (cpn) {
            activeCpns[cpn] = {
              name: dbData[r][idxMap['POC1']], 
              contact: dbData[r][idxMap['CON 1']],
              apt: dbData[r][idxMap['APARTMENT']], 
              blk: dbData[r][idxMap['BLOCK']], 
              door: dbData[r][idxMap['DOOR']],
              lastOrderTs: 0
            };
        }
      }
    }
    
    var histSS = SpreadsheetApp.openById(HISTORY_SPREADSHEET_ID);
    var salesSheet = histSS.getSheetByName('SALES');
    if (salesSheet) {
      var salesData = salesSheet.getDataRange().getValues();
      
      // FIX: Dynamically find the header row by scanning the first 10 rows
      var headerRowIdx = 0;
      for (var i = 0; i < Math.min(10, salesData.length); i++) {
        var rowString = salesData[i].join("").toUpperCase();
        if (rowString.indexOf("CPN") > -1) {
          headerRowIdx = i;
          break;
        }
      }

      // FIX: Expand possible column names in case they changed
      var sCpn = getColIndexSafeDormant(salesData[headerRowIdx], ['CPNNO', 'CPN', 'CUSTOMER CPN'], 11);
      var sDel = getColIndexSafeDormant(salesData[headerRowIdx], ['DEL DATE', 'DELIVERY DATE', 'DATE', 'ORDER DATE'], 15);
      
      // Loop through sales data starting AFTER the header row
      for (var idx = headerRowIdx + 1; idx < salesData.length; idx++) {
        var rowCpn = String(salesData[idx][sCpn]).trim().toUpperCase();
        
        if (activeCpns.hasOwnProperty(rowCpn)) {
           var rawD = salesData[idx][sDel];
           if (rawD) {
             // FIX: Handle cases where the date might be interpreted as a string instead of a Date object
             var tstamp = (rawD instanceof Date) ? rawD.getTime() : new Date(rawD).getTime();
             if (!isNaN(tstamp) && tstamp > activeCpns[rowCpn].lastOrderTs) {
                 activeCpns[rowCpn].lastOrderTs = tstamp;
             }
           }
        }
      }
    }
    
    var results = [];
    var nowTS = new Date().getTime();
    var oneDay = 86400000;
    var tz = Session.getScriptTimeZone();
    
    for (var key in activeCpns) {
      var user = activeCpns[key];
      var daysSince = (nowTS - user.lastOrderTs) / oneDay;
      
      if (daysSince >= daysThreshold || user.lastOrderTs === 0) {
        user.cpn = key;
        user.lastDateStr = (user.lastOrderTs === 0) ? "Never Ordered" : Utilities.formatDate(new Date(user.lastOrderTs), tz, "dd-MMM-yyyy");
        user.daysDormant = (user.lastOrderTs === 0) ? 999 : Math.floor(daysSince); 
        user.status = status_fetch.toUpperCase();
        results.push(user);
      }
    }
    
    results.sort(function(a,b) { return a.daysDormant - b.daysDormant; });
    
    for(var k=0; k<results.length; k++) { 
        if(results[k].daysDormant === 999) results[k].daysDormant = ">30"; 
    }

    return { success: true, data: results };
  } catch(e) { 
      return { success: false, message: e.toString() }; 
  }
}

function getColIndexSafeDormant(headerRow, possibleNames, defaultIdx) {
  for (var i = 0; i < headerRow.length; i++) {
    var h = String(headerRow[i]).trim().toUpperCase();
    for (var j = 0; j < possibleNames.length; j++) { if (h === possibleNames[j]) return i; }
  } return defaultIdx;
}


// ==========================================
// NEW: Fetch Final Statuses from MASTER
// ==========================================
function getFinalStatuses() {
  try {
    var ss = SpreadsheetApp.openById(MASTER_SPREADSHEET_ID); 
    var sheet = ss.getSheetByName('SETUP');
    if (!sheet) return ['Active'];
    
    var lastRow = sheet.getLastRow();
    if (lastRow < 3) return ['Active'];
    
    var data = sheet.getRange(3, 33, lastRow - 2, 1).getValues();
    var statuses = [];
    
    for (var i = 0; i < data.length; i++) {
      // FIX: Trim the value immediately before processing
      var valStr = data[i][0] ? data[i][0].toString().trim() : "";
      
      if (valStr !== "" && statuses.indexOf(valStr) === -1) {
        statuses.push(valStr);
      }
    }
    
    return statuses.length > 0 ? statuses : ['Active'];
  } catch(e) {
    Logger.log("Error fetching statuses: " + e.toString());
    return ['Active'];
  }
}

// PUSH DORMANT CUSTOMERS TO CRM QUEUE (With Duplicate Prevention)
function pushDormantToCRMQueue(dormantCustomersList,forcePush) {
  var lock = LockService.getScriptLock();
  try {
    var currentUser = Session.getActiveUser().getEmail() || "Admin";
    lock.waitLock(10000);
    var sheet = SpreadsheetApp.openById(CRM_SPREADSHEET_ID).getSheetByName('DORMANT_CALL_LOGS');
    
    // 1. Fetch existing queue to check for active duplicates
    var existingData = fetchSheetDataFast(CRM_SPREADSHEET_ID, 'DORMANT_CALL_LOGS');
    var activeCPNs = {}; 
    
    // FIX: Pulling WIP Statuses dynamically from the SETUP sheet
    var setupConfigs = getCRMSetupData();
    var wipStatuses = setupConfigs.wipStatuses;

    for (var j = 1; j < existingData.length; j++) {
        var existingCpn = String(existingData[j][2] || "").trim().toUpperCase();
        var callStatus = String(existingData[j][6] || "").trim();
        
        var isPending = (callStatus === "" || callStatus.toLowerCase() === "pending");
        var isWip = wipStatuses.some(function(s) { return s.toLowerCase() === callStatus.toLowerCase(); });

        // If the CPN is currently active in the Pending or WIP queue, flag it
        if (isPending || isWip) {
            activeCPNs[existingCpn] = true;
        }
    }

    var timestamp = new Date();
    var newRows = [];
    var skippedCount = 0;

    for (var i = 0; i < dormantCustomersList.length; i++) {
      var c = dormantCustomersList[i];
      var cleanCpn = String(c.cpn).trim().toUpperCase();

      // 2. Prevent Duplicate: Skip if already active in Telecaller Queue
      if (!forcePush && activeCPNs[cleanCpn]) {
          skippedCount++;
          continue; 
      }

      // Generate the DORM-YYMMDD-XXXX Log ID
      var dateSuffix = Utilities.formatDate(timestamp, Session.getScriptTimeZone(), "yyMMdd");
      var randomDigit = Math.floor(1000 + Math.random() * 9000); 
      var logId = "DORM-" + dateSuffix + "-" + randomDigit;
      
      newRows.push([
        logId,                     // A: Log ID
        timestamp,                 // B: Formatted Date
        c.cpn,                     // C: CPN
        c.name || "Unknown",       // D: Name
        c.phone || "N/A",          // E: Phone
        c.days || 0,               // F: Days Dormant
        "Pending",                 // G: Call Status
        "",                        // H: Prev Status
        "",                        // I: New Status
        "",                        // J: Reason
        "",                        // K: Cust Remark
        "",                        // L: Telecaller Remark
        "Admin",                   // M: Action By
        timestamp,                 // N: Last Updated
        currentUser,               // O: Enter By
        timestamp                  // P: Enter On

      ]);
    }

    // 3. Push only the unique records
    if (newRows.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, newRows[0].length).setValues(newRows);
    }
    
    return { 
      success: true, 
      message: newRows.length + " customers pushed. " + skippedCount + " skipped (already active in queue)." 
    };
    
  } catch (e) {
    return { success: false, message: "System Error pushing to CRM: " + e.toString() };
  } finally {
    lock.releaseLock();
  }
}