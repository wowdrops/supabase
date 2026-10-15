function getDormantConversionAnalytics(startDateStr, endDateStr) {
  try {
    var crmSs = SpreadsheetApp.openById(CRM_SPREADSHEET_ID);
    var dormSheet = crmSs.getSheetByName('DORMANT_CALL_LOGS');
    var data = dormSheet.getDataRange().getValues();
    var start = new Date(startDateStr).setHours(0, 0, 0, 0);
    var end = new Date(endDateStr).setHours(23, 59, 59, 999);

    var analytics = { totalCalls: 0, activeToInactive: 0, pendingCount: 0, lostCustomers: [], reasons: {}, agents: {} };

    for (var i = 1; i < data.length; i++) {
      var status = String(data[i][6]).trim().toLowerCase(); 
      if (status === "" || status === "pending") { analytics.pendingCount++; continue; }
      var logDate = new Date(data[i][13]);
      if (logDate >= start && logDate <= end) {
        analytics.totalCalls++;
        var prevStatus = String(data[i][7]).trim().toUpperCase();
        var newStatus = String(data[i][8]).trim().toUpperCase();
        var reason = String(data[i][9]).trim() || "Unspecified";
        var agent = String(data[i][12]).trim() || "Unknown";
        if (prevStatus === "ACTIVE" && newStatus === "INACTIVE") {
          analytics.activeToInactive++;
          analytics.lostCustomers.push({ cpn: String(data[i][2]).trim(), name: String(data[i][3]).trim(), date: Utilities.formatDate(logDate, "Asia/Kolkata", "dd-MMM"), reason: reason });
        }
        analytics.reasons[reason] = (analytics.reasons[reason] || 0) + 1;
        analytics.agents[agent] = (analytics.agents[agent] || 0) + 1;
      }
    }
    return { success: true, data: analytics };
  } catch (e) { return { success: false, message: e.toString() }; }
}


/*

function getCRMPastStatus(startDateStr, endDateStr) {
  try {
    var crmSs = SpreadsheetApp.openById(CRM_SPREADSHEET_ID);
    var dormSheet = crmSs.getSheetByName('DORMANT_CALL_LOGS');
    var data = dormSheet.getDataRange().getValues();

    var start = new Date(startDateStr);
    start.setHours(0, 0, 0, 0);
    var end = new Date(endDateStr);
    end.setHours(23, 59, 59, 999);

    var report = {
      totalCalls: 0,
      activeToInactive: 0,
      lostCustomers: [], // Details of who became inactive
      reasons: {},
      agents: {}
    };

    for (var i = 1; i < data.length; i++) {
      var status = String(data[i][6]).trim().toLowerCase();
      if (status === "" || status === "pending") continue; // Skip pending calls

      var rawDate = data[i][13]; // Col N: Last Updated
      var logDate = new Date(rawDate);

      if (logDate >= start && logDate <= end) {
        report.totalCalls++;

        var prevStatus = String(data[i][7]).trim().toUpperCase();
        var newStatus = String(data[i][8]).trim().toUpperCase();
        var reason = String(data[i][9]).trim() || "Unspecified";
        var agent = String(data[i][12]).trim() || "Unknown";
        var cpn = String(data[i][2]).trim();
        var name = String(data[i][3]).trim();

        // 1. WOWDROPS REQUIREMENT: Active -> Inactive Conversion
        if (prevStatus === "ACTIVE" && newStatus === "INACTIVE") {
          report.activeToInactive++;
          report.lostCustomers.push({ cpn: cpn, name: name, date: Utilities.formatDate(logDate, "Asia/Kolkata", "dd-MMM"), reason: reason });
        }

        // 2. Aggregate Reasons
        if (!report.reasons[reason]) report.reasons[reason] = 0;
        report.reasons[reason]++;

        // 3. Aggregate Agent Productivity
        if (!report.agents[agent]) report.agents[agent] = 0;
        report.agents[agent]++;
      }
    }
    
    return { success: true, data: report };
  } catch(e) {
    return { success: false, message: e.toString() };
  }
}

*/