// ==========================================
// Handles the backend data fetching for the 4 CRM Cards
// ==========================================
// ==========================================
// Handles the backend data fetching for the 4 CRM Cards
// ==========================================
// ==========================================
// Handles the backend data fetching for the 5 CRM Cards
// ==========================================
function getCRMDashboardStats(daysBack) {
  try {
    var setup = getCRMSetupData(); 
    var data = fetchSheetDataFast(CRM_SPREADSHEET_ID, 'DORMANT_CALL_LOGS');
    
    var tz = Session.getScriptTimeZone();
    var now = new Date();
    
    // Default to 7 if undefined
    daysBack = parseInt(daysBack) || 7;
    var cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysBack).getTime();

    var payload = {
      inactive: { total: 0, splits: {}, rows: [] },
      retained: { total: 0, splits: {}, rows: [] }, // NEW: The Saved Customers
      wip: { total: 0, splits: {}, rows: [] },
      completed: { total: 0, splits: {}, rows: [] },
      escalated: { total: 0, splits: {}, rows: [] }
    };

    function parseDateObj(rawDate) {
       if (!rawDate) return 0;
       if (rawDate instanceof Date) return rawDate.getTime();
       if (typeof rawDate === 'string' && rawDate.trim() !== "") {
           var parsed = new Date(rawDate);
           if (!isNaN(parsed.getTime())) return parsed.getTime();
           var parts = rawDate.split(/[\/\s:-]/);
           if (parts.length >= 3) return new Date(parts[2], parts[1] - 1, parts[0]).getTime();
       }
       if (typeof rawDate === 'number') return Math.round((rawDate - 25569) * 86400000);
       return 0;
    }

    var wipStatuses = (setup.wipStatuses || []).map(function(s){ return String(s).toUpperCase(); });
    var compStatuses = (setup.completedStatuses || []).map(function(s){ return String(s).toUpperCase(); });

    for (var i = data.length - 1; i >= 1; i--) {
       var row = data[i];
       if (!row[0]) continue; 

       var lastUpTs = parseDateObj(row[13] || row[1]);
       var enterOnTs = parseDateObj(row[15] || row[1]);
       
       if (!lastUpTs || isNaN(lastUpTs) || lastUpTs < cutoff) continue; 

       var callStatus = String(row[6] || "").trim().toUpperCase();
       var prevStatus = String(row[7] || "").trim().toUpperCase();
       var newStatus = String(row[8] || "").trim().toUpperCase();
       var reason = String(row[9] || "Unspecified").trim();
       var telecallerRemark = String(row[11] || "");

       var record = {
         logId: row[0], 
         enterDate: enterOnTs ? Utilities.formatDate(new Date(enterOnTs), tz, "dd-MMM hh:mm a") : "N/A", 
         lastUpdateDate: lastUpTs ? Utilities.formatDate(new Date(lastUpTs), tz, "dd-MMM hh:mm a") : "N/A",
         cpn: row[2], name: row[3], callStatus: row[6], prevStatus: row[7], newStatus: row[8],
         reason: reason, custRemark: row[10], tcRemark: row[11], actionBy: row[12], ts: lastUpTs
       };

       // 1. LOST (Active -> Inactive)
       if (prevStatus === "ACTIVE" && newStatus === "INACTIVE") {
         payload.inactive.total++;
         payload.inactive.splits[reason] = (payload.inactive.splits[reason] || 0) + 1;
         payload.inactive.rows.push(record);
       }
       
       // 2. RETAINED / SAVED (Active -> Active OR Active Random)
       else if (prevStatus === "ACTIVE" && (newStatus === "ACTIVE" || newStatus === "ACTIVE RANDOM")) {
         payload.retained.total++;
         // Split by the New Status so you see how many went to Random vs stayed normal Active
         payload.retained.splits[newStatus] = (payload.retained.splits[newStatus] || 0) + 1;
         payload.retained.rows.push(record);
       }

       // 3. WIP / PENDING
       var isPending = (callStatus === "" || callStatus === "PENDING");
       var isWIP = (wipStatuses.indexOf(callStatus) !== -1);
       if (isPending || isWIP) {
         var splitKeyWip = isPending ? "Pending" : String(row[6]).trim();
         payload.wip.total++;
         payload.wip.splits[splitKeyWip] = (payload.wip.splits[splitKeyWip] || 0) + 1;
         payload.wip.rows.push(record);
       }

       // 4. COMPLETED
       var isCompleted = (compStatuses.indexOf(callStatus) !== -1);
       if (isCompleted) {
         payload.completed.total++;
         payload.completed.splits[reason] = (payload.completed.splits[reason] || 0) + 1;
         payload.completed.rows.push(record);
       }

       // 5. ESCALATED
       if (telecallerRemark.indexOf("⚠️ [ADMIN REVIEW REQUESTED]") !== -1) {
         var caller = String(row[12] || "Unknown");
         payload.escalated.total++;
         payload.escalated.splits[caller] = (payload.escalated.splits[caller] || 0) + 1;
         payload.escalated.rows.push(record);
       }
    }

    return { success: true, data: payload };

  } catch(e) {
    return { success: false, message: e.toString() };
  }
}

// ==========================================
// FETCH DORMANT DASHBOARD CARD COUNTS
// ==========================================
function getDormantDashboardCounts() {
  try {
    var masterSS = SpreadsheetApp.openById(MASTER_SPREADSHEET_ID);
    var histSS = SpreadsheetApp.openById(HISTORY_SPREADSHEET_ID);
    var activeCpns = {};

    // 1. Get all ACTIVE customers
    var dbSheet = masterSS.getSheetByName('DATABASE');
    if (dbSheet) {
      var dbData = dbSheet.getDataRange().getValues();
      var idxCpnDb = -1, idxStatus = -1;
      if (dbData.length > 2) {
        for (var cc = 0; cc < dbData[2].length; cc++) {
          var hName = String(dbData[2][cc]).trim().toUpperCase();
          if (hName === 'CPNNO' || hName === 'CPN') idxCpnDb = cc;
          if (hName === 'FINAL STATUS') idxStatus = cc;
        }
        if (idxCpnDb > -1 && idxStatus > -1) {
          for (var rDb = 3; rDb < dbData.length; rDb++) {
            if (String(dbData[rDb][idxStatus]).trim().toUpperCase() === 'ACTIVE') {
              var cpnNo = String(dbData[rDb][idxCpnDb]).trim();
              if (cpnNo) activeCpns[cpnNo] = 0; // 0 means no order yet
            }
          }
        }
      }
    }

    // 2. Find their last delivery date
    var salesSheet = histSS.getSheetByName('SALES');
    if (salesSheet) {
      var salesData = salesSheet.getDataRange().getValues();
      if (salesData.length > 1) {
        var sCpnIdx = 11, sDateIdx = 15; // Defaults based on your architecture
        for (var c = 0; c < salesData[0].length; c++) {
          var h = String(salesData[0][c]).trim().toUpperCase();
          if (h === 'CPNNO' || h === 'CPN') sCpnIdx = c;
          if (h === 'DEL DATE') sDateIdx = c;
        }
        for (var idx = 1; idx < salesData.length; idx++) {
          var rowCpn = String(salesData[idx][sCpnIdx]).trim();
          if (activeCpns.hasOwnProperty(rowCpn)) {
            var rawD = salesData[idx][sDateIdx];
            if (rawD) {
              var tstamp = (rawD instanceof Date) ? rawD.getTime() : new Date(rawD).getTime();
              if (tstamp > activeCpns[rowCpn]) activeCpns[rowCpn] = tstamp;
            }
          }
        }
      }
    }

    // 3. Bucket them by days
    var counts = { exactly7: 0, days7to10: 0, days10to15: 0, days15to30: 0 };
    var nowTS = new Date().getTime(), oneDay = 86400000;

    for (var key in activeCpns) {
      var days = (activeCpns[key] === 0) ? 999 : Math.floor((nowTS - activeCpns[key]) / oneDay);
      
      if (days === 7) counts.exactly7++;
      if (days >= 7 && days <= 10) counts.days7to10++;
      if (days > 10 && days <= 15) counts.days10to15++;
      if (days > 15 && days <= 30) counts.days15to30++;
    }
    
    return { success: true, counts: counts };
  } catch (e) { 
    return { success: false, message: e.toString() }; 
  }
}