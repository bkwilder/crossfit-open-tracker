// ============================================================
// Google Apps Script — paste this into your Google Sheet's
// Apps Script editor (Extensions > Apps Script)
// ============================================================

// Sheet tab names
const ATHLETES_SHEET = 'Athletes';
const SCORES_SHEET   = 'Scores';

// ── Initialise sheets if they don't exist ──
function initSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  if (!ss.getSheetByName(ATHLETES_SHEET)) {
    const s = ss.insertSheet(ATHLETES_SHEET);
    s.appendRow(['id', 'name', 'team', 'paid']);
  }

  if (!ss.getSheetByName(SCORES_SHEET)) {
    const s = ss.insertSheet(SCORES_SHEET);
    s.appendRow(['athleteId', 'wod', 'score', 'division', 'costume', 'bonus']);
  }
}

// ── HTTP handlers ──

function doGet(e) {
  initSheets();
  const action = (e.parameter && e.parameter.action) || 'getAll';

  let result;
  if (action === 'getAll') {
    result = getAllData();
  } else {
    result = { error: 'Unknown action' };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  initSheets();
  const body = JSON.parse(e.postData.contents);
  const action = body.action;

  let result;
  switch (action) {
    case 'addAthlete':    result = addAthlete(body.data); break;
    case 'removeAthlete': result = removeAthlete(body.data.id); break;
    case 'updateAthlete': result = updateAthlete(body.data); break;
    case 'saveScore':     result = saveScore(body.data); break;
    case 'saveAllData':   result = saveAllData(body.data); break;
    default: result = { error: 'Unknown action' };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Read all data ──
function getAllData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Athletes
  const aSheet = ss.getSheetByName(ATHLETES_SHEET);
  const aData = aSheet.getDataRange().getValues();
  const athletes = [];
  for (let i = 1; i < aData.length; i++) {
    if (!aData[i][0]) continue;
    athletes.push({
      id:   String(aData[i][0]),
      name: aData[i][1],
      team: aData[i][2],
      paid: aData[i][3] === true || aData[i][3] === 'TRUE' || aData[i][3] === true
    });
  }

  // Scores
  const sSheet = ss.getSheetByName(SCORES_SHEET);
  const sData = sSheet.getDataRange().getValues();
  const scores = { wod1: {}, wod2: {}, wod3: {} };
  for (let i = 1; i < sData.length; i++) {
    const athleteId = String(sData[i][0]);
    const wod       = sData[i][1];
    if (!athleteId || !wod) continue;
    if (!scores[wod]) scores[wod] = {};
    scores[wod][athleteId] = {
      score:    sData[i][2] === '' ? '' : String(sData[i][2]),
      division: sData[i][3] || 'rx',
      costume:  sData[i][4] === true || sData[i][4] === 'TRUE',
      bonus:    Number(sData[i][5]) || 0
    };
  }

  return { athletes, scores };
}

// ── Add athlete ──
function addAthlete(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(ATHLETES_SHEET);
  sheet.appendRow([data.id, data.name, data.team, data.paid]);
  return { success: true };
}

// ── Remove athlete ──
function removeAthlete(id) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Remove from Athletes sheet
  const aSheet = ss.getSheetByName(ATHLETES_SHEET);
  const aData = aSheet.getDataRange().getValues();
  for (let i = aData.length - 1; i >= 1; i--) {
    if (String(aData[i][0]) === String(id)) {
      aSheet.deleteRow(i + 1);
    }
  }

  // Remove their scores
  const sSheet = ss.getSheetByName(SCORES_SHEET);
  const sData = sSheet.getDataRange().getValues();
  for (let i = sData.length - 1; i >= 1; i--) {
    if (String(sData[i][0]) === String(id)) {
      sSheet.deleteRow(i + 1);
    }
  }

  return { success: true };
}

// ── Update athlete (toggle team/paid) ──
function updateAthlete(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(ATHLETES_SHEET);
  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(data.id)) {
      if (data.team !== undefined)  sheet.getRange(i + 1, 3).setValue(data.team);
      if (data.paid !== undefined)  sheet.getRange(i + 1, 4).setValue(data.paid);
      if (data.name !== undefined)  sheet.getRange(i + 1, 2).setValue(data.name);
      break;
    }
  }

  return { success: true };
}

// ── Save a single score entry ──
function saveScore(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SCORES_SHEET);
  const rows = sheet.getDataRange().getValues();

  // Look for existing row
  let found = false;
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(data.athleteId) && rows[i][1] === data.wod) {
      sheet.getRange(i + 1, 3).setValue(data.score);
      sheet.getRange(i + 1, 4).setValue(data.division);
      sheet.getRange(i + 1, 5).setValue(data.costume);
      sheet.getRange(i + 1, 6).setValue(data.bonus);
      found = true;
      break;
    }
  }

  if (!found) {
    sheet.appendRow([data.athleteId, data.wod, data.score, data.division, data.costume, data.bonus]);
  }

  return { success: true };
}

// ── Bulk save (replaces all data) ──
function saveAllData(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Rewrite Athletes
  const aSheet = ss.getSheetByName(ATHLETES_SHEET);
  aSheet.clearContents();
  aSheet.appendRow(['id', 'name', 'team', 'paid']);
  data.athletes.forEach(a => {
    aSheet.appendRow([a.id, a.name, a.team, a.paid]);
  });

  // Rewrite Scores
  const sSheet = ss.getSheetByName(SCORES_SHEET);
  sSheet.clearContents();
  sSheet.appendRow(['athleteId', 'wod', 'score', 'division', 'costume', 'bonus']);
  ['wod1', 'wod2', 'wod3'].forEach(wod => {
    if (!data.scores[wod]) return;
    Object.keys(data.scores[wod]).forEach(athleteId => {
      const s = data.scores[wod][athleteId];
      sSheet.appendRow([athleteId, wod, s.score || '', s.division || 'rx', s.costume || false, s.bonus || 0]);
    });
  });

  return { success: true };
}
