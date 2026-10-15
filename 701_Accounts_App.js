function accounts_generateVoucherID(voucherType) {
  // 1. ACQUIRE THE SCRIPT LOCK
  var lock = LockService.getScriptLock();
  
  // Try to lock the script for up to 10 seconds. 
  // If the system is busy longer than that, it rejects the request safely.
  if (!lock.tryLock(10000)) {
    throw new Error("System is currently processing another transaction. Please try again in a few seconds.");
  }
  
  try {
    var ss = SpreadsheetApp.openById(WEBACCOUNTS_SPREADSHEET_ID);
    var txnSheet = ss.getSheetByName('TRANSACTIONS');
    
    // 2. FORMAT THE PREFIX (e.g., 'RCPT')
    var prefixMap = {
      'RECEIPT': 'RCPT',
      'PAYMENT': 'PAYM',
      'JOURNAL': 'JRNL',
      'CONTRA':  'CNTR'
    };
    var typePrefix = prefixMap[voucherType.toString().toUpperCase()] || 'VCHR';
    
    // 3. FORMAT THE YYMM STRING (e.g., '2608' for August 2026)
    var now = new Date();
    var yy = now.getFullYear().toString().slice(-2);
    var mm = ("0" + (now.getMonth() + 1)).slice(-2);
    var yymm = yy + mm; 
    
    var searchString = typePrefix + "-" + yymm + "-"; // Example: "PAYM-2608-"
    
    // 4. READ EXISTING IDs TO FIND THE MAX SEQUENCE
    var lastRow = txnSheet.getLastRow();
    var maxSeq = 0;
    
    if (lastRow > 1) {
      // Column O is Linked_JV_ID (Index 15 in GAS 1-based indexing)
      var jvData = txnSheet.getRange(2, 15, lastRow - 1, 1).getValues(); 
      
      for (var i = 0; i < jvData.length; i++) {
        var currentId = jvData[i][0] ? jvData[i][0].toString().trim() : "";
        
        // If the ID matches our current month and type prefix
        if (currentId.indexOf(searchString) === 0) {
          var seqString = currentId.replace(searchString, ""); // Strips out "PAYM-2608-"
          var seqNum = parseInt(seqString, 10);
          
          if (!isNaN(seqNum) && seqNum > maxSeq) {
            maxSeq = seqNum;
          }
        }
      }
    }
    
    // 5. INCREMENT AND PAD THE NEW SEQUENCE (e.g., '0042')
    var newSeq = maxSeq + 1;
    var paddedSeq = ("0000" + newSeq).slice(-4); 
    
    var finalVoucherID = searchString + paddedSeq; // Final Output: PAYM-2608-0042
    
    return finalVoucherID;
    
  } finally {
    // CRITICAL: Always release the lock so the next user in the queue can proceed
    lock.releaseLock();
  }
}