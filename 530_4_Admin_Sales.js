function fetchSalesDetailedReport(startStr, endStr, targetCpn) {
  try {
    // 1. Load Master Database for Apt, Blk, Door, Name, Contact
    var masterSS = SpreadsheetApp.openById(MASTER_SPREADSHEET_ID);
    var dbSheet = masterSS.getSheetByName('DATABASE');
    var dbData = dbSheet.getDataRange().getValues();
    var dbHeaders = dbData[2]; 
    
    var dbMap = {};
    dbHeaders.forEach((h, i) => { if(h) dbMap[String(h).toUpperCase().replace(/\s+/g, '')] = i; });
    var gDbCol = function(name) { return dbMap[name]; };

    var mCpn = gDbCol('CPNNO') !== undefined ? gDbCol('CPNNO') : gDbCol('CPN');
    var mApt = gDbCol('APARTMENT') !== undefined ? gDbCol('APARTMENT') : gDbCol('APT');
    var mBlk = gDbCol('BLOCK') !== undefined ? gDbCol('BLOCK') : gDbCol('BLK');
    var mDoor = gDbCol('DOOR') !== undefined ? gDbCol('DOOR') : gDbCol('FLAT');
    var mName = gDbCol('NAME') !== undefined ? gDbCol('NAME') : gDbCol('POC1');
    var mCon = gDbCol('PHONE') !== undefined ? gDbCol('PHONE') : gDbCol('CON1');
    var mStatus = gDbCol('FINALSTATUS');

    var custMap = {};
    for (var d = 3; d < dbData.length; d++) {
      var dbCpn = mCpn !== undefined ? String(dbData[d][mCpn]).trim().toUpperCase() : "";
      if (dbCpn) {
        custMap[dbCpn] = {
          apt: mApt !== undefined ? String(dbData[d][mApt]) : "-", 
          blk: mBlk !== undefined ? String(dbData[d][mBlk]) : "-", 
          door: mDoor !== undefined ? String(dbData[d][mDoor]) : "-",
          name: mName !== undefined ? String(dbData[d][mName]) : "Unknown", 
          contact: mCon !== undefined ? String(dbData[d][mCon]) : "-",
          status: mStatus !== undefined ? String(dbData[d][mStatus]).toUpperCase() : "UNKNOWN"
        };
      }
    }

    // 2. Fetch Sales Data with Bulletproof Space-Stripping Header Map
    var ss = SpreadsheetApp.openById(HISTORY_SPREADSHEET_ID);
    var sheet = ss.getSheetByName('SALES');
    if (!sheet) return { success: false, message: "SALES sheet not found." };
    
    var data = sheet.getDataRange().getValues();
    if(data.length < 3) return { success: true, data: [] };

    // --- BULLETPROOF HEADER FINDER ---
    var headerRowIdx = 1; 
    for (var h = 0; h < Math.min(5, data.length); h++) {
      var testStr = String(data[h][1]).trim().toUpperCase();
      if (testStr === "APARTMENT" || testStr === "APT") { headerRowIdx = h; break; }
    }
    
    var headers = data[headerRowIdx];
    var colMap = {};
    headers.forEach((h, i) => { if(h) colMap[String(h).toUpperCase().replace(/\s+/g, '')] = i; });
    var getVal = function(row, colName, defaultName) { 
      var idx = colMap[colName] !== undefined ? colMap[colName] : colMap[defaultName];
      return idx !== undefined ? row[idx] : ""; 
    };
    // ---------------------------------

    var startTS = startStr ? new Date(startStr).setHours(0,0,0,0) : 0;
    var endTS = endStr ? new Date(endStr).setHours(23,59,59,999) : 8640000000000000;
    var tz = Session.getScriptTimeZone();
    
    function fmtD(val, incTime) { 
      if (!val || String(val).trim() === "") return "-";
      var d = new Date(val);
      if (isNaN(d.getTime())) return String(val); 
      return Utilities.formatDate(d, tz, incTime ? "dd-MMM-yyyy hh:mm a" : "dd-MMM-yyyy"); 
    }
    
    var safeTargetCpn = targetCpn ? String(targetCpn).trim().toUpperCase() : "";
    var records = [];

    // 100% IN-MEMORY PROCESSING
    for (var i = data.length - 1; i > headerRowIdx; i--) {
      var rowCpn = String(getVal(data[i], 'CPNNO', 'CPN')).trim().toUpperCase();
      
      if (safeTargetCpn !== "" && rowCpn !== safeTargetCpn) continue;

      var rawDate = getVal(data[i], 'DELDATE'); 
      if (!rawDate) continue;
      
      var ts = (rawDate instanceof Date) ? rawDate.getTime() : new Date(rawDate).getTime();
      
      if (ts >= startTS && ts <= endTS) {
        var prof = custMap[rowCpn] || { apt: "-", blk: "-", door: "-", name: "Unknown", contact: "-", status: "UNKNOWN" };

        records.push({
          rowIdx: i + 1, cpn: rowCpn, apt: prof.apt, blk: prof.blk, door: prof.door, name: prof.name, contact: prof.contact, status: prof.status,
          delDate: fmtD(rawDate, false),
          actD: Number(getVal(data[i], 'ACTD')) || 0, 
          actE: Number(getVal(data[i], 'ACTE')) || 0, 
          rate: Number(getVal(data[i], 'RATE', 'DEFRATE')) || 0, 
          amt: Number(getVal(data[i], 'AMOUNT')) || 0,
          uniqueNo: String(getVal(data[i], 'UNIQUENO', 'UNIQUE_NO')).trim() || ("SALES_" + i),
          
          doorLink: String(getVal(data[i], 'DOORPHOTO', 'DOORDELIVERYLINK')).trim(), 
          ordD: Number(getVal(data[i], 'ORDD')) || 0, ordE: Number(getVal(data[i], 'ORDE')) || 0,
          
          actDVJ: Number(getVal(data[i], 'ACTDVJ')) || 0, 
          actDNVJ: Number(getVal(data[i], 'ACTDNVJ')) || 0, 
          actEVJ: Number(getVal(data[i], 'ACTEVJ')) || 0, 
          actENVJ: Number(getVal(data[i], 'ACTENVJ')) || 0,

          // --- REPLACEMENT MAPPING ---
          repQty: Number(getVal(data[i], 'REPLACEQTY', 'REPLACE_QTY')) || 0,
          repVj: Number(getVal(data[i], 'REPLACEACTVJ', 'REPLACE_ACT_VJ')) || 0,
          repNvj: Number(getVal(data[i], 'REPLACEACTNVJ', 'REPLACE_ACT_NVJ')) || 0,
          
          ordCmt: String(getVal(data[i], 'ORDCOMMENT')), delCmt: String(getVal(data[i], 'DELCOMMENT', 'COMMENT')), 
          ordBy: String(getVal(data[i], 'ORDERENTERBY', 'ENTERBY')), ordOn: fmtD(getVal(data[i], 'ORDERENTERON', 'ENTERON'), true),
          delBy: String(getVal(data[i], 'DELIVERYENTERBY')), delOn: fmtD(getVal(data[i], 'DELIVERYENTERON', 'DELENTERON'), true),
          
          colFull: Number(getVal(data[i], 'COLLECTEDFULL')) || 0, varFull: Number(getVal(data[i], 'VARIANCEFULL')) || 0, varEmp: Number(getVal(data[i], 'VARIANCEEMPTY')) || 0, varRes: String(getVal(data[i], 'VARIANCEREASON')),
          
          v2bLink: String(getVal(data[i], 'VANTOBLOCKPHOTO', 'VANTOBLOCKLINK')).trim(), b2vLink: String(getVal(data[i], 'BLOCKTOVANPHOTO', 'BLOCKTOVANLINK')).trim(),
          v2bFull: Number(getVal(data[i], 'VANTOBLOCKFULLCANCOUNT')) || 0, b2vFull: Number(getVal(data[i], 'BLOCKTOVANFULLCOUNT')) || 0, b2vEmp: Number(getVal(data[i], 'BLOCKTOVANEMPTYCOUNT')) || 0,
          unloadOn: fmtD(getVal(data[i], 'UNLOADON'), true), unloadBy: String(getVal(data[i], 'UNLOADBY')),
          loadOn: fmtD(getVal(data[i], 'LOADON'), true), loadBy: String(getVal(data[i], 'LOADBY'))
        });
      }
    }
    return { success: true, data: records };
  } catch (e) { return { success: false, message: e.toString() }; }
}