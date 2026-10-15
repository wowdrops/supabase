// ==========================================
// MODULE: OUTSTANDING REPORT
// ==========================================

function getOutstandingReportData() {
  try {
    var ss = SpreadsheetApp.openById(HISTORY_SPREADSHEET_ID);
    var sheet = ss.getSheetByName('OUTSTANDING');
    if (!sheet) return { success: false, message: "OUTSTANDING sheet unavailable." };

    var data = sheet.getDataRange().getValues();
    if (data.length < 7) return { success: true, data: [], headers: {} };

    // Dynamically extract month headers from Row 6 (Index 5)
    var headers = data[5];
    var monthHeaders = {
      m1: String(headers[16] || "Month 1").trim(), // Col Q
      m2: String(headers[17] || "Month 2").trim(), // Col R
      m3: String(headers[18] || "Month 3").trim(), // Col S
      m4: String(headers[19] || "Month 4").trim()  // Col T
    };

    var reportData = [];
    
    // Data starts at Row 7 (Index 6)
    for (var i = 6; i < data.length; i++) {
      var apt = String(data[i][1] || "").trim(); // Col B (Apartment)
      if (!apt) continue; // Skip empty rows

      var p1 = Number(data[i][16]) || 0; // Col Q
      var p2 = Number(data[i][17]) || 0; // Col R
      var p3 = Number(data[i][18]) || 0; // Col S
      var p4 = Number(data[i][19]) || 0; // Col T
      var depositAdv = Number(data[i][21]) || 0; // Col V

      var totalOutstanding = p1 + p2 + p3 + p4 + depositAdv;

      // SKIP DOOR IF THERE IS NO OUTSTANDING
      if (totalOutstanding === 0) continue;

      reportData.push({
        apartment: apt,
        block: String(data[i][2] || "").trim(), // Col C
        door: String(data[i][3] || "").trim(),  // Col D
        name: String(data[i][4] || "").trim(),  // Col E
        cpn: String(data[i][6] || "").trim(),   // Col G
        pend1: Number(data[i][16]) || 0,        // Col Q
        pend2: Number(data[i][17]) || 0,        // Col R
        pend3: Number(data[i][18]) || 0,        // Col S
        pend4: Number(data[i][19]) || 0,        // Col T
        cans: Number(data[i][20]) || 0,         // Col U
        advance: Number(data[i][21]) || 0,      // Col V
        payType: String(data[i][22] || "").trim().toUpperCase() // Col W (Keep as text)
      });
    }

    return { success: true, data: reportData, headers: monthHeaders };
  } catch (e) {
    return { success: false, message: "Error fetching outstanding data: " + e.toString() };
  }
}