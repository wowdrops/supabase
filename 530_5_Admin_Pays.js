// ==========================================
// PAYS REPORT HELPER
// ==========================================
function getColIndexSafePays(headerRow, possibleNames, defaultIdx) {
  for (var i = 0; i < headerRow.length; i++) {
    // Strip all spaces and new lines to handle "AMO UNT" or "ENTER\nON"
    var h = String(headerRow[i]).toUpperCase().replace(/[\n\r\s]+/g, '');
    for (var j = 0; j < possibleNames.length; j++) { 
      var target = String(possibleNames[j]).toUpperCase().replace(/[\n\r\s]+/g, '');
      if (h === target) return i; 
    }
  } 
  return defaultIdx;
}

// ==========================================
// FETCH PAYS REPORT (DYNAMIC 5-ROW SCANNER)
// ==========================================
function fetchPaysDetailedReport(startStr, endStr, targetCpn) {
  try {
    var ss = SpreadsheetApp.openById(HISTORY_SPREADSHEET_ID);
    var sheet = ss.getSheetByName('PAYS');
    var data = sheet.getDataRange().getValues();
    if(data.length < 2) return { success: true, data: [] };

    // --- DYNAMIC 5-ROW HEADER SCANNER ---
    var headerRowIdx = 1; // Default to row 2 (Index 1)
    for (var r = 0; r < Math.min(5, data.length); r++) {
      var rowString = data[r].join("").toUpperCase().replace(/[\n\r\s]+/g, '');
      if (rowString.indexOf("CPNNO") > -1 || rowString.indexOf("AMOUNT") > -1) {
        headerRowIdx = r;
        break;
      }
    }
    
    var h = data[headerRowIdx];

    // Accurate mapping using the new Pays-specific helper function
    var c = {
      cpn: getColIndexSafePays(h, ['CPNNO', 'CPN'], 11),
      date: getColIndexSafePays(h, ['DATE'], 12),
      amt: getColIndexSafePays(h, ['AMOUNT', 'PAID', 'AMO UNT'], 13),
      time: getColIndexSafePays(h, ['TIME 24HR', 'TIME 24hr', 'TIME'], 14),
      refNo: getColIndexSafePays(h, ['REF NO', 'REF'], 15),
      bank: getColIndexSafePays(h, ['UPI / BANK', 'UPI/BANK', 'BANK'], 16),
      mode: getColIndexSafePays(h, ['MODE'], 17),
      comment: getColIndexSafePays(h, ['COMMENT'], 19),
      uniqueNo: getColIndexSafePays(h, ['UNIQUENO', 'UNIQUE NO'], 22),
      enterOn: getColIndexSafePays(h, ['ENTER ON', 'ENTERON'], 23),
      enterBy: getColIndexSafePays(h, ['ENTER BY', 'ENTERBY'], 24),
      entryFrom: getColIndexSafePays(h, ['ENTRY FROM', 'ENTRYFROM'], 25)
    };

    function getVal(row, idx) { return (idx !== undefined && idx > -1) ? row[idx] : ""; }

    var startTS = startStr ? new Date(startStr).setHours(0,0,0,0) : 0;
    var endTS = endStr ? new Date(endStr).setHours(23,59,59,999) : 8640000000000000;
    var tz = Session.getScriptTimeZone();
    
    // Normalize target CPN
    var safeTargetCpn = targetCpn ? String(targetCpn).trim().toUpperCase() : "";
    
    var results = [];
    
    // Loop stops at headerRowIdx to prevent reading the headers as data
    for (var i = data.length - 1; i > headerRowIdx; i--) {
      var rowCpn = String(getVal(data[i], c.cpn)).trim().toUpperCase();
      
      // LAYER 1 SPEED OPTIMIZATION: Bypass loop instantly if CPN doesn't match
      if (safeTargetCpn !== "" && rowCpn !== safeTargetCpn) continue;

      var rawDate = getVal(data[i], c.date); 
      if (!rawDate) continue;
      
      var ts = (rawDate instanceof Date) ? rawDate.getTime() : new Date(rawDate).getTime();
      
      if (ts >= startTS && ts <= endTS) {
        var rawEnterOn = getVal(data[i], c.enterOn);
        
        results.push({
          cpn: rowCpn,
          date: Utilities.formatDate(new Date(ts), tz, "dd-MMM-yyyy"),
          time: String(getVal(data[i], c.time)).trim(),
          timestamp: ts, // We send the raw timestamp to allow perfect frontend sorting
          amt: Number(getVal(data[i], c.amt)) || 0,
          mode: String(getVal(data[i], c.mode)).trim(),
          refNo: String(getVal(data[i], c.refNo)).trim(),
          bank: String(getVal(data[i], c.bank)).trim(),
          comment: String(getVal(data[i], c.comment)).trim(),
          uniqueNo: String(getVal(data[i], c.uniqueNo)).trim(),
          enterOn: (rawEnterOn instanceof Date) ? Utilities.formatDate(rawEnterOn, tz, "dd-MMM-yyyy hh:mm a") : String(rawEnterOn),
          enterBy: String(getVal(data[i], c.enterBy)).trim(),
          entryFrom: String(getVal(data[i], c.entryFrom)).trim()
        });
      }
    }
    return { success: true, data: results };
  } catch(e) { return { success: false, message: e.toString() }; }
}