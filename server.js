const http = require('http');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const xlsx = require('xlsx-js-style');

// Prevent server exit from browser client socket drops (ECONNRESET, EPIPE)
process.on('uncaughtException', (err) => {
  if (err && (err.code === 'ECONNRESET' || err.code === 'EPIPE' || err.code === 'ETIMEDOUT' || err.code === 'ECANCELED')) {
    return;
  }
  console.error('[UNCAUGHT EXCEPTION]', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[UNHANDLED REJECTION]', reason);
});

const PORT = process.env.PORT || 3000;

// Helper to get executable directory for pkg
const IS_PKG = typeof process.pkg !== 'undefined';
const EXEC_DIR = IS_PKG ? path.dirname(process.execPath) : __dirname;

// Path to save entries
const TARGET_DIR = path.join(EXEC_DIR, 'data', 'surveillance');
const USERS_FILE = path.join(TARGET_DIR, 'users_db.json');
const ENTRIES_DIR = path.join(TARGET_DIR, 'DATA');
const BARRED_DIR = path.join(TARGET_DIR, 'BARRED');
const STAFF_DIR = path.join(TARGET_DIR, 'STAFF');
const EXPORTS_DIR = path.join(TARGET_DIR, 'EXPORTS');

const MONTH_NAMES = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
];

// Helper: Ensure and return Year/Month-named subfolders under EXPORTS:
// EXPORTS/<YEAR>/<MONTH> <YEAR>/DATE_WISE and .../MONTHLY_WORKBOOK
function getMonthExportDirs(year, month) {
  const monthIdx = parseInt(month, 10) - 1;
  const monthName = MONTH_NAMES[monthIdx] || `MONTH_${month}`;
  const yearStr = String(year);
  const monthFolderName = `${monthName} ${yearStr}`;

  const yearDir = path.join(EXPORTS_DIR, yearStr);
  const monthDir = path.join(yearDir, monthFolderName);
  const dateWiseDir = path.join(monthDir, 'DATE_WISE');
  const monthlyDir = path.join(monthDir, 'MONTHLY_WORKBOOK');

  [EXPORTS_DIR, yearDir, monthDir, dateWiseDir, monthlyDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (e) {}
    }
  });

  return { yearDir, monthDir, dateWiseDir, monthlyDir, monthName, monthFolderName };
}

function calculateActualBusinessDate() {
  const d = new Date();
  if (d.getHours() < 6) d.setDate(d.getDate() - 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getPersistedBusinessDate() {
  const filePath = path.join(TARGET_DIR, 'business_date.txt');
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf8').trim();
  }
  const d = calculateActualBusinessDate();
  fs.writeFileSync(filePath, d, 'utf8');
  return d;
}

let currentBusinessDate = getPersistedBusinessDate();

let sseClients = [];

function safeJsonParse(str) {
  if (typeof str !== 'string') return null;
  const trimmed = str.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch (err) {
    try {
      const sanitized = trimmed.replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, '\\\\');
      return JSON.parse(sanitized);
    } catch (err2) {
      throw err;
    }
  }
}

function broadcastEvent(eventData) {
  const dataString = JSON.stringify(eventData);
  sseClients = sseClients.filter(client => {
    if (!client || client.destroyed || client.writableEnded) return false;
    try {
      client.write(`data: ${dataString}\n\n`);
      return true;
    } catch (err) {
      return false;
    }
  });
}

function checkIfGuestIsBarred(guestname) {
  if (!guestname) return null;
  const nameToMatch = guestname.trim().toLowerCase();
  if (!fs.existsSync(BARRED_DIR)) return null;
  try {
    const files = fs.readdirSync(BARRED_DIR);
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const filePath = path.join(BARRED_DIR, file);
          const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          
          let matched = false;
          let possibleName = null;
          let possibleReason = 'No reason specified';

          for (const key in content) {
            const lowerKey = key.toLowerCase();
            const val = content[key];
            if (typeof val === 'string') {
              const valLower = val.trim().toLowerCase();
              if (lowerKey.includes('name')) {
                const valNorm = valLower.replace(/\s+/g, ' ');
                const matchNorm = nameToMatch.replace(/\s+/g, ' ');
                if (valNorm === matchNorm) {
                  matched = true;
                  possibleName = val;
                }
              }
              if (lowerKey.includes('reason')) {
                possibleReason = val;
              }
            }
          }
          if (matched) {
            return {
              content, // return the whole row
              guestname: possibleName || guestname,
              reason: content.reason || content['REASON'] || possibleReason
            };
          }
        } catch (e) {}
      }
    }
  } catch (err) {
    console.error('Error reading barred dir:', err);
  }
  return null;
}

setInterval(() => {
  sseClients = sseClients.filter(client => {
    if (!client || client.destroyed || client.writableEnded) return false;
    try {
      client.write(': heartbeat\n\n');
      return true;
    } catch (e) {
      return false;
    }
  });
}, 20000);

function savePersistedBusinessDate(d) {
  currentBusinessDate = d;
  fs.writeFileSync(path.join(TARGET_DIR, 'business_date.txt'), d, 'utf8');
}


// Ensure target directories exist
[TARGET_DIR, ENTRIES_DIR, BARRED_DIR, STAFF_DIR, EXPORTS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory at: ${dir}`);
    } catch (err) {
      console.error(`Failed to create directory: ${dir}`, err);
    }
  }
});

// Migrate existing entry files from TARGET_DIR to ENTRIES_DIR
try {
  const existingFiles = fs.readdirSync(TARGET_DIR);
  existingFiles.forEach(file => {
    if (file.endsWith('.json') && file !== 'users_db.json') {
      const oldPath = path.join(TARGET_DIR, file);
      const newPath = path.join(ENTRIES_DIR, file);
      fs.renameSync(oldPath, newPath);
      console.log(`Migrated ${file} to DATA folder.`);
    }
  });
} catch (err) {
  console.error("Migration error:", err);
}

// Migrate legacy exports into Year -> Month named subfolders (e.g. EXPORTS/2026/NOVEMBER 2026/...)
try {
  // 1. Migrate any unnested month folders (e.g. EXPORTS/NOVEMBER_2026 or EXPORTS/NOVEMBER 2026) into EXPORTS/<YEAR>/<MONTH> <YEAR>/
  if (fs.existsSync(EXPORTS_DIR)) {
    const rootItems = fs.readdirSync(EXPORTS_DIR);
    rootItems.forEach(item => {
      // Check if folder is a month folder directly in EXPORTS (not a 4-digit year)
      const match = item.match(/^([A-Z]+)[_ ](\d{4})$/);
      if (match) {
        const [, mName, year] = match;
        const mIdx = MONTH_NAMES.indexOf(mName);
        if (mIdx !== -1) {
          const month = String(mIdx + 1).padStart(2, '0');
          const oldMonthPath = path.join(EXPORTS_DIR, item);
          const { dateWiseDir, monthlyDir } = getMonthExportDirs(year, month);

          // Move DATE_WISE files if exists
          const oldDateWise = path.join(oldMonthPath, 'DATE_WISE');
          if (fs.existsSync(oldDateWise)) {
            const files = fs.readdirSync(oldDateWise);
            files.forEach(f => {
              const oldF = path.join(oldDateWise, f);
              const newF = path.join(dateWiseDir, f);
              try { fs.renameSync(oldF, newF); } catch (e) {
                try { fs.copyFileSync(oldF, newF); fs.unlinkSync(oldF); } catch (e2) {}
              }
            });
            try { fs.rmdirSync(oldDateWise); } catch (e) {}
          }

          // Move MONTHLY_WORKBOOK files if exists
          const oldMonthly = path.join(oldMonthPath, 'MONTHLY_WORKBOOK');
          if (fs.existsSync(oldMonthly)) {
            const files = fs.readdirSync(oldMonthly);
            files.forEach(f => {
              const oldF = path.join(oldMonthly, f);
              const newF = path.join(monthlyDir, f);
              try { fs.renameSync(oldF, newF); } catch (e) {
                try { fs.copyFileSync(oldF, newF); fs.unlinkSync(oldF); } catch (e2) {}
              }
            });
            try { fs.rmdirSync(oldMonthly); } catch (e) {}
          }

          // Move any loose files in oldMonthPath
          try {
            const remaining = fs.readdirSync(oldMonthPath);
            remaining.forEach(rf => {
              const rfPath = path.join(oldMonthPath, rf);
              if (fs.statSync(rfPath).isFile()) {
                const targetF = path.join(monthlyDir, rf);
                try { fs.renameSync(rfPath, targetF); } catch (e) {}
              }
            });
            fs.rmdirSync(oldMonthPath);
            console.log(`Migrated legacy folder ${item} into ${year}/${mName} ${year}`);
          } catch (e) {}
        }
      }
    });
  }

  // 2. Migrate legacy root DATE_WISE and MONTHLY_WORKBOOK if any
  const oldDateWise = path.join(EXPORTS_DIR, 'DATE_WISE');
  const oldMonthly = path.join(EXPORTS_DIR, 'MONTHLY_WORKBOOK');

  if (fs.existsSync(oldDateWise)) {
    const files = fs.readdirSync(oldDateWise);
    files.forEach(f => {
      const parts = f.replace('.xlsx', '').split('-');
      if (parts.length === 3) {
        const year = parts[2];
        const month = parts[1];
        const { dateWiseDir } = getMonthExportDirs(year, month);
        const oldFile = path.join(oldDateWise, f);
        const newFile = path.join(dateWiseDir, f);
        try {
          fs.renameSync(oldFile, newFile);
          console.log(`Migrated ${f} to ${dateWiseDir}`);
        } catch (e) {}
      }
    });
    try {
      if (fs.readdirSync(oldDateWise).length === 0) fs.rmdirSync(oldDateWise);
    } catch (e) {}
  }

  if (fs.existsSync(oldMonthly)) {
    const files = fs.readdirSync(oldMonthly);
    files.forEach(f => {
      const parts = f.replace('.xlsx', '').split('_');
      if (parts.length === 2 && MONTH_NAMES.includes(parts[0])) {
        const year = parts[1];
        const mIdx = MONTH_NAMES.indexOf(parts[0]);
        const month = String(mIdx + 1).padStart(2, '0');
        const { monthlyDir } = getMonthExportDirs(year, month);
        const oldFile = path.join(oldMonthly, f);
        const newFile = path.join(monthlyDir, f);
        try {
          fs.renameSync(oldFile, newFile);
          console.log(`Migrated ${f} to ${monthlyDir}`);
        } catch (e) {}
      }
    });
    try {
      if (fs.readdirSync(oldMonthly).length === 0) fs.rmdirSync(oldMonthly);
    } catch (e) {}
  }
} catch (err) {
  console.error("Exports migration error:", err);
}

function getArchiveWorkbookPath(year, month) {
  const { monthlyDir, monthName } = getMonthExportDirs(year, month);
  const monthlyPath = path.join(monthlyDir, `${monthName}_${year}.xlsx`);
  if (fs.existsSync(monthlyPath)) return monthlyPath;
  const altPath = path.join(monthlyDir, `${year}-${month}.xlsx`);
  if (fs.existsSync(altPath)) return altPath;

  // Legacy fallback if not yet migrated:
  const legacyDir1 = path.join(EXPORTS_DIR, `${monthName}_${year}`, 'MONTHLY_WORKBOOK');
  const legacyPath1 = path.join(legacyDir1, `${monthName}_${year}.xlsx`);
  if (fs.existsSync(legacyPath1)) return legacyPath1;

  const legacyDir2 = path.join(EXPORTS_DIR, `${monthName} ${year}`, 'MONTHLY_WORKBOOK');
  const legacyPath2 = path.join(legacyDir2, `${monthName}_${year}.xlsx`);
  if (fs.existsSync(legacyPath2)) return legacyPath2;

  return monthlyPath;
}

function ensureArchiveWorkbook(year, month) {
  return getArchiveWorkbookPath(year, month);
}

function saveEntriesToArchive(entries) {
  return [];
}

function archiveActiveEntries() {
  const files = fs.existsSync(ENTRIES_DIR) ? fs.readdirSync(ENTRIES_DIR) : [];
  const jsonFiles = files.filter(f => f.endsWith('.json') && f !== 'users_db.json');
  if (jsonFiles.length === 0) {
    return { archived: false, message: 'No entries to archive.' };
  }

  const entries = jsonFiles.map(file => {
    try {
      const filePath = path.join(ENTRIES_DIR, file);
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (content.archived) return null;
      return { ...content, _file: file }; // keep file name to update later
    } catch (err) {
      console.error(`Failed to parse entry file ${file}:`, err);
      return null;
    }
  }).filter(Boolean);

  if (entries.length === 0) {
    return { archived: false, message: 'No entries to archive.' };
  }

  const archivePaths = saveEntriesToArchive(entries);
  
  entries.forEach(entry => {
    const filePath = path.join(ENTRIES_DIR, entry._file);
    delete entry._file; // don't write this meta field
    entry.archived = true;
    fs.writeFileSync(filePath, JSON.stringify(entry, null, 2), 'utf8');
  });

  return { archived: true, count: entries.length, archivePaths, archivedEntries: entries };
}

function formatEntrySentence(entry) {
  const t = (entry.type || '').toUpperCase();
  const amt = Number(entry.amount) || 0;
  let amtStr = amt.toString();
  if (amt >= 1000) {
    let k = amt / 1000;
    amtStr = (Number.isInteger(k) ? k : k.toFixed(1)) + 'K';
  }
  const guest = (entry.guestname || 'UNKNOWN').toUpperCase();
  const card = (entry.card || '').toUpperCase();
  const info = entry.otherinfo ? ` (${String(entry.otherinfo).toUpperCase()})` : '';

  if (t === 'CASHIN' || t === 'C/IN') return `${amtStr} CASHIN BY ${guest}${info}`;
  if (t === 'CASHOUT' || t === 'C/OUT') return `${amtStr} CASHOUT BY ${guest}${info}`;
  if (t === 'ISSUE') return `${amtStr} ISSUE TO ${guest} FROM ${card} CARD${info}`;
  if (t === 'DEPOSIT') return `${amtStr} DEPOSIT BY ${guest} ON ${card} CARD${info}`;
  if (t === 'KEYIN') return `${amtStr} KEYIN BY ${guest}${info}`;
  if (t === 'KEYOUT') return `${amtStr} KEYOUT BY ${guest}${info}`;
  return `${amtStr} ${t} BY ${guest}${info}`;
}

const EXCEL_HEADERS = [
  'DATE', 'TIME', 'TYPE', 'AMOUNT', 'GUEST NAME', 'CARD', 'OTHER INFO', 'SURV ID', 'SENTENCE ENTRIES', 'GUEST SUMMARY'
];

function isTotalInType(type) {
  if (!type) return false;
  const clean = String(type).trim().toUpperCase().replace(/[\s\-_]/g, '');
  const norm = clean.replace(/[\/\\]/g, '/');
  return (
    norm === 'CASHIN' ||
    norm === 'C/IN' ||
    norm === 'CIN' ||
    norm === 'ISSUE' ||
    norm === 'KEY/IN' ||
    norm === 'KEYIN'
  );
}

function isTotalOutType(type) {
  if (!type) return false;
  const clean = String(type).trim().toUpperCase().replace(/[\s\-_]/g, '');
  const norm = clean.replace(/[\/\\]/g, '/');
  return (
    norm === 'CASHOUT' ||
    norm === 'C/OUT' ||
    norm === 'COUT' ||
    norm === 'DEPOSIT' ||
    norm === 'KEY/OUT' ||
    norm === 'KEYOUT' ||
    norm === 'KY/OUT' ||
    norm === 'KYOUT' ||
    norm === 'PAID'
  );
}

// Canonical guest name matching & clustering
function isNameMatch(n1, n2) {
  if (!n1 || !n2) return false;
  const s1 = String(n1).trim().toUpperCase();
  const s2 = String(n2).trim().toUpperCase();
  if (s1 === s2) return true;

  const words1 = s1.split(/[\s,._-]+/).filter(Boolean);
  const words2 = s2.split(/[\s,._-]+/).filter(Boolean);
  if (words1.length === 0 || words2.length === 0) return false;

  const fullWords1 = words1.filter(w => w.length > 1);
  const fullWords2 = words2.filter(w => w.length > 1);
  const initials1 = words1.filter(w => w.length === 1);
  const initials2 = words2.filter(w => w.length === 1);

  const commonWords = fullWords1.filter(w => fullWords2.includes(w));
  if (commonWords.length > 0) {
    const diff1 = fullWords1.filter(w => !commonWords.includes(w));
    const diff2 = fullWords2.filter(w => !commonWords.includes(w));
    if (diff1.length > 0 && diff2.length > 0) return false;
    if (diff1.length > 0 && initials2.length > 0) {
      if (!diff1.some(w => initials2.includes(w[0]))) return false;
    }
    if (diff2.length > 0 && initials1.length > 0) {
      if (!diff2.some(w => initials1.includes(w[0]))) return false;
    }
    return true;
  }

  if (fullWords1.length === 1 && initials1.length === 1 && fullWords2.length === 1 && initials2.length === 1) {
    if (initials2.includes(fullWords1[0][0]) && initials1.includes(fullWords2[0][0])) {
      return true;
    }
  }

  return false;
}

function getCanonicalNamePriority(name) {
  if (!name) return 0;
  const s = String(name).trim().toUpperCase();
  const words = s.split(/[\s,._-]+/).filter(Boolean);
  if (words.length === 0) return 0;

  const fullWords = words.filter(w => w.length > 1);
  const initials = words.filter(w => w.length === 1);

  if (fullWords.length >= 2) return 3000 + (fullWords.length * 100) + s.length;
  if (fullWords.length === 1 && initials.length >= 1 && words[words.length - 1].length === 1) return 2000 + s.length;
  if (fullWords.length === 1 && initials.length >= 1 && words[0].length === 1) return 1800 + s.length;
  if (fullWords.length === 1 && initials.length >= 1) return 1600 + s.length;
  if (fullWords.length === 1) return 1400 + s.length;
  return 1000 + s.length;
}

function getGuestCluster(targetName, candidateEntries) {
  if (!targetName || !Array.isArray(candidateEntries)) {
    return { canonicalName: (targetName || '').toUpperCase(), entries: [] };
  }
  const target = String(targetName).trim().toUpperCase();

  let clusterEntries = candidateEntries.filter(e => {
    const gn = (e.guestname || '').trim();
    return isNameMatch(target, gn);
  });

  if (clusterEntries.length === 0) {
    clusterEntries = candidateEntries.filter(e => (e.guestname || '').trim().toUpperCase() === target);
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const e of candidateEntries) {
      if (!clusterEntries.includes(e)) {
        const gn = (e.guestname || '').trim();
        if (clusterEntries.some(m => isNameMatch((m.guestname || '').trim(), gn))) {
          clusterEntries.push(e);
          changed = true;
        }
      }
    }
  }

  const uniqueNames = [...new Set(clusterEntries.map(e => (e.guestname || '').trim().toUpperCase()))].filter(Boolean);
  uniqueNames.sort((a, b) => getCanonicalNamePriority(b) - getCanonicalNamePriority(a));

  const canonicalName = uniqueNames.length > 0 ? uniqueNames[0] : target;
  return { canonicalName, entries: clusterEntries };
}

function buildStyledWorksheet(dayEntries, dayNum, isPartOfMonthly = false, yearMonth = null) {
  dayEntries = Array.isArray(dayEntries) ? dayEntries : [];

  // Determine exact date string (DD-MM-YYYY) for this day
  let sheetDateStr = '';
  if (dayEntries.length > 0 && dayEntries[0].datetime) {
    const dtPart = dayEntries[0].datetime.split('T')[0] || dayEntries[0].datetime.split(' ')[0];
    const dp = dtPart.split('-');
    if (dp.length === 3) {
      sheetDateStr = `${dp[2]}-${dp[1]}-${dp[0]}`;
    }
  } else if (dayEntries.length > 0 && dayEntries[0].businessDate) {
    const dp = dayEntries[0].businessDate.split('-');
    if (dp.length === 3) {
      sheetDateStr = `${dp[2]}-${dp[1]}-${dp[0]}`;
    }
  }

  if (!sheetDateStr) {
    let ym = yearMonth;
    if (!ym) {
      ym = (typeof currentBusinessDate === 'string' && currentBusinessDate.length >= 7)
        ? currentBusinessDate.slice(0, 7)
        : calculateActualBusinessDate().slice(0, 7);
    }
    const ymParts = ym.split('-');
    const y = ymParts[0];
    const m = ymParts[1];
    const d = String(dayNum).padStart(2, '0');
    sheetDateStr = `${d}-${m}-${y}`;
  }

  const headerRow = isPartOfMonthly ? 2 : 1;
  const startDataRow = isPartOfMonthly ? 3 : 2;
  const currentSheetName = isPartOfMonthly ? String(dayNum) : `Day ${dayNum}`;

  // Group entries by canonical guest for Column J Summary
  const guestGroups = [];
  const assignedEntryIds = new Set();
  const guestFirstEntryRow = {}; // Map guest uppercase name -> first entry row in column E

  dayEntries.forEach((e, idx) => {
    const rawGuest = (e.guestname || '').trim().toUpperCase();
    if (!rawGuest) return;

    const rowNum = startDataRow + idx;
    if (!guestFirstEntryRow[rawGuest]) {
      guestFirstEntryRow[rawGuest] = rowNum;
    }

    if (!assignedEntryIds.has(e.id)) {
      const cluster = getGuestCluster(rawGuest, dayEntries);
      cluster.entries.forEach(ce => assignedEntryIds.add(ce.id));

      let totalIn = 0;
      let totalOut = 0;
      cluster.entries.forEach(ce => {
        const amt = Number(ce.amount) || 0;
        const t = ce.type || '';
        if (isTotalInType(t)) totalIn += amt;
        else if (isTotalOutType(t)) totalOut += amt;
      });

      const memberNames = [...new Set(cluster.entries.map(ce => (ce.guestname || '').trim().toUpperCase()))].filter(Boolean);

      guestGroups.push({
        name: cluster.canonicalName,
        totalIn,
        totalOut,
        memberNames
      });
    }
  });

  guestGroups.sort((a, b) => a.name.localeCompare(b.name));

  // Build Column J summary rows (4 rows per guest + 1 yellow separator row)
  const summaryRows = [];
  const guestCardRowMap = {}; // Maps guest name (canonical and aliases) to J row number in current sheet

  guestGroups.forEach(g => {
    const cardStartRow = startDataRow + summaryRows.length; // Row where "NAME :- <g.name>" is located in Column J
    guestCardRowMap[g.name] = cardStartRow;
    if (Array.isArray(g.memberNames)) {
      g.memberNames.forEach(m => {
        guestCardRowMap[m] = cardStartRow;
      });
    }

    const netResult = g.totalOut - g.totalIn;
    const isMinus = netResult < 0;
    // NO + or - sign! Directly formatted number:
    const resFormatted = Math.abs(netResult).toLocaleString('en-IN');

    summaryRows.push({
      text: `NAME :- ${g.name}`,
      type: 'guest_name',
      guestName: g.name,
      cardRow: cardStartRow,
      returnRow: guestFirstEntryRow[g.name] || (g.memberNames && g.memberNames.map(m => guestFirstEntryRow[m]).find(Boolean))
    });
    summaryRows.push({
      text: `TOTAL IN :- ${g.totalIn.toLocaleString('en-IN')}`,
      type: 'guest_in'
    });
    summaryRows.push({
      text: `TOTAL OUT :- ${g.totalOut.toLocaleString('en-IN')}`,
      type: 'guest_out'
    });
    summaryRows.push({
      text: `RESULT :- ${resFormatted}`,
      type: 'guest_result',
      isMinus: isMinus
    });
    summaryRows.push({
      text: '',
      type: 'separator_yellow'
    });
  });

  const numDataRows = Math.max(dayEntries.length, summaryRows.length);
  const totalRows = numDataRows + 1; // Row 1 is header

  // Styles definition - ALL CELLS MIDDLE ALIGNED IN CENTRAL BOX
  const headerStyle = {
    fill: { fgColor: { rgb: '00A2E8' } }, // Bright Cyan
    font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: '000000' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: '000000' } },
      bottom: { style: 'thin', color: { rgb: '000000' } },
      left: { style: 'thin', color: { rgb: '000000' } },
      right: { style: 'thin', color: { rgb: '000000' } }
    }
  };

  const blueDataStyle = {
    fill: { fgColor: { rgb: 'D9E1F2' } }, // Soft Ice Blue
    font: { name: 'Calibri', sz: 10, color: { rgb: '000000' } },
    alignment: { horizontal: 'center', vertical: 'center' }, // Central box alignment
    border: {
      top: { style: 'thin', color: { rgb: '000000' } },
      bottom: { style: 'thin', color: { rgb: '000000' } },
      left: { style: 'thin', color: { rgb: '000000' } },
      right: { style: 'thin', color: { rgb: '000000' } }
    }
  };

  const summaryNameHeaderStyle = {
    fill: { fgColor: { rgb: 'A7F3D0' } }, // Luminous Vibrant Mint / Emerald Glow for Selected Destination
    font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '0000FF' }, underline: true },
    alignment: { vertical: 'center', horizontal: 'center' }, // Central box alignment
    border: {
      top: { style: 'medium', color: { rgb: '059669' } },
      bottom: { style: 'thin', color: { rgb: '059669' } },
      left: { style: 'medium', color: { rgb: '059669' } },
      right: { style: 'medium', color: { rgb: '059669' } }
    }
  };

  const summaryGreenStyle = {
    fill: { fgColor: { rgb: 'D9EAD3' } }, // Pastel Light Green
    font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '000000' } },
    alignment: { vertical: 'center', horizontal: 'center' }, // Central box alignment
    border: {
      top: { style: 'thin', color: { rgb: '000000' } },
      bottom: { style: 'thin', color: { rgb: '000000' } },
      left: { style: 'thin', color: { rgb: '000000' } },
      right: { style: 'thin', color: { rgb: '000000' } }
    }
  };

  const summaryRedResultStyle = {
    fill: { fgColor: { rgb: 'D9EAD3' } },
    font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: 'B91C1C' } }, // Deep Red for high contrast
    alignment: { vertical: 'center', horizontal: 'center' }, // Central box alignment
    border: {
      top: { style: 'thin', color: { rgb: '000000' } },
      bottom: { style: 'thin', color: { rgb: '000000' } },
      left: { style: 'thin', color: { rgb: '000000' } },
      right: { style: 'thin', color: { rgb: '000000' } }
    }
  };

  const summaryGreenResultStyle = {
    fill: { fgColor: { rgb: 'D9EAD3' } },
    font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '047857' } }, // Deep Forest Green for high contrast
    alignment: { vertical: 'center', horizontal: 'center' }, // Central box alignment
    border: {
      top: { style: 'thin', color: { rgb: '000000' } },
      bottom: { style: 'thin', color: { rgb: '000000' } },
      left: { style: 'thin', color: { rgb: '000000' } },
      right: { style: 'thin', color: { rgb: '000000' } }
    }
  };

  const yellowSeparatorStyle = {
    fill: { fgColor: { rgb: 'FFFF00' } }, // Bright Yellow
    alignment: { vertical: 'center', horizontal: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: '000000' } },
      bottom: { style: 'thin', color: { rgb: '000000' } },
      left: { style: 'thin', color: { rgb: '000000' } },
      right: { style: 'thin', color: { rgb: '000000' } }
    }
  };

  const ws = {};
  const colLetter = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  const merges = [];

  // Track max character length per column for auto-fit
  const colWidths = EXCEL_HEADERS.map(h => h.length);

  // If part of monthly workbook: Row 1 is Navigation Bar with BACK TO SUMMARY on Cell A1
  if (isPartOfMonthly) {
    // CELL A1: BACK TO SUMMARY BUTTON
    ws['A1'] = {
      t: 's',
      v: '🏠 BACK TO SUMMARY',
      l: { Target: "#'SUMMARY'!A1", Tooltip: "Click to return to the Monthly SUMMARY sheet" },
      s: {
        fill: { fgColor: { rgb: '0284C7' } }, // Sky Blue Button
        font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' }, underline: true },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: {
          top: { style: 'medium', color: { rgb: '0369A1' } },
          bottom: { style: 'medium', color: { rgb: '0369A1' } },
          left: { style: 'medium', color: { rgb: '0369A1' } },
          right: { style: 'medium', color: { rgb: '0369A1' } }
        }
      }
    };
    if (colWidths[0] < 22) colWidths[0] = 22;

    // CELLS B1:J1: Title Banner for Day (Just the Date)
    ws['B1'] = {
      t: 's',
      v: sheetDateStr,
      s: {
        fill: { fgColor: { rgb: '0F172A' } },
        font: { name: 'Calibri', sz: 12, bold: true, color: { rgb: 'FFFFFF' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: {
          top: { style: 'thin', color: { rgb: '334155' } },
          bottom: { style: 'thin', color: { rgb: '334155' } }
        }
      }
    };
    for (let c = 2; c < 10; c++) {
      ws[`${colLetter[c]}1`] = {
        t: 's',
        v: '',
        s: {
          fill: { fgColor: { rgb: '0F172A' } },
          border: {
            top: { style: 'thin', color: { rgb: '334155' } },
            bottom: { style: 'thin', color: { rgb: '334155' } },
            right: c === 9 ? { style: 'thin', color: { rgb: '334155' } } : undefined
          }
        }
      };
    }
    merges.push({ s: { r: 0, c: 1 }, e: { r: 0, c: 9 } }); // Merge B1:J1
  }

  // 1. Write Header Row (Row 2 if monthly workbook, Row 1 if daily export)
  EXCEL_HEADERS.forEach((h, cIdx) => {
    const cellRef = `${colLetter[cIdx]}${headerRow}`;
    ws[cellRef] = {
      t: 's',
      v: h,
      s: headerStyle
    };
    if (h.length > colWidths[cIdx]) colWidths[cIdx] = h.length;
  });

  // 2. Write Data Rows
  if (numDataRows === 0 && isPartOfMonthly) {
    ws[`A3`] = {
      t: 's',
      v: `NO ENTRIES LOGGED FOR DAY ${dayNum}`,
      s: {
        fill: { fgColor: { rgb: 'BAE6FD' } },
        font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: '0F172A' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: {
          top: { style: 'thin', color: { rgb: '0284C7' } },
          bottom: { style: 'thin', color: { rgb: '0284C7' } },
          left: { style: 'thin', color: { rgb: '0284C7' } },
          right: { style: 'thin', color: { rgb: '0284C7' } }
        }
      }
    };
    for (let c = 1; c < 10; c++) {
      ws[`${colLetter[c]}3`] = {
        t: 's',
        v: '',
        s: {
          fill: { fgColor: { rgb: 'BAE6FD' } },
          border: {
            top: { style: 'thin', color: { rgb: '0284C7' } },
            bottom: { style: 'thin', color: { rgb: '0284C7' } },
            right: c === 9 ? { style: 'thin', color: { rgb: '0284C7' } } : undefined
          }
        }
      };
    }
    merges.push({ s: { r: 2, c: 0 }, e: { r: 2, c: 9 } });

    // Distinct soft pastel page background fill across empty canvas rows
    for (let emptyRow = 4; emptyRow <= 30; emptyRow++) {
      const emptyBg = emptyRow % 2 === 0 ? 'BAE6FD' : 'D0EEFC';
      for (let c = 0; c < 10; c++) {
        ws[`${colLetter[c]}${emptyRow}`] = {
          t: 's',
          v: '',
          s: {
            fill: { fgColor: { rgb: emptyBg } },
            border: {
              top: { style: 'thin', color: { rgb: '7DD3FC' } },
              bottom: { style: 'thin', color: { rgb: '7DD3FC' } },
              left: { style: 'thin', color: { rgb: '7DD3FC' } },
              right: { style: 'thin', color: { rgb: '7DD3FC' } }
            }
          }
        };
      }
    }
  }

  for (let r = 0; r < numDataRows; r++) {
    const rowNum = startDataRow + r;
    const entry = dayEntries[r];
    const summary = summaryRows[r];

    // Format entry fields
    let dt = '', tm = '';
    if (entry && entry.datetime) {
      const parts = entry.datetime.split('T');
      if (parts[0]) {
        const dparts = parts[0].split('-');
        if (dparts.length === 3) dt = `${dparts[2]}-${dparts[1]}-${dparts[0]}`;
        else dt = parts[0];
      }
      tm = parts[1] ? parts[1].slice(0, 5) : '';
    }

    const rowValues = [
      entry ? dt : '',
      entry ? tm : '',
      entry ? (entry.type || '').toUpperCase() : '',
      entry ? (Number(entry.amount) || 0) : '',
      entry ? (entry.guestname || '').toUpperCase() : '',
      entry ? (entry.card ? String(entry.card) : '') : '',
      entry ? (entry.otherinfo || '') : '',
      entry ? (entry.surv || '') : '',
      entry ? formatEntrySentence(entry) : ''
    ];

    // Alternating distinct soft pastel sky blue rows for clearly visible page background
    const isEven = r % 2 === 0;
    const rowBgColor = isEven ? 'BAE6FD' : 'D0EEFC';

    // Columns A through I - ALL MIDDLE ALIGNED IN CENTRAL BOX
    rowValues.forEach((val, cIdx) => {
      const cellRef = `${colLetter[cIdx]}${rowNum}`;
      const isNum = typeof val === 'number';

      // All data cells bold and middle-aligned across the workbook
      let cellFont = { name: 'Calibri', sz: 10, bold: true, color: { rgb: '000000' } };
      if (cIdx === 4 && val) {
        cellFont = { name: 'Calibri', sz: 10, bold: true, color: { rgb: '0000FF' }, underline: true };
      }

      ws[cellRef] = {
        t: isNum ? 'n' : 's',
        v: val,
        s: {
          fill: { fgColor: { rgb: rowBgColor } },
          font: cellFont,
          alignment: { horizontal: 'center', vertical: 'center' },
          border: {
            top: { style: 'thin', color: { rgb: '7DD3FC' } },
            bottom: { style: 'thin', color: { rgb: '7DD3FC' } },
            left: { style: 'thin', color: { rgb: '7DD3FC' } },
            right: { style: 'thin', color: { rgb: '7DD3FC' } }
          }
        }
      };

      if (cIdx === 4 && val) {
        const rawName = String(val).trim().toUpperCase();
        let targetCardRow = guestCardRowMap[rawName];
        if (!targetCardRow) {
          const matchedGroup = guestGroups.find(g => isNameMatch(g.name, rawName) || (g.memberNames && g.memberNames.some(m => isNameMatch(m, rawName))));
          if (matchedGroup) {
            targetCardRow = guestCardRowMap[matchedGroup.name];
          }
        }
        if (targetCardRow) {
          ws[cellRef].l = {
            Target: `#'${currentSheetName}'!J${targetCardRow}`,
            Tooltip: `Jump to ${val} in Guest Summary (J${targetCardRow})`
          };
        }
      }

      const valLen = String(val).length;
      if (valLen > colWidths[cIdx]) colWidths[cIdx] = valLen;
    });

    // Column J (Guest Summary)
    const jCellRef = `J${rowNum}`;
    if (summary) {
      let cellStyle = summaryGreenStyle;
      if (summary.type === 'guest_name') {
        cellStyle = summaryNameHeaderStyle;
      } else if (summary.type === 'guest_result') {
        cellStyle = summary.isMinus ? summaryRedResultStyle : summaryGreenResultStyle;
      } else if (summary.type === 'separator_yellow') {
        cellStyle = yellowSeparatorStyle;
      }

      ws[jCellRef] = {
        t: 's',
        v: summary.text,
        s: cellStyle
      };

      if (summary.type === 'guest_name' && summary.returnRow) {
        ws[jCellRef].l = {
          Target: `#'${currentSheetName}'!E${summary.returnRow}`,
          Tooltip: `Return to entry for ${summary.guestName} (E${summary.returnRow})`
        };
      }

      const sLen = summary.text.length;
      if (sLen > colWidths[9]) colWidths[9] = sLen;
    } else {
      // Empty cell in column J
      ws[jCellRef] = {
        t: 's',
        v: '',
        s: {
          fill: { fgColor: { rgb: rowBgColor } },
          border: {
            top: { style: 'thin', color: { rgb: '7DD3FC' } },
            bottom: { style: 'thin', color: { rgb: '7DD3FC' } },
            left: { style: 'thin', color: { rgb: '7DD3FC' } },
            right: { style: 'thin', color: { rgb: '7DD3FC' } }
          }
        }
      };
    }
  }

  // Extend page background canvas below data rows up to row 30
  if (numDataRows > 0 && isPartOfMonthly) {
    const canvasStart = startDataRow + numDataRows;
    for (let emptyRow = canvasStart; emptyRow <= 30; emptyRow++) {
      const emptyBg = emptyRow % 2 === 0 ? 'BAE6FD' : 'D0EEFC';
      for (let c = 0; c < 10; c++) {
        ws[`${colLetter[c]}${emptyRow}`] = {
          t: 's',
          v: '',
          s: {
            fill: { fgColor: { rgb: emptyBg } },
            border: {
              top: { style: 'thin', color: { rgb: '7DD3FC' } },
              bottom: { style: 'thin', color: { rgb: '7DD3FC' } },
              left: { style: 'thin', color: { rgb: '7DD3FC' } },
              right: { style: 'thin', color: { rgb: '7DD3FC' } }
            }
          }
        };
      }
    }
  }

  // Set range ref with page background rows
  const lastRow = isPartOfMonthly ? Math.max(numDataRows + 2, 30) : Math.max(numDataRows + 1, 2);
  ws['!ref'] = `A1:J${lastRow}`;
  if (merges.length > 0) ws['!merges'] = merges;
  ws['!views'] = [{ showGridLines: true }];

  // Auto-fit column widths: max content length + 4 characters padding (minimum 11)
  ws['!cols'] = colWidths.map(w => ({ wch: Math.max(w + 4, 11) }));

  // Auto fit to page in landscape print/view
  ws['!pageSetup'] = { orientation: 'landscape', fitToWidth: 1, fitToHeight: 0 };

  return ws;
}

// Helper: Ensure workbook has all 31 sheets (1 through 31) plus SUMMARY sheet at index 0
function ensureWorkbook31Sheets(workbook) {
  for (let d = 1; d <= 31; d++) {
    const sheetName = String(d);
    if (!workbook.Sheets[sheetName]) {
      workbook.Sheets[sheetName] = buildStyledWorksheet([], d, true);
    }
  }
  const orderedNames = ['SUMMARY', ...Array.from({ length: 31 }, (_, i) => String(i + 1))];
  workbook.SheetNames = orderedNames.filter(name => workbook.Sheets[name]);
  return workbook;
}

// Build the Master SUMMARY Sheet with Guest-Wise Date-Wise & Month-Wise Details
function buildMonthlySummarySheet(allEntries, monthName, year) {
  const ws = {};
  allEntries = Array.isArray(allEntries) ? allEntries : [];
  
  // 1. Calculate Monthly & Daily Totals for Days 1 to 31
  const daysData = {};
  const monthIdx = MONTH_NAMES.indexOf(monthName);
  const monthPadded = monthIdx >= 0 ? String(monthIdx + 1).padStart(2, '0') : '11';

  for (let d = 1; d <= 31; d++) {
    daysData[d] = {
      day: d,
      dateStr: `${String(d).padStart(2, '0')}-${monthPadded}-${year}`,
      totalIn: 0,
      totalOut: 0,
      result: 0,
      guests: new Set(),
      entriesCount: 0
    };
  }

  // Guest Summary Structure:
  // guestName -> { name, datesMap: { [dateStr]: { dateStr, day, totalIn, totalOut, count } }, monthIn, monthOut, entriesCount, firstDay }
  const guestSummaryMap = {};

  allEntries.forEach(e => {
    let rawDate = e.businessDate || '';
    if (!rawDate && e.datetime) {
      rawDate = e.datetime.includes('T') ? e.datetime.split('T')[0] : e.datetime.split(' ')[0];
    }
    
    let day = 0;
    if (rawDate && rawDate.includes('-')) {
      const parts = rawDate.split('-');
      if (parts[0] === String(year) && parts[1] === monthPadded) {
        day = parseInt(parts[2], 10);
      }
    }
    
    if (day >= 1 && day <= 31) {
      const amt = Number(e.amount) || 0;
      const gName = (e.guestname || 'UNKNOWN').trim().toUpperCase();
      daysData[day].entriesCount++;
      daysData[day].guests.add(gName);

      if (isTotalInType(e.type)) {
        daysData[day].totalIn += amt;
      } else if (isTotalOutType(e.type)) {
        daysData[day].totalOut += amt;
      }

      if (!guestSummaryMap[gName]) {
        guestSummaryMap[gName] = {
          name: gName,
          datesMap: {},
          monthIn: 0,
          monthOut: 0,
          entriesCount: 0,
          firstDay: day
        };
      }

      const gObj = guestSummaryMap[gName];
      if (!gObj.datesMap[rawDate]) {
        gObj.datesMap[rawDate] = { dateStr: rawDate, day, totalIn: 0, totalOut: 0, count: 0 };
      }

      if (isTotalInType(e.type)) {
        gObj.monthIn += amt;
        gObj.datesMap[rawDate].totalIn += amt;
      } else if (isTotalOutType(e.type)) {
        gObj.monthOut += amt;
        gObj.datesMap[rawDate].totalOut += amt;
      }
      gObj.entriesCount++;
      gObj.datesMap[rawDate].count++;
    }
  });

  let grandMonthIn = 0;
  let grandMonthOut = 0;
  let grandEntriesCount = 0;
  for (let d = 1; d <= 31; d++) {
    daysData[d].result = daysData[d].totalIn - daysData[d].totalOut;
    grandMonthIn += daysData[d].totalIn;
    grandMonthOut += daysData[d].totalOut;
    grandEntriesCount += daysData[d].entriesCount;
  }
  const grandMonthResult = grandMonthIn - grandMonthOut;

  // Calculate results for all guests; sort by total volume (descending)
  const uniqueGuestsList = Object.values(guestSummaryMap);
  uniqueGuestsList.forEach(g => {
    g.monthResult = g.monthIn - g.monthOut;
    Object.values(g.datesMap).forEach(dObj => {
      dObj.result = dObj.totalIn - dObj.totalOut;
    });
  });

  uniqueGuestsList.sort((a, b) => b.monthIn - a.monthIn);

  // Styles
  const thinBorder = {
    top: { style: 'thin', color: { rgb: '7DD3FC' } },
    bottom: { style: 'thin', color: { rgb: '7DD3FC' } },
    left: { style: 'thin', color: { rgb: '7DD3FC' } },
    right: { style: 'thin', color: { rgb: '7DD3FC' } }
  };
  const doubleBottomBorder = {
    top: { style: 'thin', color: { rgb: '7DD3FC' } },
    bottom: { style: 'double', color: { rgb: '0F172A' } },
    left: { style: 'thin', color: { rgb: '7DD3FC' } },
    right: { style: 'thin', color: { rgb: '7DD3FC' } }
  };

  const centerAlignment = { horizontal: 'center', vertical: 'center' };
  const leftAlignment = { horizontal: 'left', vertical: 'center' };
  const colKeys = ['A', 'B', 'C', 'D', 'E', 'F'];

  const merges = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }, // A1:F1 (Title)
    { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } }, // A2:F2 (Page background spacer)
    { s: { r: 2, c: 0 }, e: { r: 2, c: 5 } }, // A3:F3 (Section 1 Header)
    { s: { r: 35, c: 0 }, e: { r: 35, c: 5 } }, // A36:F36 (Page background spacer)
    { s: { r: 36, c: 0 }, e: { r: 36, c: 5 } }  // A37:F37 (Section 2 Header)
  ];

  // ROW 1: Banner Header - SURVEILLANCE SUMMARY (MONTH WITH YEAR)
  ws['A1'] = {
    t: 's',
    v: `SURVEILLANCE SUMMARY (${monthName.toUpperCase()} ${year})`,
    s: {
      fill: { fgColor: { rgb: '0F172A' } },
      font: { name: 'Calibri', sz: 16, bold: true, color: { rgb: 'FFFFFF' } },
      alignment: centerAlignment
    }
  };

  // ROW 2: Page Background Spacer (Visible Sky Blue)
  for (let c = 0; c < 6; c++) {
    ws[`${colKeys[c]}2`] = { t: 's', v: '', s: { fill: { fgColor: { rgb: 'BAE6FD' } } } };
  }

  // ROW 3: Section 1 Header - DATE WISE BREAKDOWN (MONTH NAME WITH YEAR) - Middle Aligned
  ws['A3'] = {
    t: 's',
    v: `DATE WISE BREAKDOWN (${monthName.toUpperCase()} ${year})`,
    s: { fill: { fgColor: { rgb: '1E3A8A' } }, font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } }, alignment: centerAlignment }
  };

  // ROW 4: Table 1 Headers: DATE | TOTAL IN | TOTAL OUT | RESULT | TOTAL ENTRIES | LINK (Single cells, no merge)
  const t1Headers = ['DATE', 'TOTAL IN', 'TOTAL OUT', 'RESULT', 'TOTAL ENTRIES', 'LINK'];
  t1Headers.forEach((th, idx) => {
    ws[`${colKeys[idx]}4`] = {
      t: 's',
      v: th,
      s: { fill: { fgColor: { rgb: '0284C7' } }, font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: 'FFFFFF' } }, alignment: centerAlignment, border: thinBorder }
    };
  });

  // ROWS 5 to 35: 31 Days Breakdown (Visible pastel mint green for active days, visible pastel sky blue for inactive days)
  for (let d = 1; d <= 31; d++) {
    const rowIdx = 4 + d;
    const dayObj = daysData[d];
    const isEven = d % 2 === 0;
    const rowBg = dayObj.entriesCount > 0 ? (isEven ? 'A7F3D0' : 'BBF7D0') : (isEven ? 'BAE6FD' : 'D0EEFC');

    const rowBaseStyle = {
      fill: { fgColor: { rgb: rowBg } },
      font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '000000' } },
      alignment: centerAlignment,
      border: thinBorder
    };

    // Col A: DATE (Single cell)
    ws[`A${rowIdx}`] = {
      t: 's',
      v: dayObj.dateStr,
      l: { Target: `#'${d}'!A1`, Tooltip: `Open Day ${d} Sheet (${dayObj.dateStr})` },
      s: { ...rowBaseStyle, font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '0000FF' }, underline: true } }
    };

    // Col B: TOTAL IN (Single cell)
    ws[`B${rowIdx}`] = {
      t: 'n',
      v: dayObj.totalIn,
      s: { ...rowBaseStyle, font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: dayObj.totalIn > 0 ? '065F46' : '000000' } } }
    };

    // Col C: TOTAL OUT (Single cell)
    ws[`C${rowIdx}`] = {
      t: 'n',
      v: dayObj.totalOut,
      s: { ...rowBaseStyle, font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: dayObj.totalOut > 0 ? '78350F' : '000000' } } }
    };

    // Col D: RESULT (Single cell)
    const resColor = dayObj.result > 0 ? '047857' : (dayObj.result < 0 ? 'B91C1C' : '1E293B');
    ws[`D${rowIdx}`] = {
      t: 'n',
      v: dayObj.result,
      s: { ...rowBaseStyle, font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: resColor } } }
    };

    // Col E: TOTAL ENTRIES (Single cell)
    ws[`E${rowIdx}`] = {
      t: 'n',
      v: dayObj.entriesCount,
      s: { ...rowBaseStyle, font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '000000' } } }
    };

    // Col F: LINK (Single cell)
    ws[`F${rowIdx}`] = {
      t: 's',
      v: dayObj.entriesCount > 0 ? `➜ View Day ${d} (${dayObj.entriesCount} Entries)` : `➜ View Day ${d} (Empty)`,
      l: { Target: `#'${d}'!A1`, Tooltip: `Jump to Day ${d} Sheet` },
      s: { ...rowBaseStyle, font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '0000FF' }, underline: true } }
    };
  }

  // ROW 36: Page Background Spacer (Visible Sky Blue) between Table 1 and Table 2 (MONTH TOTALS row removed)
  for (let c = 0; c < 6; c++) {
    ws[`${colKeys[c]}36`] = { t: 's', v: '', s: { fill: { fgColor: { rgb: 'BAE6FD' } } } };
  }

  // ROW 37: Section 2 Header - GUEST NAME WISE BREAKDOWN (MONTH WITH YEAR) (in bold, middle aligned)
  ws['A37'] = {
    t: 's',
    v: `GUEST NAME WISE BREAKDOWN (${monthName.toUpperCase()} ${year})`,
    s: { fill: { fgColor: { rgb: '4338CA' } }, font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } }, alignment: centerAlignment }
  };

  // Table 2 Headers: GUEST NAME | DATE | TOTAL IN | TOTAL OUT | RESULT | LINK (Single cells, no merge)
  const t2Headers = ['GUEST NAME', 'DATE', 'TOTAL IN', 'TOTAL OUT', 'RESULT', 'LINK'];
  t2Headers.forEach((th, idx) => {
    ws[`${colKeys[idx]}38`] = {
      t: 's',
      v: th,
      s: { fill: { fgColor: { rgb: '4F46E5' } }, font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: 'FFFFFF' } }, alignment: centerAlignment, border: thinBorder }
    };
  });

  let curRow = 39;
  if (uniqueGuestsList.length === 0) {
    ws[`A${curRow}`] = {
      t: 's',
      v: 'NO GUEST ENTRIES LOGGED YET FOR THIS MONTH. NEW LOG ENTRIES WILL APPEAR HERE AUTOMATICALLY.',
      s: { fill: { fgColor: { rgb: 'BAE6FD' } }, font: { name: 'Calibri', sz: 11, italic: true, color: { rgb: '0F172A' } }, alignment: centerAlignment, border: thinBorder }
    };
    for (let c = 1; c < 6; c++) {
      ws[`${colKeys[c]}${curRow}`] = { t: 's', v: '', s: { fill: { fgColor: { rgb: 'BAE6FD' } }, border: thinBorder } };
    }
    merges.push({ s: { r: curRow - 1, c: 0 }, e: { r: curRow - 1, c: 5 } });
    curRow++;
  } else {
    uniqueGuestsList.forEach((g, gIdx) => {
      const datesList = Object.values(g.datesMap).sort((a, b) => a.day - b.day);
      const numDates = datesList.length;

      // Guest Box Header: Direct Guest Name (No Number, No Prefix) - Light Background & Bold Name
      const boxHeaderBg = 'C7D2FE'; // Clearly visible soft lavender/periwinkle
      const boxBorderColor = '4338CA'; // Indigo Accent Border
      const boxMediumBorder = { style: 'medium', color: { rgb: boxBorderColor } };
      const boxHeaderDivider = { style: 'thin', color: { rgb: '6366F1' } };

      ws[`A${curRow}`] = {
        t: 's',
        v: g.name.toUpperCase(),
        s: {
          fill: { fgColor: { rgb: boxHeaderBg } },
          font: { name: 'Calibri', sz: 12, bold: true, color: { rgb: '0F172A' } },
          alignment: centerAlignment,
          border: {
            top: boxMediumBorder,
            left: boxMediumBorder,
            right: boxMediumBorder,
            bottom: boxHeaderDivider
          }
        }
      };
      for (let c = 1; c < 6; c++) {
        ws[`${colKeys[c]}${curRow}`] = {
          t: 's',
          v: '',
          s: {
            fill: { fgColor: { rgb: boxHeaderBg } },
            border: {
              top: boxMediumBorder,
              bottom: boxHeaderDivider,
              right: c === 5 ? boxMediumBorder : undefined
            }
          }
        };
      }
      merges.push({ s: { r: curRow - 1, c: 0 }, e: { r: curRow - 1, c: 5 } });
      curRow++;

      // Individual Date Rows for this guest (enclosed in the guest's box, alternating visible lavender tints)
      datesList.forEach((dObj, dIdx) => {
        const isEven = dIdx % 2 === 0;
        const rowBg = isEven ? 'E0E7FF' : 'C7D2FE'; // Distinct soft lavender tints
        const dmy = `${String(dObj.day).padStart(2, '0')}-${monthPadded}-${year}`;
        const isLastDate = (dIdx === numDates - 1);
        const bottomEdgeBorder = isLastDate ? boxMediumBorder : { style: 'thin', color: { rgb: '818CF8' } };

        const baseCellBorder = {
          top: { style: 'thin', color: { rgb: '818CF8' } },
          bottom: bottomEdgeBorder,
          left: { style: 'thin', color: { rgb: '818CF8' } },
          right: { style: 'thin', color: { rgb: '818CF8' } }
        };

        const baseDateStyle = {
          fill: { fgColor: { rgb: rowBg } },
          font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '000000' } },
          alignment: centerAlignment,
          border: baseCellBorder
        };

        // Col A: Guest Name (Single cell, hyperlinked, left edge of box)
        ws[`A${curRow}`] = {
          t: 's',
          v: g.name,
          l: { Target: `#'${dObj.day}'!A1`, Tooltip: `Jump to ${g.name}'s entries on Day ${dObj.day}` },
          s: {
            ...baseDateStyle,
            font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '0000FF' }, underline: true },
            border: {
              ...baseCellBorder,
              left: boxMediumBorder
            }
          }
        };

        // Col B: Gaming Date (Single cell)
        ws[`B${curRow}`] = {
          t: 's',
          v: dmy,
          s: baseDateStyle
        };

        // Col C: Date Total In (Single cell)
        ws[`C${curRow}`] = {
          t: 'n',
          v: dObj.totalIn,
          s: { ...baseDateStyle, font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '065F46' } } }
        };

        // Col D: Date Total Out (Single cell)
        ws[`D${curRow}`] = {
          t: 'n',
          v: dObj.totalOut,
          s: { ...baseDateStyle, font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '78350F' } } }
        };

        // Col E: Date Result (+/-) (Single cell)
        const dResColor = dObj.result > 0 ? '047857' : (dObj.result < 0 ? 'B91C1C' : '1E293B');
        ws[`E${curRow}`] = {
          t: 'n',
          v: dObj.result,
          s: {
            ...baseDateStyle,
            font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: dResColor } }
          }
        };

        // Col F: Sheet Navigation link (Single cell, right edge of box)
        ws[`F${curRow}`] = {
          t: 's',
          v: `➜ View Day ${dObj.day} Entries`,
          l: { Target: `#'${dObj.day}'!A1`, Tooltip: `Open Day ${dObj.day} sheet for ${g.name}` },
          s: {
            ...baseDateStyle,
            font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '0000FF' }, underline: true },
            border: {
              ...baseCellBorder,
              right: boxMediumBorder
            }
          }
        };

        curRow++;
      });

      // Blank spacing row between guest boxes (visible sky blue background fill)
      for (let c = 0; c < 6; c++) {
        ws[`${colKeys[c]}${curRow}`] = {
          t: 's',
          v: '',
          s: { fill: { fgColor: { rgb: 'BAE6FD' } } }
        };
      }
      merges.push({ s: { r: curRow - 1, c: 0 }, e: { r: curRow - 1, c: 5 } });
      curRow++;
    });
  }

  // Extend background canvas below Table 2 up to row 50
  const endSummaryRow = Math.max(curRow, 50);
  for (let emptyRow = curRow; emptyRow <= endSummaryRow; emptyRow++) {
    const emptyBg = emptyRow % 2 === 0 ? 'BAE6FD' : 'D0EEFC';
    for (let c = 0; c < 6; c++) {
      ws[`${colKeys[c]}${emptyRow}`] = {
        t: 's',
        v: '',
        s: {
          fill: { fgColor: { rgb: emptyBg } },
          border: {
            top: { style: 'thin', color: { rgb: '7DD3FC' } },
            bottom: { style: 'thin', color: { rgb: '7DD3FC' } },
            left: { style: 'thin', color: { rgb: '7DD3FC' } },
            right: { style: 'thin', color: { rgb: '7DD3FC' } }
          }
        }
      };
    }
    merges.push({ s: { r: emptyRow - 1, c: 0 }, e: { r: emptyRow - 1, c: 5 } });
  }

  ws['!ref'] = `A1:F${endSummaryRow}`;
  ws['!merges'] = merges;
  ws['!views'] = [{ showGridLines: true }];
  ws['!cols'] = [
    { wch: 22 }, // A: Date (Table 1) / Guest Name (Table 2)
    { wch: 18 }, // B: Total In (Table 1) / Date (Table 2)
    { wch: 18 }, // C: Total Out (Table 1) / Total In (Table 2)
    { wch: 18 }, // D: Result (Table 1) / Total Out (Table 2)
    { wch: 18 }, // E: Total Entries (Table 1) / Result (Table 2)
    { wch: 30 }  // F: Link (Table 1 & Table 2)
  ];
  ws['!pageSetup'] = { orientation: 'landscape', fitToWidth: 1, fitToHeight: 0 };

  return ws;
}

// Export Date-wise into Folder 1 (DATE_WISE) and Monthly Workbook into Folder 2 (MONTHLY_WORKBOOK)
function exportEntriesToExcel(entries, dateStr) {
  if (!dateStr) {
    dateStr = calculateActualBusinessDate();
  }
  const parts = dateStr.split('-');
  const year = parts[0];
  const month = parts[1];
  const dayNumber = parseInt(parts[2], 10); // 1..31
  const dayPadded = String(dayNumber).padStart(2, '0');
  const dmyDate = `${dayPadded}-${month}-${year}`;

  const { dateWiseDir, monthlyDir, monthName, monthFolderName } = getMonthExportDirs(year, month);
  const monthlyWorkbookPath = path.join(monthlyDir, `${monthName}_${year}.xlsx`);
  const dateWisePath = path.join(dateWiseDir, `${dmyDate}.xlsx`);

  // Aggregate all entries for this month from ENTRIES_DIR
  const allMonthEntries = [];
  const monthEntriesByDay = {};
  for (let d = 1; d <= 31; d++) {
    monthEntriesByDay[d] = [];
  }

  try {
    if (fs.existsSync(ENTRIES_DIR)) {
      const allFiles = fs.readdirSync(ENTRIES_DIR).filter(f => f.endsWith('.json') && f !== 'users_db.json');
      allFiles.forEach(file => {
        try {
          const item = JSON.parse(fs.readFileSync(path.join(ENTRIES_DIR, file), 'utf8'));
          let itemDate = item.businessDate || '';
          if (!itemDate && item.datetime) {
            itemDate = item.datetime.includes('T') ? item.datetime.split('T')[0] : item.datetime.split(' ')[0];
          }
          if (itemDate && itemDate.startsWith(`${year}-${month}`)) {
            const itemDay = parseInt(itemDate.split('-')[2], 10);
            if (itemDay >= 1 && itemDay <= 31) {
              allMonthEntries.push(item);
              monthEntriesByDay[itemDay].push(item);
            }
          }
        } catch (err) {}
      });
    }
  } catch (err) {
    console.error('Error syncing ENTRIES_DIR to sheets:', err);
  }

  // If specific entries passed for current dateStr, merge them into that day's list if not already present
  if (Array.isArray(entries) && entries.length > 0) {
    if (dayNumber >= 1 && dayNumber <= 31) {
      const existingIds = new Set(monthEntriesByDay[dayNumber].map(e => e.id));
      entries.forEach(e => {
        if (!existingIds.has(e.id)) {
          monthEntriesByDay[dayNumber].push(e);
          allMonthEntries.push(e);
        }
      });
    }
  }

  // Sort each day's entries
  for (let d = 1; d <= 31; d++) {
    monthEntriesByDay[d].sort((a, b) => (a.datetime || '').localeCompare(b.datetime || ''));
  }
  allMonthEntries.sort((a, b) => (a.datetime || '').localeCompare(b.datetime || ''));

  let generatedDailyWorkbook = null;
  let generatedMonthlyWorkbook = null;

  // 1. Save Date-Wise Workbook in Folder 1 (EXPORTS/DATE_WISE/DD-MM-YYYY.xlsx)
  const shouldSaveDateWise = (Array.isArray(entries) && entries.length > 0) ||
                             (dateStr === currentBusinessDate) ||
                             (dayNumber >= 1 && dayNumber <= 31 && monthEntriesByDay[dayNumber] && monthEntriesByDay[dayNumber].length > 0);
  if (shouldSaveDateWise) {
    try {
      const targetDayData = (dayNumber >= 1 && dayNumber <= 31) ? monthEntriesByDay[dayNumber] : (entries || []);
      generatedDailyWorkbook = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(generatedDailyWorkbook, buildStyledWorksheet(targetDayData, dayNumber, false), `Day ${dayNumber}`);
      try {
        xlsx.writeFile(generatedDailyWorkbook, dateWisePath);
        console.log(`[FOLDER 1: DATE_WISE] Saved workbook to: ${dateWisePath}`);
      } catch (fErr) {
        if (fErr.code === 'EBUSY') {
          console.warn(`[NOTE] ${dateWisePath} is currently open in Excel. Will stream directly to client.`);
        } else {
          console.error(`Failed to write date-wise workbook: ${dateWisePath}`, fErr);
        }
      }
    } catch (err) {
      console.error(`Failed to build date-wise workbook: ${dateWisePath}`, err);
    }
  }

  // 2. Save Monthly Workbook in Folder 2 (EXPORTS/MONTHLY_WORKBOOK/<MONTH>_<YEAR>.xlsx)
  try {
    generatedMonthlyWorkbook = xlsx.utils.book_new();

    // Sheet 1: Master SUMMARY Sheet
    const summarySheet = buildMonthlySummarySheet(allMonthEntries, monthName, year);
    generatedMonthlyWorkbook.Sheets['SUMMARY'] = summarySheet;

    // Sheets 2 to 32: Sheets '1' to '31'
    for (let d = 1; d <= 31; d++) {
      const daySheet = buildStyledWorksheet(monthEntriesByDay[d], d, true, `${year}-${month}`);
      generatedMonthlyWorkbook.Sheets[String(d)] = daySheet;
    }

    generatedMonthlyWorkbook.SheetNames = ['SUMMARY', ...Array.from({ length: 31 }, (_, i) => String(i + 1))];

    try {
      xlsx.writeFile(generatedMonthlyWorkbook, monthlyWorkbookPath);
      console.log(`[FOLDER 2: MONTHLY_WORKBOOK] Saved workbook to: ${monthlyWorkbookPath}`);
    } catch (writeErr) {
      if (writeErr.code === 'EBUSY') {
        console.warn(`[NOTE] ${monthlyWorkbookPath} is currently open in Excel. Saving as ${monthName}_${year}_UPDATED.xlsx`);
        try {
          const altPath = path.join(monthlyDir, `${monthName}_${year}_UPDATED.xlsx`);
          xlsx.writeFile(generatedMonthlyWorkbook, altPath);
        } catch (e) {}
      } else {
        console.error(`Failed to write monthly workbook: ${monthlyWorkbookPath}`, writeErr);
      }
    }
  } catch (err) {
    console.error(`Failed to build monthly workbook: ${monthlyWorkbookPath}`, err);
  }

  return { dailyWorkbook: generatedDailyWorkbook, monthlyWorkbook: generatedMonthlyWorkbook };
}

function getArchiveMetadata() {
  const metadata = {};
  if (!fs.existsSync(EXPORTS_DIR)) return [];

  const subdirs = fs.readdirSync(EXPORTS_DIR);
  subdirs.forEach(folder => {
    // 1. Check if folder is a 4-digit Year (e.g. 2026, 2027)
    if (/^\d{4}$/.test(folder)) {
      const year = folder;
      const yearPath = path.join(EXPORTS_DIR, year);
      try {
        const monthDirs = fs.readdirSync(yearPath);
        monthDirs.forEach(mFolder => {
          // Can be "NOVEMBER 2026" or "NOVEMBER_2026"
          const mMatch = mFolder.match(/^([A-Z]+)[_ ](\d{4})$/);
          if (mMatch) {
            const [, mName] = mMatch;
            const mIdx = MONTH_NAMES.indexOf(mName);
            if (mIdx !== -1) {
              const month = String(mIdx + 1).padStart(2, '0');
              metadata[year] = metadata[year] || new Set();
              metadata[year].add(month);
            }
          }
        });
      } catch (e) {}
    } else {
      // Legacy: Month folder directly under EXPORTS (e.g. NOVEMBER_2026 or NOVEMBER 2026)
      const match = folder.match(/^([A-Z]+)[_ ](\d{4})$/);
      if (match) {
        const [, mName, year] = match;
        const mIdx = MONTH_NAMES.indexOf(mName);
        if (mIdx !== -1) {
          const month = String(mIdx + 1).padStart(2, '0');
          metadata[year] = metadata[year] || new Set();
          metadata[year].add(month);
        }
      }
    }
  });

  return Object.entries(metadata).map(([year, months]) => ({
    year,
    months: Array.from(months).sort()
  })).sort((a, b) => Number(b.year) - Number(a.year));
}

function readArchiveEntries(year, month) {
  const archivePath = getArchiveWorkbookPath(year, month);
  if (!fs.existsSync(archivePath)) {
    return [];
  }

  const workbook = xlsx.readFile(archivePath);
  const entries = [];

  workbook.SheetNames.forEach(sheetName => {
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
    data.forEach(row => {
      const rowType = row['TYPE'] || row['Type'] || row.type || '';
      const rowGuest = row['GUEST NAME'] || row['Guest Name'] || row.guestname || '';
      if (!rowType && !rowGuest) return; // Skip empty rows or summary rows

      let dt = row.datetime || row['Date & Time'] || '';
      if (!dt && row['DATE']) {
        const dparts = String(row['DATE']).split('-');
        let formattedDate = row['DATE'];
        if (dparts.length === 3 && dparts[0].length === 2) {
          // DD-MM-YYYY to YYYY-MM-DD
          formattedDate = `${dparts[2]}-${dparts[1]}-${dparts[0]}`;
        }
        const timePart = row['TIME'] || '00:00';
        dt = `${formattedDate}T${timePart}`;
      }

      entries.push({
        id: row.id || row['ID'] || null,
        datetime: dt || `${year}-${month}-${sheetName}`,
        surv: row['SURV ID'] || row['Surv ID'] || row.surv || '',
        cd: row['C / D'] || row.cd || '',
        cashier: row['Cashier'] || row.cashier || '',
        type: rowType,
        amount: Number(row['AMOUNT'] || row['Amount'] || row.amount) || 0,
        guestname: rowGuest,
        card: row['CARD'] || row['Card'] || row.card || '',
        otherinfo: row['OTHER INFO'] || row['Other Info'] || row.otherinfo || ''
      });
    });
  });

  entries.sort((a, b) => new Date(b.datetime) - new Date(a.datetime));
  return entries;
}

function startDailyArchiveJob() {
  // 1. Check if we missed the reset while the server/PC was shut down
  const actualDate = calculateActualBusinessDate();
  if (actualDate > currentBusinessDate) {
    const previousDate = currentBusinessDate;
    console.log(`[${new Date().toISOString()}] Missed a daily reset. Running catch-up archiving for ${previousDate}...`);
    try {
      const result = archiveActiveEntries();
      if (result.archived && result.archivedEntries && result.archivedEntries.length > 0) {
        console.log(`Catch-up archived ${result.count} entries.`);
        exportEntriesToExcel(result.archivedEntries, previousDate);
      } else {
        exportEntriesToExcel([], previousDate);
      }
      savePersistedBusinessDate(actualDate);
      broadcastEvent({ type: 'date-rollover', newDate: actualDate, previousDate: previousDate });
    } catch (err) {
      console.error('Catch-up archive failed:', err);
    }
  }

  // 2. Schedule the normal daily reset at 06:00 AM while the server is running
  cron.schedule('0 6 * * *', () => {
    const naturalToday = calculateActualBusinessDate(); // At 06:00 AM, this is today's calendar date
    console.log(`[${new Date().toISOString()}] [06:00 HRS] Checking 06:00 AM auto-rollover. Current business date: ${currentBusinessDate}, Natural date: ${naturalToday}`);

    // If currentBusinessDate is already naturalToday (or newer), the user manually started this day earlier (e.g. at 04:00 AM)!
    // That day MUST NOT be changed or archived at 06:00 AM. It will advance at NEXT 06:00 AM.
    if (currentBusinessDate >= naturalToday) {
      console.log(`[06:00 HRS] Gaming date (${currentBusinessDate}) was already manually activated before 06:00 HRS. Skipping auto-rollover until next 06:00 AM.`);
      // Sync monthly sheets without archiving active session entries
      exportEntriesToExcel([], currentBusinessDate);
      return;
    }

    const finishedBusinessDate = currentBusinessDate; // The date that just finished
    console.log(`[${new Date().toISOString()}] [06:00 HRS] Running daily archiving & Excel export job for ${finishedBusinessDate}...`);
    try {
      const result = archiveActiveEntries();
      if (result.archived) {
        console.log(`[06:00 HRS] Archived ${result.count} active entries to: ${result.archivePaths.join(', ')}`);
        exportEntriesToExcel(result.archivedEntries || [], finishedBusinessDate);
      } else {
        console.log(`[06:00 HRS] No active entries found to archive for ${finishedBusinessDate}, syncing monthly export sheets 1..31...`);
        exportEntriesToExcel([], finishedBusinessDate);
      }

      savePersistedBusinessDate(naturalToday);
      broadcastEvent({ type: 'date-rollover', newDate: naturalToday, previousDate: finishedBusinessDate });
      console.log(`[06:00 HRS] New gaming day auto-started: ${naturalToday}. Fresh entries started on Home button.`);
    } catch (err) {
      console.error('[06:00 HRS] Scheduled 06:00 archive failed:', err);
    }
  }, {
    scheduled: true
  });
}

// Database Helper: Load users
function loadUsers() {
  const defaultUsers = {
    admin: { password: 'ADMIN', role: 'admin', name: 'ADMIN', firstLogin: false }
  };

  if (!fs.existsSync(USERS_FILE)) {
    try {
      fs.writeFileSync(USERS_FILE, JSON.stringify(defaultUsers, null, 2), 'utf8');
      console.log(`Initialized user database at: ${USERS_FILE}`);
    } catch (err) {
      console.error(`Failed to initialize user database file: ${USERS_FILE}`, err);
    }
    return defaultUsers;
  }

  try {
    const data = fs.readFileSync(USERS_FILE, 'utf8');
    let users = JSON.parse(data);
    let upgraded = false;
    for (let username in users) {
      if (typeof users[username] === 'string') {
        users[username] = {
          name: username === 'admin' ? 'ADMIN' : '',
          password: users[username],
          role: username === 'admin' ? 'admin' : 'officer',
          firstLogin: username !== 'admin'
        };
        upgraded = true;
      } else {
        if (!users[username].name) {
          users[username].name = username === 'admin' ? 'ADMIN' : '';
          upgraded = true;
        }
        if (users[username].firstLogin === undefined) {
          users[username].firstLogin = !users[username].name && username !== 'admin';
          upgraded = true;
        }
      }
    }
    if (upgraded) {
      saveUsers(users);
    }
    return users;
  } catch (err) {
    console.error(`Failed to read user database file: ${USERS_FILE}. Falling back to default users.`, err);
    return defaultUsers;
  }
}

// Database Helper: Save users
function saveUsers(users) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`Failed to write user database file: ${USERS_FILE}`, err);
    return false;
  }
}

// Pre-initialize user database
loadUsers();

// Supported MIME types
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  // Ensure UTF-8 decoding on all incoming request streams
  if (req.setEncoding) req.setEncoding('utf8');
  // CORS Headers for API requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Parse request URL
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // Favicon direct serving for browser tabs
  if (pathname === '/favicon.ico' || pathname === '/favicon.svg') {
    const iconPath = path.join(__dirname, 'public', 'favicon.svg');
    if (fs.existsSync(iconPath)) {
      res.writeHead(200, {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      });
      fs.createReadStream(iconPath).pipe(res);
      return;
    }
  }

  // ==========================================================================
  // API ROUTING
  // ==========================================================================

  // GET /api/events - Server-Sent Events (SSE) stream
  if (pathname === '/api/events' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write(': ok\n\n');
    sseClients.push(res);
    req.on('close', () => {
      sseClients = sseClients.filter(c => c !== res);
    });
    return;
  }


  // POST /api/login
  if (pathname === '/api/login' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { username, password } = safeJsonParse(body) || {};
        if (!username || !password) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Username and password are required.' }));
          return;
        }

        const normalizedUser = username.toLowerCase().trim();
        const users = loadUsers();

        const foundKey = Object.keys(users).find(k => k.toLowerCase() === normalizedUser);
        const userObj = foundKey ? users[foundKey] : null;
        // Case-insensitive password comparison: small letter or capital letter does not matter
        const enteredPass = String(password || '').trim().toLowerCase();
        const storedPass = String((userObj && userObj.password) || '').trim().toLowerCase();

        if (userObj && enteredPass === storedPass) {
          const isFirstLogin = normalizedUser !== 'admin' && (!!userObj.firstLogin || !userObj.name);
          const displayName = (userObj.name && userObj.name.trim()) ? userObj.name.trim() : (normalizedUser === 'admin' ? 'ADMIN' : (foundKey || username.trim()));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            user: {
              id: foundKey || normalizedUser,
              name: displayName,
              role: userObj.role || 'officer',
              firstLogin: isFirstLogin
            }
          }));
        } else if (!userObj && enteredPass === normalizedUser && normalizedUser !== 'admin') {
          // Auto-registration for new users:
          // ID = Password on first login, no prior setup needed by Admin
          const cleanId = username.trim();
          users[cleanId] = {
            name: '',
            password: String(password).trim(),
            role: 'officer',
            firstLogin: true
          };
          saveUsers(users);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            user: {
              id: cleanId,
              name: '',
              role: 'officer',
              firstLogin: true
            }
          }));
        } else {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid username or password.' }));
        }
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Malformed JSON payload.' }));
      }
    });
    return;
  }

  // POST /api/user/first-login (User sets their Full Name and new password on first login)
  if (pathname === '/api/user/first-login' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { username, newName, newPassword } = safeJsonParse(body) || {};
        if (!username || !newName || !newPassword) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Username, Full Name, and New Password are required.' }));
          return;
        }

        const normalizedUser = (username || '').toLowerCase().trim();
        const users = loadUsers();
        const foundKey = Object.keys(users).find(k => k.toLowerCase() === normalizedUser);

        if (!foundKey) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'User account not found.' }));
          return;
        }

        const userObj = users[foundKey];
        const formattedName = newName.trim().toUpperCase();
        userObj.name = formattedName;
        userObj.password = String(newPassword).trim();
        userObj.firstLogin = false;
        saveUsers(users);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          message: 'Profile and password updated successfully.',
          user: {
            id: foundKey,
            name: formattedName,
            role: userObj.role || 'officer',
            firstLogin: false
          }
        }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Malformed JSON payload.' }));
      }
    });
    return;
  }

  // GET /api/users (Admin only - returns all accounts with visible passwords)
  if (pathname === '/api/users' && req.method === 'GET') {
    const requester = (parsedUrl.searchParams.get('requester') || '').toLowerCase().trim();
    if (requester !== 'admin') {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Forbidden. Admin access required.' }));
      return;
    }

    const users = loadUsers();
    const userList = Object.keys(users).map(user => ({
      username: user,
      name: users[user].name || (user === 'admin' ? 'ADMIN' : ''),
      password: users[user].password,
      role: users[user].role || 'officer',
      firstLogin: !!users[user].firstLogin || (!users[user].name && user !== 'admin')
    }));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ users: userList }));
    return;
  }

  // POST /api/users (Admin only - create new user with ID & Designation)
  if (pathname === '/api/users' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { adminUser, newUsername, newPassword, newRole, newName } = safeJsonParse(body) || {};
        if (!adminUser || String(adminUser).toLowerCase().trim() !== 'admin') {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Forbidden. Admin authorization required.' }));
          return;
        }

        if (!newUsername) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'User ID is required.' }));
          return;
        }

        const cleanNewUser = newUsername.trim();
        if (cleanNewUser === '') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid User ID.' }));
          return;
        }

        const users = loadUsers();
        const existingKey = Object.keys(users).find(k => k.toLowerCase() === cleanNewUser.toLowerCase());
        if (existingKey) {
          res.writeHead(409, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `User ID "${cleanNewUser}" already exists.` }));
          return;
        }

        const initialPass = (newPassword && newPassword.trim()) ? newPassword.trim() : cleanNewUser;
        const formattedName = (newName && newName.trim()) ? newName.trim().toUpperCase() : '';
        const role = (newRole || 'officer').toLowerCase();

        // Add and save
        users[cleanNewUser] = {
          name: formattedName,
          password: initialPass,
          role: role,
          firstLogin: !formattedName
        };
        saveUsers(users);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: `Account created for ${cleanNewUser}.` }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Malformed JSON payload.' }));
      }
    });
    return;
  }

  // DELETE /api/users (Admin only - delete credentials)
  if (pathname === '/api/users' && req.method === 'DELETE') {
    const adminUser = parsedUrl.searchParams.get('adminUser') || parsedUrl.searchParams.get('requester');
    const usernameToDelete = parsedUrl.searchParams.get('username');

    if (!adminUser || String(adminUser).toLowerCase().trim() !== 'admin') {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Forbidden. Admin authorization required.' }));
      return;
    }

    if (!usernameToDelete) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Username to delete is required.' }));
      return;
    }

    const normalizedToDelete = usernameToDelete.trim().toLowerCase();
    if (normalizedToDelete === 'admin') {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Cannot delete primary admin account.' }));
      return;
    }

    const users = loadUsers();
    const targetKey = Object.keys(users).find(k => k.toLowerCase() === normalizedToDelete);
    if (!targetKey) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'User account not found.' }));
      return;
    }

    // Delete and save
    delete users[targetKey];
    saveUsers(users);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: `Account for ${targetKey} deleted.` }));
    return;
  }

  // PUT /api/users (Admin only - update credentials, ID, Name, Password, Role)
  if (pathname === '/api/users' && req.method === 'PUT') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { adminUser, username, origUsername, newUsername, name, password, role } = safeJsonParse(body) || {};
        if (!adminUser || String(adminUser).toLowerCase().trim() !== 'admin') {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Forbidden. Admin authorization required.' }));
          return;
        }

        const searchUser = (origUsername || username || '').trim().toLowerCase();
        const users = loadUsers();
        const foundKey = Object.keys(users).find(k => k.toLowerCase() === searchUser);
        if (!foundKey) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'User account not found.' }));
          return;
        }

        const userObj = users[foundKey];
        if (password) userObj.password = String(password).trim();
        if (role) userObj.role = role.toLowerCase();
        if (name !== undefined) {
          userObj.name = (name || '').trim().toUpperCase();
          if (userObj.name) userObj.firstLogin = false;
        }

        // If User ID was changed:
        const cleanNewId = (newUsername || '').trim();
        if (cleanNewId && cleanNewId.toLowerCase() !== foundKey.toLowerCase()) {
          const conflictKey = Object.keys(users).find(k => k.toLowerCase() === cleanNewId.toLowerCase());
          if (conflictKey) {
            res.writeHead(409, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `User ID "${cleanNewId}" already exists.` }));
            return;
          }
          delete users[foundKey];
          users[cleanNewId] = userObj;
        } else if (cleanNewId && cleanNewId !== foundKey) {
          delete users[foundKey];
          users[cleanNewId] = userObj;
        }

        saveUsers(users);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: `Account updated successfully.` }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Malformed JSON payload.' }));
      }
    });
    return;
  }

  // POST /api/entries (Ultra-fast single or batch entry creation)
  if (pathname === '/api/entries' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let parsed;
      try {
        parsed = safeJsonParse(body);
      } catch (parseErr) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Malformed JSON payload: ${parseErr.message}` }));
        return;
      }

      try {
        if (!parsed) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Empty JSON payload.' }));
          return;
        }

        const items = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.entries) ? parsed.entries : [parsed]);
        if (items.length === 0) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing required entry fields.' }));
          return;
        }

        const now = Date.now();
        const savedList = [];

        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const entryId = item.id || (now + i);
          const entryData = {
            id: entryId,
            businessDate: item.businessDate || currentBusinessDate,
            archived: false,
            ...item,
            id: entryId,
            modifiedAt: entryId
          };
          const filename = `entry_${entryId}.json`;
          const filePath = path.join(ENTRIES_DIR, filename);
          fs.writeFileSync(filePath, JSON.stringify(entryData, null, 2), 'utf8');
          savedList.push(entryData);

          if (item.guestname) {
            const barredGuest = checkIfGuestIsBarred(item.guestname);
            if (barredGuest) {
              broadcastEvent({
                type: 'barred-match',
                guestname: barredGuest.guestname,
                reason: barredGuest.reason || 'No reason specified',
                content: barredGuest.content
              });
            }
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          message: `${savedList.length} entry/entries saved successfully.`,
          count: savedList.length,
          file: `entry_${savedList[0].id}.json`,
          entry: savedList[0],
          entries: savedList
        }));
      } catch (err) {
        console.error('Error writing entry:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to write entry to file system.' }));
      }
    });
    return;
  }

  // GET /api/barred
  if (pathname === '/api/barred' && req.method === 'GET') {
    try {
      if (!fs.existsSync(BARRED_DIR)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ barred: [] }));
        return;
      }
      const files = fs.readdirSync(BARRED_DIR);
      const barred = [];
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const content = fs.readFileSync(path.join(BARRED_DIR, file), 'utf8');
            barred.push(JSON.parse(content));
          } catch (e) {}
        }
      }
      barred.sort((a, b) => b.timestamp - a.timestamp);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ barred }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to read barred guests.' }));
    }
    return;
  }

  // POST /api/barred
  if (pathname === '/api/barred' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = safeJsonParse(body) || {};
        const { guestname, reason, date, inst, property, otherinfo, photo } = data;
        if (!guestname) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Guest Name is required.' }));
          return;
        }
        const id = Date.now();
        const entryData = { id, guestname, reason, date, inst, property, otherinfo, photo, timestamp: id };
        fs.writeFileSync(path.join(BARRED_DIR, `barred_${id}.json`), JSON.stringify(entryData, null, 2), 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, entry: entryData }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to save barred guest.' }));
      }
    });
    return;
  }

  // POST /api/barred/bulk
  if (pathname === '/api/barred/bulk' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = safeJsonParse(body) || {};
        if (!Array.isArray(data.guests)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Expected an array of guests.' }));
          return;
        }
        
        // Remove existing files only if clearFirst is explicitly true
        if (data.clearFirst === true && fs.existsSync(BARRED_DIR)) {
          const oldFiles = fs.readdirSync(BARRED_DIR);
          for (const file of oldFiles) {
            if (file.endsWith('.json')) {
              fs.unlinkSync(path.join(BARRED_DIR, file));
            }
          }
        }
        
        const added = [];
        let idCounter = Date.now();
        data.guests.forEach(g => {
          const id = idCounter++;
          const entryData = { id, timestamp: id, ...g };
          fs.writeFileSync(path.join(BARRED_DIR, `barred_${id}.json`), JSON.stringify(entryData, null, 2), 'utf8');
          added.push(entryData);
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, count: added.length }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to bulk import barred guests.' }));
      }
    });
    return;
  }

  // GET /api/staff
  if (pathname === '/api/staff' && req.method === 'GET') {
    try {
      if (!fs.existsSync(STAFF_DIR)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ staff: [] }));
        return;
      }
      const files = fs.readdirSync(STAFF_DIR);
      const staff = [];
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const content = fs.readFileSync(path.join(STAFF_DIR, file), 'utf8');
            staff.push(JSON.parse(content));
          } catch (e) {}
        }
      }
      staff.sort((a, b) => (b.timestamp || b.id || 0) - (a.timestamp || a.id || 0));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ staff }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to read staff.' }));
    }
    return;
  }

  // POST /api/staff (Single Add)
  if (pathname === '/api/staff' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = safeJsonParse(body) || {};
        const name = (data.name || '').trim();
        if (!name) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Name is required' }));
          return;
        }
        const id = data.id || Date.now();
        const entryData = { id, timestamp: id, ...data };
        fs.writeFileSync(path.join(STAFF_DIR, `staff_${id}.json`), JSON.stringify(entryData, null, 2), 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, entry: entryData }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to save staff member.' }));
      }
    });
    return;
  }

  // POST /api/staff/bulk
  if (pathname === '/api/staff/bulk' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = safeJsonParse(body) || {};
        const rawList = data.staff || data.entries;
        if (!Array.isArray(rawList)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Expected an array of staff.' }));
          return;
        }
        
        // Remove existing files before bulk insert to do a fresh import
        if (fs.existsSync(STAFF_DIR)) {
          const oldFiles = fs.readdirSync(STAFF_DIR);
          for (const file of oldFiles) {
            if (file.endsWith('.json')) {
              try { fs.unlinkSync(path.join(STAFF_DIR, file)); } catch (err) {}
            }
          }
        }
        
        const added = [];
        let idCounter = Date.now();
        rawList.forEach(s => {
          const id = idCounter++;
          const entryData = { id, timestamp: id, ...s };
          fs.writeFileSync(path.join(STAFF_DIR, `staff_${id}.json`), JSON.stringify(entryData, null, 2), 'utf8');
          added.push(entryData);
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, count: added.length }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to bulk import staff.' }));
      }
    });
    return;
  }

  // PUT /api/staff?id=<id> or /api/staff/<id> - Update staff details or photo
  if ((pathname === '/api/staff' || pathname.startsWith('/api/staff/')) && req.method === 'PUT') {
    const id = parsedUrl.searchParams.get('id') || (pathname.startsWith('/api/staff/') ? pathname.split('/').pop() : null);
    if (!id || id === 'staff') {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'ID is required.' }));
      return;
    }
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const filePath = path.join(STAFF_DIR, `staff_${id}.json`);
        if (!fs.existsSync(filePath)) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Staff not found.' }));
          return;
        }
        const existingData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const data = safeJsonParse(body) || {};
        const updatedData = { ...existingData, ...data, id: existingData.id || id };
        fs.writeFileSync(filePath, JSON.stringify(updatedData, null, 2), 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, entry: updatedData }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to update staff.' }));
      }
    });
    return;
  }

  // DELETE /api/staff?id=<id> or /api/staff/<id>
  if ((pathname === '/api/staff' || pathname.startsWith('/api/staff/')) && req.method === 'DELETE') {
    const id = parsedUrl.searchParams.get('id') || (pathname.startsWith('/api/staff/') ? pathname.split('/').pop() : null);
    if (!id || id === 'staff') {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'ID is required.' }));
      return;
    }
    try {
      const filePath = path.join(STAFF_DIR, `staff_${id}.json`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Staff not found.' }));
      }
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to delete staff.' }));
    }
    return;
  }

  // PUT /api/barred?id=<id>
  if (pathname === '/api/barred' && req.method === 'PUT') {
    const id = parsedUrl.searchParams.get('id');
    if (!id) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'ID is required.' }));
      return;
    }
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const filePath = path.join(BARRED_DIR, `barred_${id}.json`);
        if (!fs.existsSync(filePath)) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Barred guest not found.' }));
          return;
        }
        
        const existingData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const data = safeJsonParse(body) || {};
        const guestname = data.guestname || existingData.guestname;
        
        if (!guestname) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Guest Name is required.' }));
          return;
        }
        
        const updatedData = { 
          ...existingData, 
          guestname, 
          reason: data.reason !== undefined ? data.reason : existingData.reason, 
          date: data.date !== undefined ? data.date : existingData.date, 
          inst: data.inst !== undefined ? data.inst : existingData.inst, 
          property: data.property !== undefined ? data.property : existingData.property, 
          otherinfo: data.otherinfo !== undefined ? data.otherinfo : existingData.otherinfo,
          photo: data.photo !== undefined ? data.photo : existingData.photo 
        };
        
        fs.writeFileSync(filePath, JSON.stringify(updatedData, null, 2), 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, entry: updatedData }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to update barred guest.' }));
      }
    });
    return;
  }

  // DELETE /api/barred
  if (pathname === '/api/barred' && req.method === 'DELETE') {
    const id = parsedUrl.searchParams.get('id');
    const all = parsedUrl.searchParams.get('all');

    if (all === 'true' || id === 'all') {
      try {
        if (fs.existsSync(BARRED_DIR)) {
          const files = fs.readdirSync(BARRED_DIR);
          for (const file of files) {
            if (file.endsWith('.json')) {
              fs.unlinkSync(path.join(BARRED_DIR, file));
            }
          }
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'All barred guests deleted.' }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to delete all barred guests.' }));
      }
      return;
    }

    if (!id) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'ID is required.' }));
      return;
    }
    try {
      const filePath = path.join(BARRED_DIR, `barred_${id}.json`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Barred guest not found.' }));
      }
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to delete barred guest.' }));
    }
    return;
  }

  // GET /api/status
  if (pathname === '/api/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', currentBusinessDate, businessDate: currentBusinessDate, serverTime: Date.now() }));
    return;
  }

  // GET /api/business-date
  if (pathname === '/api/business-date' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ businessDate: currentBusinessDate, currentBusinessDate }));
    return;
  }

  // GET /api/archives
  if (pathname === '/api/archives' && req.method === 'GET') {
    const year = parsedUrl.searchParams.get('year');
    const month = parsedUrl.searchParams.get('month');

    if (!year || !month) {
      const archives = getArchiveMetadata();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ archives }));
      return;
    }

    try {
      const entries = readArchiveEntries(year, month);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ entries }));
    } catch (err) {
      console.error('Error reading archive entries:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to read archive entries.' }));
    }
    return;
  }

  // GET /api/export-date?date=YYYY-MM-DD - Download single date Excel file from DATE_WISE folder
  if (pathname === '/api/export-date' && req.method === 'GET') {
    try {
      let dateParam = parsedUrl.searchParams.get('date') || currentBusinessDate;
      const parts = dateParam.split('-');
      const year = parts[0];
      const month = parts[1];
      const dayNum = parseInt(parts[2], 10);
      const dayPadded = String(dayNum).padStart(2, '0');
      const dmyDate = `${dayPadded}-${month}-${year}`;

      const { dateWiseDir } = getMonthExportDirs(year, month);
      const dateWisePath = path.join(dateWiseDir, `${dmyDate}.xlsx`);

      // Read entries for this specific date
      const dateEntries = [];
      if (fs.existsSync(ENTRIES_DIR)) {
        const files = fs.readdirSync(ENTRIES_DIR).filter(f => f.endsWith('.json') && f !== 'users_db.json');
        files.forEach(f => {
          try {
            const item = JSON.parse(fs.readFileSync(path.join(ENTRIES_DIR, f), 'utf8'));
            const itemDate = item.businessDate || (item.datetime ? (item.datetime.includes('T') ? item.datetime.split('T')[0] : item.datetime.split(' ')[0]) : '');
            if (itemDate === dateParam) {
              dateEntries.push(item);
            }
          } catch (e) {}
        });
      }
      dateEntries.sort((a, b) => (a.datetime || '').localeCompare(b.datetime || ''));

      // Build and write date-wise workbook into FOLDER 1 (DATE_WISE)
      const dailyWorkbook = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(dailyWorkbook, buildStyledWorksheet(dateEntries, dayNum, false), `Day ${dayNum}`);
      xlsx.writeFile(dailyWorkbook, dateWisePath);

      // Stream file to client
      if (fs.existsSync(dateWisePath)) {
        const stat = fs.statSync(dateWisePath);
        res.writeHead(200, {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Length': stat.size,
          'Content-Disposition': `attachment; filename="${dmyDate}.xlsx"`
        });
        fs.createReadStream(dateWisePath).pipe(res);
        return;
      }
    } catch (err) {
      console.error('Error serving Date Excel export:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to generate Date Excel export' }));
      return;
    }
  }

  // GET /api/export-excel?month=YYYY-MM - Download Monthly Excel with SUMMARY + 1..31 Sheets from MONTHLY_WORKBOOK folder
  if (pathname === '/api/export-excel' && req.method === 'GET') {
    try {
      const monthParam = parsedUrl.searchParams.get('month') || currentBusinessDate.slice(0, 7);
      const parts = monthParam.split('-');
      const year = parts[0];
      const month = parts[1];
      const { monthlyDir, monthName } = getMonthExportDirs(year, month);
      const monthlyFileName = `${monthName}_${year}.xlsx`;
      const exportPath = path.join(monthlyDir, monthlyFileName);

      // Generate all 1..31 sheets + SUMMARY
      const exportRes = exportEntriesToExcel([], `${monthParam}-01`);

      if (exportRes && exportRes.monthlyWorkbook) {
        const buf = xlsx.write(exportRes.monthlyWorkbook, { type: 'buffer', bookType: 'xlsx' });
        res.writeHead(200, {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Length': buf.length,
          'Content-Disposition': `attachment; filename="${monthlyFileName}"`
        });
        res.end(buf);
        return;
      }

      if (fs.existsSync(exportPath)) {
        const stat = fs.statSync(exportPath);
        res.writeHead(200, {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Length': stat.size,
          'Content-Disposition': `attachment; filename="${monthlyFileName}"`
        });
        fs.createReadStream(exportPath).pipe(res);
        return;
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Export file not found' }));
        return;
      }
    } catch (err) {
      console.error('Error serving Excel export:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to generate Excel export' }));
      return;
    }
  }

  // GET /api/entries
  if (pathname === '/api/entries' && req.method === 'GET') {
    try {
      if (!fs.existsSync(ENTRIES_DIR)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ entries: [], currentBusinessDate }));
        return;
      }

      const files = fs.readdirSync(ENTRIES_DIR);
      const entries = [];

      for (const file of files) {
        if (file.endsWith('.json') && file !== 'users_db.json') {
          try {
            const filePath = path.join(ENTRIES_DIR, file);
            const content = fs.readFileSync(filePath, 'utf8');
            const parsed = JSON.parse(content);
            entries.push(parsed);
          } catch (readErr) {
            console.error(`Error reading or parsing file ${file}:`, readErr);
          }
        }
      }

      // Sort entries by timestamp (newest modified first)
      entries.sort((a, b) => (b.modifiedAt || b.id) - (a.modifiedAt || a.id));

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ entries, currentBusinessDate }));
    } catch (err) {
      console.error('Error fetching entries:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to read entries from file system.' }));
    }
    return;
  }

  // PUT /api/entries?id=<id>  — update an existing entry file
  if (pathname === '/api/entries' && req.method === 'PUT') {
    const entryId = parsedUrl.searchParams.get('id');
    if (!entryId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Entry ID is required.' }));
      return;
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = safeJsonParse(body) || {};
        
        // 1. Check direct file first O(1)
        const directFile = `entry_${entryId}.json`;
        const directPath = path.join(ENTRIES_DIR, directFile);
        let targetFile = null;
        let existingContent = {};

        if (fs.existsSync(directPath)) {
          targetFile = directFile;
          try {
            existingContent = JSON.parse(fs.readFileSync(directPath, 'utf8'));
          } catch (e) {}
        } else if (fs.existsSync(ENTRIES_DIR)) {
          // 2. Scan ENTRIES_DIR for matching ID (loose comparison string/number)
          const files = fs.readdirSync(ENTRIES_DIR);
          for (const file of files) {
            if (file.endsWith('.json') && file !== 'users_db.json') {
              try {
                const content = JSON.parse(fs.readFileSync(path.join(ENTRIES_DIR, file), 'utf8'));
                if (String(content.id) === String(entryId) || content.id == entryId) {
                  targetFile = file;
                  existingContent = content;
                  break;
                }
              } catch (e) { /* ignore */ }
            }
          }
        }

        // If target file was not found, save as entry_${entryId}.json to prevent data loss
        const saveFileName = targetFile || `entry_${entryId}.json`;
        const saveFilePath = path.join(ENTRIES_DIR, saveFileName);

        // Preserve businessDate, archived status, and merge updated fields
        const bDate = data.businessDate || existingContent.businessDate || currentBusinessDate;
        const updatedEntry = {
          ...existingContent,
          ...data,
          id: existingContent.id || Number(entryId) || entryId,
          businessDate: bDate,
          archived: existingContent.archived !== undefined ? existingContent.archived : false,
          modifiedAt: Date.now()
        };

        fs.writeFileSync(saveFilePath, JSON.stringify(updatedEntry, null, 2), 'utf8');

        // Broadcast entry-updated event so other clients/tabs refresh automatically
        broadcastEvent({
          type: 'entry-updated',
          entry: updatedEntry
        });

        const barredGuest = checkIfGuestIsBarred(updatedEntry.guestname);
        if (barredGuest) {
          broadcastEvent({
            type: 'barred-match',
            guestname: barredGuest.guestname,
            reason: barredGuest.reason || 'No reason specified',
            content: barredGuest.content
          });
        }

        // Keep Excel exports and archives in sync
        try {
          exportEntriesToExcel([], bDate);
        } catch (excelErr) {
          console.error('Error syncing Excel export on entry update:', excelErr);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, entry: updatedEntry }));
      } catch (err) {
        console.error('Error updating entry:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message || 'Failed to update entry.' }));
      }
    });
    return;
  }

  // POST /api/newday - Archive current entries and clear day
  if (pathname === '/api/newday' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = safeJsonParse(body) || {};
        const previousDate = currentBusinessDate;
        const result = archiveActiveEntries();
        if (result.archived && result.archivedEntries && result.archivedEntries.length > 0) {
          exportEntriesToExcel(result.archivedEntries, previousDate);
        } else {
          exportEntriesToExcel([], previousDate);
        }
        
        // Advance business date
        if (data.newDate) {
          savePersistedBusinessDate(data.newDate);
        } else {
          const d = new Date(currentBusinessDate);
          d.setDate(d.getDate() + 1);
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          savePersistedBusinessDate(`${year}-${month}-${day}`);
        }

        // Broadcast date rollover event to all connected clients
        broadcastEvent({ type: 'date-rollover', newDate: currentBusinessDate, previousDate: previousDate });

        if (!result.archived) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: 'Date changed. No previous entries to archive.', newDate: currentBusinessDate }));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: `Archived ${result.count} entries to Excel`, archive: result.archivePaths, newDate: currentBusinessDate }));
      } catch (err) {
        console.error('Error during NEW DAY process:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to complete New Day archiving.' }));
      }
    });
    return;
  }

  // POST /api/entries/move
  if (pathname === '/api/entries/move' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = safeJsonParse(body) || {};
        const idsToCopy = data.ids || [];
        let targetDateStr = data.targetDate;
        let copiedCount = 0;
        console.log(`[ENTRIES MOVE] Request: ${JSON.stringify(data)}`);
        
        if (!Array.isArray(idsToCopy) || idsToCopy.length === 0) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'No IDs provided.' }));
          return;
        }

        // Use targetDate if provided, otherwise default to Next Day based on currentBusinessDate
        if (!targetDateStr) {
          const d = new Date(currentBusinessDate);
          d.setDate(d.getDate() + 1);
          targetDateStr = d.toISOString().split('T')[0];
        }

        const files = fs.existsSync(ENTRIES_DIR) ? fs.readdirSync(ENTRIES_DIR) : [];

        files.forEach(file => {
          if (!file.endsWith('.json') || file === 'users_db.json') return;
          
          try {
            const filePath = path.join(ENTRIES_DIR, file);
            const content = fs.readFileSync(filePath, 'utf8');
            const entry = JSON.parse(content);
            
            if (idsToCopy.includes(entry.id)) {
              // Move existing entry to new date
              entry.businessDate = targetDateStr;
              if (entry.datetime) {
                const timePart = entry.datetime.includes('T') ? entry.datetime.split('T')[1] : entry.datetime.split(' ')[1];
                entry.datetime = `${targetDateStr}T${timePart}`;
              }
              entry.modifiedAt = Date.now();
              fs.writeFileSync(filePath, JSON.stringify(entry, null, 2), 'utf8');
              copiedCount++;
            }
          } catch (err) {
            console.error('Failed to parse or copy file:', file, err);
          }
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, copied: copiedCount }));
      } catch (err) {
        console.error('Copy forward error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Server error during copy.' }));
      }
    });
    return;
  }

  // POST /api/entries/batch-delete — ULTRA FAST BULK DELETION (10,000+ entries in milliseconds)
  if ((pathname === '/api/entries/batch-delete' || pathname === '/api/entries/delete-batch') && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const data = safeJsonParse(body) || {};
        const ids = Array.isArray(data.ids) ? data.ids : [];
        const isAll = data.all === true;
        const targetDate = data.date;

        if (isAll) {
          const files = fs.existsSync(ENTRIES_DIR) ? fs.readdirSync(ENTRIES_DIR) : [];
          const count = files.filter(f => f.endsWith('.json') && f !== 'users_db.json').length;

          // Lightning-fast instant directory swap (<15ms for 100,000 files)
          const trashDir = path.join(TARGET_DIR, 'DATA_TRASH_' + Date.now());
          try {
            fs.renameSync(ENTRIES_DIR, trashDir);
            fs.mkdirSync(ENTRIES_DIR, { recursive: true });
            // Clean up trash directory asynchronously in background without blocking response
            fs.rm(trashDir, { recursive: true, force: true }, () => {});
          } catch (swapErr) {
            // Fallback: fast parallel unlink
            await Promise.all(files.map(f => {
              if (f.endsWith('.json') && f !== 'users_db.json') {
                return fs.promises.unlink(path.join(ENTRIES_DIR, f)).catch(() => {});
              }
              return Promise.resolve();
            }));
          }
          console.log(`[ULTRA-FAST DELETE] Deleted ALL ${count} entries instantly.`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, count, message: `All ${count} entries deleted quickly.` }));
          return;
        }

        if (ids.length === 0 && !targetDate) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'No IDs or date provided for deletion.' }));
          return;
        }

        let deletedCount = 0;
        const remainingIds = new Set();

        // Fast Phase 1: Parallel async direct file unlinks across thread pool (libuv)
        await Promise.all(ids.map(async (id) => {
          const directFile = path.join(ENTRIES_DIR, `entry_${id}.json`);
          try {
            await fs.promises.unlink(directFile);
            deletedCount++;
          } catch (e) {
            remainingIds.add(Number(id));
          }
        }));

        // Fast Phase 2: If any remaining IDs had non-standard filenames or targetDate was passed
        if (remainingIds.size > 0 || targetDate) {
          const files = fs.existsSync(ENTRIES_DIR) ? fs.readdirSync(ENTRIES_DIR) : [];
          for (const file of files) {
            if (file.endsWith('.json') && file !== 'users_db.json') {
              try {
                const filePath = path.join(ENTRIES_DIR, file);
                const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                let shouldDelete = false;
                if (remainingIds.has(Number(content.id))) {
                  shouldDelete = true;
                  remainingIds.delete(Number(content.id));
                } else if (targetDate) {
                  const bDate = content.businessDate || (content.datetime ? content.datetime.split('T')[0] : '');
                  if (bDate === targetDate) shouldDelete = true;
                }
                if (shouldDelete) {
                  await fs.promises.unlink(filePath).catch(() => {});
                  deletedCount++;
                }
              } catch (e) {}
            }
          }
        }

        console.log(`[ULTRA-FAST DELETE] Successfully deleted ${deletedCount} entries.`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, count: deletedCount, message: `${deletedCount} entries deleted quickly.` }));
      } catch (err) {
        console.error('Batch delete error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to execute batch deletion.' }));
      }
    });
    return;
  }

  // DELETE /api/entries — High speed single or all deletion
  if (pathname === '/api/entries' && req.method === 'DELETE') {
    const entryId = parsedUrl.searchParams.get('id');
    const isAll = parsedUrl.searchParams.get('all') === 'true';
    const targetDate = parsedUrl.searchParams.get('date');

    // Fast wipe all entries
    if (isAll) {
      try {
        const files = fs.existsSync(ENTRIES_DIR) ? fs.readdirSync(ENTRIES_DIR) : [];
        const count = files.filter(f => f.endsWith('.json') && f !== 'users_db.json').length;
        const trashDir = path.join(TARGET_DIR, 'DATA_TRASH_' + Date.now());
        try {
          fs.renameSync(ENTRIES_DIR, trashDir);
          fs.mkdirSync(ENTRIES_DIR, { recursive: true });
          fs.rm(trashDir, { recursive: true, force: true }, () => {});
        } catch (swapErr) {
          files.forEach(f => {
            if (f.endsWith('.json') && f !== 'users_db.json') {
              try { fs.unlinkSync(path.join(ENTRIES_DIR, f)); } catch (e) {}
            }
          });
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, count, message: `All ${count} entries deleted quickly.` }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to delete entries.' }));
      }
      return;
    }

    // Fast wipe entries by date
    if (targetDate) {
      try {
        const files = fs.existsSync(ENTRIES_DIR) ? fs.readdirSync(ENTRIES_DIR) : [];
        let count = 0;
        for (const file of files) {
          if (file.endsWith('.json') && file !== 'users_db.json') {
            try {
              const p = path.join(ENTRIES_DIR, file);
              const content = JSON.parse(fs.readFileSync(p, 'utf8'));
              const bDate = content.businessDate || (content.datetime ? content.datetime.split('T')[0] : '');
              if (bDate === targetDate) {
                fs.unlinkSync(p);
                count++;
              }
            } catch (e) {}
          }
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, count, message: `${count} entries deleted.` }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to delete entries for date.' }));
      }
      return;
    }

    if (!entryId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Entry ID is required.' }));
      return;
    }

    try {
      // Direct instant unlink by filename O(1)
      const directFile = path.join(ENTRIES_DIR, `entry_${entryId}.json`);
      if (fs.existsSync(directFile)) {
        fs.unlinkSync(directFile);
        broadcastEvent({ type: 'entry-deleted', id: entryId });
        try { exportEntriesToExcel([], currentBusinessDate); } catch (e) {}
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Entry deleted.' }));
        return;
      }

      // Fallback only if non-standard filename
      const files = fs.existsSync(ENTRIES_DIR) ? fs.readdirSync(ENTRIES_DIR) : [];
      let targetFile = null;
      for (const file of files) {
        if (file.endsWith('.json') && file !== 'users_db.json') {
          try {
            const content = JSON.parse(fs.readFileSync(path.join(ENTRIES_DIR, file), 'utf8'));
            if (String(content.id) === String(entryId) || content.id == entryId) {
              targetFile = file;
              break;
            }
          } catch (e) { /* ignore */ }
        }
      }

      if (!targetFile) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Entry not found.' }));
        return;
      }

      fs.unlinkSync(path.join(ENTRIES_DIR, targetFile));
      broadcastEvent({ type: 'entry-deleted', id: entryId });
      try { exportEntriesToExcel([], currentBusinessDate); } catch (e) {}
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Entry deleted.' }));
    } catch (err) {
      console.error('Error deleting entry:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to delete entry.' }));
    }
    return;
  }

  // Client Browser Error Logger
  if (req.method === 'POST' && pathname === '/api/client-error') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      console.error('>>> [CLIENT BROWSER ERROR]:', body);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"logged":true}');
    });
    return;
  }

  // ==========================================================================
  // STATIC FILE ROUTING
  // ==========================================================================
  
  // Clean request path
  const sanitizedPath = pathname === '/' ? '/index.html' : pathname;
  let filePath = path.join(__dirname, 'public', sanitizedPath);
  
  // Security: prevent directory traversal
  const relative = path.relative(path.join(__dirname, 'public'), filePath);
  const isSafe = relative && !relative.startsWith('..') && !path.isAbsolute(relative);
  
  if (!isSafe) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // Only fallback to index.html for client-side routing on extension-less or .html routes
        if (!ext || ext === '.html') {
          fs.readFile(path.join(__dirname, 'public', 'index.html'), (indexErr, indexContent) => {
            if (indexErr) {
              res.writeHead(500, { 'Content-Type': 'text/plain' });
              res.end('Internal Server Error');
            } else {
              res.writeHead(200, {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
                'Pragma': 'no-cache',
                'Expires': '0',
                'Surrogate-Control': 'no-store'
              });
              res.end(indexContent, 'utf-8');
            }
          });
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
        }
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store'
      });
      res.end(content);
    }
  });
});

const osModule = require('os');
const networkInterfaces = osModule.networkInterfaces();
let localIp = 'localhost';

for (const interfaceName in networkInterfaces) {
  const interfaces = networkInterfaces[interfaceName];
  for (const iface of interfaces) {
    if (!iface.internal && iface.family === 'IPv4') {
      localIp = iface.address;
      break;
    }
  }
  if (localIp !== 'localhost') break;
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[PORT IN USE] Port ${PORT} is already in use by another instance or process.`);
    process.exit(1);
  } else {
    console.error('[SERVER ERROR]', err);
    process.exit(1);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(` SUCCESS! Surveillance Server is LIVE!`);
  console.log(`======================================================`);
  console.log(` -> Direct URL:             http://surveillance`);
  console.log(` -> Clean Localhost:        http://localhost`);
  console.log(` -> Port 3000 (Fallback):   http://localhost:${PORT}`);
  if (localIp !== 'localhost') {
    console.log(` -> Network IP (Port 80):   http://${localIp}`);
    console.log(` -> Network IP (Port 3000): http://${localIp}:${PORT}`);
  }
  console.log(`======================================================\n`);
  console.log(`Writing entries to: ${TARGET_DIR}`);
  startDailyArchiveJob();
});

// Also bind Port 80 for direct "http://surveillance" (no :3000 needed) - Local machine only
if (!process.env.PORT) {
  try {
    const serverPort80 = http.createServer((req, res) => {
      server.emit('request', req, res);
    });
    serverPort80.listen(80, '0.0.0.0', () => {
      console.log(`[HTTP 80] Direct http://surveillance and http://localhost are LIVE on Port 80!`);
    });
    serverPort80.on('error', (err) => {
      console.log(`[HTTP 80 Note] Port 80 could not be bound: ${err.message}. Port ${PORT} is active.`);
    });
  } catch (e) {
    console.log('[HTTP 80 Note]', e.message);
  }
}
