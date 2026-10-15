// ==========================================
// 603_CRM_SETUP.gs
// Configuration & High-Speed Data Fetcher
// ==========================================

// High-Speed Fetcher: Tries Advanced API first, falls back to standard if not enabled
function fetchSheetDataFast(ssId, sheetName) {
  try {
    // FIX: Passing just the sheetName automatically captures the full populated range (up to BH, ZZ, etc.)
    var response = Sheets.Spreadsheets.Values.get(ssId, sheetName);
    return response.values || [];
  } catch(e) {
    var sheet = SpreadsheetApp.openById(ssId).getSheetByName(sheetName);
    if (!sheet) return [];
    return sheet.getDataRange().getDisplayValues(); 
  }
}

function getCRMSetupData() {
  var data = fetchSheetDataFast(CRM_SPREADSHEET_ID, 'SETUP');
  
  var setup = {
    callStatuses: [],
    customerStatuses: [],
    dormancyReasons: [],
    feedbackCategories: [],
    wipStatuses: [],
    completedStatuses: [], // NEW
    editableRecords: 2,         
    maxCompletedLimit: 50,      
    dormantQueueThreshold: 7    
  };

  for (var i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    var key = String(data[i][0]).trim(); 
    var val = String(data[i][1] || "").trim(); 
    
    if (key === "Call_Statuses") setup.callStatuses = val.split(',').map(s => s.trim());
    if (key === "Customer_Statuses") setup.customerStatuses = val.split(',').map(s => s.trim());
    if (key === "Dormancy_Reasons") setup.dormancyReasons = val.split(',').map(s => s.trim());
    if (key === "Feedback_Categories") setup.feedbackCategories = val.split(',').map(s => s.trim());
    if (key === "WIP_Statuses") setup.wipStatuses = val.split(',').map(s => s.trim());
    if (key === "Completed_Statuses") setup.completedStatuses = val.split(',').map(s => s.trim()); // NEW
    
    if (key === "Editable_Recent_Records") setup.editableRecords = parseInt(val) || 2;
    if (key === "Max_Completed_Limit") setup.maxCompletedLimit = parseInt(val) || 50;
    if (key === "Dormant_Queue_Threshold") setup.dormantQueueThreshold = parseInt(val) || 7;
  }
  return setup;
}