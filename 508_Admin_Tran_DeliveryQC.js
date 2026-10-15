// ==========================================
// ADMIN IMAGE OVERRIDE UPLOAD
// ==========================================
const ADMIN_PROOFS_FOLDER_ID = '1d2_p__J4xrctt4_7eYxig6nI1HrCHU13';

// --- NEW: LIVE TOGGLE ROLLOVER STATE ---
function adminToggleRolloverStatus(uniqueNo, isRollover) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var sheet = SpreadsheetApp.openById(ENTRY_SPREADSHEET_ID).getSheetByName('DEL2');
    var lastRow = getLastDataRow(sheet, "L");
    if (lastRow < 3) return { success: false, message: "No data in DEL2." };

    // --- DYNAMIC HEADER MAPPING ---
    var headers = sheet.getRange(3, 1, 1, sheet.getLastColumn()).getValues()[0];
    var colMap = {};
    // Map spaces-stripped headers to their 1-based column index for sheet.getRange()
    headers.forEach((h, i) => { if(h) colMap[String(h).toUpperCase().replace(/\s+/g, '')] = i + 1; });
    
    var colUnique = colMap['UNIQUENO'] !== undefined ? colMap['UNIQUENO'] : 25;
    var colComment = colMap['DELCOMMENT'] !== undefined ? colMap['DELCOMMENT'] : (colMap['COMMENT'] || 21);

    // Grab the dynamic columns
    var dataKeys = sheet.getRange(3, colUnique, lastRow - 2, 1).getValues();
    var comments = sheet.getRange(3, colComment, lastRow - 2, 1).getValues();

    var targetRow = -1;
    for (var i = 0; i < dataKeys.length; i++) {
      if (String(dataKeys[i][0]).trim() === uniqueNo) {
        targetRow = i + 3;
        var cmt = String(comments[i][0]).trim();

        // Scrub old rollover tags from comment to keep it clean
        cmt = cmt.replace(/\[ROLLOVER: YES\]/g, "").replace(/\[ROLLOVER: NO\]/g, "").trim();

        // Append new explicit decision tag
        cmt = cmt + (isRollover ? " [ROLLOVER: YES]" : " [ROLLOVER: NO]");

        // Write back dynamically
        sheet.getRange(targetRow, colComment).setValue(cmt.trim());
        return { success: true };
      }
    }
    return { success: false, message: "Door not found in DEL2" };
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

// --- UNIFIED QC SYNC (100% DYNAMIC COLUMN MAPPING - BATCH WRITE FIX) ---
function syncQCState(payload) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var sheet = SpreadsheetApp.openById(ENTRY_SPREADSHEET_ID).getSheetByName('DEL2');
    
    // FIX: Use native getLastRow to ensure it never skips rows due to blank cells
    var lastRow = sheet.getLastRow();
    if (lastRow < 3) return { success: true };

    // Fetch data starting from Row 3 (the header row)
    var data = sheet.getRange(3, 1, lastRow - 2, sheet.getLastColumn()).getValues();
    var headers = data[0]; 
    
    var colMap = {};
    headers.forEach((h, i) => { if(h) colMap[String(h).toUpperCase().replace(/\s+/g, '')] = i; });
    var getCol = function(name) { return colMap[name]; };

    // DYNAMIC MAPPING FOR SAFETY
    var idxApt = getCol('APARTMENT') !== undefined ? getCol('APARTMENT') : (getCol('APT') || 1);
    var idxBlk = getCol('BLOCK') !== undefined ? getCol('BLOCK') : (getCol('BLK') || 2);
    var idxUnique = getCol('UNIQUENO') !== undefined ? getCol('UNIQUENO') : 24;
    var idxRate = getCol('RATE') !== undefined ? getCol('RATE') : (getCol('DEFRATE') || 18);

    var vDoorMap = {}, uDoorMap = {}, vBlockMap = {}, uBlockMap = {};
    if (payload.verifyDoors) payload.verifyDoors.forEach(function (d) { vDoorMap[d.id] = d; });
    if (payload.unverifyDoors) payload.unverifyDoors.forEach(function (d) { uDoorMap[d.id] = d; });
    if (payload.verifyBlocks) payload.verifyBlocks.forEach(function (b) { vBlockMap[b.apt + "_" + b.blk] = b; });
    if (payload.unverifyBlocks) payload.unverifyBlocks.forEach(function (b) { uBlockMap[b.apt + "_" + b.blk] = true; });

    var updatesMade = false;

    // Start at i = 1 to explicitly skip the header row!
    for (var i = 1; i < data.length; i++) {
      var apt = String(data[i][idxApt]).trim();
      var blk = String(data[i][idxBlk]).trim();
      var uniqueNo = String(data[i][idxUnique]).trim();
      var bKey = apt + "_" + blk;
      var rowModified = false;

      if (vDoorMap[uniqueNo] || uDoorMap[uniqueNo]) {
        var dMap = vDoorMap[uniqueNo] ? vDoorMap[uniqueNo] : uDoorMap[uniqueNo];
        
        var actD = Number(dMap.dvj) + Number(dMap.dnvj);
        var actE = Number(dMap.evj) + Number(dMap.envj);
        var rate = Number(data[i][idxRate]) || 0;

        if(getCol('DOORQC') !== undefined) data[i][getCol('DOORQC')] = vDoorMap[uniqueNo] ? true : false;
        if(getCol('ACTDVJ') !== undefined) data[i][getCol('ACTDVJ')] = dMap.dvj; 
        if(getCol('ACTDNVJ') !== undefined) data[i][getCol('ACTDNVJ')] = dMap.dnvj;
        if(getCol('ACTEVJ') !== undefined) data[i][getCol('ACTEVJ')] = dMap.evj; 
        if(getCol('ACTENVJ') !== undefined) data[i][getCol('ACTENVJ')] = dMap.envj;
        
        // --- FIX: REPLACE MISSING FORMULA MATH ---
        if(getCol('ACTD') !== undefined) data[i][getCol('ACTD')] = actD;
        if(getCol('ACTE') !== undefined) data[i][getCol('ACTE')] = actE;
        if(getCol('AMOUNT') !== undefined) data[i][getCol('AMOUNT')] = actD * rate;
        // -------------------------------------------
        
        if(getCol('REPLACE_ACT_VJ') !== undefined) data[i][getCol('REPLACE_ACT_VJ')] = dMap.repVj || 0;
        if(getCol('REPLACE_ACT_NVJ') !== undefined) data[i][getCol('REPLACE_ACT_NVJ')] = dMap.repNvj || 0;
        
        rowModified = true;
      }

      if (vBlockMap[bKey]) {
        if(getCol('BLOCKQC') !== undefined) data[i][getCol('BLOCKQC')] = "VERIFIED";
        if(getCol('VARIANCEFULL') !== undefined) data[i][getCol('VARIANCEFULL')] = vBlockMap[bKey].fullVar || 0;
        if(getCol('VARIANCEEMPTY') !== undefined) data[i][getCol('VARIANCEEMPTY')] = vBlockMap[bKey].empVar || 0;
        if(getCol('VARIANCEREASON') !== undefined) data[i][getCol('VARIANCEREASON')] = vBlockMap[bKey].reason || "";
        if(getCol('VANTOBLOCKFULLCANCOUNT') !== undefined) data[i][getCol('VANTOBLOCKFULLCANCOUNT')] = vBlockMap[bKey].v2bF || 0;
        if(getCol('BLOCKTOVANFULLCOUNT') !== undefined) data[i][getCol('BLOCKTOVANFULLCOUNT')] = vBlockMap[bKey].b2vF || 0;
        if(getCol('BLOCKTOVANEMPTYCOUNT') !== undefined) data[i][getCol('BLOCKTOVANEMPTYCOUNT')] = vBlockMap[bKey].b2vE || 0;
        rowModified = true;
      } else if (uBlockMap[bKey]) {
        if(getCol('BLOCKQC') !== undefined) data[i][getCol('BLOCKQC')] = "PENDING";
        if(getCol('VARIANCEFULL') !== undefined) data[i][getCol('VARIANCEFULL')] = 0; 
        if(getCol('VARIANCEEMPTY') !== undefined) data[i][getCol('VARIANCEEMPTY')] = 0; 
        if(getCol('VARIANCEREASON') !== undefined) data[i][getCol('VARIANCEREASON')] = "";
        rowModified = true;
      }

      if (rowModified) {
        updatesMade = true;
      }
    }

    // --- BATCH WRITE FIX ---
    // Execute ONE Single-Stroke Write for the entire modified dataset instead of looping row-by-row
    if (updatesMade) {
      sheet.getRange(3, 1, data.length, headers.length).setValues(data);
    }

    return { success: true };
  } catch (e) { return { success: false, message: e.toString() }; }
  finally { lock.releaseLock(); }
}

// --- QC DASHBOARD DATA FETCHER (WITH ORD2 PRE-LOAD) ---
function getPendingDeliveriesDEL2() {
  try {
    var sheet = SpreadsheetApp.openById(ENTRY_SPREADSHEET_ID).getSheetByName('DEL2');
    var lastRow = sheet.getLastRow();
    
    var existingOrd2 = {};
    try {
      var ordSheet = SpreadsheetApp.openById(ENTRY_SPREADSHEET_ID).getSheetByName('ORD2');
      var ordData = ordSheet.getDataRange().getValues();
      if (ordData.length > 2) {
        var ordHeaders = ordData[2];
        var ordColMap = {};
        ordHeaders.forEach((h, i) => { if (h) ordColMap[String(h).toUpperCase().replace(/\s+/g, '')] = i; });
        var ordCpnIdx = ordColMap['CPNNO'] !== undefined ? ordColMap['CPNNO'] : (ordColMap['CPN'] !== undefined ? ordColMap['CPN'] : 11);
        var ordDIdx = ordColMap['ORDD'] !== undefined ? ordColMap['ORDD'] : 13;
        var ordEIdx = ordColMap['ORDE'] !== undefined ? ordColMap['ORDE'] : 14;
        
        for (var o = 3; o < ordData.length; o++) {
          var oCpn = String(ordData[o][ordCpnIdx]).trim().toUpperCase();
          if (oCpn) {
            existingOrd2[oCpn] = {
              ordD: Number(ordData[o][ordDIdx]) || 0,
              ordE: Number(ordData[o][ordEIdx]) || 0
            };
          }
        }
      }
    } catch(err) { /* Fail silently if ORD2 is empty */ }

    if (lastRow < 3) return { success: true, payloadData: JSON.stringify({ blocks: {}, counts: { total: 0, finished: 0, pending: 0 }, existingOrd2: existingOrd2 }) };

    var data = sheet.getRange(3, 1, lastRow - 2, sheet.getLastColumn()).getValues();
    var headers = data[0];

    var colMap = {};
    for (var c = 0; c < headers.length; c++) {
      if (headers[c]) colMap[String(headers[c]).toUpperCase().replace(/\s+/g, '')] = c;
    }
    
    var getCol = function(name, fallback) { return colMap[name] !== undefined ? colMap[name] : fallback; };

    var idxDelEnter = getCol('DELIVERYENTERON', getCol('DELENTERON', 26));
    var idxDelBy = getCol('DELIVERYENTERBY', 27);
    var idxApt = getCol('APARTMENT', getCol('APT', 1));
    var idxBlk = getCol('BLOCK', getCol('BLK', 2));
    var idxCpn = getCol('CPNNO', getCol('CPN', 11));
    var idxUnique = getCol('UNIQUENO', 24);
    var idxDoor = getCol('DOOR', getCol('APTNO', 3));
    
    var blocksData = {};
    var counts = { total: 0, finished: 0, pending: 0 };

    function safeDateString(val) {
      if (!val) return "";
      if (val instanceof Date) {
        var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        var d = val.getDate(), m = months[val.getMonth()], y = String(val.getFullYear()).slice(-2);
        var hr = val.getHours(), min = val.getMinutes(), sec = val.getSeconds();
        hr = (hr < 10 ? '0' : '') + hr; min = (min < 10 ? '0' : '') + min; sec = (sec < 10 ? '0' : '') + sec;
        var dStr = (d < 10 ? '0' : '') + d;
        return dStr + '/' + m + '/' + y + ' ' + hr + ':' + min + ':' + sec;
      }
      return String(val).trim();
    }

    for (var i = 1; i < data.length; i++) {
      var apt = String(data[i][idxApt]).trim();
      var blk = String(data[i][idxBlk]).trim();
      var cpn = String(data[i][idxCpn]).trim();
      var uniqueNo = String(data[i][idxUnique]).trim();

      var delEnterOn = safeDateString(data[i][idxDelEnter]);
      var actDStr = String(data[i][getCol('ACTD', 16)]).trim();
      var actEStr = String(data[i][getCol('ACTE', 17)]).trim();

      if (!apt || !blk || !cpn || !uniqueNo) continue;
      if (delEnterOn === "" && actDStr === "" && actEStr === "") continue;

      var blockId = (apt + "_" + blk).replace(/\s+/g, '_');

      if (!blocksData[blockId]) {
        blocksData[blockId] = {
          apartment: apt, blockName: blk,
          v2bPhoto: String(data[i][getCol('VANTOBLOCKPHOTO', 9)] || ""), 
          b2vPhoto: String(data[i][getCol('BLOCKTOVANPHOTO', 10)] || ""),
          v2bFulls: 0, b2vFulls: 0, b2vEmpties: 0,
          isBlockVerified: false, varFull: 0, varEmp: 0, reason: "",
          unloadOn: safeDateString(data[i][getCol('UNLOADON', 57)]), 
          unloadBy: String(data[i][getCol('UNLOADBY', 58)] || ""),
          loadOn: safeDateString(data[i][getCol('LOADON', 59)]), 
          loadBy: String(data[i][getCol('LOADBY', 60)] || ""),
          v2bAI: data[i][getCol('VANTOBLOCKAI', 68)] || 0, 
          b2vF_AI: data[i][getCol('BLOCKTOVANFAI', 69)] || 0, 
          b2vE_AI: data[i][getCol('BLOCKTOVANEAI', 70)] || 0,
          doors: []
        };
        counts.total++;
      }

      var foundV2bFull = Number(data[i][getCol('VANTOBLOCKFULLCANCOUNT', 48)]) || 0;
      var foundB2vFull = Number(data[i][getCol('BLOCKTOVANFULLCOUNT', 49)]) || 0;
      var foundB2vEmp = Number(data[i][getCol('BLOCKTOVANEMPTYCOUNT', 50)]) || 0;

      if (foundV2bFull > blocksData[blockId].v2bFulls) blocksData[blockId].v2bFulls = foundV2bFull;
      if (foundB2vFull > blocksData[blockId].b2vFulls) blocksData[blockId].b2vFulls = foundB2vFull;
      if (foundB2vEmp > blocksData[blockId].b2vEmpties) blocksData[blockId].b2vEmpties = foundB2vEmp;

      if (String(data[i][getCol('BLOCKQC', 52)]).trim().toUpperCase() === "VERIFIED") {
        blocksData[blockId].isBlockVerified = true;
        blocksData[blockId].varFull = Number(data[i][getCol('VARIANCEFULL', 54)]) || 0;
        blocksData[blockId].varEmp = Number(data[i][getCol('VARIANCEEMPTY', 55)]) || 0;
        blocksData[blockId].reason = String(data[i][getCol('VARIANCEREASON', 56)] || "");
      }

      var delComment = String(data[i][getCol('DELCOMMENT', getCol('COMMENT', 20))] || "");
      var rolloverState = false;

      if (delComment.includes("[ROLLOVER: YES]")) rolloverState = true;
      else if (delComment.includes("[ROLLOVER: NO]")) rolloverState = false;
      else if (delComment.includes("[DEFERRED")) rolloverState = true;
      else if (delComment.includes("[CANCELLED")) rolloverState = false;

      // --- FIX: BYPASS MISSING SHEET FORMULAS BY CALCULATING IN BACKEND ---
      var actVj = Number(data[i][getCol('ACTDVJ', 62)]) || 0;
      var actNvj = Number(data[i][getCol('ACTDNVJ', 63)]) || 0;
      var actEVj = Number(data[i][getCol('ACTEVJ', 64)]) || 0;
      var actENvj = Number(data[i][getCol('ACTENVJ', 65)]) || 0;

      var rawActD = Number(data[i][getCol('ACTD', 16)]) || 0;
      var rawActE = Number(data[i][getCol('ACTE', 17)]) || 0;

      var finalActD = (actVj + actNvj > 0) ? (actVj + actNvj) : rawActD;
      var finalActE = (actEVj + actENvj > 0) ? (actEVj + actENvj) : rawActE;
      // --------------------------------------------------------------------

      blocksData[blockId].doors.push({
        sheetRow: i + 3,
        uniqueNo: uniqueNo,
        doorNo: String(data[i][idxDoor] || ""),
        cpn: cpn,
        delDate: safeDateString(data[i][getCol('DELDATE', 15)]),
        enterOn: delEnterOn,
        enterBy: String(data[i][idxDelBy] || ""),
        ordD: Number(data[i][getCol('ORDD', 13)]) || 0, 
        ordE: Number(data[i][getCol('ORDE', 14)]) || 0,
        
        actD: finalActD, // USING CALCULATED TOTALS
        actE: finalActE, // USING CALCULATED TOTALS
        
        dvj: actVj, dnvj: actNvj,
        evj: actEVj, envj: actENvj,

        replaceQty: Number(data[i][getCol('REPLACE_QTY', 99)]) || 0,
        replaceReason: String(data[i][getCol('REPLACE_REASON', 99)] || ""),
        repVj: Number(data[i][getCol('REPLACE_ACT_VJ', 99)]) || 0,
        repNvj: Number(data[i][getCol('REPLACE_ACT_NVJ', 99)]) || 0,

        aiD: Number(data[i][getCol('AIACTD', getCol('AID', 66))]) || 0, 
        aiE: Number(data[i][getCol('AIACTE', getCol('AIE', 67))]) || 0,
        doorPhoto: String(data[i][getCol('DOORPHOTO', getCol('DOORDELIVERYLINK', 21))] || ""),
        isVerified: data[i][getCol('DOORQC', 51)] === true || String(data[i][getCol('DOORQC', 51)]).toUpperCase() === "TRUE",
        delComment: delComment,
        rollover: rolloverState 
      });
    }

    for (var key in blocksData) {
      if (blocksData[key].isBlockVerified) counts.finished++;
      else counts.pending++;
    }

    return { success: true, payloadData: JSON.stringify({ blocks: blocksData, counts: counts, existingOrd2: existingOrd2 }) };
  } catch (e) { return { success: false, message: "Error mapping DEL2 data: " + e.toString() }; }
}

// --- TRANSFER TO SALES & ORD2 (100% DYNAMIC MAPPING) ---
function executeSecureTransferToSales(payload) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    var ssEntry = SpreadsheetApp.openById(ENTRY_SPREADSHEET_ID);
    var delSheet = ssEntry.getSheetByName('DEL2');
    var ordSheet = ssEntry.getSheetByName('ORD2');
    var ssHist = SpreadsheetApp.openById(HISTORY_SPREADSHEET_ID);
    var salesSheet = ssHist.getSheetByName('SALES');
    var tz = Session.getScriptTimeZone();

    var delData = delSheet.getDataRange().getValues();
    if (delData.length < 4) return { success: false, message: "No data to process." };
    
    var salesData = salesSheet.getDataRange().getValues();
    var ordData = ordSheet.getDataRange().getValues();

    // 1. DYNAMIC HEADER MAPPING (Space-Stripped for Safety)
    var cleanCol = (h) => String(h).toUpperCase().replace(/\s+/g, '');
    
    var delHeaders = delData[2];   // Row 3
    var ordHeaders = ordData[2];   // Row 3
    var salesHeaders = salesData[1]; // Row 2

    var delMap = {}, ordMap = {}, salesMap = {};
    delHeaders.forEach((h, i) => { if (h) delMap[cleanCol(h)] = i; });
    ordHeaders.forEach((h, i) => { if (h) ordMap[cleanCol(h)] = i; });
    salesHeaders.forEach((h, i) => { if (h) salesMap[cleanCol(h)] = i; });

    // --- BUILD LIVE COLLISION MAP ---
    var existingOrd2Map = {};
    for (var o = 3; o < ordData.length; o++) {
      var cpnIdx = ordMap['CPNNO'] !== undefined ? ordMap['CPNNO'] : ordMap['CPN'];
      var c = String(ordData[o][cpnIdx]).trim().toUpperCase();
      if (c) {
        existingOrd2Map[c] = {
          ordD: Number(ordData[o][ordMap['ORDD']]) || 0,
          ordE: Number(ordData[o][ordMap['ORDE']]) || 0
        };
      }
    }

    var liveCollisions = {};
    var hasCollisions = false;
    // -------------------------------------

    var matchedIndices = [];
    var salesBatch = [];
    var deferredBatch = [];
    var timestamp = new Date();
    // --- NEW: EOD HANDSHAKE BLOCKER ---
    var uniqueDriversInBatch = [];
    for (var r = 3; r < delData.length; r++) {
      var dName = String(delData[r][delMap['DELIVERYENTERBY']]).trim();
      if (dName && !uniqueDriversInBatch.includes(dName)) uniqueDriversInBatch.push(dName);
    }
    
    if (uniqueDriversInBatch.length > 0) {
      var handshakeStatus = verifyEodHandshakeStatus(uniqueDriversInBatch);
      
      // STRICT SECURITY WALL: Block on ANY failure, even if it's a system crash
      if (!handshakeStatus.success) {
        var errorDetails = handshakeStatus.pendingDrivers 
          ? "Missing EOD Handshake for: " + handshakeStatus.pendingDrivers.join(', ') + ". The physical truck inventory must be verified before transferring data to SALES."
          : "System Validation Error: " + (handshakeStatus.message || "Failed to verify physical inventory status.");
          
        return { success: false, message: "TRANSFER BLOCKED: " + errorDetails };
      }
    }
    // ----------------------------------
    // --- DYNAMIC DEL2 -> SALES MAPPER ---
    function mapDel2ToSales(row, dp) {
      var sRow = new Array(salesHeaders.length).fill("");
      var actD = Number(dp.dvj) + Number(dp.dnvj);
      var actE = Number(dp.evj) + Number(dp.envj);
      var rate = Number(row[delMap['RATE']] !== undefined ? row[delMap['RATE']] : (row[delMap['DEFRATE']] || 0));

      salesHeaders.forEach((h, i) => {
        var ch = cleanCol(h);
        
        // Handle QC logic and overrides
        if (ch === 'ACTD') sRow[i] = actD;
        else if (ch === 'ACTE') sRow[i] = actE;
        else if (ch === 'AMOUNT') sRow[i] = actD * rate;
        else if (ch === 'CHKBOXRESERVED5' || ch === 'RESERVED5') sRow[i] = "FALSE";
        else if (ch === 'DOORQC') sRow[i] = true;
        else if (ch === 'BLOCKQC') sRow[i] = "VERIFIED";
        else if (ch === 'VARIANCEFULL') sRow[i] = dp.fullVar;
        else if (ch === 'VARIANCEEMPTY') sRow[i] = dp.empVar;
        else if (ch === 'VARIANCEREASON') sRow[i] = dp.reason;
        else if (ch === 'VANTOBLOCKFULLCANCOUNT') sRow[i] = dp.v2bF;
        else if (ch === 'BLOCKTOVANFULLCOUNT') sRow[i] = dp.b2vF;
        else if (ch === 'BLOCKTOVANEMPTYCOUNT') sRow[i] = dp.b2vE;
        else if (ch === 'ACTDVJ') sRow[i] = dp.dvj;
        else if (ch === 'ACTDNVJ') sRow[i] = dp.dnvj;
        else if (ch === 'ACTEVJ') sRow[i] = dp.evj;
        else if (ch === 'ACTENVJ') sRow[i] = dp.envj;
        else if (ch === 'REPLACE_ACT_VJ') sRow[i] = dp.repVj || 0;
        else if (ch === 'REPLACE_ACT_NVJ') sRow[i] = dp.repNvj || 0;
        
        // Otherwise, if it exists in DEL2, copy it exactly
        else if (delMap[ch] !== undefined && row[delMap[ch]] !== undefined) {
          sRow[i] = row[delMap[ch]];
        }
      });
      return sRow;
    }

    var payloadDoors = {};
    if (payload.blocks) {
      payload.blocks.forEach(function (b) {
        b.doors.forEach(function (d) {
          if (d.uniqueNo) payloadDoors[d.uniqueNo] = {
            dvj: Number(d.dvj)||0, dnvj: Number(d.dnvj)||0, 
            evj: Number(d.evj)||0, envj: Number(d.envj)||0,
            repVj: Number(d.repVj)||0, repNvj: Number(d.repNvj)||0, // FIX: Added Replacement Values
            fullVar: b.fullVar, empVar: b.empVar, reason: b.reason,
            v2bF: b.v2bF, b2vF: b.b2vF, b2vE: b.b2vE, rollover: d.rollover
          };
        });
      });
    }

    // 2. Scan DEL2 Data
    for (var r = 3; r < delData.length; r++) {
      var row = delData[r];
      var rowUnique = String(row[delMap['UNIQUENO']]).trim();
      
      if (rowUnique && payloadDoors[rowUnique]) {
        var dp = payloadDoors[rowUnique];
        salesBatch.push(mapDel2ToSales(row, dp));

        // 3. EVALUATE ROLLOVERS (WITH LIVE PRE-FLIGHT CHECK)
        if (dp.rollover) {
          var calcD = (Number(dp.dvj) || 0) + (Number(dp.dnvj) || 0);
          var calcE = (Number(dp.evj) || 0) + (Number(dp.envj) || 0);
          var calcRep = (Number(dp.repVj) || 0) + (Number(dp.repNvj) || 0);

          var diffD = Math.max(0, (Number(row[delMap['ORDD']]) || 0) - calcD) || 0;
          var diffE = Math.max(0, (Number(row[delMap['ORDE']]) || 0) - calcE) || 0;
          
          // FIX: Safely fallback for the replacement column map and intercept NaN
          var idxRepQty = delMap['REPLACE_QTY'] !== undefined ? delMap['REPLACE_QTY'] : delMap['REPLACEQTY'];
          var diffRep = Math.max(0, (Number(row[idxRepQty]) || 0) - calcRep) || 0;

          if (diffD > 0 || diffE > 0 || diffRep > 0) { // TRIGGER ON REP SHORTAGE TOO
            var rowReason = String(row[delMap['DELCOMMENT']] || row[delMap['COMMENT']] || "").trim();

            if (!rowReason.includes("[CANCELLED")) {
              var targetCpn = String(row[delMap['CPNNO']]).trim().toUpperCase();

              // --- CRITICAL GUARD: ABORT IF CPN IN ORD2 ---
              if (existingOrd2Map[targetCpn]) {
                liveCollisions[targetCpn] = existingOrd2Map[targetCpn];
                hasCollisions = true;
              } else {
                existingOrd2Map[targetCpn] = { ordD: diffD, ordE: diffE }; // Temp lock
                
                var pushReason = "[ADMIN ROLLED: SHORTAGE]";
                if (rowReason.includes("[DEFERRED")) pushReason = rowReason.replace("[DEFERRED", "[AUTO-DEFERRED");
                else if (rowReason !== "") pushReason = rowReason;

                var ordRow = new Array(ordHeaders.length).fill("");
                var rate = Number(row[delMap['RATE']] !== undefined ? row[delMap['RATE']] : (row[delMap['DEFRATE']] || 0));
                
                // DYNAMIC DEL2 -> ORD2 MAPPER
                ordHeaders.forEach((h, i) => {
                  var ch = cleanCol(h);
                  
                  if (ch === 'ORDD') ordRow[i] = diffD;
                  else if (ch === 'ORDE') ordRow[i] = diffE;
                  else if (ch === 'AMOUNT') ordRow[i] = diffD * rate;
                  else if (ch === 'ORDCOMMENT') ordRow[i] = pushReason;
                  else if (ch === 'ORDDATE') ordRow[i] = Utilities.formatDate(new Date(), tz, "dd/MMM/yy");//var todayStr = Utilities.formatDate(new Date(), tz, "dd MMM yyyy");
                  else if (ch === 'STATUS') ordRow[i] = "PENDING";
                  else if (ch === 'PENDING_QTY') ordRow[i] = diffD;
                  else if (ch === 'REPLACE_QTY' || ch === 'REPLACEQTY') ordRow[i] = diffRep; 
                  else if (ch === 'REPLACE_ACT_VJ' || ch === 'REPLACEACTVJ' || ch === 'REPLACE_ACT_NVJ' || ch === 'REPLACEACTNVJ') ordRow[i] = "";
                  else if (ch === 'UNIQUENO') {
                     var suffix = (calcD > 0 || calcE > 0) ? "-P1" : "-R1";
                     ordRow[i] = rowUnique + suffix;
                  }
                  else if (ch === 'ENTERON') {
                    ordRow[i] = row[delMap['ORDERENTERON']] || row[delMap['ENTERON']] || timestamp;
                  }
                  else if (ch === 'ENTERBY') {
                    ordRow[i] = row[delMap['ORDERENTERBY']] || row[delMap['ENTERBY']] || currentUser;
                  }
                  // Otherwise, if it exists in DEL2, copy it exactly
                  else if (delMap[ch] !== undefined && row[delMap[ch]] !== undefined) {
                    ordRow[i] = row[delMap[ch]];
                  }
                });

                deferredBatch.push(ordRow);
              }
            }
          }
        }
        matchedIndices.push(r + 1); // Exact sheet row mapping
      }
    }

    // --- ABORT ENTIRE TRANSACTION IF LIVE COLLISIONS FOUND ---
    if (hasCollisions) {
      return { success: false, errorType: "COLLISION", collisionData: liveCollisions, message: "Transaction aborted due to ORD2 conflict." };
    }
    // ---------------------------------------------------------

    if (matchedIndices.length === 0) return { success: false, message: "No rows found." };

    // Set Data dynamically based on exact header lengths
    salesSheet.getRange(salesSheet.getLastRow() + 1, 1, salesBatch.length, salesHeaders.length).setValues(salesBatch);

    if (deferredBatch.length > 0) {
      var target = Math.max(ordSheet.getLastRow() + 1, 4);
      ordSheet.getRange(target, 1, deferredBatch.length, ordHeaders.length).setValues(deferredBatch);
    }

    var rowsAsc = matchedIndices.sort(function (a, b) { return a - b });
    var deleteGroups = [];
    var init = rowsAsc[0], currCnt = 1;
    for (var j = 1; j < rowsAsc.length; j++) {
      if (rowsAsc[j] === rowsAsc[j - 1] + 1) { currCnt++; } else { deleteGroups.push([init, currCnt]); init = rowsAsc[j]; currCnt = 1; }
    }
    deleteGroups.push([init, currCnt]);
    deleteGroups.reverse();

    delSheet.insertRowsAfter(delSheet.getMaxRows(), matchedIndices.length);
    for (var g = 0; g < deleteGroups.length; g++) delSheet.deleteRows(deleteGroups[g][0], deleteGroups[g][1]);

    return { success: true, message: "Sync successful!" };
  } catch (e) { return { success: false, message: "Transaction Failed: " + e.toString() }; }
  finally { lock.releaseLock(); }
}

function adminUpdateQCPhoto(payload) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    if (!payload.base64) return { success: false, message: "No image data provided." };

    var folder = DriveApp.getFolderById(ADMIN_PROOFS_FOLDER_ID);
    var parts = payload.base64.split(',');
    var encodedStr = parts.length > 1 ? parts[1] : parts[0];
    var bytes = Utilities.base64Decode(encodedStr);

    var timestamp = new Date().getTime();
    var filename = "ADMIN_OVR_" + payload.type.toUpperCase() + "_" + payload.apt + "_" + payload.blk + "_" + timestamp + ".jpg";
    var blob = Utilities.newBlob(bytes, 'image/jpeg', filename);

    var file = folder.createFile(blob);
    var fileId = file.getId();
    try { Drive.Permissions.insert({ 'role': 'reader', 'type': 'anyone' }, fileId); }
    catch (e) { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); }
    var url = file.getUrl();

    var sheet = SpreadsheetApp.openById(ENTRY_SPREADSHEET_ID).getSheetByName('DEL2');
    var lastRow = getLastDataRow(sheet, "L");
    if (lastRow < 3) return { success: true, url: url, count: 0 };

    // --- DYNAMIC HEADER MAPPING ---
    var headers = sheet.getRange(3, 1, 1, sheet.getLastColumn()).getValues()[0];
    var colMap = {};
    headers.forEach((h, i) => { if(h) colMap[String(h).toUpperCase().replace(/\s+/g, '')] = i; });
    
    // Array Indexes (0-based) for reading data
    var idxApt = colMap['APARTMENT'] !== undefined ? colMap['APARTMENT'] : (colMap['APT'] || 1);
    var idxBlk = colMap['BLOCK'] !== undefined ? colMap['BLOCK'] : (colMap['BLK'] || 2);
    var idxUnique = colMap['UNIQUENO'] !== undefined ? colMap['UNIQUENO'] : 24;
    
    // Sheet Column Indexes (1-based) for writing data
    var colV2B = (colMap['VANTOBLOCKPHOTO'] !== undefined ? colMap['VANTOBLOCKPHOTO'] : 9) + 1;
    var colB2V = (colMap['BLOCKTOVANPHOTO'] !== undefined ? colMap['BLOCKTOVANPHOTO'] : 10) + 1;
    var colDoor = (colMap['DOORPHOTO'] !== undefined ? colMap['DOORPHOTO'] : (colMap['DOORDELIVERYLINK'] || 21)) + 1;

    var data = sheet.getRange(3, 1, lastRow - 2, sheet.getLastColumn()).getValues();
    var updatesMade = 0;

    for (var i = 0; i < data.length; i++) {
      var rowApt = String(data[i][idxApt]).trim();
      var rowBlk = String(data[i][idxBlk]).trim();
      var rowUnique = String(data[i][idxUnique]).trim();

      if (rowApt === payload.apt && rowBlk === payload.blk) {
        if (payload.type === 'v2b') {
          sheet.getRange(i + 3, colV2B).setValue(url);
          updatesMade++;
        } else if (payload.type === 'b2v') {
          sheet.getRange(i + 3, colB2V).setValue(url);
          updatesMade++;
        } else if (payload.type === 'door' && rowUnique === payload.doorUniqueNo) {
          sheet.getRange(i + 3, colDoor).setValue(url);
          updatesMade++;
          break;
        }
      }
    }

    return { success: true, url: url, count: updatesMade };
  } catch (e) { return { success: false, message: e.toString() }; }
  finally { lock.releaseLock(); }
}

// ==========================================
// EOD HANDSHAKE: GENERATE OTP PIN FOR MANAGER
// ==========================================
function generateManagerEodPin(userEmail) {
  var lock = LockService.getScriptLock();
  try {
    // 1. Hard-Stop on backend if email payload is missing
    if (!userEmail) return { success: false, message: "Security error: Admin email is missing from payload." };
    
    lock.waitLock(10000);
    var ss = SpreadsheetApp.openById(MASTER_SPREADSHEET_ID);
    var sheet = ss.getSheetByName('Users'); 
    var data = sheet.getDataRange().getValues();
    
    var headers = data[0];
    var colMap = {};
    headers.forEach((h, i) => { if(h) colMap[String(h).toUpperCase().replace(/\s+/g, '')] = i; });
    
    // 2. Updated Scanner: Now specifically checks for 'MAILID'
    var emailIdx = colMap['MAILID'] !== undefined ? colMap['MAILID'] : (colMap['EMAILID'] !== undefined ? colMap['EMAILID'] : colMap['EMAIL']);
    var pinIdx = colMap['PIN'];
    
    if (pinIdx === undefined) {
      pinIdx = headers.length;
      sheet.getRange(1, pinIdx + 1).setValue('PIN');
    }
    
    var searchEmail = String(userEmail).trim().toLowerCase();
    var newPin = Math.floor(1000 + Math.random() * 9000).toString(); 
    var userFound = false;
    
    // 3. Scan exclusively by Email
    for (var i = 1; i < data.length; i++) {
      var rowEmail = emailIdx !== undefined ? String(data[i][emailIdx]).trim().toLowerCase() : "";
      
      if (rowEmail === searchEmail) {
        sheet.getRange(i + 1, pinIdx + 1).setValue(newPin);
        userFound = true;
        break;
      }
    }
    
    if (userFound) return { success: true, pin: newPin };
    else return { success: false, message: "Admin email not found in Users database." };
    
  } catch (e) { return { success: false, message: e.toString() }; }
  finally { lock.releaseLock(); }
}

// ==========================================
// EOD HANDSHAKE: VERIFY COMPLETION PRE-TRANSFER
// ==========================================
function verifyEodHandshakeStatus(driverList) {
try {
    // Uses the global HISTORY_SPREADSHEET_ID you defined in the router
    var ss = SpreadsheetApp.openById(HISTORY_SPREADSHEET_ID);
    var logSheet = ss.getSheetByName('EOD_LOG');
    
    if (!logSheet) return { success: false, message: "EOD_LOG sheet could not be found." };
    
    var data = logSheet.getDataRange().getValues();
    if (data.length < 2) return { success: false, message: "EOD_LOG sheet is empty." };
    
    // --- DYNAMIC HEADER MAPPING ---
    var headers = data[0];
    var colMap = {};
    headers.forEach((h, i) => { if(h) colMap[String(h).toUpperCase().replace(/\s+/g, '')] = i; });
    
    var idxTime = colMap['TIMESTAMP'] !== undefined ? colMap['TIMESTAMP'] : 0;
    var idxDriver = colMap['DRIVERMAILID'] !== undefined ? colMap['DRIVERMAILID'] : (colMap['DRIVER'] || 1);
    var idxStatus = colMap['STATUS'] !== undefined ? colMap['STATUS'] : 9; // Fallback to column J
    // ------------------------------

    var tz = Session.getScriptTimeZone();
    
    // Format today's date strictly as DD/MM/YYYY to match your sheet strings
    var todayStr = Utilities.formatDate(new Date(), tz, "dd/MM/yyyy");
    
    var verifiedDriversToday = [];
    
    for (var i = 1; i < data.length; i++) {
      var rawTime = data[i][idxTime];
      if (!rawTime) continue; // Skip blank rows
      
      var logDateStr = "";
      
      // SAFELY PARSE DATES: Handle both active Date objects and raw text strings
      if (rawTime instanceof Date) {
         logDateStr = Utilities.formatDate(rawTime, tz, "dd/MM/yyyy");
      } else {
         // If it is a string like "14/08/2026 08:25:32", split by space and take the first part
         logDateStr = String(rawTime).split(" ")[0].trim();
      }
      
      // Look for "Completed" in the dynamically found STATUS column
      if (logDateStr === todayStr && String(data[i][idxStatus]).trim().toLowerCase() === "completed") {
        verifiedDriversToday.push(String(data[i][idxDriver]).trim().toLowerCase());
      }
    }
    
    var pending = [];
    driverList.forEach(driver => {
       if (!verifiedDriversToday.includes(String(driver).trim().toLowerCase())) {
           pending.push(driver);
       }
    });
    
    if (pending.length === 0) return { success: true };
    else return { success: false, pendingDrivers: pending };
    
  } catch(e) {
    return { success: false, message: "Backend crash while reading inventory log: " + e.toString() };
  }
}