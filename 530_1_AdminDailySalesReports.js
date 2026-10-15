// ==========================================
// MODULE E: ADMIN REPORTS
// ==========================================

function getDailySalesSummary(yearMonthStr) {
  try {
    var ss = SpreadsheetApp.openById(HISTORY_SPREADSHEET_ID);
    var sheet = ss.getSheetByName('SALES');
    if (!sheet) return { success: false, message: "SALES history sheet not found." };

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: true, data: [] };

    // Fetch the entire array into local execution memory at once for high-speed parsing
    var data = sheet.getDataRange().getValues();
    
    var targetYear = parseInt(yearMonthStr.split('-')[0], 10);
    var targetMonth = parseInt(yearMonthStr.split('-')[1], 10) - 1; 
    
    var summaryMap = {};

    // Column Map Index Calculations:
    // Col P = 15 (DEL DATE), Col Q = 16 (ACT D), Col R = 17 (ACT E), Col X = 23 (AMOUNT)
    for (var i = 1; i < data.length; i++) {
      var rawDate = data[i][15]; 
      if (!rawDate) continue;
      
      var recordDate = (rawDate instanceof Date) ? rawDate : new Date(rawDate);
      
      if (recordDate.getFullYear() === targetYear && recordDate.getMonth() === targetMonth) {
        var dateKey = Utilities.formatDate(recordDate, Session.getScriptTimeZone(), "yyyy-MM-dd");
        var displayDate = Utilities.formatDate(recordDate, Session.getScriptTimeZone(), "EEE, dd MMM yyyy");
        
        var cansDelivered = Number(data[i][16]) || 0;
        var emptiesRecovered = Number(data[i][17]) || 0;
        var financialAmount = Number(data[i][23]) || 0;
        
        if (!summaryMap[dateKey]) {
          summaryMap[dateKey] = {
            dateKey: dateKey,
            displayDate: displayDate,
            totalCansDelivered: 0,
            totalEmptiesTaken: 0,
            totalRevenue: 0
          };
        }
        
        summaryMap[dateKey].totalCansDelivered += cansDelivered;
        summaryMap[dateKey].totalEmptiesTaken += emptiesRecovered;
        summaryMap[dateKey].totalRevenue += financialAmount;
      }
    }

    var compiledList = Object.keys(summaryMap).map(function(k) { return summaryMap[k]; });
    compiledList.sort(function(a, b) { return new Date(a.dateKey) - new Date(b.dateKey); });

    return { success: true, data: compiledList };
    
  } catch(err) {
    return { success: false, message: "Report compilation crash: " + err.toString() };
  }
}