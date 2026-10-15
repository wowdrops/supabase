// ==========================================
// 601_CRM_Backend.gs
// Advanced API & Lazy Loading Backend
// ==========================================

function getColIdx(headers, possibleNames) {
  for(var i=0; i<headers.length; i++) {
      if(!headers[i]) continue;
      var h = String(headers[i]).toUpperCase().trim();
      for(var j=0; j<possibleNames.length; j++){
          if(h === possibleNames[j]) return i;
      }
  }
  return -1;
}

// FETCHES ALL QUEUES IN ONE INSTANT API CALL
function getAllCRMQueues(page) {
   var setup = getCRMSetupData();
   var data = fetchSheetDataFast(CRM_SPREADSHEET_ID, 'DORMANT_CALL_LOGS');
   
   var queues = { pending: [], wip: [], completed: [], hasMoreCompleted: false };
   
   // FIX: Pulling WIP Statuses dynamically from the SETUP sheet
   var wipStatuses = setup.wipStatuses;
   
   var MAX_COMPLETED = setup.maxCompletedLimit;
   page = page || 1;
   var skipLimit = (page - 1) * MAX_COMPLETED;
   var skipCount = 0;

   for (var i = data.length - 1; i >= 1; i--) {
      var callStatus = String(data[i][6] || "").trim();
      var isPending = (callStatus === "" || callStatus.toLowerCase() === "pending");
      var isWip = wipStatuses.some(function(s) { return s.toLowerCase() === callStatus.toLowerCase(); });
      
      var rawDate = data[i][13] || "N/A";
      var timestamp = 0;
      
      if (rawDate !== "N/A") {
         // Assuming format is "DD/MM/YYYY" or "DD/MM/YYYY HH:mm:ss"
         var parts = rawDate.split(/[\/\s:]/); 
         if (parts.length >= 3) {
            // Rearrange to YYYY, MM (0-indexed), DD
            timestamp = new Date(parts[2], parts[1] - 1, parts[0]).getTime();
         }
      }

      var item = {
         cpn: String(data[i][2] || "").trim(),
         type: "DORMANT",
         status: callStatus || "Pending",
         days: Number(data[i][5]) || 0,
         dateStr: rawDate,
         ts: timestamp
      };

      if (!item.cpn) continue;

      if (isPending) {
         queues.pending.push(item);
      } else if (isWip) {
         queues.wip.push(item);
      } else {
         // Completed Pagination Logic
         if (skipCount < skipLimit) { skipCount++; continue; }
         if (queues.completed.length < MAX_COMPLETED) {
             queues.completed.push(item);
         } else {
             queues.hasMoreCompleted = true;
         }
      }
   }
   return queues;
}

// LAZY LOAD 1: Profile, Orders, Outstanding
function getProfileAndAlerts(cpn) {
  var cleanCpn = String(cpn).trim().toUpperCase();
  var response = { profile: null, liveData: { outstanding: 0, hasOrder: false, ordDate: "", ordD: 0 } };
  
  var dbData = fetchSheetDataFast(MASTER_SPREADSHEET_ID, 'DATABASE');
  if (dbData.length > 2) {
      var headers = dbData[2];
      var cCpn = getColIdx(headers, ['CPNNO', 'CPN']);
      var cName = getColIdx(headers, ['POC1', 'NAME']);
      var cPhone = getColIdx(headers, ['CON 1', 'PHONE']);
      var cApt = getColIdx(headers, ['APARTMENT', 'APT']);
      var cBlk = getColIdx(headers, ['BLOCK', 'BLK']);
      var cDoor = getColIdx(headers, ['DOOR', 'FLAT']);
      var cRate = getColIdx(headers, ['DEFAULT RATE']);
      var cStatus = getColIdx(headers, ['FINAL STATUS']);
      var cCanDeposit = getColIdx(headers, ['CAN DEPOSIT']);
      
      for (var i = 3; i < dbData.length; i++) {
        if (String(dbData[i][cCpn] || "").trim().toUpperCase() === cleanCpn) {
          response.profile = {
            name: dbData[i][cName] || "Unknown", phone: dbData[i][cPhone] || "No Number",
            apt: dbData[i][cApt] || "", blk: dbData[i][cBlk] || "", door: dbData[i][cDoor] || "",
            rate: dbData[i][cRate] || 0, status: dbData[i][cStatus] || "ACTIVE", canDeposit: dbData[i][cCanDeposit] || 0
          };
          break;
        }
      }
  }

  var outData = fetchSheetDataFast(HISTORY_SPREADSHEET_ID, 'OUTSTANDING');
  for (var o = 6; o < outData.length; o++) {
      if (String(outData[o][6] || "").trim().toUpperCase() === cleanCpn) {
        response.liveData.outstanding = (Number(outData[o][16])||0) + (Number(outData[o][17])||0) + (Number(outData[o][18])||0) + (Number(outData[o][19])||0);
        response.liveData.payType = outData[o][22]|| "";
        break;
      }
  }

  var ordData = fetchSheetDataFast(ENTRY_SPREADSHEET_ID, 'ORD2');
  for (var r = ordData.length - 1; r >= 3; r--) {
      if (String(ordData[r][11] || "").trim().toUpperCase() === cleanCpn) {
        response.liveData.hasOrder = true;
        response.liveData.ordD = Number(ordData[r][13]) || 0; 
        response.liveData.ordDate = ordData[r][12] || "";
        break; 
      }
  }
  
  return response;
}



// LAZY LOAD 2: Sales and Pays
function getSalesAndPays(cpn) {
  var cleanCpn = String(cpn).trim().toUpperCase();
  var response = { sales: [], pays: [], lastDel: "N/A" };
  
  var salesData = fetchSheetDataFast(HISTORY_SPREADSHEET_ID, 'SALES');
  for (var j = salesData.length - 1; j >= 1; j--) {
      if (String(salesData[j][11] || "").trim().toUpperCase() === cleanCpn) {
        var dStr = salesData[j][15] || "";
        if (response.sales.length === 0) response.lastDel = dStr;
        response.sales.push({ date: dStr, actD: salesData[j][16] || 0, actE: salesData[j][17] || 0, amt: salesData[j][23] || 0 });
        if (response.sales.length >= 3) break; 
      }
  }

  var paysData = fetchSheetDataFast(HISTORY_SPREADSHEET_ID, 'PAYS');
  for (var k = paysData.length - 1; k >= 2; k--) {
      if (String(paysData[k][11] || "").trim().toUpperCase() === cleanCpn) {
         response.pays.push({ date: paysData[k][12] || "", amt: paysData[k][13] || 0, mode: paysData[k][17] || "Unknown" });
         if (response.pays.length >= 3) break; 
      }
  }
  return response;
}

// LAZY LOAD 3: CRM Logs (Includes Dormant & General Feedback)
function getCRMHistory(cpn) {
  var cleanCpn = String(cpn).trim().toUpperCase();
  var interactions = [];
  
  // 1. Fetch Dormant Call Logs
  var dLogs = fetchSheetDataFast(CRM_SPREADSHEET_ID, 'DORMANT_CALL_LOGS');
  for (var d = dLogs.length - 1; d >= 1; d--) {
      if (String(dLogs[d][2] || "").trim().toUpperCase() === cleanCpn) {
         var rawTs = dLogs[d][1];
         interactions.push({
           type: "Dormant Call", date: rawTs, timestamp: (new Date(rawTs)).getTime() || 0,
           status: dLogs[d][6] || "", prevStatus: dLogs[d][7] || "N/A", newStatus: dLogs[d][8] || "N/A",   
           reason: dLogs[d][9] || "N/A", custRemark: dLogs[d][10] || "N/A", remark: dLogs[d][11] || "N/A",     
           actionBy: dLogs[d][12] || "Admin", lastUpdated: dLogs[d][13] || ""
         });
      }
  }

  // 2. Fetch General Feedback Logs
  var fLogs = fetchSheetDataFast(CRM_SPREADSHEET_ID, 'GENERAL_FEEDBACK');
  if (fLogs && fLogs.length > 0) {
      for (var f = fLogs.length - 1; f >= 1; f--) {
          if (String(fLogs[f][2] || "").trim().toUpperCase() === cleanCpn) {
             var fRawTs = fLogs[f][1]; 
             interactions.push({
               type: "General Feedback", date: fRawTs, timestamp: (new Date(fRawTs)).getTime() || 0,
               status: fLogs[f][6] || "Feedback", prevStatus: fLogs[f][7] || "N/A", newStatus: fLogs[f][8] || "N/A",   
               reason: fLogs[f][5] || "N/A", custRemark: "N/A", remark: fLogs[f][9] || fLogs[f][11] || "N/A",     
               actionBy: fLogs[f][12] || "Telecaller", lastUpdated: fLogs[f][13] || fRawTs
             });
          }
      }
  }

  // Sort combined logs from newest to oldest
  interactions.sort(function(a, b) { return b.timestamp - a.timestamp; });
  return interactions.slice(0, 5);
}

// SAVE INTERACTION (Still uses SpreadsheetApp for safe writing)
function saveTelecallerInteraction(payload) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var timestamp = new Date();
    var finalRemark = payload.adminEscalate ? "⚠️ [ADMIN REVIEW REQUESTED] - " + payload.remark : payload.remark;
    
    var formatToTitleCase = function(str) {
      if (!str) return "";
      var cleanStr = String(str).trim();
      return cleanStr.charAt(0).toUpperCase() + cleanStr.slice(1).toLowerCase();
    };

    var exactNewStatus = formatToTitleCase(payload.newStatus);
    var exactPrevStatus = formatToTitleCase(payload.prevStatus);
    var safeCallStatus = String(payload.callStatus).trim();

    var setupConfigs = getCRMSetupData();
    var editableLimit = setupConfigs.editableRecords || 2;

    var crmSs = SpreadsheetApp.openById(CRM_SPREADSHEET_ID);
    var dormSheet = crmSs.getSheetByName('DORMANT_CALL_LOGS');
    var dormData = dormSheet.getDataRange().getValues();
    var crmUpdatedCount = 0;

    for (var i = dormData.length - 1; i >= 1; i--) {
      if (String(dormData[i][2]).trim().toUpperCase() === String(payload.cpn).toUpperCase()) { 
        var row = i + 1;
        dormSheet.getRange(row, 7).setValue(safeCallStatus);      
        dormSheet.getRange(row, 8).setValue(exactPrevStatus);     
        dormSheet.getRange(row, 9).setValue(exactNewStatus);      
        dormSheet.getRange(row, 10).setValue(payload.reason);     
        dormSheet.getRange(row, 12).setValue(finalRemark);        
        dormSheet.getRange(row, 13).setValue(payload.username);   
        dormSheet.getRange(row, 14).setValue(timestamp);          
        
        crmUpdatedCount++;
        if (crmUpdatedCount >= editableLimit) break; 
      }
    }

    var masterSs = SpreadsheetApp.openById(MASTER_SPREADSHEET_ID);
    var dbSheet = masterSs.getSheetByName('DATABASE');
    var dbData = dbSheet.getDataRange().getValues();
    var dbUpdated = false;

    var headers = dbData[2]; 
    var cpnIdx = -1, statusIdx = -1;

    for (var c = 0; c < headers.length; c++) {
      var h = String(headers[c]).trim().toUpperCase();
      if (h === 'CPNNO' || h === 'CPN') cpnIdx = c;
      if (h === 'FINAL STATUS') statusIdx = c;
    }

    if (cpnIdx > -1 && statusIdx > -1) {
      var cleanPayloadCpn = String(payload.cpn).trim().toUpperCase();
      for (var j = 3; j < dbData.length; j++) {
        if (String(dbData[j][cpnIdx]).trim().toUpperCase() === cleanPayloadCpn) { 
          dbSheet.getRange(j + 1, statusIdx + 1).setValue(exactNewStatus); 
          dbUpdated = true;
          break;
        }
      }
    }

    if (crmUpdatedCount > 0) return { success: true, message: "Saved to CRM (" + crmUpdatedCount + " logs) & Database." };
    return { success: false, message: "Could not find any recent records for this CPN." };

  } catch(e) {
    return { success: false, message: "System Error: " + e.toString() };
  } finally {
    lock.releaseLock();
  }
}