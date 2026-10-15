// ==========================================
// SALES CALENDAR (DYNAMIC WEEKS)
// ==========================================
function getSalesCalendarData(weeks) {
  try {
    weeks = parseInt(weeks) || 4; // Default to 4 weeks if not provided
    var tz = Session.getScriptTimeZone();
    var now = new Date();
    
    // 1. Calculate Date Boundaries
    var currentDayOfWeek = now.getDay(); // 0 is Sunday
    var currentSunday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - currentDayOfWeek);
    var startDate = new Date(currentSunday.getFullYear(), currentSunday.getMonth(), currentSunday.getDate() - ((weeks - 1) * 7)); 
    var startTime = startDate.getTime();

    var masterSS = SpreadsheetApp.openById(MASTER_SPREADSHEET_ID);
    var histSS = SpreadsheetApp.openById(HISTORY_SPREADSHEET_ID);

    // 2. Build Master Database Map (No Sheet Name. Added POC1, CON 1, FINAL STATUS, DEFAULT RATE)
    var dbSheet = masterSS.getSheetByName('DATABASE');
    var cpnMap = {};
    if (dbSheet) {
      var dbData = dbSheet.getDataRange().getValues();
      var hDb = dbData[2] || []; 
      var cCpn = -1, cApt = -1, cBlk = -1, cDoor = -1, cPoc1 = -1, cCon1 = -1, cStatus = -1, cDefRate = -1;
      
      for(var c = 0; c < hDb.length; c++) {
        var h = String(hDb[c]).trim().toUpperCase();
        if(h === 'CPNNO' || h === 'CPN') cCpn = c;
        if(h === 'APARTMENT') cApt = c;
        if(h === 'BLOCK') cBlk = c;
        if(h === 'DOOR') cDoor = c;
        if(h === 'POC1') cPoc1 = c;
        if(h === 'CON 1' || h === 'CON1') cCon1 = c;
        if(h === 'FINAL STATUS') cStatus = c;
        if(h === 'DEFAULT RATE') cDefRate = c;
      }
      
      if(cCpn > -1) {
        for(var r = 3; r < dbData.length; r++) {
          var cpn = String(dbData[r][cCpn]).trim();
          if(cpn) {
            cpnMap[cpn] = {
              apt: cApt > -1 ? String(dbData[r][cApt]) : '',
              blk: cBlk > -1 ? String(dbData[r][cBlk]) : '',
              door: cDoor > -1 ? String(dbData[r][cDoor]) : '',
              poc: cPoc1 > -1 ? String(dbData[r][cPoc1]) : 'Unknown',
              contact: cCon1 > -1 ? String(dbData[r][cCon1]) : '',
              status: cStatus > -1 ? String(dbData[r][cStatus]).toUpperCase() : 'ACTIVE',
              defRate: cDefRate > -1 ? Number(dbData[r][cDefRate]) || 0 : 0
            };
          }
        }
      }
    }

    // 3. Reverse Loop the SALES Sheet
    var salesSheet = histSS.getSheetByName('SALES');
    var summary = {}, details = {};
    
    if (salesSheet) {
      var sData = salesSheet.getDataRange().getValues();
      var hS = sData[1] || []; 
      var sCpn = -1, sDate = -1, sActD = -1, sAmt = -1;
      
      for(var col = 0; col < hS.length; col++) {
        var hd = String(hS[col]).trim().toUpperCase();
        if(hd === 'CPNNO' || hd === 'CPN') sCpn = col;
        if(hd === 'DEL DATE') sDate = col;
        if(hd === 'ACT D') sActD = col;
        if(hd === 'AMOUNT') sAmt = col;
      }

      var outOfBoundsCount = 0;
      for (var row = sData.length - 1; row >= 2; row--) {
        var rawDate = sData[row][sDate];
        if (!rawDate) continue;
        
        var dTs = (rawDate instanceof Date) ? rawDate.getTime() : new Date(rawDate).getTime();
        if (isNaN(dTs)) continue;
        
        // Speed cutoff
        if (dTs < startTime) {
           outOfBoundsCount++;
           if (outOfBoundsCount > 250) break; 
           continue;
        } else {
           outOfBoundsCount = 0; 
        }

        var dateKey = Utilities.formatDate(new Date(dTs), tz, "yyyy-MM-dd");
        var actD = Number(sData[row][sActD]) || 0;
        var amt = Number(sData[row][sAmt]) || 0;
        var cpnNo = String(sData[row][sCpn]).trim();

        if (!summary[dateKey]) summary[dateKey] = { actD: 0, amt: 0 };
        summary[dateKey].actD += actD;
        summary[dateKey].amt += amt;

        if (!details[dateKey]) details[dateKey] = [];
        var profile = cpnMap[cpnNo] || { apt: sData[row][1], blk: sData[row][2], door: sData[row][3], poc: 'Unknown', contact: '', status: 'UNKNOWN', defRate: 0 }; 
        
        if (actD > 0 || amt > 0) {
            details[dateKey].push({
               cpn: cpnNo, poc: profile.poc, contact: profile.contact,
               apt: profile.apt, blk: profile.blk, door: profile.door, 
               status: profile.status, defRate: profile.defRate,
               actD: actD, amt: amt
            });
        }
      }
    }

    return { success: true, summary: summary, details: details, startDate: Utilities.formatDate(startDate, tz, "yyyy-MM-dd"), totalDays: weeks * 7 };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}