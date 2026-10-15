// ==========================================
// ADMIN PORTAL UI LOGIC (Notifications)
// ==========================================

function backendGetNotificationLogs(startDateStr, endDateStr) {
  try {
    var ss = SpreadsheetApp.openById(PUSH_SPREADSHEET_ID);
    var sheet = ss.getSheetByName('NOTIFICATION_LOGS');
    if (!sheet) return { success: false, message: "NOTIFICATION_LOGS sheet not found!" };

    var data = sheet.getDataRange().getValues();
    
    var startD = new Date(startDateStr); startD.setHours(0,0,0,0);
    var endD = new Date(endDateStr); endD.setHours(23,59,59,999);
    
    var logs = [];
    var counts = { total: 0, process: 0, completed: 0, reminders: 0 };

    for (var i = data.length - 1; i > 0; i--) {
      var rowDate = new Date(data[i][0]);
      
      if (rowDate >= startD && rowDate <= endD) {
        var category = String(data[i][2]).trim();
        
        counts.total++;
        if (category === "Delivery Under Process") counts.process++;
        else if (category === "Delivery Completed") counts.completed++;
        else if (category === "Order Reminder") counts.reminders++;

        logs.push({
          timestamp: Utilities.formatDate(rowDate, Session.getScriptTimeZone(), "dd/MM/yy HH:mm"),
          cpn: String(data[i][1]),
          category: category,
          title: String(data[i][3]),
          message: String(data[i][4]),
          status: String(data[i][5])
        });
      }
    }
    return { success: true, logs: logs, counts: counts };
  } catch(e) {
    return { success: false, message: e.toString() };
  }
}

function backendQueueAdminBroadcast(title, message, adminUser) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000); 
    var ss = SpreadsheetApp.openById(PUSH_SPREADSHEET_ID);
    var sheet = ss.getSheetByName('NOTIFICATION_LOGS');
    
    sheet.appendRow([
      new Date(), 
      "ALL", 
      "Admin Broadcast", 
      title, 
      message, 
      "QUEUED", 
      "", 
      adminUser
    ]);
    
    return { success: true };
  } catch(e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

// ==========================================
// BACKGROUND QUEUE PROCESSOR (RangeList Optimized)
// ==========================================

function processNotificationQueue() {
  _coreQueueProcessor(5); // Process 5 at a time for the automated background trigger
}

function forceProcessNotificationQueue() {
  var result = _coreQueueProcessor(50); // Process 50 at a time for the manual admin button
  if (result.locked) {
      return { success: false, message: "Queue is currently locked by the automated timer. Try again in 30 seconds." }; 
  }
  return { success: true, count: result.processedCount };
}

// ⚡ CORE ENGINE: Used by both automated and manual triggers
function _coreQueueProcessor(batchLimit) {
  var lock = LockService.getScriptLock();
  var tasksToProcess = [];
  var tokenMap = {};
  var cellsToUpdate = [];

  // --- PHASE 1: GRAB LOCK & TARGET SPECIFIC ROWS ---
  try {
    if (!lock.tryLock(10000)) return { locked: true, processedCount: 0 }; 
    
    var ss = SpreadsheetApp.openById(PUSH_SPREADSHEET_ID);
    var logSheet = ss.getSheetByName('NOTIFICATION_LOGS');
    var subSheet = ss.getSheetByName('PUSH_SUBSCRIPTIONS');
    
    if (!logSheet || !subSheet) return { locked: false, processedCount: 0 };

    var logs = logSheet.getDataRange().getValues();
    var subs = subSheet.getDataRange().getValues();
    
    for (var i = 1; i < subs.length; i++) {
       var subCpn = String(subs[i][0]).trim().toUpperCase();
       if(subCpn && subs[i][1]) tokenMap[subCpn] = subs[i][1];
    }

    var processedCount = 0;
    var now = new Date().getTime();

    for (var r = 1; r < logs.length; r++) {
       if (processedCount >= batchLimit) break;
       
       var status = String(logs[r][5]).trim().toUpperCase();
       var entryTime = new Date(logs[r][0]).getTime();
       
       // SELF-HEALING: Pick up anything stuck in processing for > 15 mins
       var isStuck = (status === "PROCESSING" && (now - entryTime > 15 * 60 * 1000));
       
       if (status === "QUEUED" || isStuck) {
          cellsToUpdate.push("F" + (r + 1)); // Collect exact cell addresses (e.g., F3, F5)
          
          tasksToProcess.push({
             rowNumber: r + 1,
             targetCpn: String(logs[r][1]).trim().toUpperCase(),
             title: logs[r][3],
             msg: logs[r][4]
          });
          processedCount++;
       }
    }

    // ⚡ ONE SINGLE API CALL to mark all tasks as PROCESSING
    if (cellsToUpdate.length > 0) {
       logSheet.getRangeList(cellsToUpdate).setValue("PROCESSING");
    }

  } catch (e) {
    console.error("Queue Processor Lock Error: " + e.toString());
    return { locked: false, processedCount: 0 };
  } finally {
    // ⚡ RELEASE LOCK IMMEDIATELY 
    lock.releaseLock();
  }

  if (tasksToProcess.length === 0) return { locked: false, processedCount: 0 };

  // --- PHASE 2: FIREBASE CALLS (NO LOCK HELD) ---
  for (var t = 0; t < tasksToProcess.length; t++) {
     var task = tasksToProcess[t];
     var finalStatus = "FAILED";
     var finalLog = "Unknown Error";

     try {
         if (task.targetCpn === "ALL") {
             var sentCount = 0;
             for (var custCpn in tokenMap) {
                sendPushNotification(tokenMap[custCpn], task.title, task.msg, custCpn);
                sentCount++;
             }
             finalStatus = "SENT";
             finalLog = "Broadcasted to " + sentCount + " devices";
         } else {
             var token = tokenMap[task.targetCpn];
             if (token) {
                var res = sendPushNotification(token, task.title, task.msg, task.targetCpn);
                if (res.error) {
                   finalStatus = "FAILED";
                   finalLog = JSON.stringify(res.error);
                } else {
                   finalStatus = "SENT";
                   finalLog = "";
                }
             } else {
                finalStatus = "FAILED";
                finalLog = "User is not subscribed to notifications.";
             }
         }
     } catch (fError) {
         finalStatus = "QUEUED"; // Auto-revert if Firebase API crashes
         finalLog = "System crashed during send: " + fError.toString();
     } finally {
         // --- PHASE 3: SAFE ROW-BY-ROW WRITE BACK ---
         try {
             if (lock.tryLock(10000)) {
                var updateSheet = SpreadsheetApp.openById(PUSH_SPREADSHEET_ID).getSheetByName('NOTIFICATION_LOGS');
                updateSheet.getRange(task.rowNumber, 6, 1, 2).setValues([[finalStatus, finalLog]]);
             }
         } catch(e) {
             console.error("Failed final write: " + e.toString());
         } finally {
             lock.releaseLock();
         }
     }
  }
  return { locked: false, processedCount: tasksToProcess.length };
}

// ==========================================
// DATABASE MAINTENANCE: AUTOMATED CLEANUP
// ==========================================

function cleanupOldNotifications() {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var ss = SpreadsheetApp.openById(PUSH_SPREADSHEET_ID);
    var logSheet = ss.getSheetByName('NOTIFICATION_LOGS');
    if (!logSheet) return;

    var data = logSheet.getDataRange().getValues();
    var now = new Date().getTime();
    var SEVEN_DAYS_IN_MS = 7 * 24 * 60 * 60 * 1000;
    
    // Always loop backwards when deleting rows!
    for (var i = data.length - 1; i > 0; i--) {
      var rowStatus = String(data[i][5]).trim().toUpperCase();
      var entryTime = new Date(data[i][0]).getTime();
      
      // Delete if older than 7 days AND it is not actively processing
      if ((now - entryTime > SEVEN_DAYS_IN_MS) && rowStatus !== "PROCESSING") {
        logSheet.deleteRow(i + 1);
      }
    }
  } catch (e) {
    console.error("Cleanup error: " + e.message);
  } finally {
    lock.releaseLock();
  }
}