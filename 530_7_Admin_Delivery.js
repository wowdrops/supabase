function fetchDeliveryDetailedReport() {
  try {
    var ss = SpreadsheetApp.openById(ENTRY_SPREADSHEET_ID);
    var sheet = ss.getSheetByName('DEL2');
    var data = sheet.getDataRange().getValues();
    var results = { ledger: [], unloadsPending: 0, loadsPending: 0, visualMap: {}, totalOrdD: 0 };
    
    if(data.length < 3) return { success: true, data: results };

    // --- 5-ROW DYNAMIC SCANNER ---
    var hIdxNum = 2; 
    for(var h=0; h<Math.min(5, data.length); h++){
       if(String(data[h].join("")).toUpperCase().indexOf("CPN") > -1) { hIdxNum = h; break; }
    }
    var headers = data[hIdxNum]; 
    var hIdx = {};
    headers.forEach((col, idx) => { if (col) hIdx[String(col).trim().toUpperCase().replace(/\s+/g, '')] = idx; });
    // -----------------------------

    var tz = Session.getScriptTimeZone();
    function fmtDateOnly(val) { return (val instanceof Date) ? Utilities.formatDate(val, tz, "dd-MMM-yyyy") : (val || ""); }
    function fmtDateTime(val) { return (val instanceof Date) ? Utilities.formatDate(val, tz, "dd-MMM HH:mm") : (val || ""); }

    // 100% IN-MEMORY PROCESSING
    for (var i = hIdxNum + 1; i < data.length; i++) {
      var cpn = String(data[i][hIdx['CPNNO'] !== undefined ? hIdx['CPNNO'] : (hIdx['CPN'] !== undefined ? hIdx['CPN'] : 11)] || "").trim();
      if (!cpn) continue; 
      
      var apt = String(data[i][hIdx['APARTMENT']] || "").trim();
      var blk = hIdx['BLK'] !== undefined ? String(data[i][hIdx['BLK']] || "").trim() : (hIdx['BLOCK'] !== undefined ? String(data[i][hIdx['BLOCK']] || "").trim() : "");
      var door = String(data[i][hIdx['DOOR']] || "").trim();
      var delEnterOn = String(data[i][hIdx['DELIVERYENTERON']] || data[i][hIdx['DELENTERON']] || "").trim();
      var isDelivered = (delEnterOn !== "");

      var rowAmt = Number(data[i][hIdx['AMOUNT']]) || 0;
      if (!rowAmt && hIdx['ACTD'] !== undefined && hIdx['RATE'] !== undefined) {
         rowAmt = (Number(data[i][hIdx['ACTD']]) || 0) * (Number(data[i][hIdx['RATE']] || data[i][hIdx['DEFRATE']]) || 0);
      }
      
      results.ledger.push({
        apt: apt, blk: blk, door: door,
        name: String(data[i][hIdx['NAME']] || "").trim(),
        contact: String(data[i][hIdx['CONTACT']] || "").trim(),
        cpn: cpn,
        ordDate: hIdx['ORDDATE'] !== undefined ? fmtDateOnly(data[i][hIdx['ORDDATE']]) : "",
        ordD: hIdx['ORDD'] !== undefined ? (Number(data[i][hIdx['ORDD']]) || 0) : 0,
        ordE: hIdx['ORDE'] !== undefined ? (Number(data[i][hIdx['ORDE']]) || 0) : 0,
        pend: hIdx['PENDINGQTY'] !== undefined ? (Number(data[i][hIdx['PENDINGQTY']]) || 0) : (hIdx['PENDING_QTY'] !== undefined ? (Number(data[i][hIdx['PENDING_QTY']]) || 0) : 0),
        rep: hIdx['REPLACEQTY'] !== undefined ? (Number(data[i][hIdx['REPLACEQTY']]) || 0) : (hIdx['REPLACE_QTY'] !== undefined ? (Number(data[i][hIdx['REPLACE_QTY']]) || 0) : 0),
        repReason: hIdx['REPLACEREASON'] !== undefined ? String(data[i][hIdx['REPLACEREASON']] || "").trim() : (hIdx['REPLACE_REASON'] !== undefined ? String(data[i][hIdx['REPLACE_REASON']] || "").trim() : ""),
        delDate: hIdx['DELDATE'] !== undefined ? fmtDateOnly(data[i][hIdx['DELDATE']]) : "",
        actD: hIdx['ACTD'] !== undefined ? (Number(data[i][hIdx['ACTD']]) || 0) : 0,
        actE: hIdx['ACTE'] !== undefined ? (Number(data[i][hIdx['ACTE']]) || 0) : 0,
        rate: hIdx['RATE'] !== undefined ? (Number(data[i][hIdx['RATE']]) || 0) : (Number(data[i][hIdx['DEFRATE']]) || 0),
        ordComment: hIdx['ORDCOMMENT'] !== undefined ? String(data[i][hIdx['ORDCOMMENT']] || "").trim() : "",
        delComment: hIdx['DELCOMMENT'] !== undefined ? String(data[i][hIdx['DELCOMMENT']] || "").trim() : "",
        amt: rowAmt,
        uniqueNo: hIdx['UNIQUENO'] !== undefined ? String(data[i][hIdx['UNIQUENO']] || "").trim() : "",
        ordEnterOn: hIdx['ORDERENTERON'] !== undefined ? fmtDateTime(data[i][hIdx['ORDERENTERON']]) : (hIdx['ENTERON'] !== undefined ? fmtDateTime(data[i][hIdx['ENTERON']]) : ""),
        ordEnterBy: hIdx['ORDERENTERBY'] !== undefined ? String(data[i][hIdx['ORDERENTERBY']] || "").trim() : (hIdx['ENTERBY'] !== undefined ? String(data[i][hIdx['ENTERBY']] || "").trim() : ""),
        delEnterOn: delEnterOn,
        delEnterBy: hIdx['DELIVERYENTERBY'] !== undefined ? String(data[i][hIdx['DELIVERYENTERBY']] || "").trim() : "",
        doorQC: hIdx['DOORQC'] !== undefined ? String(data[i][hIdx['DOORQC']] || "").trim() : "",
        colFull: hIdx['COLLECTEDFULL'] !== undefined ? (Number(data[i][hIdx['COLLECTEDFULL']]) || 0) : 0,
        varFull: hIdx['VARIANCEFULL'] !== undefined ? (Number(data[i][hIdx['VARIANCEFULL']]) || 0) : 0,
        varEmpty: hIdx['VARIANCEEMPTY'] !== undefined ? (Number(data[i][hIdx['VARIANCEEMPTY']]) || 0) : 0,
        varReason: hIdx['VARIANCEREASON'] !== undefined ? String(data[i][hIdx['VARIANCEREASON']] || "").trim() : "",
        unloadOn: hIdx['UNLOADON'] !== undefined ? fmtDateTime(data[i][hIdx['UNLOADON']]) : "",
        unloadBy: hIdx['UNLOADBY'] !== undefined ? String(data[i][hIdx['UNLOADBY']] || "").trim() : "",
        loadOn: hIdx['LOADON'] !== undefined ? fmtDateTime(data[i][hIdx['LOADON']]) : "",
        loadBy: hIdx['LOADBY'] !== undefined ? String(data[i][hIdx['LOADBY']] || "").trim() : "",
        advAmt: hIdx['CANDEPOSIT'] !== undefined ? (Number(data[i][hIdx['CANDEPOSIT']]) || 0) : 0,
        actDVJ: hIdx['ACTDVJ'] !== undefined ? (Number(data[i][hIdx['ACTDVJ']]) || 0) : 0,
        actDNVJ: hIdx['ACTDNVJ'] !== undefined ? (Number(data[i][hIdx['ACTDNVJ']]) || 0) : 0,
        actEVJ: hIdx['ACTEVJ'] !== undefined ? (Number(data[i][hIdx['ACTEVJ']]) || 0) : 0,
        actENVJ: hIdx['ACTENVJ'] !== undefined ? (Number(data[i][hIdx['ACTENVJ']]) || 0) : 0,
        v2bFull: hIdx['VANTOBLOCKFULLCANCOUNT'] !== undefined ? (Number(data[i][hIdx['VANTOBLOCKFULLCANCOUNT']]) || 0) : (hIdx['VANTOBLOCKFULL'] !== undefined ? (Number(data[i][hIdx['VANTOBLOCKFULL']]) || 0) : 0),
        b2vFull: hIdx['BLOCKTOVANFULLCOUNT'] !== undefined ? (Number(data[i][hIdx['BLOCKTOVANFULLCOUNT']]) || 0) : (hIdx['BLOCKTOVANFULL'] !== undefined ? (Number(data[i][hIdx['BLOCKTOVANFULL']]) || 0) : 0),
        b2vEmpty: hIdx['BLOCKTOVANEMPTYCOUNT'] !== undefined ? (Number(data[i][hIdx['BLOCKTOVANEMPTYCOUNT']]) || 0) : (hIdx['BLOCKTOVANEMPTY'] !== undefined ? (Number(data[i][hIdx['BLOCKTOVANEMPTY']]) || 0) : 0),
        status: isDelivered ? 'DELIVERED' : 'PENDING'
      });
      
      var v2bLink = hIdx['VANTOBLOCKLINK'] !== undefined ? String(data[i][hIdx['VANTOBLOCKLINK']] || "").trim() : "";  
      var b2vLink = hIdx['BLOCKTOVANLINK'] !== undefined ? String(data[i][hIdx['BLOCKTOVANLINK']] || "").trim() : ""; 
      var doorLink = hIdx['DOORDELIVERYLINK'] !== undefined ? String(data[i][hIdx['DOORDELIVERYLINK']] || "").trim() : "";
      
      if(!results.visualMap[apt]) results.visualMap[apt] = { blocks: {} };
      if(!results.visualMap[apt].blocks[blk]) { results.visualMap[apt].blocks[blk] = { v2bLink: "", b2vLink: "", doors: [] }; }
      if (v2bLink) results.visualMap[apt].blocks[blk].v2bLink = v2bLink;
      if (b2vLink) results.visualMap[apt].blocks[blk].b2vLink = b2vLink;
      if (hIdx['ORDD'] !== undefined) results.totalOrdD += (Number(data[i][hIdx['ORDD']]) || 0);
      
      results.visualMap[apt].blocks[blk].doors.push({ door: door, isDelivered: isDelivered, link: doorLink });
    }
    
    for (var a in results.visualMap) {
      for (var b in results.visualMap[a].blocks) {
        if (!results.visualMap[a].blocks[b].v2bLink) results.unloadsPending++;
        if (!results.visualMap[a].blocks[b].b2vLink) results.loadsPending++;
      }
    }
    return { success: true, data: results };
  } catch(e) { return { success: false, message: e.toString() }; }
}