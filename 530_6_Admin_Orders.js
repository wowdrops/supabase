function fetchOrdersDetailedReport() {
  try {
    var ss = SpreadsheetApp.openById(ENTRY_SPREADSHEET_ID);
    var sheet = ss.getSheetByName('ORD2');
    var data = sheet.getDataRange().getValues();
    if(data.length < 3) return { success: true, data: [] };

    // --- 5-ROW DYNAMIC SCANNER ---
    var hIdx = 2; 
    for(var h=0; h<Math.min(5, data.length); h++){
       if(String(data[h].join("")).toUpperCase().indexOf("CPN") > -1) { hIdx = h; break; }
    }
    var headers = data[hIdx]; 
    var colMap = {};
    headers.forEach((col, idx) => { if (col) colMap[String(col).trim().toUpperCase().replace(/\s+/g, '')] = idx; });
    // -----------------------------

    var cCpn = colMap['CPNNO'] !== undefined ? colMap['CPNNO'] : (colMap['CPN'] !== undefined ? colMap['CPN'] : 11);
    var cName = colMap['NAME'] !== undefined ? colMap['NAME'] : (colMap['POC1'] !== undefined ? colMap['POC1'] : 4);
    var cDate = colMap['ENTERON'];
    var cOrdD = colMap['ORDD'];
    var cOrdE = colMap['ORDE'];
    var cPend = colMap['PENDINGQTY'] !== undefined ? colMap['PENDINGQTY'] : colMap['PENDING_QTY'];
    var cRep = colMap['REPLACEQTY'] !== undefined ? colMap['REPLACEQTY'] : colMap['REPLACE_QTY'];
    var cRepRea = colMap['REPLACEREASON'] !== undefined ? colMap['REPLACEREASON'] : colMap['REPLACE_REASON'];
    var cAmt = colMap['AMOUNT'];

    var tz = Session.getScriptTimeZone();
    var results = [];
    
    // 100% IN-MEMORY PROCESSING
    for (var i = hIdx + 1; i < data.length; i++) {
      if (!data[i][cCpn]) continue; 
      
      var rawDate = cDate !== undefined ? data[i][cDate] : ""; 
      var timeStr = rawDate ? Utilities.formatDate(new Date(rawDate), tz, "dd-MMM HH:mm") : "-";
      
      results.push({
        cpn: String(data[i][cCpn]).trim(),
        name: cName !== undefined ? String(data[i][cName]).trim() : "",
        date: timeStr,
        ordD: cOrdD !== undefined ? (Number(data[i][cOrdD]) || 0) : 0,
        ordE: cOrdE !== undefined ? (Number(data[i][cOrdE]) || 0) : 0,
        pend: cPend !== undefined ? (Number(data[i][cPend]) || 0) : 0,
        rep: cRep !== undefined ? (Number(data[i][cRep]) || 0) : 0,
        repReason: cRepRea !== undefined ? String(data[i][cRepRea]).trim() : "",
        amt: cAmt !== undefined ? (Number(data[i][cAmt]) || 0) : 0
      });
    }
    return { success: true, data: results.reverse() }; 
  } catch(e) { return { success: false, message: e.toString() }; }
}