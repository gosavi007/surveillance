const CREDIT_TYPES = ['CASHIN', 'C/IN', 'ISSUE', 'KEYIN'];
const DEBIT_TYPES = ['CASHOUT', 'C/OUT', 'DEPOSIT', 'KEYOUT', 'PAID'];

// Universal Global Data References (Safe across all scopes and event handlers)
var allEntries = [];
window.allEntries = allEntries;
var globalBarredList = [];
window.globalBarredList = globalBarredList;
var currentBusinessDate = '';
var currentBusinessDateStr = '';
window.currentBusinessDate = '';
window.currentBusinessDateStr = '';

// Global Safe HTML Escape
function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
window.escapeHTML = escapeHTML;

// Global Date Formatting Helper (Safe across all scopes)
function formatDisplayDate(dateStr) {
  if (!dateStr) return '';
  const clean = String(dateStr).split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateStr;
}
window.formatDisplayDate = formatDisplayDate;

// Global Number Formatter Helper (Indian Format)
function formatIndianNumber(val) {
  const n = Math.abs(Math.round(Number(val) || 0));
  return n.toLocaleString('en-IN');
}
window.formatIndianNumber = formatIndianNumber;

// Global K Amount Formatter Helper
function formatKCurrency(val) {
  if (!val || isNaN(val)) return '0';
  const num = Math.abs(Number(val));
  if (num >= 1000) {
    const k = num / 1000;
    return (Number.isInteger(k) ? k : k.toFixed(1)) + 'K';
  }
  return num.toString();
}
window.formatKCurrency = formatKCurrency;

// Global Entry Type Helpers
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
window.isTotalInType = isTotalInType;

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
window.isTotalOutType = isTotalOutType;

// Universal Entry Sentence Helper (Always defined immediately)
function getEntrySentence(entry, isHtmlLink = false) {
  if (!entry) return '';
  const t = (entry.type || '').toUpperCase();
  const amt = (typeof formatKCurrency === 'function' ? formatKCurrency(Number(entry.amount) || 0) : (entry.amount || 0)).toString().toUpperCase();
  const rawGuest = (entry.guestname || 'UNKNOWN').toUpperCase();
  const guest = isHtmlLink
    ? `<span class="clickable-guest-name" data-guest="${escapeHTML(rawGuest)}" style="cursor:pointer; color:#38bdf8 !important; text-decoration:underline; font-weight:700;">${escapeHTML(rawGuest)}</span>`
    : escapeHTML(rawGuest);
  const card = entry.card ? escapeHTML(String(entry.card).toUpperCase()) : '';
  const info = entry.otherinfo ? ` (${escapeHTML(String(entry.otherinfo).toUpperCase())})` : '';

  const cleanType = t.replace(/[\s\-_]/g, '');
  if (cleanType === 'CASHIN' || cleanType === 'CIN' || t === 'C/IN')   return `${amt} CASHIN BY ${guest}${info}`;
  if (cleanType === 'CASHOUT' || cleanType === 'COUT' || t === 'C/OUT')  return `${amt} CASHOUT BY ${guest}${info}`;
  if (cleanType === 'ISSUE')    return `${amt} ISSUE TO ${guest}${card ? ` FROM ${card} CARD` : ''}${info}`;
  if (cleanType === 'DEPOSIT')  return `${amt} DEPOSIT BY ${guest}${card ? ` ON ${card} CARD` : ''}${info}`;
  if (cleanType === 'KEYIN' || t === 'KEY/IN')    return `${amt} KEYIN BY ${guest}${info}`;
  if (cleanType === 'KEYOUT' || cleanType === 'KYOUT' || t === 'KEY/OUT' || t === 'KY/OUT')   return `${amt} KEYOUT BY ${guest}${info}`;
  
  return `${amt} ${t} BY ${guest}${info}`;
}
window.getEntrySentence = getEntrySentence;

// Global AI Assistant Helpers (Always defined immediately)
window.aiShowDateAllEntries = function(dStr) {
  const aiDatePicker = document.getElementById('ai-date-picker');
  const aiSelectedDateBadge = document.getElementById('ai-selected-date-badge');
  const aiQueryInput = document.getElementById('ai-query-input');
  if (dStr && aiDatePicker) aiDatePicker.value = dStr;
  if (dStr && aiSelectedDateBadge && typeof formatDisplayDate === 'function') {
    aiSelectedDateBadge.textContent = formatDisplayDate(dStr);
  }
  if (aiQueryInput) aiQueryInput.value = '';
  if (typeof window.executeAiQuery === 'function') {
    window.executeAiQuery('ALL ENTRIES');
  }
};

window.aiSwitchDate = function(dStr, guestName) {
  const aiDatePicker = document.getElementById('ai-date-picker');
  const aiSelectedDateBadge = document.getElementById('ai-selected-date-badge');
  const aiQueryInput = document.getElementById('ai-query-input');
  if (dStr && aiDatePicker) aiDatePicker.value = dStr;
  if (dStr && aiSelectedDateBadge && typeof formatDisplayDate === 'function') {
    aiSelectedDateBadge.textContent = formatDisplayDate(dStr);
  }
  if (guestName && aiQueryInput) aiQueryInput.value = guestName;
  if (typeof window.executeAiQuery === 'function') {
    window.executeAiQuery(guestName || 'ALL ENTRIES');
  }
};

window.aiOpenGuestSummary = function(guestName) {
  if (!guestName) return;
  const aiDatePicker = document.getElementById('ai-date-picker');
  const activeDate = (aiDatePicker && aiDatePicker.value)
    ? aiDatePicker.value
    : (window.currentBusinessDateStr || window.currentBusinessDate || (typeof getBusinessDate === 'function' ? getBusinessDate() : ''));
  const candidateList = (typeof allEntries !== 'undefined' && Array.isArray(allEntries) && allEntries.length > 0)
    ? allEntries
    : (window.allEntries || []);
  const openFn = (typeof openGuestSummaryPopup === 'function')
    ? openGuestSummaryPopup
    : window.openGuestSummaryPopup;
  if (openFn) {
    openFn(guestName, candidateList, activeDate);
  }
};

window.aiQueryGuest = function(guestName) {
  window.aiOpenGuestSummary(guestName);
};

function parseEntryDateTime(datetimeStr) {
  if (!datetimeStr) return { date: '', time: '', dmy: '' };
  const str = String(datetimeStr).trim();
  let datePart = '';
  let timePart = '';
  if (str.includes('T')) {
    const parts = str.split('T');
    datePart = parts[0] || '';
    timePart = parts[1] || '';
  } else if (str.includes(' ')) {
    const parts = str.split(' ');
    datePart = parts[0] || '';
    timePart = parts[1] || '';
  } else {
    datePart = str.slice(0, 10);
    timePart = str.slice(11);
  }
  const cleanTime = timePart ? timePart.slice(0, 5) : '';
  let dmy = datePart;
  const dp = datePart.split('-');
  if (dp.length === 3) {
    dmy = `${dp[2]}-${dp[1]}-${dp[0]}`;
  }
  return { date: datePart, time: cleanTime, dmy, timeOnly: cleanTime };
}
window.parseEntryDateTime = parseEntryDateTime;

// Universal Date Display Helper (DD-MM-YYYY)
function formatDisplayDate(dateStr) {
  if (!dateStr) return '';
  const clean = String(dateStr).split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateStr;
}
window.formatDisplayDate = formatDisplayDate;

// Guest Name Matching & Priority System
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

  // Check shared full words
  const sharedFullWords = fullWords1.filter(w => fullWords2.includes(w));
  if (sharedFullWords.length >= 1) {
    if (words1.length === 1 && words2.length === 1) return true;
    if (words1.length === 1 || words2.length === 1) return true;

    const remainingWords1 = words1.filter(w => !sharedFullWords.includes(w));
    const remainingWords2 = words2.filter(w => !sharedFullWords.includes(w));
    if (remainingWords1.length === 0 || remainingWords2.length === 0) return true;

    const remainingInitials1 = remainingWords1.map(w => w[0]);
    const remainingInitials2 = remainingWords2.map(w => w[0]);
    const matchesInitials = remainingInitials1.some(i => remainingInitials2.includes(i));
    if (matchesInitials) return true;
  }

  // Pure initial cross-matching
  if (words1.length >= 2 && words2.length >= 2) {
    const initialsAll1 = words1.map(w => w[0]);
    const initialsAll2 = words2.map(w => w[0]);
    if (initialsAll1.join('') === initialsAll2.join('') && initialsAll1.length >= 2) return true;
  }

  return false;
}
window.isNameMatch = isNameMatch;

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
window.getCanonicalNamePriority = getCanonicalNamePriority;

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
window.getGuestCluster = getGuestCluster;

// Universal Guest Summary Popup (Always available immediately)
function openGuestSummaryPopup(guestName, candidateEntries, activeDateStr) {
  const modal = document.getElementById('guest-summary-modal');
  if (!modal) return;

  // Determine target full date string
  let resolvedDateStr = activeDateStr || window.currentBusinessDateStr || window.currentBusinessDate || (typeof getBusinessDate === 'function' ? getBusinessDate() : '');
  if (typeof resolvedDateStr === 'number' || (typeof resolvedDateStr === 'string' && /^\d{1,2}$/.test(resolvedDateStr.trim()))) {
    const dayNum = parseInt(resolvedDateStr, 10);
    const base = window.currentBusinessDateStr || window.currentBusinessDate || (typeof getBusinessDate === 'function' ? getBusinessDate() : '');
    const ym = base ? base.slice(0, 7) : '';
    resolvedDateStr = ym ? `${ym}-${String(dayNum).padStart(2, '0')}` : resolvedDateStr;
  }

  // Format display date: DD-MM-YYYY
  const displayDate = formatDisplayDate(resolvedDateStr);
  const dateEl = document.getElementById('guest-summary-modal-date');
  if (dateEl) dateEl.textContent = displayDate;

  // Full pool of candidate entries
  const allCandidateEntries = (Array.isArray(candidateEntries) && candidateEntries.length > 0)
    ? candidateEntries
    : ((typeof allEntries !== 'undefined' && Array.isArray(allEntries)) ? allEntries : (window.allEntries || []));

  // Cluster matching entries
  const cluster = getGuestCluster(guestName, allCandidateEntries);
  let canonicalName = cluster.canonicalName || (guestName || '').toUpperCase();
  let clusterEntries = cluster.entries || [];

  if (clusterEntries.length === 0) {
    clusterEntries = allCandidateEntries.filter(e => {
      const gn = (e.guestname || '').trim().toUpperCase();
      return gn === canonicalName || gn.includes(canonicalName) || canonicalName.includes(gn);
    });
  }

  // Filter to selected business date
  let dayEntries = clusterEntries;
  if (resolvedDateStr) {
    const filtered = clusterEntries.filter(e => {
      const d = getEntryDate(e) || (parseEntryDateTime(e.datetime).date);
      return d === resolvedDateStr;
    });
    dayEntries = filtered;
  }

  // Calculate In / Out / Result for selected date
  let totalIn = 0;
  let totalOut = 0;
  dayEntries.forEach(e => {
    const amt = Number(e.amount) || 0;
    const t = e.type || '';
    if (isTotalInType(t)) {
      totalIn += amt;
    } else if (isTotalOutType(t)) {
      totalOut += amt;
    }
  });

  const netResult = totalOut - totalIn;
  const isNegative = netResult < 0;
  const totalInStr = formatIndianNumber(totalIn);
  const totalOutStr = formatIndianNumber(totalOut);
  const resFormatted = formatIndianNumber(Math.abs(netResult));
  // USER RULE: IF NEGATIVE THAN RED, NO COLOUR FOR OTHER (#000000 on green card)
  const resColor = isNegative ? '#FF0000' : '#000000';

  // Render Excel Style Guest Summary Card
  const cardContainer = document.getElementById('guest-summary-card-container') || document.querySelector('.guest-summary-card-box');
  if (cardContainer) {
    cardContainer.innerHTML = `
      <div class="guest-summary-header-cyan" style="display: block !important; visibility: visible !important; font-family: Arial, 'Segoe UI', Calibri, sans-serif !important; font-weight: 800 !important; color: #000000 !important; text-shadow: none !important; filter: none !important;">
        GUEST SUMMARY
      </div>
      <div class="guest-summary-body-green" style="display: flex !important; visibility: visible !important; font-family: Arial, 'Segoe UI', Calibri, sans-serif !important; text-shadow: none !important; filter: none !important;">
        <div class="summary-row" style="display: flex !important; font-family: Arial, 'Segoe UI', Calibri, sans-serif !important; text-shadow: none !important;">
          <span class="summary-lbl" style="font-family: Arial, 'Segoe UI', Calibri, sans-serif !important; font-weight: 700 !important; color: #000000 !important; text-shadow: none !important; filter: none !important;">NAME :-</span>
          <span id="guest-summary-modal-name" class="summary-val" style="font-family: Arial, 'Segoe UI', Calibri, sans-serif !important; font-weight: 800 !important; color: #000000 !important; text-shadow: none !important; filter: none !important;">${escapeHTML(canonicalName || guestName || '—')}</span>
        </div>
        <div class="summary-row" style="display: flex !important; font-family: Arial, 'Segoe UI', Calibri, sans-serif !important; text-shadow: none !important;">
          <span class="summary-lbl" style="font-family: Arial, 'Segoe UI', Calibri, sans-serif !important; font-weight: 700 !important; color: #000000 !important; text-shadow: none !important; filter: none !important;">TOTAL IN :-</span>
          <span id="guest-summary-modal-in" class="summary-val" style="font-family: Arial, 'Segoe UI', Calibri, sans-serif !important; font-weight: 800 !important; color: #000000 !important; text-shadow: none !important; filter: none !important;">${totalInStr}</span>
        </div>
        <div class="summary-row" style="display: flex !important; font-family: Arial, 'Segoe UI', Calibri, sans-serif !important; text-shadow: none !important;">
          <span class="summary-lbl" style="font-family: Arial, 'Segoe UI', Calibri, sans-serif !important; font-weight: 700 !important; color: #000000 !important; text-shadow: none !important; filter: none !important;">TOTAL OUT :-</span>
          <span id="guest-summary-modal-out" class="summary-val" style="font-family: Arial, 'Segoe UI', Calibri, sans-serif !important; font-weight: 800 !important; color: #000000 !important; text-shadow: none !important; filter: none !important;">${totalOutStr}</span>
        </div>
        <div class="summary-row summary-row-result" style="display: flex !important; visibility: visible !important; min-height: 32px !important; border-bottom: 1.5px solid #000000 !important; font-family: Arial, 'Segoe UI', Calibri, sans-serif !important; text-shadow: none !important;">
          <span class="summary-lbl" style="font-family: Arial, 'Segoe UI', Calibri, sans-serif !important; font-weight: 800 !important; color: #000000 !important; text-shadow: none !important; filter: none !important;">RESULT :-</span>
          <span id="guest-summary-modal-result" class="summary-val summary-val-result" style="font-family: Arial, 'Segoe UI', Calibri, sans-serif !important; color: ${resColor} !important; font-weight: 800 !important; font-size: 1.05rem !important; text-shadow: none !important; filter: none !important;">${escapeHTML(resFormatted)}</span>
        </div>
      </div>
      <div class="guest-summary-footer-yellow" style="display: block !important; visibility: visible !important; height: 20px !important; min-height: 20px !important; background: #FFFF00 !important; border-top: 1.5px solid #000000 !important;"></div>
    `;
  }

  const nameEl = document.getElementById('guest-summary-modal-name');
  const inEl = document.getElementById('guest-summary-modal-in');
  const outEl = document.getElementById('guest-summary-modal-out');
  const resultEl = document.getElementById('guest-summary-modal-result');
  if (nameEl) nameEl.textContent = canonicalName || guestName || '—';
  if (inEl) inEl.textContent = totalInStr;
  if (outEl) outEl.textContent = totalOutStr;
  if (resultEl) {
    resultEl.textContent = resFormatted;
    resultEl.style.color = resColor;
    resultEl.style.setProperty('color', resColor, 'important');
  }

  const countEl = document.getElementById('guest-summary-modal-count');
  if (countEl) {
    countEl.textContent = `${dayEntries.length} ${dayEntries.length === 1 ? 'ENTRY' : 'ENTRIES'}`;
  }

  // Sort entries chronologically
  const sortedEntries = [...dayEntries].sort((a, b) => (a.datetime || '').localeCompare(b.datetime || ''));

  // Populate Entries List below
  const listEl = document.getElementById('guest-summary-modal-entries');
  if (listEl) {
    if (sortedEntries.length === 0) {
      listEl.innerHTML = `<div style="text-align:center; padding: 20px; color: #94a3b8; font-size: 0.9rem; font-weight: 700;">No entries found for ${escapeHTML(canonicalName)} on ${displayDate}</div>`;
    } else {
      listEl.innerHTML = sortedEntries.map(e => {
        const t = (e.type || '').toUpperCase();
        const isCredit = isTotalInType(t);
        const typeBorder = isCredit ? '#10b981' : '#ef4444';
        const dtObj = parseEntryDateTime(e.datetime);
        const time = dtObj.time || '—';
        const sentence = (typeof getEntrySentence === 'function') ? getEntrySentence(e, false) : (e.amount + ' ' + t + ' BY ' + (e.guestname || ''));

        return `
          <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-left: 3.5px solid ${typeBorder}; border-radius: 6px; padding: 7px 12px; display: flex; align-items: center; gap: 14px; font-family: 'JetBrains Mono', Consolas, monospace; font-size: 0.84rem;">
            <span style="color: #38bdf8; font-weight: 700; min-width: 48px; flex-shrink: 0; letter-spacing: 0.5px;">${time}</span>
            <span style="color: #f1f5f9; font-weight: 600; flex: 1; word-break: break-word;">${escapeHTML(sentence)}</span>
          </div>
        `;
      }).join('');
    }
  }

  modal.style.display = 'flex';
  if (typeof lucide !== 'undefined') lucide.createIcons();
}
window.openGuestSummaryPopup = openGuestSummaryPopup;

function closeGuestSummaryPopup() {
  const modal = document.getElementById('guest-summary-modal');
  if (modal) modal.style.display = 'none';
}
window.closeGuestSummaryPopup = closeGuestSummaryPopup;


function getEntryDate(entry) {
  if (!entry) return '';
  if (entry.businessDate) return String(entry.businessDate).trim();
  if (!entry.datetime) return '';
  return parseEntryDateTime(entry.datetime).date;
}
window.getEntryDate = getEntryDate;

// Universal Business Date Calculator Helper (Safe across all scopes)
function getBusinessDate(dateObj) {
  if (!dateObj && (window.currentBusinessDateStr || window.currentBusinessDate || currentBusinessDateStr || currentBusinessDate)) {
    return window.currentBusinessDateStr || window.currentBusinessDate || currentBusinessDateStr || currentBusinessDate;
  }
  if (dateObj) {
    if (typeof dateObj === 'string') {
      const parsed = parseEntryDateTime(dateObj);
      if (parsed && parsed.date) return parsed.date;
    }
    const d = new Date(dateObj);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }
  const d = new Date();
  if (d.getHours() < 6) {
    d.setDate(d.getDate() - 1);
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
window.getBusinessDate = getBusinessDate;

/**
 * CLIENT-SIDE APP LOGIC
 * Surveillance Entry Portal
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Time Synchronization
  let timeOffset = 0;
  function getServerTimeDate() {
    return new Date(Date.now() + timeOffset);
  }

  // DOM Elements - Navigation & Views
  const loginView = document.getElementById('login-view');
  const mainView = document.getElementById('main-view');
  const userBadgeId = document.getElementById('user-badge-id');
  const btnHome = document.getElementById('btn-home');
  const btnLogout = document.getElementById('btn-logout');
  const btnAdminUsers = document.getElementById('btn-admin-users');
  const btnMajor = document.getElementById('btn-major');
  const btnAllEntries = document.getElementById('btn-all-entries');
  
  // DOM Elements - Panels
  const entryFormEl = document.getElementById('entry-form');
  const entryFormSection = entryFormEl ? entryFormEl.closest('section') : null;
  const allEntriesDatePicker = document.getElementById('all-entries-datepicker');
  const allEntriesYear = document.getElementById('all-entries-year');
  const allEntriesSearch = document.getElementById('all-entries-search');
  const btnAllEntriesHome = document.getElementById('btn-all-entries-home');
  const dayNumbersContainer = document.getElementById('day-numbers-container');
  const dayNavPrev = document.getElementById('day-nav-prev');
  const dayNavNext = document.getElementById('day-nav-next');
  const gotoDayInput = document.getElementById('goto-day-input');
  const archiveStatus = document.getElementById('archive-status');
  const CURRENT_ENTRY_LIMIT = null; // Show all entries for today inside the scrollable box
  let archiveMode = false;
  let archiveEntries = [];
  const historyTableSection = document.getElementById('history-table-panel') || document.querySelector('.table-panel-card');
  const adminPanelCard = document.getElementById('admin-panel-card');
  const majorPanelCard = document.getElementById('major-panel-card');
  const allEntriesPanelCard = document.getElementById('all-entries-panel-card');
  
  // DOM Elements - Supervisor / Log Modal
  const btnSupervisorLog = document.getElementById('btn-supervisor-log');
  const btnOpenLogModal = document.getElementById('btn-open-log-modal');
  const supervisorHomePanel = document.getElementById('supervisor-home-panel');
  const barredGuestsPanel = document.getElementById('barred-guests-panel-card');
  const supervisorLogModal = document.getElementById('supervisor-log-modal');
  const supervisorLogModalBody = document.getElementById('supervisor-log-modal-body');
  const btnCloseLogModal = document.getElementById('btn-close-log-modal');
  const supervisorSendBox = document.getElementById('supervisor-send-box');
  const supervisorAllEntries = document.getElementById('supervisor-all-entries');

  function openLogModal() {
    if (supervisorLogModal) {
      resetFormInputs();
      supervisorLogModal.style.display = 'flex';
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
  }

  function closeLogModal() {
    if (supervisorLogModal) {
      supervisorLogModal.style.display = 'none';
    }
  }
  
  // DOM Elements - Login
  const loginForm = document.getElementById('login-form');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const loginErrorContainer = document.getElementById('login-error-container');
  const loginErrorText = document.getElementById('login-error-text');
  const loginSpinner = document.getElementById('login-spinner');
  const loginBtn = document.querySelector('.login-btn');

  // DOM Elements - Entry Form
  const entryForm = document.getElementById('entry-form');
  const inputDateTime = document.getElementById('datetime');
  const inputCD = document.getElementById('cd');
  const inputCashier = document.getElementById('cashier');
  const inputType = document.getElementById('type');
  const inputAmount = document.getElementById('amount');
  const inputGuestName = document.getElementById('guestname');
  const inputCard = document.getElementById('card');
  const inputOtherInfo = document.getElementById('otherinfo');
  const inputSurv = document.getElementById('surv');
  const btnSave = document.getElementById('btn-save');

  // Remove any legacy floating scroll buttons from the home screen
  const existingScrollBtns = document.getElementById('page-scroll-buttons');
  if (existingScrollBtns) existingScrollBtns.remove();
  const btnCancelEdit = document.getElementById('btn-cancel-edit');

  const saveBtnText = document.getElementById('save-btn-text');
  const cardList = document.getElementById('card-list');
  const otherInfoList = document.getElementById('otherinfo-list');

  // DOM Elements - Analytics Stats
  const statTotalLogs = document.getElementById('stat-total-logs');
  const statTotalIn = document.getElementById('stat-total-in');
  const statTotalOut = document.getElementById('stat-total-out');
  const statNetBalance = document.getElementById('stat-net-balance');

  // DOM Elements - New Lists & Exports
  const majorListContainer = document.getElementById('major-list-container');
  const allEntriesListContainer = document.getElementById('all-entries-list-container');
  const btnExportAll = document.getElementById('btn-export-all');
  const btnExportAdmin = document.getElementById('btn-export-admin');
  const majorSearch = document.getElementById('major-search');
  const adminSendList = document.getElementById('admin-send-list');
  const btnAdminSend = document.getElementById('btn-admin-send');

  // DOM Elements - Table & Search
  const logsTableBody = document.getElementById('logs-table-body');
  const recordCountBadge = document.getElementById('record-count');
  const tableSearchInput = document.getElementById('table-search');
  const btnRefresh = document.getElementById('btn-refresh');

  // Local state cache synced to universal window scope
  allEntries = window.allEntries || [];
  window.allEntries = allEntries;
  let currentUser = null;
  globalBarredList = window.globalBarredList || [];
  window.globalBarredList = globalBarredList;
  let summaryChart = null;

  // Initialize Lucide Icons
  lucide.createIcons();

  // Perform time sync immediately on load
  try {
    const startFetch = Date.now();
    const statRes = await fetch('/api/status');
    if (statRes.ok) {
      const data = await statRes.json();
      if (data.serverTime) {
        const rtt = Date.now() - startFetch;
        timeOffset = data.serverTime + (rtt / 2) - Date.now();
      }
    }
  } catch (e) {
    console.error('Failed to sync time on load', e);
  }

  // Helper: Format local date and time as YYYY-MM-DDTHH:mm
  function getLocalTimeISOString() {
    const now = getServerTimeDate();
    let year = now.getFullYear();
    let month = String(now.getMonth() + 1).padStart(2, '0');
    let day = String(now.getDate()).padStart(2, '0');
    
    if (currentBusinessDateStr) {
      const parts = currentBusinessDateStr.split('-');
      if (parts.length === 3) {
        year = parts[0];
        month = parts[1];
        day = parts[2];
      }
    }

    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  // ==========================================================================
  // IN-APP NOTIFICATION SYSTEM (NO BROWSER "localhost:3000 says" POPUPS)
  // ==========================================================================
  function showAppNotification(message, type = 'info', durationMs = 4000) {
    if (!message) return;
    let container = document.getElementById('app-notification-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'app-notification-container';
      container.className = 'app-notification-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const toastType = ['success', 'error', 'warning', 'info'].includes(type) ? type : 'info';
    toast.className = `app-toast toast-${toastType}`;

    let iconSvg = '';
    if (toastType === 'success') {
      iconSvg = '<svg class="app-toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6 9 17l-5-5"/></svg>';
    } else if (toastType === 'error') {
      iconSvg = '<svg class="app-toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
    } else if (toastType === 'warning') {
      iconSvg = '<svg class="app-toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
    } else {
      iconSvg = '<svg class="app-toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
    }

    toast.innerHTML = `
      ${iconSvg}
      <div class="app-toast-content">${escapeHTML(String(message))}</div>
      <button class="app-toast-close" title="Close">&times;</button>
    `;

    const closeBtn = toast.querySelector('.app-toast-close');
    const dismiss = () => {
      toast.classList.add('toast-hiding');
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 250);
    };

    if (closeBtn) closeBtn.addEventListener('click', dismiss);
    if (durationMs > 0) setTimeout(dismiss, durationMs);

    container.appendChild(toast);
  }
  window.showAppNotification = showAppNotification;

  // Intercept and replace all window.alert calls with in-app notifications
  window.alert = function(msg) {
    const text = String(msg || '');
    let type = 'info';
    const low = text.toLowerCase();
    if (low.includes('error') || low.includes('failed')) type = 'error';
    else if (low.includes('success') || low.includes('started') || low.includes('copied') || low.includes('saved') || low.includes('imported')) type = 'success';
    else if (low.includes('warning') || low.includes('please') || low.includes('require') || low.includes('choose')) type = 'warning';
    showAppNotification(text, type);
  };

  currentBusinessDateStr = currentBusinessDateStr || '';
  currentBusinessDate = currentBusinessDate || '';

  // In-app confirmation dialog (replaces browser confirm() "localhost:3000 says")
  function showAppConfirm(message) {
    return new Promise(resolve => {
      const modal = document.getElementById('app-confirm-modal');
      const msgEl = document.getElementById('app-confirm-message');
      const btnOk = document.getElementById('app-confirm-ok');
      const btnCancel = document.getElementById('app-confirm-cancel');
      if (!modal) {
        return resolve(true);
      }
      if (msgEl) msgEl.textContent = message || 'Are you sure?';
      modal.style.display = 'flex';
      if (typeof lucide !== 'undefined') lucide.createIcons();

      const cleanup = (val) => {
        modal.style.display = 'none';
        btnOk.onclick = null;
        btnCancel.onclick = null;
        resolve(val);
      };

      if (btnOk) btnOk.onclick = () => cleanup(true);
      if (btnCancel) btnCancel.onclick = () => cleanup(false);
    });
  }

  // Parse datetime string safely whether formatted with 'T' or space ' '
  function parseEntryDateTime(datetimeStr) {
    if (!datetimeStr) return { date: '', time: '', dmy: '' };
    const str = String(datetimeStr).trim();
    let datePart = '';
    let timePart = '';
    if (str.includes('T')) {
      const parts = str.split('T');
      datePart = parts[0] || '';
      timePart = parts[1] || '';
    } else if (str.includes(' ')) {
      const parts = str.split(' ');
      datePart = parts[0] || '';
      timePart = parts[1] || '';
    } else {
      datePart = str.slice(0, 10);
      timePart = str.slice(11);
    }
    const cleanTime = timePart ? timePart.slice(0, 5) : '';
    let dmy = datePart;
    const dp = datePart.split('-');
    if (dp.length === 3) {
      dmy = `${dp[2]}-${dp[1]}-${dp[0]}`;
    }
    return { date: datePart, time: cleanTime, dmy, timeOnly: cleanTime };
  }

  // Extract pure YYYY-MM-DD from entry
  function getEntryDate(entry) {
    if (!entry) return '';
    if (entry.businessDate) return String(entry.businessDate).trim();
    if (!entry.datetime) return '';
    return parseEntryDateTime(entry.datetime).date;
  }

  // Format number in Indian numbering format (e.g. 41,00,000) without currency symbol
  function formatIndianNumber(val) {
    const n = Math.abs(Math.round(Number(val) || 0));
    return n.toLocaleString('en-IN');
  }

  // Helper: Get the business date string (YYYY-MM-DD) for a given datetime.
  function getBusinessDate(dateObj) {
    if (!dateObj && (currentBusinessDateStr || currentBusinessDate)) {
      return currentBusinessDateStr || currentBusinessDate;
    }
    
    if (dateObj) {
      if (typeof dateObj === 'string') {
        const parsed = parseEntryDateTime(dateObj);
        if (parsed.date) return parsed.date;
      }
      const d = new Date(dateObj);
      if (isNaN(d.getTime())) return '';
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    const d = getServerTimeDate();
    if (d.getHours() < 6) {
      d.setDate(d.getDate() - 1);
    }
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Helper: Check if an entry belongs to today's active business session.
  // STRICT RULE: Only unarchived entries matching current gaming date belong to today.
  function isEntryForToday(e) {
    if (!e) return false;
    if (e.archived === true || e.archived === 'true') return false;
    const todayBus = currentBusinessDateStr || currentBusinessDate || getBusinessDate();
    if (!todayBus) return true;
    const entryDate = getEntryDate(e);
    return entryDate === todayBus;
  }

  // Helper: Format amount as Indian Rupee (INR) without decimal zeroes
  function formatCurrency(value) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  }

  let allEntriesArchiveData = [];
  let archiveMetadata = {};

  async function fetchArchiveMetadata() {
    try {
      const resp = await fetch('/api/archives');
      if (resp.ok) {
        const data = await resp.json();
        archiveMetadata = data.archives || {};
        populateArchiveYears();
      }
    } catch (err) {
      console.error('Failed to fetch archive metadata:', err);
    }
  }

  function populateArchiveYears() {
    const el = document.getElementById('all-entries-year');
    if (!el) return;
    const colors = [
      '#e53935', '#d81b60', '#8e24aa', '#5e35b1', '#3949ab', '#1e88e5',
      '#039be5', '#00acc1', '#00897b', '#43a047', '#7cb342', '#f4511e'
    ];
    let html = '<option value="current">CURRENT YEAR</option>';
    for (let y = 2026; y <= 3000; y++) {
      const color = colors[(y - 2026) % colors.length];
      html += `<option value="${y}" style="background: ${color}; color: white;">${y}</option>`;
    }
    el.innerHTML = html;
  }

  let activeAllEntriesDay = Number(getBusinessDate().split('-')[2]);

  function syncDatePickerWithDay() {
    if (!allEntriesDatePicker) return;
    let currentVal = allEntriesDatePicker.value;
    if (!currentVal) {
      currentVal = getBusinessDate();
    }
    const parts = currentVal.split('-');
    if (parts.length === 3) {
      parts[2] = String(activeAllEntriesDay).padStart(2, '0');
      allEntriesDatePicker.value = parts.join('-');
    }
  }

  function renderDayPagination() {
    if (!dayNumbersContainer) return;
    let html = '';
    for (let i = 1; i <= 31; i++) {
      html += `<button class="day-nav-btn ${activeAllEntriesDay === i ? 'active' : ''}" data-day="${i}">${i}</button>`;
    }
    dayNumbersContainer.innerHTML = html;

    if (gotoDayInput && activeAllEntriesDay) {
      gotoDayInput.value = activeAllEntriesDay;
    }

    // Attach listeners
    dayNumbersContainer.querySelectorAll('.day-nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const d = parseInt(btn.getAttribute('data-day'));
        activeAllEntriesDay = d;
        if(gotoDayInput) gotoDayInput.value = d;
        syncDatePickerWithDay();
        renderDayPagination();
        updateAllEntriesView();
      });
    });

    // Auto-scroll active day into view
    setTimeout(() => {
      const activeBtn = dayNumbersContainer.querySelector('.day-nav-btn.active');
      if (activeBtn && activeBtn.scrollIntoView) {
        activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }, 10);
  }

  // Next/Prev logic (< PREV and NEXT >)
  if(dayNavPrev) {
    dayNavPrev.addEventListener('click', () => {
      if(activeAllEntriesDay > 1) {
        activeAllEntriesDay--;
      } else {
        activeAllEntriesDay = 31; // wrap around
      }
      if(gotoDayInput) gotoDayInput.value = activeAllEntriesDay;
      syncDatePickerWithDay();
      renderDayPagination();
      updateAllEntriesView();
    });
  }
  if(dayNavNext) {
    dayNavNext.addEventListener('click', () => {
      if(activeAllEntriesDay === null) activeAllEntriesDay = 1;
      else if(activeAllEntriesDay < 31) activeAllEntriesDay++;
      else activeAllEntriesDay = 1; // wrap around
      if(gotoDayInput) gotoDayInput.value = activeAllEntriesDay;
      syncDatePickerWithDay();
      renderDayPagination();
      updateAllEntriesView();
    });
  }
  if(gotoDayInput) {
    const handleGoto = () => {
      let val = parseInt(gotoDayInput.value, 10);
      if(!isNaN(val)) {
        if (val < 1) val = 1;
        if (val > 31) val = 31;
        activeAllEntriesDay = val;
        gotoDayInput.value = val;
        syncDatePickerWithDay();
        renderDayPagination();
        updateAllEntriesView();
      }
    };
    gotoDayInput.addEventListener('change', handleGoto);
    gotoDayInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleGoto();
        gotoDayInput.blur();
      }
    });
  }

  // Initial render
  renderDayPagination();
  // Modal DOM elements
  const editModal = document.getElementById('edit-modal');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const btnCancelEditModal = document.getElementById('btn-cancel-edit-modal');
  const editEntryForm = document.getElementById('edit-entry-form');

  const editInputDateTime = document.getElementById('edit-datetime');
  const editInputCD = document.getElementById('edit-cd');
  const editInputType = document.getElementById('edit-type');
  const editInputAmount = document.getElementById('edit-amount');
  const editInputCashier = document.getElementById('edit-cashier');
  const editInputGuestName = document.getElementById('edit-guestname');
  const editInputCard = document.getElementById('edit-card');
  const editInputOtherInfo = document.getElementById('edit-otherinfo');
  const editInputSurv = document.getElementById('edit-surv');

  let currentEditingEntry = null;

  // Edit Entry Helper
  function editEntry(entry) {
    if (!entry) return;
    currentEditingEntry = entry;
    
    // Normalize datetime for datetime-local input (YYYY-MM-DDTHH:mm)
    let dt = entry.datetime ? String(entry.datetime).replace(' ', 'T') : '';
    if (/^\d{2}-\d{2}-\d{4}/.test(dt)) {
      const parts = dt.split('T');
      const dParts = parts[0].split('-');
      dt = `${dParts[2]}-${dParts[1]}-${dParts[0]}T${parts[1] || '00:00'}`;
    }
    if (dt.length > 16) dt = dt.slice(0, 16);

    // Populate modal form
    editInputDateTime.value  = dt || getLocalTimeISOString();
    editInputCD.value        = entry.cd        || 'CD-01';
    editInputType.value      = entry.type      || '';
    editInputAmount.value    = entry.amount !== undefined ? entry.amount : '';
    editInputCashier.value   = entry.cashier   || '-';
    editInputGuestName.value = entry.guestname || '';
    editInputCard.value      = entry.card      || '';
    editInputOtherInfo.value = entry.otherinfo || '';
    editInputSurv.value      = entry.surv      || (currentUser ? (currentUser.name || currentUser.id) : 'ADMIN');
    
    editingEntryId = entry.id;
    
    // Show Modal
    editModal.style.display = 'flex';
  }

  // Close Modal Handlers
  function closeEditModal() {
    editModal.style.display = 'none';
    editingEntryId = null;
    currentEditingEntry = null;
    editEntryForm.reset();
  }
  if (btnCloseModal) btnCloseModal.addEventListener('click', closeEditModal);
  if (btnCancelEditModal) btnCancelEditModal.addEventListener('click', closeEditModal);
  if (editModal) editModal.addEventListener('click', (e) => {
    if (e.target === editModal) closeEditModal();
  });

  // Handle Edit Form Submission
  if (editEntryForm) editEntryForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (editingEntryId === null || editingEntryId === undefined) return;

    let typeVal = editInputType.value.trim().toUpperCase();
    if (typeVal === 'C/IN') typeVal = 'CASHIN';
    if (typeVal === 'C/OUT') typeVal = 'CASHOUT';

    const bDate = currentEditingEntry?.businessDate || currentBusinessDateStr || currentBusinessDate || getBusinessDate();

    const updatedData = {
      id: editingEntryId,
      datetime: editInputDateTime.value,
      cd: (editInputCD && editInputCD.value) ? editInputCD.value.toUpperCase() : (currentEditingEntry?.cd || 'CD-01'),
      type: typeVal,
      amount: parseFloat(editInputAmount.value) || 0,
      cashier: (editInputCashier && editInputCashier.value) ? editInputCashier.value.trim().toUpperCase() : (currentEditingEntry?.cashier || '-'),
      guestname: editInputGuestName.value.trim().toUpperCase(),
      card: editInputCard.value.trim().toUpperCase(),
      otherinfo: editInputOtherInfo.value.trim().toUpperCase(),
      surv: editInputSurv.value.toUpperCase(),
      businessDate: bDate,
      archived: currentEditingEntry?.archived !== undefined ? currentEditingEntry.archived : false
    };

    try {
      const resp = await fetch(`/api/entries?id=${encodeURIComponent(editingEntryId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(data.error || 'Update failed.');
      }
      
      // Update entry in-memory immediately for instant 0ms UI update
      const targetIdStr = String(editingEntryId);
      const localIdx = allEntries.findIndex(item => String(item.id) === targetIdStr || item.id == editingEntryId);
      if (localIdx !== -1) {
        allEntries[localIdx] = { ...allEntries[localIdx], ...updatedData };
      }
      window.allEntries = allEntries;

      closeEditModal();
      showAppNotification('Entry updated successfully.', 'success');

      // Re-render views
      renderEntries(allEntries, { limit: CURRENT_ENTRY_LIMIT, isArchive: false });
      calculateStatistics(allEntries.filter(isEntryForToday));
      populateDataLists(allEntries);
      if (typeof updateAllEntriesView === 'function') updateAllEntriesView();
      if (typeof renderMajor === 'function') renderMajor();

      // Background sync with server
      fetchEntries().catch(console.error);
    } catch (err) {
      showAppNotification(`Error updating entry: ${err.message}`, 'error');
    }
  });

  // ALL ENTRIES panel view update
  async function updateAllEntriesView() {
    if (!allEntriesDatePicker || !allEntriesSearch) return;

    const selectedDate = allEntriesDatePicker.value;
    const query = allEntriesSearch.value.toLowerCase().trim();

    let sourceEntries = allEntries;

    // Filter by selected date
    if (selectedDate) {
      sourceEntries = sourceEntries.filter(entry => {
        if (!entry.datetime) return false;
        return getBusinessDate(entry.datetime) === selectedDate;
      });
    }

    // Apply Search filter
    if (query) {
      sourceEntries = sourceEntries.filter(entry => {
        const nameMatch = entry.guestname && entry.guestname.toLowerCase().includes(query);
        const cashierMatch = entry.cashier && entry.cashier.toLowerCase().includes(query);
        const typeMatch = entry.type && entry.type.toLowerCase().includes(query);
        const survMatch = entry.surv && entry.surv.toLowerCase().includes(query);
        const cdMatch = entry.cd && entry.cd.toLowerCase().includes(query);
        const cardMatch = entry.card && entry.card.toLowerCase().includes(query);
        const otherInfoMatch = entry.otherinfo && entry.otherinfo.toLowerCase().includes(query);
        const amountMatch = entry.amount && String(entry.amount).includes(query);

        return nameMatch || cashierMatch || typeMatch || survMatch || cdMatch || cardMatch || otherInfoMatch || amountMatch;
      });
    }

    // Render sentences, table, and excel grid views
    const allEntriesListContainer = document.getElementById('all-entries-list-container');
    const allEntriesTableBody = document.getElementById('all-entries-table-body');
    const allEntriesExcelView = document.getElementById('all-entries-excel-view');
    
    if (sourceEntries.length === 0) {
      if (allEntriesListContainer) {
        allEntriesListContainer.innerHTML = `
          <div class="empty-state">
            <p>No records found matching the filters.</p>
          </div>
        `;
      }
      if (allEntriesTableBody) {
        allEntriesTableBody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:20px;">No records found.</td></tr>`;
      }
      if (allEntriesExcelView) {
        const activeDay = activeAllEntriesDay || (selectedDate ? parseInt(selectedDate.split('-')[2], 10) : 'ALL');
        renderStyledExcelGrid([], allEntriesExcelView, activeDay === 'ALL' ? 'ALL' : 'Day ' + activeDay);
      }
      lucide.createIcons();
      return;
    }

    // 1. Render Sentences View
    if (allEntriesListContainer) {
      allEntriesListContainer.innerHTML = `<ul class="sentence-list">` + 
        sourceEntries.map(e => `<li class="sentence-item ${(e.type||'').toLowerCase().replace('/', '-')}">${getEntrySentence(e, true)}</li>`).join('') +
        `</ul>`;
    }

    // 2. Render Table View
    if (allEntriesTableBody) {
      let tableHtml = '';
      sourceEntries.forEach(entry => {
        const type = (entry.type || '').toUpperCase();
        let typeBadge = { cls: 'badge-synced', label: type };
        if (['CASHIN', 'C/IN', 'ISSUE', 'KEYIN'].includes(type)) typeBadge = { cls: 'badge-credit', label: type };
        if (['CASHOUT', 'C/OUT', 'DEPOSIT', 'KEYOUT'].includes(type)) typeBadge = { cls: 'badge-debit', label: type };
        
        const amtClass = ['CASHIN', 'C/IN', 'ISSUE', 'KEYIN'].includes(type) ? 'text-green' : 'text-red';
        const amtFormatted = formatCurrency(Number(entry.amount) || 0);
        const displayDate = entry.datetime ? entry.datetime.replace('T', ' ') : 'N/A';
        const cdText = escapeHTML(entry.cd || 'N/A');

        let actionButtons = `
          <div style="display:flex; gap:4px; align-items:center;">
            <button class="btn-edit-entry" data-id="${entry.id}" title="Edit" style="background:rgba(59,130,246,0.18);color:#60a5fa;border:1px solid rgba(59,130,246,0.4);border-radius:5px;width:24px;height:24px;padding:0;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:all 0.15s ease;">
              <i data-lucide="edit-2" style="width:12px;height:12px;pointer-events:none;"></i>
            </button>
            <button class="btn-delete-entry" data-id="${entry.id}" title="Delete" style="background:rgba(239,68,68,0.18);color:#f87171;border:1px solid rgba(239,68,68,0.4);border-radius:5px;width:24px;height:24px;padding:0;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:all 0.15s ease;">
              <i data-lucide="trash-2" style="width:12px;height:12px;pointer-events:none;"></i>
            </button>
          </div>
        `;

        tableHtml += `
          <tr>
            <td class="checkbox-col">
              <input type="checkbox" class="entry-checkbox" data-id="${entry.id}">
            </td>
            <td><strong>${displayDate}</strong></td>
            <td><span style="color: #60a5fa; font-weight: bold;">${escapeHTML(entry.surv || '-')}</span></td>
            <td><span class="badge ${typeBadge.cls}">${typeBadge.label}</span></td>
            <td class="table-amount ${amtClass}">${amtFormatted}</td>
            <td><span class="clickable-guest-name" data-guest="${escapeHTML(entry.guestname || '')}" style="cursor:pointer; color:#60a5fa; text-decoration:underline;">${escapeHTML(entry.guestname || '—')}</span></td>
            <td>${(() => {
              const showCard = ['ISSUE','DEPOSIT'].includes(type);
              return showCard
                ? `<code>${entry.card ? escapeHTML(entry.card) : '—'}</code>`
                : `<span style="color:var(--text-muted)">—</span>`;
            })()}</td>
            <td title="${escapeHTML(entry.otherinfo || '')}">
              <div style="max-width:200px;overflow:hidden;text-overflow:ellipsis;">
                ${entry.otherinfo ? escapeHTML(entry.otherinfo) : '<span style="color:var(--text-muted)">—</span>'}
              </div>
            </td>
            <td>${actionButtons}</td>
          </tr>
        `;
      });
      allEntriesTableBody.innerHTML = tableHtml;
    }

    // 3. Render Excel Spreadsheet View
    if (allEntriesExcelView) {
      const activeDay = activeAllEntriesDay || (selectedDate ? parseInt(selectedDate.split('-')[2], 10) : 'ALL');
      renderStyledExcelGrid(sourceEntries, allEntriesExcelView, activeDay === 'ALL' ? 'ALL' : 'Day ' + activeDay);
    }

    lucide.createIcons();

    // Attach click listeners to all guest names in All Entries (Table, Sentence, and Excel)
    const allEntriesPanel = document.getElementById('all-entries-panel-card');
    if (allEntriesPanel) {
      allEntriesPanel.querySelectorAll('.clickable-guest-name').forEach(el => {
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          const gName = el.getAttribute('data-guest');
          if (!gName) return;
          const targetDay = (allEntriesDatePicker && allEntriesDatePicker.value) ? allEntriesDatePicker.value : (selectedDate || getBusinessDate());
          openGuestSummaryPopup(gName, sourceEntries, targetDay);
        });
      });
    }

    // Attach listeners for Edit & Delete across all containers
    document.querySelectorAll('#all-entries-panel-card .btn-edit-entry').forEach(btn => {
      btn.addEventListener('click', () => {
        const idAttr = btn.getAttribute('data-id');
        const entry = allEntries.find(e => String(e.id) === String(idAttr) || e.id == idAttr);
        if (entry) editEntry(entry);
      });
    });
    document.querySelectorAll('#all-entries-panel-card .btn-delete-entry').forEach(btn => {
      btn.addEventListener('click', async () => {
        const idAttr = btn.getAttribute('data-id');
        if (!(await showAppConfirm('Are you sure you want to delete this entry?'))) return;
        try {
          // Instant in-memory removal
          allEntries = allEntries.filter(e => String(e.id) !== String(idAttr) && e.id != idAttr);
          window.allEntries = allEntries;
          if (typeof updateAllEntriesView === 'function') updateAllEntriesView();
          if (typeof renderEntries === 'function') renderEntries(allEntries, { limit: CURRENT_ENTRY_LIMIT, isArchive: false });
          showAppNotification('Entry deleted successfully.', 'success');

          // Fast direct delete call
          fetch(`/api/entries?id=${encodeURIComponent(idAttr)}`, { method: 'DELETE' }).catch(e => console.error(e));
        } catch (err) {
          showAppNotification(`Error deleting entry: ${err.message}`, 'error');
        }
      });
    });
  }

  // Switch App Views
  function showView(viewId) {
    if (viewId === 'main') {
      loginView.classList.remove('active');
      loginView.style.display = 'none';
      loginView.style.opacity = '0';
      mainView.style.display = 'flex';
      mainView.style.opacity = '1';
      mainView.style.transform = 'translateY(0)';
      mainView.classList.add('active');
    } else if (viewId === 'login') {
      mainView.classList.remove('active');
      mainView.style.display = 'none';
      mainView.style.opacity = '0';
      loginView.style.display = 'flex';
      loginView.style.opacity = '1';
      loginView.style.transform = 'translateY(0)';
      loginView.classList.add('active');
    }
  }

  // Dynamic Wallpaper Logic
  const wallpapers = [
    'assets/surveillance_bg.png',
    'assets/surveillance_bg_green.png',
    'assets/surveillance_bg_red.png',
    'assets/surveillance_bg_orange.png'
  ];

  function applyUserWallpaper(username) {
    document.body.style.background = "linear-gradient(rgba(6, 11, 25, 0.35), rgba(6, 11, 25, 0.48)), url('assets/surveillance_bg.png') center/cover fixed no-repeat";
  }

  // Verify and load active session
  function checkAuthSession() {
    const sessionData = localStorage.getItem('surv_session');
    if (sessionData) {
      let parsedSession = null;
      try {
        parsedSession = JSON.parse(sessionData);
      } catch (err) {
        console.error('Failed to parse session data:', err);
        localStorage.removeItem('surv_session');
        showView('login');
        return;
      }
      
      if (parsedSession) {
        currentUser = parsedSession;
        userBadgeId.textContent = currentUser.name || currentUser.id;
        inputSurv.value = currentUser.name || currentUser.id;
        
        applyUserWallpaper(currentUser.name);
        
        showView('main');
        
        // Restore last active panel (AFTER REFRESH SAME PAGE)
        const lastPanel = sessionStorage.getItem('current_panel') || 'home';
        if (lastPanel === 'admin') showAdminPanel();
        else if (lastPanel === 'major') showMajorPanel();
        else if (lastPanel === 'all_entries') showAllEntriesPanel();
        else if (lastPanel === 'barred') showBarredPanel();
        else if (lastPanel === 'staff') showStaffPanel();
        else showHomePanel();
        
        resetFormInputs();
        toggleAdminPanel();
        updateSurvFieldState();
        fetchArchiveMetadata();
        fetchEntries();
        fetchGlobalBarredList();
        checkAndPromptFirstTimeSetup(currentUser);
      }
    } else {
      showView('login');
    }
  }

  // Toggle SURV input editability based on admin status
  function updateSurvFieldState() {
    const wrapper = inputSurv.parentElement;
    if (currentUser && currentUser.id === 'admin') {
      inputSurv.removeAttribute('readonly');
      wrapper.classList.remove('read-only');
      inputSurv.placeholder = 'Enter SURV ID';
    } else {
      inputSurv.setAttribute('readonly', 'readonly');
      wrapper.classList.add('read-only');
      inputSurv.placeholder = 'SURV ID';
    }
  }

  // Reset entry form fields
  function resetFormInputs() {
    inputDateTime.value = getLocalTimeISOString();
    if (inputCD) inputCD.value = 'CD-01';
    inputType.value     = '';
    inputAmount.value   = '';
    if (inputCashier) inputCashier.value = '-';
    inputGuestName.value= '';
    inputCard.value     = '';
    inputOtherInfo.value= '';
    if (currentUser) inputSurv.value = currentUser.name || currentUser.id;

    // Dispatch input events to sync quick entry widgets
    if (inputCD) inputCD.dispatchEvent(new Event('input', { bubbles: true }));
    if (inputCashier) inputCashier.dispatchEvent(new Event('input', { bubbles: true }));

    updateSurvFieldState();
    // Exit edit mode
    editingEntryId = null;
    if (saveBtnText)    saveBtnText.textContent    = 'SAVE';
    if (btnCancelEdit)  btnCancelEdit.style.display = 'none';
  }

  // Cancel edit mode
  if (btnCancelEdit) {
 if (btnCancelEdit) btnCancelEdit.addEventListener('click', () => { resetFormInputs(); });
  }

  // ==========================================================================
  // AUTHENTICATION LOGIC
  // ==========================================================================
 if (loginForm) loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginErrorContainer.style.display = 'none';

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) return;

    // Show loading state
    loginBtn.classList.add('loading');

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed.');
      }

      // Save user to session
      currentUser = data.user;
      localStorage.setItem('surv_session', JSON.stringify(currentUser));
      
      // Update badge and field
      userBadgeId.textContent = currentUser.name || currentUser.id;
      inputSurv.value = currentUser.name || currentUser.id;
      
      applyUserWallpaper(currentUser.name);
      
      // Navigate to dashboard - AFTER LOGIN SHOW HOME PAGE
      sessionStorage.setItem('current_panel', 'home');
      showView('main');
      showHomePanel();
      resetFormInputs();
      toggleAdminPanel();
      updateSurvFieldState();
      fetchArchiveMetadata();
      fetchEntries();
      fetchGlobalBarredList();
      checkAndPromptFirstTimeSetup(currentUser);

      // Reset login form fields
      usernameInput.value = '';
      passwordInput.value = '';
    } catch (err) {
      loginErrorText.textContent = err.message || 'Authorization failed. Check details.';
      loginErrorContainer.style.display = 'flex';
    } finally {
      loginBtn.classList.remove('loading');
    }
  });

  // Logout action
  if (btnLogout) btnLogout.addEventListener('click', () => {
    localStorage.removeItem('surv_session');
    sessionStorage.removeItem('current_panel');
    currentUser = null;
    allEntries = [];
    applyUserWallpaper(null);
    updateSurvFieldState();
    hideAllPanels();
    if (btnAdminUsers) btnAdminUsers.style.display = 'none';
    if (btnSupervisorLog) btnSupervisorLog.style.display = 'none';

    showView('login');
  });

  // ==========================================================================
  // DATA AND API INTEGRATION
  // ==========================================================================

  // Fetch entries from Express backend
  async function fetchEntries() {
    try {
      const response = await fetch('/api/entries');
      if (!response.ok) throw new Error('Failed to retrieve entries.');
      const data = await response.json();
      allEntries = data.entries || [];
      window.allEntries = allEntries;
      if (data.currentBusinessDate) {
        currentBusinessDateStr = data.currentBusinessDate;
        currentBusinessDate = data.currentBusinessDate;
        window.currentBusinessDateStr = data.currentBusinessDate;
        window.currentBusinessDate = data.currentBusinessDate;
        updateGamingDateDisplay();
        // Refresh the hidden datetime input so future entries use the correct business date
        if (inputDateTime) inputDateTime.value = getLocalTimeISOString();
      }

      const currentDayEntries = allEntries.filter(isEntryForToday);
      renderEntries(allEntries, { limit: CURRENT_ENTRY_LIMIT, isArchive: false });
      calculateStatistics(currentDayEntries);
      populateDataLists(allEntries);
      if(allEntriesPanelCard && allEntriesPanelCard.style.display !== 'none') {
        const curDate = currentBusinessDateStr || getBusinessDate();
        activeAllEntriesDay = Number(curDate.split('-')[2]);
        if (gotoDayInput) gotoDayInput.value = activeAllEntriesDay;
        if (allEntriesDatePicker) allEntriesDatePicker.value = curDate;
        renderDayPagination();
        updateAllEntriesView();
      }
      if(supervisorHomePanel && supervisorHomePanel.style.display !== 'none') {
        renderSupervisorHome();
      }
      if(majorPanelCard && majorPanelCard.style.display !== 'none') {
        renderMajor();
      }
      if(adminPanelCard && adminPanelCard.style.display !== 'none') {
        renderAdminSendList();
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
      logsTableBody.innerHTML = `
        <tr>
          <td colspan="11" class="no-records-row">
            <div class="empty-state text-red">
              <i data-lucide="wifi-off"></i>
              <p>Unable to connect to server. Check server console.</p>
            </div>
          </td>
        </tr>
      `;
      lucide.createIcons();
    }
  }
  window.fetchEntries = fetchEntries;

  // Calculate stats based on fetched entries
  function calculateStatistics(entries) {
    const totalLogs = entries.length;
    let totalIn = 0;
    let totalOut = 0;

    entries.forEach(entry => {
      const t = (entry.type || '').toUpperCase();
      if (['CASHIN', 'C/IN', 'ISSUE', 'KEYIN'].includes(t)) {
        totalIn += Number(entry.amount) || 0;
      } else if (['CASHOUT', 'C/OUT', 'DEPOSIT', 'KEYOUT'].includes(t)) {
        totalOut += Number(entry.amount) || 0;
      }
    });

    const netBalance = totalIn - totalOut;

    if (statTotalLogs) statTotalLogs.textContent = totalLogs;
    if (statTotalIn) statTotalIn.textContent = formatCurrency(totalIn);
    if (statTotalOut) statTotalOut.textContent = formatCurrency(totalOut);

    // Net Flow Styling
    if (statNetBalance) {
      statNetBalance.textContent = formatCurrency(netBalance);
      if (netBalance > 0) {
        statNetBalance.className = 'stat-val text-green';
      } else if (netBalance < 0) {
        statNetBalance.className = 'stat-val text-red';
      } else {
        statNetBalance.className = 'stat-val';
      }
    }
  }

  // ==========================================================================
  // VIEW & PANEL SWITCHING
  // ==========================================================================
  
  // Hide all main content panels
  function hideAllPanels() {
    if (entryFormSection) {
      entryFormSection.style.setProperty('display', 'none', 'important');
      entryFormSection.classList.add('hidden-panel');
    }
    const logForm = document.getElementById('log-form-panel');
    if (logForm) {
      logForm.style.setProperty('display', 'none', 'important');
      logForm.classList.add('hidden-panel');
    }
    if (historyTableSection) {
      historyTableSection.style.setProperty('display', 'none', 'important');
      historyTableSection.classList.add('hidden-panel');
    }
    if (adminPanelCard) {
      adminPanelCard.style.setProperty('display', 'none', 'important');
      adminPanelCard.classList.add('hidden-panel');
    }
    if (majorPanelCard) {
      majorPanelCard.style.setProperty('display', 'none', 'important');
      majorPanelCard.classList.add('hidden-panel');
    }
    if (allEntriesPanelCard) {
      allEntriesPanelCard.style.setProperty('display', 'none', 'important');
      allEntriesPanelCard.classList.add('hidden-panel');
    }
    if (supervisorHomePanel) {
      supervisorHomePanel.style.setProperty('display', 'none', 'important');
      supervisorHomePanel.classList.add('hidden-panel');
    }
    if (barredGuestsPanel) {
      barredGuestsPanel.style.setProperty('display', 'none', 'important');
      barredGuestsPanel.classList.add('hidden-panel');
    }
    const staffPanel = document.getElementById('staff-panel-card');
    if (staffPanel) {
      staffPanel.style.setProperty('display', 'none', 'important');
      staffPanel.classList.add('hidden-panel');
    }
    
    // Close log modal if open
    closeLogModal();

    // De-activate all nav buttons
    document.querySelectorAll('.btn-nav').forEach(btn => btn.classList.remove('active'));

    // Keep wrapper locked inside single screen
    const wrapper = document.querySelector('.content-wrapper');
    if (wrapper) {
      wrapper.style.maxWidth = '';
      wrapper.style.overflow = 'hidden';
      wrapper.style.height = '100%';
    }
    
    document.body.style.overflow = 'hidden';
    document.body.style.overflowY = 'hidden';
  }

  function showHomePanel() {
    sessionStorage.setItem('current_panel', 'home');
    hideAllPanels();
    resetFormInputs();
    if(tableSearchInput) tableSearchInput.value = '';

    // Auto-fit 100% in one page with zero page scrolling (Telegram layout on mobile & desktop)
    document.body.style.overflow = 'hidden';
    document.body.style.overflowY = 'hidden';
    const wrapper = document.querySelector('.content-wrapper');
    if (wrapper) {
      wrapper.style.overflow = 'hidden';
      wrapper.style.height = '100%';
    }
    const appFooter = document.querySelector('.app-footer');
    if (appFooter) appFooter.style.display = 'none';
    
    // Toggle navigation buttons - ADD ENTRIES available for everyone
    if (btnSupervisorLog) btnSupervisorLog.style.display = 'flex';
    if (btnOpenLogModal) btnOpenLogModal.style.display = 'flex';

    if (currentUser && currentUser.role === 'supervisor') {
      // Supervisor View
      if (supervisorHomePanel) {
        supervisorHomePanel.classList.remove('hidden-panel');
        supervisorHomePanel.style.setProperty('display', 'flex', 'important');
      }
      renderSupervisorHome();
    } else {
      // Normal/Office View (Telegram layout: Table on top, Message Box fixed down)
      if (historyTableSection) {
        historyTableSection.classList.remove('hidden-panel');
        historyTableSection.style.setProperty('display', 'flex', 'important');
      }
      const logForm = document.getElementById('log-form-panel');
      if (logForm) {
        logForm.classList.remove('hidden-panel');
        logForm.style.setProperty('display', 'block', 'important');
      }
      if (entryFormSection) {
        entryFormSection.classList.remove('hidden-panel');
        entryFormSection.style.setProperty('display', 'block', 'important');
      }
    }
    
    if(btnHome) btnHome.classList.add('active');
    fetchEntries();
    focusMessageBox();
  }

  function showAdminPanel() {
    if (!isUserAdmin()) {
      if (window.showAppNotification) {
        window.showAppNotification('ONLY ADMIN CAN ADD MEMBER', 'error');
      }
      showHomePanel();
      return;
    }
    sessionStorage.setItem('current_panel', 'admin');
    hideAllPanels();

    const logForm = document.getElementById('log-form-panel');
    if (logForm) {
      logForm.style.setProperty('display', 'none', 'important');
      logForm.classList.add('hidden-panel');
    }
    if (historyTableSection) {
      historyTableSection.style.setProperty('display', 'none', 'important');
      historyTableSection.classList.add('hidden-panel');
    }

    // Auto-fit 100% screen size with zero outer window scrolling (ONLY ACTIVE MEMBERS MOVE UP/DOWN)
    const wrapper = document.querySelector('.content-wrapper');
    if (wrapper) {
      wrapper.style.maxWidth = '100%';
      wrapper.style.width = '100%';
      wrapper.style.overflow = 'hidden';
      wrapper.style.height = '100%';
      wrapper.style.flex = '1 1 0';
      wrapper.style.padding = '0 16px 6px 16px';
    }

    document.body.style.overflow = 'hidden';
    document.body.style.overflowY = 'hidden';

    if(adminPanelCard) {
      adminPanelCard.classList.remove('hidden-panel');
      adminPanelCard.style.setProperty('display', 'flex', 'important');
      if(btnAdminUsers) btnAdminUsers.classList.add('active');
      fetchUsers();
      if (window.lucide) lucide.createIcons();
    }
  }

  function showMajorPanel() {
    sessionStorage.setItem('current_panel', 'major');
    hideAllPanels();
    const logForm = document.getElementById('log-form-panel');
    if(logForm) {
      logForm.style.setProperty('display', 'none', 'important');
      logForm.classList.add('hidden-panel');
    }
    if(historyTableSection) {
      historyTableSection.style.setProperty('display', 'none', 'important');
      historyTableSection.classList.add('hidden-panel');
    }

    // Auto-fit 100% screen size with zero outer window scrolling and use full available space
    const wrapper = document.querySelector('.content-wrapper');
    if (wrapper) {
      wrapper.style.maxWidth = '100%';
      wrapper.style.width = '100%';
      wrapper.style.overflow = 'hidden';
      wrapper.style.height = '100%';
      wrapper.style.flex = '1 1 0';
      wrapper.style.padding = '0 16px 6px 16px';
    }

    document.body.style.overflow = 'hidden';
    document.body.style.overflowY = 'hidden';

    if(majorPanelCard) {
      majorPanelCard.classList.remove('hidden-panel');
      majorPanelCard.style.setProperty('display', 'flex', 'important');
      if(btnMajor) btnMajor.classList.add('active');
      if(majorSearch) majorSearch.value = ''; // Clear search to show all guests!
      majorViewMode = 'cards';
      renderMajor();
    }
  }

  function showAllEntriesPanel() {
    sessionStorage.setItem('current_panel', 'all_entries');
    hideAllPanels();

    const logForm = document.getElementById('log-form-panel');
    if (logForm) {
      logForm.style.setProperty('display', 'none', 'important');
      logForm.classList.add('hidden-panel');
    }
    if (historyTableSection) {
      historyTableSection.style.setProperty('display', 'none', 'important');
      historyTableSection.classList.add('hidden-panel');
    }

    // Auto-fit 100% screen size with zero outer window scrolling (ONLY ENTRIES MOVE UP/DOWN)
    const wrapper = document.querySelector('.content-wrapper');
    if (wrapper) {
      wrapper.style.maxWidth = '100%';
      wrapper.style.width = '100%';
      wrapper.style.overflow = 'hidden';
      wrapper.style.height = '100%';
      wrapper.style.flex = '1 1 0';
      wrapper.style.padding = '0 16px 6px 16px';
    }

    document.body.style.overflow = 'hidden';
    document.body.style.overflowY = 'hidden';

    if(allEntriesPanelCard) {
      allEntriesPanelCard.classList.remove('hidden-panel');
      allEntriesPanelCard.style.setProperty('display', 'flex', 'important');
      if(btnAllEntries) btnAllEntries.classList.add('active');
      
      updateGamingDateDisplay();

      // Always auto-goto current gaming date after refresh or close & open
      const todayDate = currentBusinessDateStr || getBusinessDate();
      activeAllEntriesDay = Number(todayDate.split('-')[2]);
      
      if (gotoDayInput) gotoDayInput.value = activeAllEntriesDay;
      if (allEntriesDatePicker) {
        allEntriesDatePicker.value = todayDate;
      }
      if (allEntriesSearch) {
        allEntriesSearch.value = '';
      }
      renderDayPagination();
      updateAllEntriesView();
      if (window.lucide) lucide.createIcons();
    }
  }

  const btnBarredGlobal = document.getElementById('btn-barred-global');
  const btnStaffGlobal = document.getElementById('btn-staff-global');

  function showStaffPanel() {
    sessionStorage.setItem('current_panel', 'staff');
    hideAllPanels();

    const wrapper = document.querySelector('.content-wrapper');
    if (wrapper) {
      wrapper.style.maxWidth = '100%';
      wrapper.style.width = '100%';
      wrapper.style.overflow = 'hidden';
      wrapper.style.height = '100%';
      wrapper.style.flex = '1 1 0';
      wrapper.style.padding = '0 16px 6px 16px';
    }

    document.body.style.overflow = 'hidden';
    document.body.style.overflowY = 'hidden';

    const staffPanel = document.getElementById('staff-panel-card') || staffDirectoryPanelCard;
    if (staffPanel) {
      staffPanel.classList.remove('hidden-panel');
      staffPanel.style.setProperty('display', 'flex', 'important');
      if (btnStaffGlobal) btnStaffGlobal.classList.add('active');
      fetchAndRenderStaff();
      if (window.lucide) lucide.createIcons();
    }
  }

  if (btnStaffGlobal) {
    btnStaffGlobal.addEventListener('click', showStaffPanel);
  }

  if(btnHome) btnHome.addEventListener('click', () => {
    if(typeof hideAllPanels === 'function') hideAllPanels();
    if(typeof showHomePanel === 'function') showHomePanel();
    focusMessageBox();
  });
  function showBarredPanel() {
    sessionStorage.setItem('current_panel', 'barred');
    hideAllPanels();

    const logForm = document.getElementById('log-form-panel');
    if (logForm) {
      logForm.style.setProperty('display', 'none', 'important');
      logForm.classList.add('hidden-panel');
    }
    if (historyTableSection) {
      historyTableSection.style.setProperty('display', 'none', 'important');
      historyTableSection.classList.add('hidden-panel');
    }

    // Auto-fit 100% screen size with zero outer window scrolling (ONLY BARRED CARDS MOVE UP/DOWN)
    const wrapper = document.querySelector('.content-wrapper');
    if (wrapper) {
      wrapper.style.maxWidth = '100%';
      wrapper.style.width = '100%';
      wrapper.style.overflow = 'hidden';
      wrapper.style.height = '100%';
      wrapper.style.flex = '1 1 0';
      wrapper.style.padding = '0 16px 6px 16px';
    }

    document.body.style.overflow = 'hidden';
    document.body.style.overflowY = 'hidden';

    if (barredGuestsPanel) {
      barredGuestsPanel.classList.remove('hidden-panel');
      barredGuestsPanel.style.setProperty('display', 'flex', 'important');
      if (btnBarredGlobal) btnBarredGlobal.classList.add('active');
      fetchAndRenderBarredGuests();
      if (window.lucide) lucide.createIcons();
    }
  }

  if (btnBarredGlobal) btnBarredGlobal.addEventListener('click', showBarredPanel);
  if(btnAdminUsers) btnAdminUsers.addEventListener('click', showAdminPanel);
  const userProfileBadge = document.getElementById('user-profile-badge') || document.querySelector('.user-profile');
  if(userProfileBadge) {
    userProfileBadge.addEventListener('click', () => {
      if (isUserAdmin()) {
        showAdminPanel();
      }
    });
  }
  if(btnMajor) btnMajor.addEventListener('click', showMajorPanel);
  if(btnAllEntries) btnAllEntries.addEventListener('click', showAllEntriesPanel);
  if(btnAllEntriesHome) btnAllEntriesHome.addEventListener('click', showHomePanel);
  const btnCloseAdminPanel = document.getElementById('btn-close-admin-panel');
  if(btnCloseAdminPanel) btnCloseAdminPanel.addEventListener('click', showHomePanel);

  // Add Entries (Log Modal) Event Listeners
  if (btnSupervisorLog) btnSupervisorLog.addEventListener('click', openLogModal);
  if (btnOpenLogModal) btnOpenLogModal.addEventListener('click', openLogModal);
  if (btnCloseLogModal) btnCloseLogModal.addEventListener('click', closeLogModal);
  if (supervisorLogModal) {
    supervisorLogModal.addEventListener('click', (e) => {
      if (e.target === supervisorLogModal) closeLogModal();
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && supervisorLogModal && supervisorLogModal.style.display === 'flex') {
      closeLogModal();
    }
  });

  // ============================================================
  // BARRED GUESTS - Fetch global list and render panel
  // ============================================================

  async function fetchGlobalBarredList() {
    try {
      const res = await fetch('/api/barred');
      if (res.ok) {
        const data = await res.json();
        globalBarredList = data.barred || [];
        window.globalBarredList = globalBarredList;
      }
    } catch (e) {
      console.error('Failed to fetch global barred list:', e);
    }
  }

  // Check if a guest name matches the barred list (exact name / same spelling)
  function checkClientBarredGuest(guestName) {
    if (!guestName || !globalBarredList || !Array.isArray(globalBarredList) || globalBarredList.length === 0) return null;
    const query = String(guestName).trim().toUpperCase().replace(/\s+/g, ' ');
    if (!query) return null;
    for (const item of globalBarredList) {
      if (!item) continue;
      // 1. Direct property checks
      const directName = item.guestname || item.name || item.GuestName || item.Name || item.GUESTNAME;
      if (typeof directName === 'string') {
        const bName = directName.trim().toUpperCase().replace(/\s+/g, ' ');
        if (bName === query) return item;
      }
      // 2. Iterate keys looking for guest / name
      for (const [k, v] of Object.entries(item)) {
        if (typeof v === 'string') {
          const lk = k.toLowerCase();
          if (lk.includes('name') || lk === 'guest' || lk.includes('guest')) {
            const bName = v.trim().toUpperCase().replace(/\s+/g, ' ');
            if (bName === query) {
              return item;
            }
          }
        }
      }
    }
    return null;
  }

  async function ensureCheckBarredGuest(guestName) {
    if (!globalBarredList || !Array.isArray(globalBarredList) || globalBarredList.length === 0) {
      await fetchGlobalBarredList();
    }
    return checkClientBarredGuest(guestName);
  }

  // Display the Barred Warning Popup Modal and wait for user acknowledgment
  function showBarredWarningPopup(match, guestName) {
    return new Promise((resolve) => {
      const warningModal = document.getElementById('barred-warning-modal');
      const warningName = document.getElementById('barred-warning-name');
      const warningReason = document.getElementById('barred-warning-reason');
      const btnClose = document.getElementById('btn-close-barred-warning');
      if (!warningModal) {
        resolve(true);
        return;
      }

      const displayName = guestName || (match ? (match.guestname || match.name || match.Name || 'BARRED GUEST') : 'BARRED GUEST');
      if (warningName) {
        warningName.textContent = displayName;
      }

      let details = '';
      let reasonText = match ? (match.reason || match.Reason || match.REASON || '') : '';
      let dateText = match ? (match.date || match.Date || match.DATE || '') : '';
      let instText = match ? (match.inst || match.Inst || match.INST || match.instruction || match.Instruction || '') : '';
      let propText = match ? (match.property || match.Property || match.PROPERTY || '') : '';
      let photoUrl = match ? (match.photo || match.Photo || '') : '';

      if (photoUrl && (photoUrl.startsWith('data:image/') || photoUrl.startsWith('http') || photoUrl.startsWith('/'))) {
        details += `<div style="text-align:center; margin-bottom:8px;"><img src="${photoUrl}" style="max-height:85px; max-width:100%; object-fit:contain; border-radius:6px; border:1.5px solid rgba(239,68,68,0.6);" /></div>`;
      }

      details += `
        <div style="display:flex; flex-direction:column; gap:3px; text-align:left; font-size:0.78rem; line-height:1.35;">
          <div><strong style="color:#ef4444;">REASON:</strong> <span style="color:#fff;">${escapeHTML(reasonText || 'No reason specified')}</span></div>
          ${dateText ? `<div><strong style="color:#94a3b8;">DATE:</strong> <span style="color:#fff;">${escapeHTML(dateText)}</span></div>` : ''}
          ${instText ? `<div><strong style="color:#94a3b8;">INSTRUCTION:</strong> <span style="color:#fff;">${escapeHTML(instText)}</span></div>` : ''}
          ${propText ? `<div><strong style="color:#94a3b8;">PROPERTY:</strong> <span style="color:#fff;">${escapeHTML(propText)}</span></div>` : ''}
        </div>
      `;

      if (warningReason) {
        warningReason.innerHTML = details;
      }

      warningModal.style.display = 'flex';
      if (window.lucide) lucide.createIcons();

      function handleAcknowledge(e) {
        if (e) e.preventDefault();
        warningModal.style.display = 'none';
        if (btnClose) btnClose.removeEventListener('click', handleAcknowledge);
        resolve(true);
      }

      if (btnClose) {
        btnClose.onclick = handleAcknowledge;
      } else {
        resolve(true);
      }
    });
  }

  let barredEditMode = false;

  async function fetchAndRenderBarredGuests() {
    const container = document.getElementById('barred-list-container');
    if (!container) return;
    
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);font-weight:700;">Loading barred guests...</div>';

    try {
      const res = await fetch('/api/barred');
      const data = await res.json();
      globalBarredList = data.barred || [];
      window.globalBarredList = globalBarredList;
    } catch (e) {
      container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--danger);font-weight:700;">Failed to load barred guests.</div>';
      return;
    }

    const searchInput = document.getElementById('barred-search');
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
    
    const filtered = query
      ? globalBarredList.filter(g => Object.values(g).some(val => String(val).toLowerCase().includes(query)))
      : globalBarredList;

    if (filtered.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);font-weight:700;">No barred guests found.</div>';
      return;
    }

    let cardsHtml = '<div class="barred-cards-grid">';
    filtered.forEach(g => {
      let photoHtml = `
        <div class="barred-photo-placeholder">
          <i data-lucide="camera" style="width:28px;height:28px;color:#94a3b8;"></i>
          <span>PHOTO</span>
        </div>`;
      let nameVal = '', reasonVal = '', dateVal = '', instVal = '', propVal = '';
      
      for (const [k, v] of Object.entries(g)) {
        if (k === 'id' || k === 'timestamp') continue;
        const lowerK = k.toLowerCase();
        if (lowerK.includes('photo') || lowerK.includes('image')) {
          if (String(v).startsWith('data:image/') || String(v).startsWith('http')) {
            photoHtml = `<img src="${v}" class="barred-photo-img" alt="Guest Photo" />`;
          }
        } else if (lowerK.includes('name')) {
          nameVal = v;
        } else if (lowerK.includes('reason')) {
          reasonVal = v;
        } else if (lowerK.includes('date')) {
          dateVal = v;
        } else if (lowerK.includes('inst')) {
          instVal = v;
        } else if (lowerK.includes('prop')) {
          propVal = v;
        } else {
          if (!nameVal) nameVal = v;
          else if (!reasonVal) reasonVal = v;
          else if (!dateVal) dateVal = v;
          else if (!instVal) instVal = v;
          else if (!propVal) propVal = v;
        }
      }

      cardsHtml += `
        <div class="barred-guest-card-box" data-id="${g.id}" title="Click to view/edit guest" style="cursor: pointer;">
          <div class="barred-card-header">
            <span class="barred-badge-title">BARRED GUEST</span>
          </div>
          <div class="barred-card-body">
            <div class="barred-photo-col" data-id="${g.id}" title="Click to upload/change photo">
              ${photoHtml}
              <input type="file" class="card-photo-file-input" data-id="${g.id}" accept="image/*" style="display:none;" />
            </div>
            <div class="barred-fields-col">
              <div class="barred-field-row">
                <span class="barred-field-label">GUESTNAME:</span>
                <span class="barred-field-value barred-field-name">${escapeHTML(String(nameVal || '-'))}</span>
              </div>
              <div class="barred-field-row">
                <span class="barred-field-label">DATE:</span>
                <span class="barred-field-value">${escapeHTML(String(dateVal || '-'))}</span>
              </div>
              <div class="barred-field-row">
                <span class="barred-field-label">REASON:</span>
                <span class="barred-field-value barred-field-reason">${escapeHTML(String(reasonVal || '-'))}</span>
              </div>
              <div class="barred-field-row">
                <span class="barred-field-label">INSTRUCTION:</span>
                <span class="barred-field-value">${escapeHTML(String(instVal || '-'))}</span>
              </div>
              <div class="barred-field-row">
                <span class="barred-field-label">PROPERTY:</span>
                <span class="barred-field-value">${escapeHTML(String(propVal || '-'))}</span>
              </div>
            </div>
          </div>
        </div>
      `;
    });
    cardsHtml += '</div>';

    container.innerHTML = cardsHtml;
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();

    // Attach listeners for Card Click (Opens Edit modal with prefilled data)
    container.querySelectorAll('.barred-guest-card-box').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.barred-photo-col') || e.target.tagName === 'INPUT') return;
        const id = card.getAttribute('data-id');
        const g = filtered.find(x => String(x.id) === String(id));
        if (g) openEditBarredGuest(g);
      });
    });

    // Attach listeners for direct photo upload by clicking on photo area
    container.querySelectorAll('.barred-photo-col').forEach(photoCol => {
      const fileInput = photoCol.querySelector('.card-photo-file-input');
      const guestId = photoCol.getAttribute('data-id');

      photoCol.addEventListener('click', (e) => {
        // Prevent if user clicked something else
        if (e.target !== fileInput && fileInput) fileInput.click();
      });

      if (fileInput) {
        fileInput.addEventListener('change', async () => {
          const file = fileInput.files[0];
          if (!file) return;

          const reader = new FileReader();
          reader.onload = async (ev) => {
            const base64Img = ev.target.result;
            try {
              const res = await fetch(`/api/barred?id=${guestId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ photo: base64Img })
              });
              if (res.ok) {
                await fetchAndRenderBarredGuests();
                await fetchGlobalBarredList();
              }
            } catch (err) {
              alert('Failed to update photo.');
            }
          };
          reader.readAsDataURL(file);
        });
      }
    });
  }

  // STAFF DIRECTORY
  async function fetchAndRenderStaff() {
    const tableHead = document.getElementById('staff-list-table-head');
    const tableBody = document.getElementById('staff-list-table-body');
    if (!tableHead || !tableBody) return;
    
    tableBody.innerHTML = '<tr><td colspan="100%" style="text-align:center;padding:40px;color:var(--text-muted);">Loading...</td></tr>';

    let staffList = [];
    try {
      const res = await fetch('/api/staff');
      const data = await res.json();
      staffList = data.staff || [];
    } catch (e) {
      tableBody.innerHTML = '<tr><td colspan="100%" style="text-align:center;padding:40px;color:var(--danger);">Failed to load staff.</td></tr>';
      return;
    }

    const searchInput = document.getElementById('staff-search');
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
    
    const filtered = query
      ? staffList.filter(s => Object.values(s).some(val => String(val).toLowerCase().includes(query)))
      : staffList;

    if (filtered.length === 0) {
      tableHead.innerHTML = '';
      tableBody.innerHTML = '<tr><td colspan="100%" style="text-align:center;padding:40px;color:var(--text-muted);">No staff found.</td></tr>';
      return;
    }

    const firstItem = filtered[0];
    let keysSet = new Set();
    filtered.forEach(g => Object.keys(g).forEach(k => {
      if(k !== 'id' && k !== 'timestamp' && k !== 'content') keysSet.add(k);
    }));
    const keys = Array.from(keysSet).filter(k => filtered.some(g => g[k] && String(g[k]).trim() !== ''));
    tableHead.innerHTML = keys.map(k => `<th style="padding: 12px; font-weight: bold; color: var(--text-secondary);">${k.toUpperCase()}</th>`).join('') + '<th style="padding: 12px; font-weight: bold; color: var(--text-secondary);">ACTIONS</th>';

    tableBody.innerHTML = filtered.map(s => {
      const tds = keys.map(k => {
      let val = String(s[k] || '');
      let content = escapeHTML(val);
      if (k.toLowerCase().includes('photo') || k.toLowerCase().includes('image')) {
        if (val.startsWith('data:image/') || val.startsWith('http')) {
           content = `<img src="${val}" style="max-width: 80px; max-height: 80px; object-fit: cover; border-radius: 4px;" alt="photo" />`;
        }
      }
      return `<td style="padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.05);">${content}</td>`;
    }).join('');
      const actionTd = `<td style="padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.05);"><button class="btn btn-secondary btn-delete-staff" data-id="${s.id}" style="padding:6px 12px;font-size:0.75rem;color:var(--danger);background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:6px;cursor:pointer;display:inline-flex;align-items:center;gap:4px;"><i data-lucide="trash-2" style="width:12px;height:12px;"></i> REMOVE</button></td>`;
      return `<tr>${tds}${actionTd}</tr>`;
    }).join('');

    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();

    tableBody.querySelectorAll('.btn-delete-staff').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        try {
          const r = await fetch(`/api/staff?id=${id}`, { method: 'DELETE' });
          if (r.ok) {
            await fetchAndRenderStaff();
          } else {
            alert('Failed to remove staff.');
          }
        } catch (e) {
          alert('Error removing staff.');
        }
      });
    });
  }

  // Barred Guest Panel UI Event Listeners
  const btnOpenBarredModal = document.getElementById('btn-open-barred-modal');
  const btnCloseBarredModal = document.getElementById('btn-close-barred-modal');
  const barredGuestModal = document.getElementById('barred-guest-modal');
  const barredGuestForm = document.getElementById('barred-guest-form');
  const barredSearch = document.getElementById('barred-search');
  const btnCloseBarredGuests = document.getElementById('btn-close-barred-guests');
  const barredPhotoInput = document.getElementById('barred-photo-input');
  const barredPhotoBox = document.getElementById('barred-photo-box');
  const barredPhotoPreview = document.getElementById('barred-photo-preview');
  const barredPhotoPh = document.getElementById('barred-photo-placeholder');
  const btnImportBarredDoc = document.getElementById('btn-import-barred-doc');
  const barredDocUpload = document.getElementById('barred-doc-upload');
  const btnDeleteAllBarred = document.getElementById('btn-delete-all-barred');
  const btnBarredSearchToggle = document.getElementById('btn-barred-search-toggle');
  const btnDeleteSingleBarred = document.getElementById('btn-delete-single-barred');
  let editingBarredId = null;
  let barredPhotoBase64 = null;

  function openEditBarredGuest(g) {
    if (!g) return;
    editingBarredId = g.id;
    document.getElementById('barred-guestname').value = g.guestname || g.Name || g['Guest Name'] || g.GUESTNAME || g.name || '';
    document.getElementById('barred-reason').value = g.reason || g.Reason || g.REASON || '';
    document.getElementById('barred-date').value = g.date || g.Date || g.DATE || '';
    document.getElementById('barred-inst').value = g.inst || g.Inst || g.INST || '';
    document.getElementById('barred-property').value = g.property || g.Property || g.PROPERTY || '';
    document.getElementById('barred-otherinfo').value = g.otherinfo || g.Otherinfo || '';
    
    const photoPreview = document.getElementById('barred-photo-preview');
    const photoPh = document.getElementById('barred-photo-placeholder');
    if (g.photo && g.photo.startsWith('data:image/')) {
       barredPhotoBase64 = g.photo;
       if (photoPreview) { photoPreview.src = g.photo; photoPreview.style.display = 'block'; }
       if (photoPh) photoPh.style.display = 'none';
    } else {
       barredPhotoBase64 = null;
       if (photoPreview) { photoPreview.src = ''; photoPreview.style.display = 'none'; }
       if (photoPh) photoPh.style.display = '';
    }
    
    const modalTitle = barredGuestModal ? barredGuestModal.querySelector('h3') : null;
    if (modalTitle) modalTitle.innerHTML = '<i data-lucide="edit" style="vertical-align: middle; margin-right: 8px;"></i>EDIT BARRED GUEST';
    if (btnDeleteSingleBarred) btnDeleteSingleBarred.style.display = 'inline-flex';
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
    if (barredGuestModal) barredGuestModal.style.display = 'flex';
  }

  if (btnOpenBarredModal) {
    btnOpenBarredModal.addEventListener('click', () => {
      editingBarredId = null;
      barredPhotoBase64 = null;
      if (barredGuestForm) barredGuestForm.reset();
      if (barredPhotoPreview) { barredPhotoPreview.style.display = 'none'; barredPhotoPreview.src = ''; }
      if (barredPhotoPh) barredPhotoPh.style.display = '';
      if (btnDeleteSingleBarred) btnDeleteSingleBarred.style.display = 'none';
      const modalTitle = barredGuestModal ? barredGuestModal.querySelector('h3') : null;
      if (modalTitle) modalTitle.innerHTML = '<i data-lucide="ban" style="vertical-align:middle;margin-right:8px;"></i>ADD BARRED GUEST';
      if (barredGuestModal) barredGuestModal.style.display = 'flex';
      lucide.createIcons();
    });
  }

  if (btnDeleteSingleBarred) {
    btnDeleteSingleBarred.addEventListener('click', async () => {
      if (!editingBarredId) return;
      if (!(await showAppConfirm('Are you sure you want to delete this barred guest?'))) return;
      try {
        const r = await fetch(`/api/barred?id=${encodeURIComponent(editingBarredId)}`, { method: 'DELETE' });
        if (r.ok) {
          showAppNotification('Barred guest removed successfully.', 'success');
          if (barredGuestModal) barredGuestModal.style.display = 'none';
          await fetchAndRenderBarredGuests();
          await fetchGlobalBarredList();
        } else {
          showAppNotification('Failed to remove barred guest.', 'error');
        }
      } catch (e) {
        showAppNotification('Error removing barred guest.', 'error');
      }
    });
  }

  if (btnCloseBarredModal) {
    btnCloseBarredModal.addEventListener('click', () => {
      if (barredGuestModal) barredGuestModal.style.display = 'none';
    });
  }

  if (barredGuestModal) {
    barredGuestModal.addEventListener('click', (e) => {
      if (e.target === barredGuestModal) {
        barredGuestModal.style.display = 'none';
      }
    });
  }

  if (btnCloseBarredGuests) {
    btnCloseBarredGuests.addEventListener('click', () => {
      if (barredGuestsPanel) barredGuestsPanel.style.display = 'none';
      showHomePanel();
    });
  }

  if (btnBarredSearchToggle && barredSearch) {
    btnBarredSearchToggle.addEventListener('click', () => {
      if (barredSearch.style.display === 'none' || !barredSearch.style.display) {
        barredSearch.style.display = 'inline-block';
        btnBarredSearchToggle.classList.add('active');
        barredSearch.focus();
      } else {
        if (!barredSearch.value) {
          barredSearch.style.display = 'none';
          btnBarredSearchToggle.classList.remove('active');
        } else {
          barredSearch.value = '';
          barredSearch.style.display = 'none';
          btnBarredSearchToggle.classList.remove('active');
          fetchAndRenderBarredGuests();
        }
      }
    });

    barredSearch.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        barredSearch.value = '';
        barredSearch.style.display = 'none';
        btnBarredSearchToggle.classList.remove('active');
        fetchAndRenderBarredGuests();
      }
    });
  }

  if (barredSearch) {
    barredSearch.addEventListener('input', fetchAndRenderBarredGuests);
  }

  if (barredPhotoBox && barredPhotoInput) {
    barredPhotoBox.addEventListener('click', () => barredPhotoInput.click());
    barredPhotoInput.addEventListener('change', () => {
      const file = barredPhotoInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        barredPhotoBase64 = ev.target.result;
        if (barredPhotoPreview) { barredPhotoPreview.src = barredPhotoBase64; barredPhotoPreview.style.display = 'block'; }
        if (barredPhotoPh) barredPhotoPh.style.display = 'none';
      };
      reader.readAsDataURL(file);
    });
  }

  if (barredGuestForm) {
    barredGuestForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const guestname = (document.getElementById('barred-guestname').value || '').trim();
      const reason = (document.getElementById('barred-reason').value || '').trim();
      const date = (document.getElementById('barred-date').value || '').trim();
      const inst = (document.getElementById('barred-inst').value || '').trim();
      const property = (document.getElementById('barred-property').value || '').trim();
      const otherinfo = (document.getElementById('barred-otherinfo').value || '').trim();
      if (!guestname) { alert('Guest Name is required.'); return; }

      const payload = { guestname, reason, date, inst, property, otherinfo, photo: barredPhotoBase64 || null };
      const url = editingBarredId ? `/api/barred?id=${editingBarredId}` : '/api/barred';
      const method = editingBarredId ? 'PUT' : 'POST';

      try {
        const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const data = await r.json();
        if (!r.ok) { alert(data.error || 'Failed to save.'); return; }
        if (barredGuestModal) barredGuestModal.style.display = 'none';
        barredGuestForm.reset();
        editingBarredId = null;
        barredPhotoBase64 = null;
        await fetchAndRenderBarredGuests();
        await fetchGlobalBarredList();
      } catch (err) {
        alert('Error saving barred guest.');
      }
    });

    barredGuestForm.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const submitBtn = barredGuestModal ? barredGuestModal.querySelector('button[type="submit"]') : null;
        if (submitBtn) {
          submitBtn.click();
        } else {
          barredGuestForm.requestSubmit();
        }
      }
    });
  }

  // Universal File Parser: Photo (image/*, .jpg, .png, etc.), Excel (.xlsx, .xls, .csv), Word (.docx), PDF (.pdf, .txt)
  async function parseBarredFile(file) {
    const name = file.name || '';
    const ext = name.split('.').pop().toLowerCase();
    
    // 0. PHOTO / IMAGE (.jpg, .jpeg, .png, .webp, .bmp, .gif)
    if ((file.type && file.type.startsWith('image/')) || ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif'].includes(ext)) {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Failed to read photo file'));
        reader.readAsDataURL(file);
      });
      // Extract guest name from filename without extension
      let baseName = name.replace(/\.[^/.]+$/, '').trim();
      baseName = baseName.replace(/[_-]+/g, ' ').trim();
      const guestname = (baseName || 'BARRED GUEST').toUpperCase();
      const resolvedDate = (typeof currentBusinessDateStr === 'string' && currentBusinessDateStr)
        ? currentBusinessDateStr
        : ((typeof getBusinessDate === 'function') ? getBusinessDate() : new Date().toISOString().split('T')[0]);
      
      return [{
        guestname: guestname,
        reason: 'BARRED',
        date: resolvedDate,
        inst: '',
        property: '',
        otherinfo: '',
        photo: dataUrl
      }];
    }

    // 1. EXCEL / CSV
    if (['xlsx', 'xls', 'csv'].includes(ext)) {
      const data = await file.arrayBuffer();
      const imgMap = (typeof extractExcelImages === 'function') ? await extractExcelImages(data) : {};
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      let rows = XLSX.utils.sheet_to_json(ws, { raw: false, defval: '' });
      rows = rows.filter(s => {
        const vals = Object.values(s).map(v => String(v).toUpperCase().trim());
        return !(vals.includes('NAME') && vals.includes('REASON'));
      });
      const guests = [];
      rows.forEach(r => {
        const g = {};
        for (const [k, v] of Object.entries(r)) {
          const kLow = k.toLowerCase().trim();
          if (kLow.includes('name')) g.guestname = String(v).trim().toUpperCase();
          else if (kLow.includes('reason')) g.reason = String(v).trim().toUpperCase();
          else if (kLow.includes('date')) g.date = String(v).trim();
          else if (kLow.includes('inst')) g.inst = String(v).trim().toUpperCase();
          else if (kLow.includes('prop')) g.property = String(v).trim().toUpperCase();
          else if (kLow.includes('photo')) g.photo = v;
          else if (kLow.includes('other')) g.otherinfo = String(v).trim().toUpperCase();
        }
        if (r.__rowNum__ !== undefined && imgMap[r.__rowNum__]) {
          g.photo = imgMap[r.__rowNum__];
        }
        if (g.guestname) guests.push(g);
      });
      return guests;
    }

    // 2. WORD (.docx)
    if (ext === 'docx') {
      const data = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(data);
      const docXml = zip.file('word/document.xml');
      if (!docXml) throw new Error('Invalid Word document: missing document.xml');
      const xmlStr = await docXml.async('text');
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlStr, 'text/xml');
      
      const guests = [];
      const tables = xmlDoc.getElementsByTagName('w:tbl');
      if (tables && tables.length > 0) {
        for (let t = 0; t < tables.length; t++) {
          const rows = tables[t].getElementsByTagName('w:tr');
          if (rows.length < 2) continue;
          const headers = [];
          const headerCells = rows[0].getElementsByTagName('w:tc');
          for (let c = 0; c < headerCells.length; c++) {
            headers.push(headerCells[c].textContent.trim().toLowerCase());
          }
          for (let r = 1; r < rows.length; r++) {
            const cells = rows[r].getElementsByTagName('w:tc');
            if (cells.length === 0) continue;
            const g = {};
            for (let c = 0; c < cells.length; c++) {
              const val = cells[c].textContent.trim();
              const h = headers[c] || '';
              if (h.includes('name')) g.guestname = val.toUpperCase();
              else if (h.includes('reason')) g.reason = val.toUpperCase();
              else if (h.includes('date')) g.date = val;
              else if (h.includes('inst')) g.inst = val.toUpperCase();
              else if (h.includes('prop')) g.property = val.toUpperCase();
              else if (h.includes('other')) g.otherinfo = val.toUpperCase();
            }
            if (g.guestname) guests.push(g);
          }
        }
      }
      
      if (guests.length === 0) {
        const paras = xmlDoc.getElementsByTagName('w:p');
        for (let i = 0; i < paras.length; i++) {
          const txt = paras[i].textContent.trim();
          if (!txt) continue;
          const parts = txt.split(/[,;\t|]+/);
          const g = {};
          parts.forEach(p => {
            const idx = p.indexOf(':');
            if (idx > -1) {
              const k = p.substring(0, idx).trim().toLowerCase();
              const v = p.substring(idx + 1).trim();
              if (k.includes('name')) g.guestname = v.toUpperCase();
              else if (k.includes('reason')) g.reason = v.toUpperCase();
              else if (k.includes('date')) g.date = v;
              else if (k.includes('inst')) g.inst = v.toUpperCase();
              else if (k.includes('prop')) g.property = v.toUpperCase();
            }
          });
          if (g.guestname) guests.push(g);
        }
      }
      return guests;
    }

    // 3. PDF (.pdf) or TEXT (.txt)
    if (ext === 'pdf' || ext === 'txt' || ext === 'doc') {
      const text = await file.text();
      const cleanLines = text.split(/[\r\n]+/).map(l => l.trim()).filter(l => l.length > 0);
      const guests = [];
      cleanLines.forEach(line => {
        const parts = line.split(/[,;\t|]+/);
        const g = {};
        parts.forEach(p => {
          const idx = p.indexOf(':');
          if (idx > -1) {
            const k = p.substring(0, idx).trim().toLowerCase();
            const v = p.substring(idx + 1).trim();
            if (k.includes('name')) g.guestname = v.toUpperCase();
            else if (k.includes('reason')) g.reason = v.toUpperCase();
            else if (k.includes('date')) g.date = v;
            else if (k.includes('inst')) g.inst = v.toUpperCase();
            else if (k.includes('prop')) g.property = v.toUpperCase();
          }
        });
        if (g.guestname) guests.push(g);
      });
      return guests;
    }

    throw new Error('Unsupported format. Please select Photo, Excel (.xlsx, .xls, .csv), Word (.docx), or PDF (.pdf) file.');
  }

  // Import button listener (Photo, PDF, Excel, Word in ONE button) - Symbol / Icon only
  if (btnImportBarredDoc && barredDocUpload) {
    btnImportBarredDoc.addEventListener('click', () => barredDocUpload.click());
    barredDocUpload.addEventListener('change', async () => {
      const files = Array.from(barredDocUpload.files || []);
      if (files.length === 0) return;
      try {
        btnImportBarredDoc.disabled = true;
        btnImportBarredDoc.innerHTML = `<i data-lucide="loader-2" class="spin" style="width: 18px; height: 18px;"></i>`;
        if (window.lucide) lucide.createIcons();

        let allGuests = [];
        for (const file of files) {
          const parsed = await parseBarredFile(file);
          if (Array.isArray(parsed) && parsed.length > 0) {
            allGuests = allGuests.concat(parsed);
          }
        }

        if (!allGuests || allGuests.length === 0) {
          if (window.showAppNotification) {
            window.showAppNotification('No valid barred guest records found in selected file(s).', 'warning');
          } else {
            alert('No valid barred guest records found in selected file(s).');
          }
          return;
        }

        const res = await fetch('/api/barred/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guests: allGuests })
        });
        const result = await res.json();
        if (result.success) {
          if (window.showAppNotification) {
            window.showAppNotification(`Successfully imported ${result.count} barred guest(s)!`, 'success');
          } else {
            alert(`Successfully imported ${result.count} barred guest(s)!`);
          }
          await fetchAndRenderBarredGuests();
          await fetchGlobalBarredList();
        } else {
          if (window.showAppNotification) {
            window.showAppNotification(result.error || 'Import failed.', 'error');
          } else {
            alert(result.error || 'Import failed.');
          }
        }
      } catch (err) {
        if (window.showAppNotification) {
          window.showAppNotification('Failed to parse file: ' + err.message, 'error');
        } else {
          alert('Failed to parse file: ' + err.message);
        }
      } finally {
        barredDocUpload.value = '';
        btnImportBarredDoc.disabled = false;
        btnImportBarredDoc.innerHTML = `<i data-lucide="upload-cloud" style="width: 18px; height: 18px;"></i>`;
        if (window.lucide) lucide.createIcons();
      }
    });
  }

  // Delete all barred guests
  if (btnDeleteAllBarred) {
    btnDeleteAllBarred.addEventListener('click', async () => {
      if (!(await showAppConfirm('Are you sure you want to delete ALL barred guests?'))) return;
      try {
        const res = await fetch('/api/barred?all=true', { method: 'DELETE' });
        const data = await res.json();
        if (res.ok) {
          showAppNotification('All barred guests deleted successfully.', 'success');
          await fetchAndRenderBarredGuests();
          await fetchGlobalBarredList();
        } else {
          showAppNotification(data.error || 'Failed to delete all barred guests.', 'error');
        }
      } catch (err) {
        showAppNotification('Error deleting all barred guests.', 'error');
      }
    });
  }


  const btnStaffPanel = document.getElementById('btn-staff-panel');
  const staffDirectoryPanelCard = document.getElementById('staff-directory-panel-card');
  const btnCloseStaffDirectory = document.getElementById('btn-close-staff-directory');
  const btnImportStaffExcel = document.getElementById('btn-import-staff-excel');
  const staffExcelUpload = document.getElementById('staff-excel-upload');
  const staffSearch = document.getElementById('staff-search');

  if (btnStaffPanel) {
    if (btnStaffPanel) btnStaffPanel.addEventListener('click', () => {
      barredGuestsPanel.style.display = 'none';
      staffDirectoryPanelCard.style.display = 'flex';
      fetchAndRenderStaff();
    });
  }
  
  if (btnCloseStaffDirectory) {
    if (btnCloseStaffDirectory) btnCloseStaffDirectory.addEventListener('click', () => {
      staffDirectoryPanelCard.style.display = 'none';
      barredGuestsPanel.style.display = 'flex';
      fetchAndRenderBarredGuests();
    });
  }

  if (staffSearch) {
    if (staffSearch) staffSearch.addEventListener('input', fetchAndRenderStaff);
  }

  if (btnImportStaffExcel && staffExcelUpload) {
    if (btnImportStaffExcel) btnImportStaffExcel.addEventListener('click', () => staffExcelUpload.click());
    if (staffExcelUpload) staffExcelUpload.addEventListener('change', async () => {
      const file = staffExcelUpload.files[0];
      if (!file) return;
      try {
        const data = await file.arrayBuffer();
        const imgMap = await extractExcelImages(data);
        const wb = XLSX.read(data);
        const ws = wb.Sheets[wb.SheetNames[0]];
        let staff = XLSX.utils.sheet_to_json(ws, { raw: false, defval: '' });
        // Filter out header rows that got interpreted as data
        staff = staff.filter(s => {
           const vals = Object.values(s).map(v => String(v).toUpperCase().trim());
           return !(vals.includes('NAME') && vals.includes('DEPARTMENT'));
        });
        staff.forEach(s => {
           if (s.__rowNum__ !== undefined && imgMap[s.__rowNum__]) {
              s.photo = imgMap[s.__rowNum__];
           }
        });
        if (staff.length === 0) { alert('No valid staff found in file.'); return; }
        const res = await fetch('/api/staff/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ staff }) });
        const result = await res.json();
        if (result.success) {
          alert(`Imported ${result.count} staff members.`);
          await fetchAndRenderStaff();
        } else {
          alert(result.error || 'Import failed.');
        }
      } catch (err) {
        alert('Failed to parse file. Ensure it is a valid Excel/CSV.');
      }
      staffExcelUpload.value = '';
    });
  }

  // Helper: Format amount to K (e.g. 500000 -> 500K)
  function formatKCurrency(value) {
    if (!value || isNaN(value)) return '0';
    if (value >= 1000) {
      let kValue = value / 1000;
      return (Number.isInteger(kValue) ? kValue : kValue.toFixed(1)) + 'K';
    }
    return value.toString();
  }

  // Helper: Entry to Sentence Form (supports clickable hyperlink for guest name)
  function getEntrySentence(entry, isHtmlLink = false) {
    if (!entry) return '';
    const t = (entry.type || '').toUpperCase();
    const amt = formatKCurrency(Number(entry.amount) || 0).toUpperCase();
    const rawGuest = (entry.guestname || 'UNKNOWN').toUpperCase();
    const guest = isHtmlLink
      ? `<span class="clickable-guest-name" data-guest="${escapeHTML(rawGuest)}" style="cursor:pointer; color:#38bdf8 !important; text-decoration:underline; font-weight:700;">${escapeHTML(rawGuest)}</span>`
      : escapeHTML(rawGuest);
    const card = entry.card ? escapeHTML(String(entry.card).toUpperCase()) : '';
    const info = entry.otherinfo ? ` (${escapeHTML(String(entry.otherinfo).toUpperCase())})` : '';

    const cleanType = t.replace(/[\s\-_]/g, '');
    if (cleanType === 'CASHIN' || cleanType === 'CIN' || t === 'C/IN')   return `${amt} CASHIN BY ${guest}${info}`;
    if (cleanType === 'CASHOUT' || cleanType === 'COUT' || t === 'C/OUT')  return `${amt} CASHOUT BY ${guest}${info}`;
    if (cleanType === 'ISSUE')    return `${amt} ISSUE TO ${guest}${card ? ` FROM ${card} CARD` : ''}${info}`;
    if (cleanType === 'DEPOSIT')  return `${amt} DEPOSIT BY ${guest}${card ? ` ON ${card} CARD` : ''}${info}`;
    if (cleanType === 'KEYIN' || t === 'KEY/IN')    return `${amt} KEYIN BY ${guest}${info}`;
    if (cleanType === 'KEYOUT' || cleanType === 'KYOUT' || t === 'KEY/OUT' || t === 'KY/OUT')   return `${amt} KEYOUT BY ${guest}${info}`;
    
    return `${amt} ${t} BY ${guest}${info}`;
  }
  window.getEntrySentence = getEntrySentence;

  // -------------------------------------------------------------
  // GUEST NAME ALIASING, CANONICAL SELECTION & SUMMARY POPUP SYSTEM
  // -------------------------------------------------------------
  function formatDisplayDate(dateStr) {
    if (!dateStr) return '';
    const clean = String(dateStr).split('T')[0];
    const parts = clean.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
  }

  // Check if two raw guest name strings refer to the same person
  // e.g. GUEST, GUEST NAME, GUEST N, N GUEST, NAME G -> all match
  function isNameMatch(n1, n2) {
    if (!n1 || !n2) return false;
    const s1 = String(n1).trim().toUpperCase();
    const s2 = String(n2).trim().toUpperCase();
    if (s1 === s2) return true;

    const words1 = s1.split(/[\s,._-]+/).filter(Boolean);
    const words2 = s2.split(/[\s,._-]+/).filter(Boolean);
    if (words1.length === 0 || words2.length === 0) return false;

    // Full multi-letter words (length > 1) and single-letter initials (length === 1)
    const fullWords1 = words1.filter(w => w.length > 1);
    const fullWords2 = words2.filter(w => w.length > 1);
    const initials1 = words1.filter(w => w.length === 1);
    const initials2 = words2.filter(w => w.length === 1);

    // Check shared full words
    const commonWords = fullWords1.filter(w => fullWords2.includes(w));

    if (commonWords.length > 0) {
      const diff1 = fullWords1.filter(w => !commonWords.includes(w));
      const diff2 = fullWords2.filter(w => !commonWords.includes(w));

      // If both have different secondary full words (e.g. "GUEST A" vs "GUEST NAME"), they are distinct
      if (diff1.length > 0 && diff2.length > 0) {
        return false;
      }

      // If one has an extra word and the other has an initial, check if initial matches
      // e.g. "GUEST N" vs "GUEST NAME": diff2 is ["NAME"], initials1 is ["G"] -> matches!
      if (diff1.length > 0 && initials2.length > 0) {
        const matches = diff1.some(w => initials2.includes(w[0]));
        if (!matches) return false;
      }
      if (diff2.length > 0 && initials1.length > 0) {
        const matches = diff2.some(w => initials1.includes(w[0]));
        if (!matches) return false;
      }

      return true;
    }

    // Cross-initial matching without full word overlap:
    // e.g. "NAME G" vs "GUEST N" or "N GUEST"
    if (fullWords1.length === 1 && initials1.length === 1 && fullWords2.length === 1 && initials2.length === 1) {
      if (initials2.includes(fullWords1[0][0]) && initials1.includes(fullWords2[0][0])) {
        return true;
      }
    }

    return false;
  }

  // Priority scoring for canonical display name:
  // 1: GUEST NAME (2 full words)
  // 2: GUEST N (full word + initial at end)
  // 3: N GUEST (initial at start + full word)
  // 4: NAME G
  // 5: GUEST
  function getCanonicalNamePriority(name) {
    if (!name) return 0;
    const s = String(name).trim().toUpperCase();
    const words = s.split(/[\s,._-]+/).filter(Boolean);
    if (words.length === 0) return 0;

    const fullWords = words.filter(w => w.length > 1);
    const initials = words.filter(w => w.length === 1);

    // 1st: Two or more full words ("GUEST NAME") -> tier 3000
    if (fullWords.length >= 2) {
      return 3000 + (fullWords.length * 100) + s.length;
    }
    // 2nd: Full word followed by initial ("GUEST N") -> tier 2000
    if (fullWords.length === 1 && initials.length >= 1 && words[words.length - 1].length === 1) {
      return 2000 + s.length;
    }
    // 3rd: Initial followed by full word ("N GUEST") -> tier 1800
    if (fullWords.length === 1 && initials.length >= 1 && words[0].length === 1) {
      return 1800 + s.length;
    }
    // 4th: Other single full word + initial ("NAME G") -> tier 1600
    if (fullWords.length === 1 && initials.length >= 1) {
      return 1600 + s.length;
    }
    // 5th: Single full word ("GUEST" or "NAME") -> tier 1400
    if (fullWords.length === 1) {
      return 1400 + s.length;
    }

    return 1000 + s.length;
  }

  // Group candidate entries linked to targetName and pick canonical name
  function getGuestCluster(targetName, candidateEntries) {
    if (!targetName || !Array.isArray(candidateEntries)) {
      return { canonicalName: (targetName || '').toUpperCase(), entries: [] };
    }
    const target = String(targetName).trim().toUpperCase();

    // Find all directly matching entries
    let clusterEntries = candidateEntries.filter(e => {
      const gn = (e.guestname || '').trim();
      return isNameMatch(target, gn);
    });

    if (clusterEntries.length === 0) {
      clusterEntries = candidateEntries.filter(e => (e.guestname || '').trim().toUpperCase() === target);
    }

    // Transitive expansion (if A matches B and B matches C)
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

    // Determine canonical name based on priority among names present in cluster
    const uniqueNames = [...new Set(clusterEntries.map(e => (e.guestname || '').trim().toUpperCase()))].filter(Boolean);
    uniqueNames.sort((a, b) => getCanonicalNamePriority(b) - getCanonicalNamePriority(a));

    const canonicalName = uniqueNames.length > 0 ? uniqueNames[0] : target;

    return {
      canonicalName,
      entries: clusterEntries
    };
  }
  window.getGuestCluster = getGuestCluster;

  // Open Guest Summary Popup
  function openGuestSummaryPopup(guestName, candidateEntries, activeDateStr) {
    const modal = document.getElementById('guest-summary-modal');
    if (!modal) return;

    // Determine target full date string
    let resolvedDateStr = activeDateStr || currentBusinessDateStr || currentBusinessDate || getBusinessDate();
    if (typeof resolvedDateStr === 'number' || (typeof resolvedDateStr === 'string' && /^\d{1,2}$/.test(resolvedDateStr.trim()))) {
      const dayNum = parseInt(resolvedDateStr, 10);
      const base = currentBusinessDateStr || currentBusinessDate || getBusinessDate();
      const ym = base.slice(0, 7);
      resolvedDateStr = `${ym}-${String(dayNum).padStart(2, '0')}`;
    }

    // Format display date: DD-MM-YYYY
    const displayDate = formatDisplayDate(resolvedDateStr);
    const dateEl = document.getElementById('guest-summary-modal-date');
    if (dateEl) dateEl.textContent = displayDate;

    // Full pool of candidate entries
    const allCandidateEntries = (Array.isArray(candidateEntries) && candidateEntries.length > 0)
      ? candidateEntries
      : ((typeof allEntries !== 'undefined' && Array.isArray(allEntries)) ? allEntries : (window.allEntries || []));

    // Cluster matching entries
    const cluster = getGuestCluster(guestName, allCandidateEntries);
    let canonicalName = cluster.canonicalName || (guestName || '').toUpperCase();
    let clusterEntries = cluster.entries || [];

    if (clusterEntries.length === 0) {
      clusterEntries = allCandidateEntries.filter(e => {
        const gn = (e.guestname || '').trim().toUpperCase();
        return gn === canonicalName || gn.includes(canonicalName) || canonicalName.includes(gn);
      });
    }

    // Filter to selected business date
    let dayEntries = clusterEntries;
    if (resolvedDateStr) {
      const filtered = clusterEntries.filter(e => {
        const d = getEntryDate(e) || (parseEntryDateTime(e.datetime).date);
        return d === resolvedDateStr;
      });
      dayEntries = filtered;
    }

    // Calculate In / Out / Result for selected date
    let totalIn = 0;
    let totalOut = 0;
    dayEntries.forEach(e => {
      const amt = Number(e.amount) || 0;
      const t = e.type || '';
      if (isTotalInType(t)) {
        totalIn += amt;
      } else if (isTotalOutType(t)) {
        totalOut += amt;
      }
    });

    const netResult = totalOut - totalIn;
    const isNegative = netResult < 0;
    const totalInStr = formatIndianNumber(totalIn);
    const totalOutStr = formatIndianNumber(totalOut);
    const resFormatted = formatIndianNumber(Math.abs(netResult));
    // USER RULE: IF NEGATIVE THAN RED, NO COLOUR FOR OTHER (#000000 on green card)
    const resColor = isNegative ? '#FF0000' : '#000000';

    // Render Excel Style Guest Summary Card (Normal text + Bold, ZERO blur or text-shadow)
    const cardContainer = document.getElementById('guest-summary-card-container') || document.querySelector('.guest-summary-card-box');
    if (cardContainer) {
      cardContainer.innerHTML = `
        <div class="guest-summary-header-cyan" style="display: block !important; visibility: visible !important; font-family: Arial, 'Segoe UI', Calibri, sans-serif !important; font-weight: 800 !important; color: #000000 !important; text-shadow: none !important; filter: none !important;">
          GUEST SUMMARY
        </div>
        <div class="guest-summary-body-green" style="display: flex !important; visibility: visible !important; font-family: Arial, 'Segoe UI', Calibri, sans-serif !important; text-shadow: none !important; filter: none !important;">
          <div class="summary-row" style="display: flex !important; font-family: Arial, 'Segoe UI', Calibri, sans-serif !important; text-shadow: none !important;">
            <span class="summary-lbl" style="font-family: Arial, 'Segoe UI', Calibri, sans-serif !important; font-weight: 700 !important; color: #000000 !important; text-shadow: none !important; filter: none !important;">NAME :-</span>
            <span id="guest-summary-modal-name" class="summary-val" style="font-family: Arial, 'Segoe UI', Calibri, sans-serif !important; font-weight: 800 !important; color: #000000 !important; text-shadow: none !important; filter: none !important;">${escapeHTML(canonicalName || guestName || '—')}</span>
          </div>
          <div class="summary-row" style="display: flex !important; font-family: Arial, 'Segoe UI', Calibri, sans-serif !important; text-shadow: none !important;">
            <span class="summary-lbl" style="font-family: Arial, 'Segoe UI', Calibri, sans-serif !important; font-weight: 700 !important; color: #000000 !important; text-shadow: none !important; filter: none !important;">TOTAL IN :-</span>
            <span id="guest-summary-modal-in" class="summary-val" style="font-family: Arial, 'Segoe UI', Calibri, sans-serif !important; font-weight: 800 !important; color: #000000 !important; text-shadow: none !important; filter: none !important;">${totalInStr}</span>
          </div>
          <div class="summary-row" style="display: flex !important; font-family: Arial, 'Segoe UI', Calibri, sans-serif !important; text-shadow: none !important;">
            <span class="summary-lbl" style="font-family: Arial, 'Segoe UI', Calibri, sans-serif !important; font-weight: 700 !important; color: #000000 !important; text-shadow: none !important; filter: none !important;">TOTAL OUT :-</span>
            <span id="guest-summary-modal-out" class="summary-val" style="font-family: Arial, 'Segoe UI', Calibri, sans-serif !important; font-weight: 800 !important; color: #000000 !important; text-shadow: none !important; filter: none !important;">${totalOutStr}</span>
          </div>
          <div class="summary-row summary-row-result" style="display: flex !important; visibility: visible !important; min-height: 32px !important; border-bottom: 1.5px solid #000000 !important; font-family: Arial, 'Segoe UI', Calibri, sans-serif !important; text-shadow: none !important;">
            <span class="summary-lbl" style="font-family: Arial, 'Segoe UI', Calibri, sans-serif !important; font-weight: 800 !important; color: #000000 !important; text-shadow: none !important; filter: none !important;">RESULT :-</span>
            <span id="guest-summary-modal-result" class="summary-val summary-val-result" style="font-family: Arial, 'Segoe UI', Calibri, sans-serif !important; color: ${resColor} !important; font-weight: 800 !important; font-size: 1.05rem !important; text-shadow: none !important; filter: none !important;">${escapeHTML(resFormatted)}</span>
          </div>
        </div>
        <div class="guest-summary-footer-yellow" style="display: block !important; visibility: visible !important; height: 20px !important; min-height: 20px !important; background: #FFFF00 !important; border-top: 1.5px solid #000000 !important;"></div>
      `;
    }

    // Also directly set text and color on element references if present
    const nameEl = document.getElementById('guest-summary-modal-name');
    const inEl = document.getElementById('guest-summary-modal-in');
    const outEl = document.getElementById('guest-summary-modal-out');
    const resultEl = document.getElementById('guest-summary-modal-result');
    if (nameEl) nameEl.textContent = canonicalName || guestName || '—';
    if (inEl) inEl.textContent = totalInStr;
    if (outEl) outEl.textContent = totalOutStr;
    if (resultEl) {
      resultEl.textContent = resFormatted;
      resultEl.style.color = resColor;
      resultEl.style.setProperty('color', resColor, 'important');
    }

    const countEl = document.getElementById('guest-summary-modal-count');
    if (countEl) {
      countEl.textContent = `${dayEntries.length} ${dayEntries.length === 1 ? 'ENTRY' : 'ENTRIES'}`;
    }

    // Sort entries chronologically
    const sortedEntries = [...dayEntries].sort((a, b) => (a.datetime || '').localeCompare(b.datetime || ''));

    // Populate Entries List below
    const listEl = document.getElementById('guest-summary-modal-entries');
    if (listEl) {
      if (sortedEntries.length === 0) {
        listEl.innerHTML = `<div style="text-align:center; padding: 20px; color: #94a3b8; font-size: 0.9rem; font-weight: 700;">No entries found for ${escapeHTML(canonicalName)} on ${displayDate}</div>`;
      } else {
        listEl.innerHTML = sortedEntries.map(e => {
          const t = (e.type || '').toUpperCase();
          const isCredit = isTotalInType(t);
          const typeBorder = isCredit ? '#10b981' : '#ef4444';
          const dtObj = parseEntryDateTime(e.datetime);
          const time = dtObj.time || '—';
          const sentence = getEntrySentence(e, false);

          return `
            <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-left: 3.5px solid ${typeBorder}; border-radius: 6px; padding: 7px 12px; display: flex; align-items: center; gap: 14px; font-family: 'JetBrains Mono', Consolas, monospace; font-size: 0.84rem;">
              <span style="color: #38bdf8; font-weight: 700; min-width: 48px; flex-shrink: 0; letter-spacing: 0.5px;">${time}</span>
              <span style="color: #f1f5f9; font-weight: 600; flex: 1; word-break: break-word;">${escapeHTML(sentence)}</span>
            </div>
          `;
        }).join('');
      }
    }

    modal.style.display = 'flex';
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
  window.openGuestSummaryPopup = openGuestSummaryPopup;

  function closeGuestSummaryPopup() {
    const modal = document.getElementById('guest-summary-modal');
    if (modal) modal.style.display = 'none';
  }

  const btnCloseGuestSummary = document.getElementById('btn-close-guest-summary-modal');
  if (btnCloseGuestSummary) {
    btnCloseGuestSummary.addEventListener('click', closeGuestSummaryPopup);
  }
  const guestSummaryModalEl = document.getElementById('guest-summary-modal');
  if (guestSummaryModalEl) {
    guestSummaryModalEl.addEventListener('click', (e) => {
      if (e.target === guestSummaryModalEl) closeGuestSummaryPopup();
    });
  }
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeGuestSummaryPopup();
    }
  });

  // Open Major Guest Details Modal (forward to unified Guest Summary Popup)
  function openMajorGuestModal(guest, netScore, inOut, entries) {
    const candidateEntries = Array.isArray(entries) && entries.length > 0 ? entries : allEntries.filter(isEntryForToday);
    openGuestSummaryPopup(guest, candidateEntries, currentBusinessDateStr || currentBusinessDate || getBusinessDate());
  }

  function closeMajorGuestModal() {
    const modal = document.getElementById('major-guest-details-modal');
    if (modal) modal.style.display = 'none';
  }

  const btnCloseMajorModal = document.getElementById('btn-close-major-modal');
  if (btnCloseMajorModal) {
    btnCloseMajorModal.addEventListener('click', closeMajorGuestModal);
  }
  const majorGuestModal = document.getElementById('major-guest-details-modal');
  if (majorGuestModal) {
    majorGuestModal.addEventListener('click', (e) => {
      if (e.target === majorGuestModal) closeMajorGuestModal();
    });
  }

  // Track view mode for Major Patron: 'cards' or 'entries_by_guest'
  let majorViewMode = 'cards';

  // Helper: check if type is TOTAL IN (CASHIN OR C/IN, ISSUE, KEY/IN)
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

  // Helper: check if type is TOTAL OUT (CASHOUT OR C/OUT, DEPOSIT, KY/OUT)
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

  // Render Major
  function renderMajor() {
    if(!majorListContainer) return;
    majorListContainer.innerHTML = '';
    const query = majorSearch ? majorSearch.value.trim().toLowerCase() : '';

    // Update toggle button text & icon according to active view mode
    const btnToggleMajor = document.getElementById('btn-toggle-major-view');
    if (btnToggleMajor) {
      btnToggleMajor.className = 'unified-tool-btn' + (majorViewMode === 'entries_by_guest' ? ' active' : '');
      btnToggleMajor.style.background = '';
      btnToggleMajor.style.color = '';
      btnToggleMajor.innerHTML = majorViewMode === 'entries_by_guest'
        ? '<i data-lucide="layout-grid"></i>'
        : '<i data-lucide="list"></i>';
    }

    // CURRENT GAMING DAY ENTRIES: SHOW ALL GUESTS (NO REPEATED GUEST)
    const todayEntries = allEntries.filter(isEntryForToday);
    const currentEntries = todayEntries;
    const guestGroups = [];
    const assignedEntryIds = new Set();

    currentEntries.forEach(e => {
      if (assignedEntryIds.has(e.id)) return;
      const rawGuest = (e.guestname || '').trim();
      if (!rawGuest) return;

      const cluster = getGuestCluster(rawGuest, currentEntries);
      cluster.entries.forEach(ce => assignedEntryIds.add(ce.id));

      let totalIn = 0;
      let totalOut = 0;
      cluster.entries.forEach(ce => {
        const amt = Number(ce.amount) || 0;
        const t = ce.type || '';
        if (isTotalInType(t)) totalIn += amt;
        else if (isTotalOutType(t)) totalOut += amt;
      });

      guestGroups.push({
        name: cluster.canonicalName,
        entries: cluster.entries,
        totalIn,
        totalOut
      });
    });

    let guestList = guestGroups;
    if (query) {
      guestList = guestList.filter(g => g.name.toLowerCase().includes(query));
    }

    // -------------------------------------------------------------
    // MODE 1: ENTRIES BY GUEST NAME VIEW
    // -------------------------------------------------------------
    if (majorViewMode === 'entries_by_guest') {
      // Sort guests alphabetically by name
      guestList.sort((a, b) => a.name.localeCompare(b.name));

      if (guestList.length === 0) {
        majorListContainer.innerHTML = `
          <div class="mp-empty-state" style="margin: auto; width: 100%; max-width: 500px;">
            <i data-lucide="users" style="width:40px;height:40px;opacity:0.4;margin-bottom:8px;"></i>
            <p style="margin: 0; font-size: 1rem;">${query ? 'No matching guests found.' : 'No patron entries recorded today.'}</p>
          </div>
        `;
        lucide.createIcons();
        return;
      }

      let groupsHtml = '';
      guestList.forEach(g => {
        // Result = Total Out minus Total In (NO +/- sign: Red if minus, Fluorescent Green if positive/0)
        const netResult = g.totalOut - g.totalIn;
        const isNegative = netResult < 0;
        const resultColorClass = isNegative ? 'text-red' : 'text-green';
        const formattedResult = formatCurrency(Math.abs(netResult));

        // Sort guest entries chronologically
        const sortedEntries = [...g.entries].sort((a, b) => (a.datetime || '').localeCompare(b.datetime || ''));

        const entriesRows = sortedEntries.map(e => {
          const t = (e.type || '').toUpperCase();
          const isCredit = isTotalInType(t);
          const colorClass = isCredit ? 'text-green' : 'text-red';
          const borderCol = isCredit ? '#10b981' : '#ef4444';
          const time = e.datetime ? e.datetime.replace('T', ' ').slice(11, 16) : '';
          return `
            <div style="background: rgba(255, 255, 255, 0.03); border-left: 3px solid ${borderCol}; border-radius: 6px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; font-size: 0.95rem;">
              <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                <span style="font-size: 0.8rem; color: #94a3b8; font-family: monospace;">${time}</span>
                <span style="font-weight: 700; color: #fff; background: rgba(255,255,255,0.06); padding: 2px 8px; border-radius: 4px;">${escapeHTML(t)}</span>
                ${e.card ? `<span style="font-size: 0.8rem; background: rgba(255,255,255,0.08); padding: 2px 6px; border-radius: 4px; color: #cbd5e1;">${escapeHTML(e.card)}</span>` : ''}
                ${e.otherinfo ? `<span style="font-size: 0.82rem; color: #a78bfa; font-weight: 500;">(${escapeHTML(e.otherinfo)})</span>` : ''}
              </div>
              <div class="${colorClass}" style="font-weight: 800; font-family: monospace; font-size: 1.05rem; white-space: nowrap; margin-left: 12px;">
                ${formatCurrency(e.amount)}
              </div>
            </div>
          `;
        }).join('');

        groupsHtml += `
          <div class="major-guest-group-card" style="flex: 0 0 auto !important; flex-shrink: 0 !important; min-height: 80px; display: flex; flex-direction: column;">
            <!-- Header: Guest Name and In/Out/Result -->
            <div style="padding: 14px 18px; background: rgba(0, 0, 0, 0.3); border-bottom: 1px solid rgba(255, 255, 255, 0.08); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
              <div style="display: flex; align-items: center; gap: 12px;">
                <span style="font-size: 1.2rem; font-weight: 800; color: #fff; letter-spacing: 0.5px;">${escapeHTML(g.name)}</span>
                <span style="font-size: 0.78rem; background: rgba(255,255,255,0.08); padding: 3px 8px; border-radius: 6px; color: #cbd5e1; font-weight: 600;">${g.entries.length} ${g.entries.length === 1 ? 'entry' : 'entries'}</span>
              </div>
              <div style="display: flex; gap: 16px; align-items: center; flex-wrap: wrap;">
                <div style="font-size: 0.88rem;"><span style="color:#94a3b8; font-weight:600;">TOTAL IN:</span> <strong style="color:#38bdf8; font-family:monospace; margin-left:4px;">${formatCurrency(g.totalIn)}</strong></div>
                <div style="font-size: 0.88rem;"><span style="color:#94a3b8; font-weight:600;">TOTAL OUT:</span> <strong style="color:#fb923c; font-family:monospace; margin-left:4px;">${formatCurrency(g.totalOut)}</strong></div>
                <div style="font-size: 0.88rem;"><span style="color:#94a3b8; font-weight:600;">RESULT:</span> <strong class="${resultColorClass}" style="font-family:monospace; font-size: 1.05rem; margin-left:4px;">${formattedResult}</strong></div>
              </div>
            </div>

            <!-- List of All Entries For This Guest -->
            <div class="major-guest-entry-card-list" style="padding: 12px 16px; display: flex; flex-direction: column; gap: 8px; max-height: 280px; overflow-y: auto;">
              ${entriesRows}
            </div>
          </div>
        `;
      });

      majorListContainer.innerHTML = `
        <div class="major-guest-entries-view">
          <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px; padding: 12px 18px; flex-shrink: 0;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <i data-lucide="users" style="width: 20px; height: 20px; color: #a78bfa;"></i>
              <span style="font-weight: 800; font-size: 1rem; color: #fff; letter-spacing: 0.5px;">ALL ENTRIES SORTED BY GUEST NAME</span>
              <span style="font-size: 0.8rem; background: rgba(167, 139, 250, 0.2); color: #c4b5fd; padding: 2px 10px; border-radius: 12px; font-weight: 700;">${guestList.length} Unique ${guestList.length === 1 ? 'Guest' : 'Guests'}</span>
            </div>
            <div style="font-size: 0.85rem; color: #94a3b8;">
              Each guest has one dedicated section with all transactions
            </div>
          </div>
          ${groupsHtml}
        </div>
      `;
      lucide.createIcons();
      return;
    }

    // -------------------------------------------------------------
    // MODE 2: 4-COLUMN CARDS GRID + ABOVE TOTAL 500000 (DEFAULT)
    // -------------------------------------------------------------

    // Sort guests by total turnover descending
    guestList.sort((a, b) => {
      const volA = a.totalIn + a.totalOut;
      const volB = b.totalIn + b.totalOut;
      return volB - volA;
    });

    let leftCardsHtml = '';
    let aboveCardsHtml = '';

    guestList.forEach(g => {
      const totalIn = g.totalIn;
      const totalOut = g.totalOut;
      // Result = Total Out minus Total In
      const netResult = totalOut - totalIn;
      const totalVolume = totalIn + totalOut;

      // If result is minus, make it RED, otherwise GREEN (NO +/- sign)
      const isNegative = netResult < 0;
      const resultColorClass = isNegative ? 'text-red' : 'text-green';
      const formattedResult = formatCurrency(Math.abs(netResult));

      // 4-Column Grid Card on Left (Exactly 1 box per guest name)
      leftCardsHtml += `
        <div class="mp-grid-card" data-guest="${escapeHTML(g.name)}" title="Click to view details for ${escapeHTML(g.name)}">
          <div class="mp-card-name">${escapeHTML(g.name)}</div>
          <div class="mp-card-line">
            <span class="mp-card-lbl">TOTAL IN</span>
            <span class="mp-card-val mp-in">${formatCurrency(totalIn)}</span>
          </div>
          <div class="mp-card-line">
            <span class="mp-card-lbl">TOTAL OUT</span>
            <span class="mp-card-val mp-out">${formatCurrency(totalOut)}</span>
          </div>
          <div class="mp-card-line mp-result-line">
            <span class="mp-card-lbl">RESULT</span>
            <span class="mp-card-val ${resultColorClass}">${formattedResult}</span>
          </div>
        </div>
      `;

      // Check if qualifies for ABOVE TOTAL 490K
      const isAbove490k = totalVolume >= 490000 || totalIn >= 490000 || totalOut >= 490000 || Math.abs(netResult) >= 490000;
      if (isAbove490k) {
        aboveCardsHtml += `
          <div class="mp-above-card" data-guest="${escapeHTML(g.name)}" title="Click to view details for ${escapeHTML(g.name)}">
            <div class="mp-above-name">${escapeHTML(g.name)}</div>
            <div class="mp-above-result-box">
              <span class="mp-above-lbl">RESULT</span>
              <span class="mp-above-val ${resultColorClass}">${formattedResult}</span>
            </div>
          </div>
        `;
      }
    });

    if (!leftCardsHtml) {
      leftCardsHtml = `
        <div class="mp-empty-state">
          <i data-lucide="user-x" style="width:36px;height:36px;opacity:0.4;margin-bottom:8px;"></i>
          <p style="margin: 0;">${query ? 'No matching patrons found.' : 'No patron transactions recorded today.'}</p>
        </div>
      `;
    }

    if (!aboveCardsHtml) {
      aboveCardsHtml = `
        <div class="mp-above-empty">
          <i data-lucide="shield-check" style="width:32px;height:32px;opacity:0.4;margin-bottom:6px;"></i>
          <p style="margin: 0; font-size: 0.85rem;">No patrons above 490,000</p>
        </div>
      `;
    }

    majorListContainer.innerHTML = `
      <div class="major-split-container">
        <!-- Left: 4-Column Grid (with independent scrollbar if many guests) -->
        <div class="major-left-section">
          <div class="major-cards-grid">
            ${leftCardsHtml}
          </div>
        </div>

        <!-- Center Divider -->
        <div class="major-divider"></div>

        <!-- Right: ABOVE TOTAL 490K (with independent scrollbar if many guests) -->
        <div class="major-right-section">
          <div class="major-sidebar-header">
            <i data-lucide="trending-up" style="width: 18px; height: 18px; color: #fbbf24;"></i>
            <span>ABOVE TOTAL 490K</span>
          </div>
          <div class="major-sidebar-list">
            ${aboveCardsHtml}
          </div>
        </div>
      </div>
    `;

    // Click handler for all cards to open transaction details modal
    majorListContainer.querySelectorAll('.mp-grid-card, .mp-above-card').forEach(card => {
      card.addEventListener('click', () => {
        const guestName = card.getAttribute('data-guest');
        if (guestName) {
          openGuestSummaryPopup(guestName, todayEntries, currentBusinessDateStr || currentBusinessDate || getBusinessDate());
        }
      });
    });

    lucide.createIcons();
  }

  // Toggle Major Patron View Button (ONLY in Major Patron)
  const btnToggleMajorView = document.getElementById('btn-toggle-major-view');
  if (btnToggleMajorView) {
    btnToggleMajorView.addEventListener('click', () => {
      majorViewMode = majorViewMode === 'cards' ? 'entries_by_guest' : 'cards';
      renderMajor();
    });
  }

  const btnMajorSearchAction = document.getElementById('btn-major-search-action');
  if (btnMajorSearchAction && majorSearch) {
    btnMajorSearchAction.addEventListener('click', () => {
      if (majorSearch.style.display === 'none' || !majorSearch.style.display) {
        majorSearch.style.display = 'inline-block';
        btnMajorSearchAction.classList.add('active');
        majorSearch.focus();
      } else {
        if (!majorSearch.value) {
          majorSearch.style.display = 'none';
          btnMajorSearchAction.classList.remove('active');
        } else {
          majorSearch.value = '';
          majorSearch.style.display = 'none';
          btnMajorSearchAction.classList.remove('active');
          renderMajor();
        }
      }
    });

    majorSearch.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        majorSearch.value = '';
        majorSearch.style.display = 'none';
        btnMajorSearchAction.classList.remove('active');
        renderMajor();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        renderMajor();
      }
    });
    majorSearch.addEventListener('input', renderMajor);
  }

  const refreshMajorBtn = document.getElementById('refreshMajor');
  if (refreshMajorBtn) {
    refreshMajorBtn.addEventListener('click', () => {
      if (majorSearch) {
        majorSearch.value = '';
        majorSearch.style.display = 'none';
      }
      if (btnMajorSearchAction) btnMajorSearchAction.classList.remove('active');
      renderMajor();
    });
  }

  // Render All Entries
  function renderAllEntries() {
    updateAllEntriesView();
  }

  // Excel Export Helper using SheetJS / xlsx-js-style - DATE WISE 1..31 SHEETS
  // Matching required format: Cyan headers, Ice-blue rows, Guest Summary in Col J, Auto-fit widths
  function formatExcelSentence(entry) {
    const t = (entry.type || '').toUpperCase();
    const amt = formatKCurrency(Number(entry.amount) || 0).toUpperCase();
    const guest = (entry.guestname || 'UNKNOWN').toUpperCase();
    const card = entry.card ? String(entry.card).toUpperCase() : '';
    const info = entry.otherinfo ? ` (${String(entry.otherinfo).toUpperCase()})` : '';

    if (t === 'CASHIN' || t === 'C/IN') return `${amt} CASHIN BY ${guest}${info}`;
    if (t === 'CASHOUT' || t === 'C/OUT') return `${amt} CASHOUT BY ${guest}${info}`;
    if (t === 'ISSUE') return `${amt} ISSUE TO ${guest} FROM ${card} CARD${info}`;
    if (t === 'DEPOSIT') return `${amt} DEPOSIT BY ${guest} ON ${card} CARD${info}`;
    if (t === 'KEYIN') return `${amt} KEYIN BY ${guest}${info}`;
    if (t === 'KEYOUT') return `${amt} KEYOUT BY ${guest}${info}`;
    return `${amt} ${t} BY ${guest}${info}`;
  }

  function buildClientStyledSheet(dayEntries, sheetName = '') {
    dayEntries = Array.isArray(dayEntries) ? dayEntries : [];
    const headers = [
      'DATE', 'TIME', 'TYPE', 'AMOUNT', 'GUEST NAME', 'CARD', 'OTHER INFO', 'SURV ID', 'SENTENCE ENTRIES', 'GUEST SUMMARY'
    ];

    const guestGroups = [];
    const assignedEntryIds = new Set();
    const guestFirstEntryRow = {}; // Map guest uppercase name -> first entry row in column E

    dayEntries.forEach((e, idx) => {
      const rawGuest = (e.guestname || '').trim().toUpperCase();
      if (!rawGuest) return;

      const rowNum = idx + 2; // Row 1 is header
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

    const summaryRows = [];
    const guestCardRowMap = {}; // Maps guest name (canonical and aliases) to J row number in current sheet

    guestGroups.forEach(g => {
      const cardStartRow = 2 + summaryRows.length; // Row where "NAME :- <g.name>" is located in Column J
      guestCardRowMap[g.name] = cardStartRow;
      if (Array.isArray(g.memberNames)) {
        g.memberNames.forEach(m => {
          guestCardRowMap[m] = cardStartRow;
        });
      }

      const netResult = g.totalOut - g.totalIn;
      const isMinus = netResult < 0;
      // NO +/- SIGN: Directly show formatted number, color-coded red for minus, fluorescent green for plus/0
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
    const totalRows = numDataRows + 1;

    // Styles definition - ALL CELLS MIDDLE ALIGNED IN CENTRAL BOX
    const headerStyle = {
      fill: { fgColor: { rgb: '00A2E8' } },
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
      fill: { fgColor: { rgb: 'D9E1F2' } },
      font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: {
        top: { style: 'thin', color: { rgb: '000000' } },
        bottom: { style: 'thin', color: { rgb: '000000' } },
        left: { style: 'thin', color: { rgb: '000000' } },
        right: { style: 'thin', color: { rgb: '000000' } }
      }
    };

    const summaryNameHeaderStyle = {
      fill: { fgColor: { rgb: 'A7F3D0' } }, // Luminous Emerald Glow for Destination
      font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '0000FF' }, underline: true },
      alignment: { vertical: 'center', horizontal: 'center' },
      border: {
        top: { style: 'medium', color: { rgb: '059669' } },
        bottom: { style: 'thin', color: { rgb: '059669' } },
        left: { style: 'medium', color: { rgb: '059669' } },
        right: { style: 'medium', color: { rgb: '059669' } }
      }
    };

    const summaryGreenStyle = {
      fill: { fgColor: { rgb: 'D9EAD3' } },
      font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '000000' } },
      alignment: { vertical: 'center', horizontal: 'center' },
      border: {
        top: { style: 'thin', color: { rgb: '000000' } },
        bottom: { style: 'thin', color: { rgb: '000000' } },
        left: { style: 'thin', color: { rgb: '000000' } },
        right: { style: 'thin', color: { rgb: '000000' } }
      }
    };

    const summaryRedResultStyle = {
      fill: { fgColor: { rgb: 'D9EAD3' } },
      font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: 'FF0000' } },
      alignment: { vertical: 'center', horizontal: 'center' },
      border: {
        top: { style: 'thin', color: { rgb: '000000' } },
        bottom: { style: 'thin', color: { rgb: '000000' } },
        left: { style: 'thin', color: { rgb: '000000' } },
        right: { style: 'thin', color: { rgb: '000000' } }
      }
    };

    const summaryGreenResultStyle = {
      fill: { fgColor: { rgb: 'D9EAD3' } },
      font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '00B050' } },
      alignment: { vertical: 'center', horizontal: 'center' },
      border: {
        top: { style: 'thin', color: { rgb: '000000' } },
        bottom: { style: 'thin', color: { rgb: '000000' } },
        left: { style: 'thin', color: { rgb: '000000' } },
        right: { style: 'thin', color: { rgb: '000000' } }
      }
    };

    const yellowSeparatorStyle = {
      fill: { fgColor: { rgb: 'FFFF00' } },
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
    const colWidths = headers.map(h => h.length);

    headers.forEach((h, cIdx) => {
      ws[`${colLetter[cIdx]}1`] = {
        t: 's',
        v: h,
        s: headerStyle
      };
    });

    for (let r = 0; r < numDataRows; r++) {
      const rowNum = r + 2;
      const entry = dayEntries[r];
      const summary = summaryRows[r];

      let dt = '', tm = '';
      if (entry && entry.datetime) {
        const dtObj = parseEntryDateTime(entry.datetime);
        dt = dtObj.dmy || '';
        tm = dtObj.time || '';
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
        entry ? formatExcelSentence(entry) : ''
      ];

      // Columns A through I - ALL MIDDLE ALIGNED IN CENTRAL BOX
      rowValues.forEach((val, cIdx) => {
        const cellRef = `${colLetter[cIdx]}${rowNum}`;
        const isNum = typeof val === 'number';

        // Hyperlink styling for Guest Name in Excel (Column E, cIdx === 4)
        let cellFont = blueDataStyle.font;
        let cellLink = null;
        if (cIdx === 4 && val) {
          cellFont = { name: 'Calibri', sz: 10, bold: true, color: { rgb: '0000FF' }, underline: true };
          const rawName = String(val).trim().toUpperCase();
          let targetCardRow = guestCardRowMap[rawName];
          if (!targetCardRow) {
            const matchedGroup = guestGroups.find(g => isNameMatch(g.name, rawName) || (g.memberNames && g.memberNames.some(m => isNameMatch(m, rawName))));
            if (matchedGroup) {
              targetCardRow = guestCardRowMap[matchedGroup.name];
            }
          }
          if (targetCardRow) {
            const linkTarget = sheetName ? `#'${sheetName}'!J${targetCardRow}` : `#J${targetCardRow}`;
            cellLink = {
              Target: linkTarget,
              Tooltip: `View ${val} in Guest Summary (J${targetCardRow})`
            };
          }
        }

        ws[cellRef] = {
          t: isNum ? 'n' : 's',
          v: val,
          s: {
            ...blueDataStyle,
            font: cellFont,
            alignment: { horizontal: 'center', vertical: 'center' }
          }
        };

        if (cellLink) {
          ws[cellRef].l = cellLink;
        }

        const valLen = String(val).length;
        if (valLen > colWidths[cIdx]) colWidths[cIdx] = valLen;
      });

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
          const returnTarget = sheetName ? `#'${sheetName}'!E${summary.returnRow}` : `#E${summary.returnRow}`;
          ws[jCellRef].l = {
            Target: returnTarget,
            Tooltip: `Return to entry for ${summary.guestName} (E${summary.returnRow})`
          };
        }

        const sLen = summary.text.length;
        if (sLen > colWidths[9]) colWidths[9] = sLen;
      } else {
        ws[jCellRef] = {
          t: 's',
          v: '',
          s: {
            fill: { fgColor: { rgb: 'D9EAD3' } },
            border: {
              top: { style: 'thin', color: { rgb: '000000' } },
              bottom: { style: 'thin', color: { rgb: '000000' } },
              left: { style: 'thin', color: { rgb: '000000' } },
              right: { style: 'thin', color: { rgb: '000000' } }
            }
          }
        };
      }
    }

    ws['!ref'] = `A1:J${Math.max(totalRows, 2)}`;
    // Auto-fit column widths: max content length + 4 characters padding (minimum 11)
    ws['!cols'] = colWidths.map(w => ({ wch: Math.max(w + 4, 11) }));
    // Auto-fit to page in landscape print / view
    ws['!pageSetup'] = { orientation: 'landscape', fitToWidth: 1, fitToHeight: 0 };

    return ws;
  }

  function exportToExcelDateWise1to31(entriesList, filenamePrefix = 'Surveillance_Export') {
    if (!window.XLSX) {
      alert("Excel library not loaded yet.");
      return;
    }

    // Determine target month from date picker, currentBusinessDate, or today
    const pickerVal = allEntriesDatePicker ? allEntriesDatePicker.value : '';
    let targetYearMonth = pickerVal ? pickerVal.slice(0, 7) : (currentBusinessDateStr ? currentBusinessDateStr.slice(0, 7) : new Date().toISOString().slice(0, 7));

    // Group entries for this month by day 1..31
    const dayGroups = {};
    for (let d = 1; d <= 31; d++) {
      dayGroups[d] = [];
    }

    const sourceData = (Array.isArray(entriesList) && entriesList.length > 0) ? entriesList : allEntries;

    sourceData.forEach(e => {
      const eDate = getEntryDate(e);
      if (eDate && eDate.startsWith(targetYearMonth)) {
        const d = parseInt(eDate.split('-')[2], 10);
        if (d >= 1 && d <= 31) {
          dayGroups[d].push(e);
        }
      }
    });

    const wb = XLSX.utils.book_new();

    // Create exactly 1.......31 sheets in numerical order
    for (let d = 1; d <= 31; d++) {
      const sheetName = String(d);
      const dayEntries = dayGroups[d] || [];
      if (dayEntries.length > 0) {
        dayEntries.sort((a, b) => (a.datetime || '').localeCompare(b.datetime || ''));
      }
      const ws = buildClientStyledSheet(dayEntries, sheetName);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }

    XLSX.writeFile(wb, `${filenamePrefix}_${targetYearMonth}_DateWise_1-31.xlsx`);
  }

  function exportToExcel(entriesToExport, filename = 'Surveillance_Export') {
    exportToExcelDateWise1to31(entriesToExport, filename);
  }

  // View Toggle Logic for All Entries Panel (TABLE, SENTENCE, EXCEL, GUESTWISE)
  const btnViewNormal = document.getElementById('btn-view-normal');
  const btnViewSentence = document.getElementById('btn-view-sentence');
  const btnViewExcel = document.getElementById('btn-view-excel');

  const allEntriesNormalView = document.getElementById('all-entries-normal-view');
  const allEntriesExcelView = document.getElementById('all-entries-excel-view');

  let allEntriesViewMode = 'table'; // 'table', 'sentence', 'excel'

  function switchAllEntriesView(mode) {
    allEntriesViewMode = mode;
    [btnViewNormal, btnViewSentence, btnViewExcel].forEach(btn => {
      if (btn) btn.classList.remove('active');
    });

    if (allEntriesNormalView) allEntriesNormalView.style.setProperty('display', 'none', 'important');
    if (allEntriesListContainer) allEntriesListContainer.style.setProperty('display', 'none', 'important');
    if (allEntriesExcelView) allEntriesExcelView.style.setProperty('display', 'none', 'important');

    if (mode === 'table') {
      if (btnViewNormal) btnViewNormal.classList.add('active');
      if (allEntriesNormalView) allEntriesNormalView.style.setProperty('display', 'block', 'important');
    } else if (mode === 'sentence') {
      if (btnViewSentence) btnViewSentence.classList.add('active');
      if (allEntriesListContainer) allEntriesListContainer.style.setProperty('display', 'block', 'important');
    } else if (mode === 'excel') {
      if (btnViewExcel) btnViewExcel.classList.add('active');
      if (allEntriesExcelView) allEntriesExcelView.style.setProperty('display', 'flex', 'important');
    }

    updateAllEntriesView();
  }

  if (btnViewNormal) btnViewNormal.addEventListener('click', () => switchAllEntriesView('table'));
  if (btnViewSentence) btnViewSentence.addEventListener('click', () => switchAllEntriesView('sentence'));
  if (btnViewExcel) btnViewExcel.addEventListener('click', () => switchAllEntriesView('excel'));

  function exportSingleDateExcelClient(dateStr) {
    if (!window.XLSX) return;
    const parts = (dateStr || '').split('-');
    const dmy = parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : dateStr;
    const dayEntries = allEntries.filter(e => {
      const ed = getEntryDate(e);
      return ed === dateStr;
    });
    dayEntries.sort((a, b) => (a.datetime || '').localeCompare(b.datetime || ''));
    const wb = XLSX.utils.book_new();
    const daySheetName = `Day ${parseInt(parts[2], 10) || 1}`;
    const ws = buildClientStyledSheet(dayEntries, daySheetName);
    XLSX.utils.book_append_sheet(wb, ws, daySheetName);
    XLSX.writeFile(wb, `${dmy}.xlsx`);
  }

  // Unified Export Function: Exports Excel BOTH WAYS (Date-wise & Month-wise 1..31 Sheets)
  async function exportBothExcelFormats(targetDateStr) {
    const targetDate = targetDateStr || (allEntriesDatePicker ? allEntriesDatePicker.value : '') || currentBusinessDateStr || getBusinessDate();
    const parts = targetDate.split('-');
    const year = parts[0];
    const month = parts[1];
    const targetMonth = `${year}-${month}`;
    const dmy = parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : targetDate;

    if (window.showAppNotification) {
      window.showAppNotification(`EXPORTING EXCEL BOTH WAYS (DATE: ${dmy} & MONTHLY: 1..31 SHEETS)...`, 'info');
    }

    // 1. Export Date-Wise Excel (saved to Month Folder on server & downloaded locally)
    try {
      const respDate = await fetch(`/api/export-date?date=${encodeURIComponent(targetDate)}`);
      if (respDate.ok) {
        const blob = await respDate.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${dmy}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        exportSingleDateExcelClient(targetDate);
      }
    } catch (e) {
      console.error('Date export error, using fallback:', e);
      exportSingleDateExcelClient(targetDate);
    }

    // Brief delay to ensure browser handles multiple downloads smoothly
    await new Promise(r => setTimeout(r, 600));

    // 2. Export Monthly Excel (1..31 Sheets workbook in Month Folder & downloaded locally)
    try {
      const respMonth = await fetch(`/api/export-excel?month=${encodeURIComponent(targetMonth)}`);
      if (respMonth.ok) {
        const blob = await respMonth.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const monthNames = [
          'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
          'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
        ];
        const mIdx = parseInt(month, 10) - 1;
        const mName = monthNames[mIdx] || `MONTH_${month}`;
        a.download = `${mName}_${year}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        exportToExcelDateWise1to31(allEntries, 'Surveillance_Export');
      }
    } catch (e) {
      console.error('Month export error, using fallback:', e);
      exportToExcelDateWise1to31(allEntries, 'Surveillance_Export');
    }

    if (window.showAppNotification) {
      const monthNames = [
        'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
        'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
      ];
      const mIdx = parseInt(month, 10) - 1;
      const mName = monthNames[mIdx] || `MONTH_${month}`;
      window.showAppNotification(`SUCCESSFULLY EXPORTED: ${dmy}.XLSX (DATE_WISE) & ${mName}_${year}.XLSX (MONTHLY_WORKBOOK)!`, 'success');
    }
  }

  // ONLY ONE EXPORT BUTTON: Exports BOTH WAYS automatically
  if (btnExportAll) {
    btnExportAll.addEventListener('click', async () => {
      await exportBothExcelFormats();
    });
  }

  // 1. Focus cursor directly to message box
  function focusMessageBox() {
    const quickInput = document.getElementById('officer-quick-input');
    if (quickInput) {
      setTimeout(() => {
        quickInput.focus();
        quickInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 60);
    }
  }

  // 2. Gaming Date & Time live badge: DD-MM-YYYY HH:MM:SS format
  function updateGamingDateDisplay() {
    const gamingDateEl = document.getElementById('all-entries-gaming-date');
    const homeLiveDatetimeEl = document.getElementById('home-live-datetime');
    const dateStr = currentBusinessDateStr || getBusinessDate();
    let formattedDate = dateStr;
    if (dateStr && dateStr.includes('-')) {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        formattedDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    }
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    
    if (gamingDateEl) {
      gamingDateEl.textContent = `${formattedDate} ${hh}:${mm}:${ss} HRS`;
    }
    if (homeLiveDatetimeEl) {
      homeLiveDatetimeEl.textContent = `${formattedDate} ${hh}:${mm}:${ss} HRS`;
    }
  }
  setInterval(updateGamingDateDisplay, 1000);
  updateGamingDateDisplay();

  // 3. Search action button in All Entries toolbar (SEARCH ICON ONLY - NO NEED BOX)
  const btnAllEntriesSearchAction = document.getElementById('btn-all-entries-search-action');
  const allEntriesSearchInput = document.getElementById('all-entries-search');
  if (btnAllEntriesSearchAction && allEntriesSearchInput) {
    btnAllEntriesSearchAction.addEventListener('click', () => {
      if (allEntriesSearchInput.style.display === 'none' || !allEntriesSearchInput.style.display) {
        allEntriesSearchInput.style.display = 'inline-block';
        btnAllEntriesSearchAction.classList.add('active');
        allEntriesSearchInput.focus();
      } else {
        if (!allEntriesSearchInput.value) {
          allEntriesSearchInput.style.display = 'none';
          btnAllEntriesSearchAction.classList.remove('active');
        } else {
          allEntriesSearchInput.value = '';
          allEntriesSearchInput.style.display = 'none';
          btnAllEntriesSearchAction.classList.remove('active');
          updateAllEntriesView();
        }
      }
    });
    allEntriesSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        allEntriesSearchInput.value = '';
        allEntriesSearchInput.style.display = 'none';
        btnAllEntriesSearchAction.classList.remove('active');
        updateAllEntriesView();
      }
    });
  }

  // 3b. Home Screen Toolbar View Modes: TABLE, SENTENCE, EXCEL & Date & Search Toggle
  let homeViewMode = 'table'; // 'table', 'sentence', 'excel'
  let homeSelectedDate = '';

  const btnHomeViewTable = document.getElementById('btn-home-view-table');
  const btnHomeViewSentence = document.getElementById('btn-home-view-sentence');
  const btnHomeViewExcel = document.getElementById('btn-home-view-excel');
  const homeTableView = document.getElementById('home-table-view');
  const homeSentenceView = document.getElementById('home-sentence-view');
  const homeExcelView = document.getElementById('home-excel-view');
  const homeDatePicker = document.getElementById('home-datepicker');
  const btnHomeSearchToggle = document.getElementById('btn-home-search-toggle');

  function switchHomeView(mode) {
    homeViewMode = mode;
    [btnHomeViewTable, btnHomeViewSentence, btnHomeViewExcel].forEach(btn => {
      if (btn) btn.classList.remove('active');
    });
    if (homeTableView) homeTableView.style.display = 'none';
    if (homeSentenceView) homeSentenceView.style.display = 'none';
    if (homeExcelView) homeExcelView.style.display = 'none';

    if (mode === 'table') {
      if (btnHomeViewTable) btnHomeViewTable.classList.add('active');
      if (homeTableView) homeTableView.style.display = 'block';
    } else if (mode === 'sentence') {
      if (btnHomeViewSentence) btnHomeViewSentence.classList.add('active');
      if (homeSentenceView) homeSentenceView.style.display = 'block';
    } else if (mode === 'excel') {
      if (btnHomeViewExcel) btnHomeViewExcel.classList.add('active');
      if (homeExcelView) homeExcelView.style.display = 'flex';
    }
    renderEntries(allEntries, { limit: CURRENT_ENTRY_LIMIT, isArchive: false });
  }

  if (btnHomeViewTable) btnHomeViewTable.addEventListener('click', () => switchHomeView('table'));
  if (btnHomeViewSentence) btnHomeViewSentence.addEventListener('click', () => switchHomeView('sentence'));
  if (btnHomeViewExcel) btnHomeViewExcel.addEventListener('click', () => switchHomeView('excel'));

  if (homeDatePicker) {
    homeDatePicker.addEventListener('change', () => {
      homeSelectedDate = homeDatePicker.value;
      renderEntries(allEntries, { limit: CURRENT_ENTRY_LIMIT, isArchive: false });
    });
  }

  if (btnHomeSearchToggle && tableSearchInput) {
    btnHomeSearchToggle.addEventListener('click', () => {
      if (tableSearchInput.style.display === 'none' || !tableSearchInput.style.display) {
        tableSearchInput.style.display = 'inline-block';
        btnHomeSearchToggle.classList.add('active');
        tableSearchInput.focus();
      } else {
        tableSearchInput.style.display = 'none';
        tableSearchInput.value = '';
        btnHomeSearchToggle.classList.remove('active');
        renderEntries(allEntries, { limit: CURRENT_ENTRY_LIMIT, isArchive: false });
      }
    });
    tableSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        tableSearchInput.value = '';
        tableSearchInput.style.display = 'none';
        btnHomeSearchToggle.classList.remove('active');
        renderEntries(allEntries, { limit: CURRENT_ENTRY_LIMIT, isArchive: false });
      }
    });
  }

  // 4. Calculate next gaming date YYYY-MM-DD
  function getNextGamingDate(baseDateStr) {
    const curStr = baseDateStr || currentBusinessDateStr || getBusinessDate();
    let dObj;
    if (curStr && curStr.includes('-')) {
      const [y, m, d] = curStr.split('-').map(Number);
      dObj = new Date(y, m - 1, d);
    } else {
      dObj = new Date();
    }
    dObj.setDate(dObj.getDate() + 1);
    const ny = dObj.getFullYear();
    const nm = String(dObj.getMonth() + 1).padStart(2, '0');
    const nd = String(dObj.getDate()).padStart(2, '0');
    return `${ny}-${nm}-${nd}`;
  }

  // 5. New Day sub button on Home Page - symbol only
  const btnNewDay = document.getElementById('btn-new-day');
  const newDayModal = document.getElementById('new-day-modal');
  const btnCancelNewDay = document.getElementById('btn-cancel-new-day');
  const btnConfirmNewDay = document.getElementById('btn-confirm-new-day');
  const newDayDateInput = document.getElementById('new-day-date-input');
  const newDayModalDesc = document.getElementById('new-day-modal-desc');

  if (btnNewDay) {
    btnNewDay.addEventListener('click', () => {
      const nextDate = getNextGamingDate();
      const curDate = currentBusinessDateStr || getBusinessDate();
      let curFormatted = curDate;
      if (curDate && curDate.includes('-')) {
        const p = curDate.split('-');
        if (p.length === 3) curFormatted = `${p[2]}-${p[1]}-${p[0]}`;
      }
      const curDayNum = parseInt(curDate.split('-')[2], 10);

      if (newDayDateInput) newDayDateInput.value = nextDate;
      if (newDayModalDesc) {
        newDayModalDesc.textContent = `Ending gaming date ${curFormatted}. Active entries will be archived, saved to Sheet ${curDayNum} in Excel, and exported locally.`;
      }
      if (newDayModal) {
        newDayModal.style.setProperty('display', 'flex', 'important');
      }
      if (window.lucide) lucide.createIcons();
    });
  }

  if (btnCancelNewDay) {
    btnCancelNewDay.addEventListener('click', () => {
      if (newDayModal) newDayModal.style.setProperty('display', 'none', 'important');
    });
  }

  if (btnConfirmNewDay) {
    btnConfirmNewDay.addEventListener('click', async () => {
      const newDateVal = newDayDateInput ? newDayDateInput.value : '';
      if (!newDateVal) {
        alert('Please choose a valid next date.');
        return;
      }

      const oldDate = currentBusinessDateStr || getBusinessDate();
      const oldDayNum = parseInt(oldDate.split('-')[2], 10);

      // Export previous day entries in Excel BOTH WAYS (Date-wise in Month folder & Month-wise 31 sheets)
      try {
        await exportBothExcelFormats(oldDate);
      } catch (eErr) {
        console.error('Error during Excel export on New Day:', eErr);
      }

      // Call server /api/newday to archive old entries and advance business date
      try {
        const resp = await fetch('/api/newday', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newDate: newDateVal })
        });
        const result = await resp.json();

        currentBusinessDateStr = newDateVal;
        currentBusinessDate = newDateVal;
        if (newDayModal) newDayModal.style.setProperty('display', 'none', 'important');

        // Re-fetch entries: active list is now clean for the new day
        await fetchEntries();

        // Update gaming date display
        updateGamingDateDisplay();

        // Navigate to Home panel and directly focus cursor to message box
        showHomePanel();
        focusMessageBox();

        let oldDateFmt = oldDate;
        if (oldDate.includes('-')) {
          const p = oldDate.split('-');
          oldDateFmt = `${p[2]}-${p[1]}-${p[0]}`;
        }
        let newDateFmt = newDateVal;
        if (newDateVal.includes('-')) {
          const p = newDateVal.split('-');
          newDateFmt = `${p[2]}-${p[1]}-${p[0]}`;
        }

        alert(`NEW DAY STARTED!\nGAMING DATE: ${newDateFmt}\nPREVIOUS ENTRIES FROM ${oldDateFmt} EXPORTED BOTH WAYS (DATE-WISE & MONTH-WISE IN MONTH FOLDER).`);
      } catch (err) {
        alert('Error starting new day: ' + err.message);
      }
    });
  }

  if(btnExportAdmin) {
 if (btnExportAdmin) btnExportAdmin.addEventListener('click', () => {
      exportToExcel(allEntries, 'Surveillance_Active_Export');
    });
  }

  // Admin Send List
  function renderAdminSendList() {
    if(!adminSendList) return;
    adminSendList.innerHTML = '';
    
    // Recalculate major entries
    const guestTotals = {};

    allEntries.forEach(e => {
      if(!isEntryForToday(e)) return;
      const g = (e.guestname || 'Unknown').trim();
      const t = (e.type || '').toUpperCase();
      let amt = Number(e.amount) || 0;
      
      if(guestTotals[g] === undefined) { guestTotals[g] = 0; }
      
      // Calculate RESULT = OUT - IN
      if (['CASHOUT', 'DEPOSIT', 'KEYOUT'].includes(t)) {
        guestTotals[g] += amt;
      } else if (['CASHIN', 'ISSUE', 'KEYIN'].includes(t)) {
        guestTotals[g] -= amt;
      }
    });

    for (const [g, result] of Object.entries(guestTotals)) {
      if (Math.abs(result) > 49000) {
        let resultStr = formatCurrency(Math.abs(result));
        if (result < 0) {
          resultStr = "-" + resultStr;
        } else if (result > 0) {
          resultStr = "+" + resultStr;
        }
        
        const row = document.createElement('div');
        row.className = 'send-item-row';
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        
        const textSpan = document.createElement('span');
        textSpan.className = 'send-item-text';
        textSpan.innerHTML = `<strong>${escapeHTML(g)}</strong>: <span class="${result < 0 ? 'text-red' : 'text-green'}">${resultStr}</span>`;
        
        const delBtn = document.createElement('button');
        delBtn.className = 'btn-delete-item';
        delBtn.innerHTML = '<i data-lucide="x"></i>';
        delBtn.onclick = () => {
          row.remove();
        };

        row.appendChild(textSpan);
        row.appendChild(delBtn);
        adminSendList.appendChild(row);
      }
    }
    lucide.createIcons();
  }

  // Admin SEND copy logic
  if(btnAdminSend) {
 if (btnAdminSend) btnAdminSend.addEventListener('click', () => {
      const rows = adminSendList.querySelectorAll('.send-item-text');
      if(rows.length === 0) {
        alert("Nothing to send.");
        return;
      }
      let finalString = "MAJOR PATRON SUMMARY:\n";
      rows.forEach(r => {
        finalString += r.textContent + "\n";
      });
      navigator.clipboard.writeText(finalString).then(() => {
        alert("Summary copied to clipboard!");
      }).catch(err => {
        alert("Failed to copy to clipboard. Check permissions.");
        console.error(err);
      });
    });
  }

  // Populate datalists for Card, OtherInfo, and GuestName from existing entries (most recently used first)
  function populateDataLists(entries) {
    const guests = [];
    const cards = [];
    const others = [];

    // entries is sorted newest first, so iterating collects most recent unique values first
    entries.forEach(e => {
      const guestVal = (e.guestname || '').trim();
      const cardVal = (e.card || '').trim();
      const otherinfoVal = (e.otherinfo || '').trim();

      if (guestVal && !guests.includes(guestVal)) guests.push(guestVal);
      if (cardVal && !cards.includes(cardVal)) cards.push(cardVal);
      if (otherinfoVal && !others.includes(otherinfoVal)) others.push(otherinfoVal);
    });

    const guestnameList = document.getElementById('guestname-options-grid');
    const cardList = document.getElementById('card-options-grid');
    const otherInfoList = document.getElementById('otherinfo-options-grid');
    if (guestnameList) {
      guestnameList.innerHTML = guests.map(v => `<div class="inline-option-item">${escapeHTML(v)}</div>`).join('');
    }
    if (cardList) {
      cardList.innerHTML = cards.map(v => `<div class="inline-option-item">${escapeHTML(v)}</div>`).join('');
    }
    if (otherInfoList) {
      otherInfoList.innerHTML = others.map(v => `<div class="inline-option-item">${escapeHTML(v)}</div>`).join('');
    }

  }

  // Handle click on any inline-option-item to populate the corresponding input
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('inline-option-item')) {
      const value = e.target.getAttribute('data-value') || e.target.textContent;
      const formGroup = e.target.closest('.form-group');
      if (formGroup) {
        const input = formGroup.querySelector('input[type="text"]');
        if (input) {
          input.value = value;
          input.focus(); // Focus the input back so pressing Enter works immediately!
          // Trigger the 'input' event manually so things like checkBarredGuest can fire
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    }
  });

  // Reusable styled spreadsheet grid renderer (Column A..J, Cyan headers, Ice-blue rows, Guest summary)
  function renderStyledExcelGrid(entries, containerEl, titlePill = 'HOME') {
    if (!containerEl) return;
    let totalAmt = 0;
    (entries || []).forEach(e => { totalAmt += (Number(e.amount) || 0); });

    const safeEntries = Array.isArray(entries) ? entries : [];
    const guestGroups = [];
    const assignedEntryIds = new Set();

    safeEntries.forEach(e => {
      if (assignedEntryIds.has(e.id)) return;
      const rawGuest = (e.guestname || '').trim();
      if (!rawGuest) return;

      const cluster = getGuestCluster(rawGuest, safeEntries);
      cluster.entries.forEach(ce => assignedEntryIds.add(ce.id));

      let totalIn = 0;
      let totalOut = 0;
      cluster.entries.forEach(ce => {
        const amt = Number(ce.amount) || 0;
        const t = ce.type || '';
        if (isTotalInType(t)) totalIn += amt;
        else if (isTotalOutType(t)) totalOut += amt;
      });

      guestGroups.push({
        name: cluster.canonicalName,
        totalIn,
        totalOut
      });
    });

    guestGroups.sort((a, b) => a.name.localeCompare(b.name));

    const summaryRows = [];
    guestGroups.forEach(g => {
      const netResult = g.totalOut - g.totalIn;
      const isMinus = netResult < 0;
      // NO +/- SIGN: Directly show formatted number, color-coded red for minus, fluorescent green for plus/0
      const resFormatted = Math.abs(netResult).toLocaleString('en-IN');

      summaryRows.push({
        guestName: g.name,
        html: `<td class="cell-guest-info guest-summary-cell" data-summary-guest="${escapeHTML(g.name)}" data-summary-part="header" style="text-align:center; vertical-align:middle;">NAME :- <a href="javascript:void(0)" class="clickable-guest-summary-name" data-guest="${escapeHTML(g.name)}" style="color: #0000FF !important; cursor: pointer; text-decoration: underline; font-weight: 800;">${escapeHTML(g.name)}</a></td>`
      });
      summaryRows.push({
        guestName: g.name,
        html: `<td class="cell-guest-info guest-summary-cell" data-summary-guest="${escapeHTML(g.name)}" data-summary-part="in" style="text-align:center; vertical-align:middle;">TOTAL IN :- ${g.totalIn.toLocaleString('en-IN')}</td>`
      });
      summaryRows.push({
        guestName: g.name,
        html: `<td class="cell-guest-info guest-summary-cell" data-summary-guest="${escapeHTML(g.name)}" data-summary-part="out" style="text-align:center; vertical-align:middle;">TOTAL OUT :- ${g.totalOut.toLocaleString('en-IN')}</td>`
      });
      summaryRows.push({
        guestName: g.name,
        html: `<td class="${isMinus ? 'cell-guest-result-minus' : 'cell-guest-result-plus'} guest-summary-cell" data-summary-guest="${escapeHTML(g.name)}" data-summary-part="result" style="text-align:center; vertical-align:middle; font-weight:800; color: ${isMinus ? '#FF0000' : '#00B050'} !important;">RESULT :- ${resFormatted}</td>`
      });
      summaryRows.push({
        guestName: null,
        html: `<td class="cell-guest-separator"></td>`
      });
    });

    const maxRows = Math.max((entries || []).length, summaryRows.length);
    let excelRowsHtml = '';

    for (let r = 0; r < maxRows; r++) {
      const entry = (entries || [])[r];
      const summary = summaryRows[r];

      let dt = '—', tm = '—';
      if (entry && entry.datetime) {
        const dtObj = parseEntryDateTime(entry.datetime);
        dt = dtObj.dmy || '—';
        tm = dtObj.time || '—';
      }

      const type = entry ? (entry.type || '').toUpperCase() : '';
      const amt = entry ? (Number(entry.amount) || 0).toLocaleString('en-IN') : '';
      const guest = entry ? (entry.guestname || '').toUpperCase() : '';
      const card = entry && entry.card ? String(entry.card) : '';
      const otherinfo = entry && entry.otherinfo ? entry.otherinfo : '';
      const surv = entry && entry.surv ? entry.surv : '';
      const sentence = entry ? getEntrySentence(entry) : '';

      let canonicalGuest = guest;
      if (entry && guest) {
        const cluster = getGuestCluster(guest, safeEntries);
        if (cluster && cluster.canonicalName) canonicalGuest = cluster.canonicalName;
      }

      const colJHtml = summary ? summary.html : `<td class="cell-guest-info" style="text-align:center; vertical-align:middle;"></td>`;

      excelRowsHtml += `
        <tr class="excel-data-row" data-row-guest="${escapeHTML(canonicalGuest)}">
          <td class="excel-row-num col-idx" style="text-align:center; vertical-align:middle; font-weight:800;">${r + 1}</td>
          <td class="cell-blue col-date" style="text-align:center; vertical-align:middle; font-weight:800;">${entry ? dt : ''}</td>
          <td class="cell-blue col-time" style="text-align:center; vertical-align:middle; font-weight:800;">${entry ? tm : ''}</td>
          <td class="cell-blue col-type" style="text-align:center; vertical-align:middle; font-weight:800;">${entry ? escapeHTML(type) : ''}</td>
          <td class="cell-blue col-amount" style="text-align:center; vertical-align:middle; font-weight:800;">${entry ? amt : ''}</td>
          <td class="cell-blue col-guest" data-guest="${escapeHTML(canonicalGuest)}" style="text-align:center; vertical-align:middle; font-weight:800;">${entry && guest ? `<a href="javascript:void(0)" class="clickable-guest-name" data-guest="${escapeHTML(canonicalGuest)}" style="color: #0000FF !important; cursor:pointer; text-decoration:underline; font-weight:800;">${escapeHTML(guest)}</a>` : ''}</td>
          <td class="cell-blue col-card" style="text-align:center; vertical-align:middle; font-weight:800;">${entry ? escapeHTML(card) : ''}</td>
          <td class="cell-blue col-other" style="text-align:center; vertical-align:middle; font-weight:800;">${entry ? escapeHTML(otherinfo) : ''}</td>
          <td class="cell-blue col-surv" style="text-align:center; vertical-align:middle; font-weight:800;">${entry ? escapeHTML(surv) : ''}</td>
          <td class="cell-blue col-sentence" style="text-align:center; vertical-align:middle; font-weight:800;">${entry ? escapeHTML(sentence) : ''}</td>
          ${colJHtml}
        </tr>
      `;
    }

    const tableHtml = `
      <div class="excel-table-wrapper">
        <table class="excel-table">
          <thead>
            <tr>
              <th class="excel-row-num col-idx">#</th>
              <th class="col-cyan col-date">DATE</th>
              <th class="col-cyan col-time">TIME</th>
              <th class="col-cyan col-type">TYPE</th>
              <th class="col-cyan col-amount">AMOUNT</th>
              <th class="col-cyan col-guest">GUEST NAME</th>
              <th class="col-cyan col-card">CARD</th>
              <th class="col-cyan col-other">OTHER INFO</th>
              <th class="col-cyan col-surv">SURV ID</th>
              <th class="col-cyan col-sentence">SENTENCE ENTRIES</th>
              <th class="col-cyan col-summary">GUEST SUMMARY</th>
            </tr>
          </thead>
          <tbody>
            ${excelRowsHtml}
          </tbody>
        </table>
      </div>
    `;

    containerEl.innerHTML = tableHtml;

    // Selected Guest Glow & Smooth Scroll Controller
    function selectAndGlowGuest(targetGuestName, fromSource) {
      if (!targetGuestName) return;
      const cleanTarget = targetGuestName.trim().toUpperCase();

      // Clear previous active glows
      containerEl.querySelectorAll('.guest-cell-selected-glow').forEach(el => el.classList.remove('guest-cell-selected-glow'));
      containerEl.querySelectorAll('.guest-row-selected-glow').forEach(el => el.classList.remove('guest-row-selected-glow'));
      containerEl.querySelectorAll('.guest-summary-card-glow').forEach(el => el.classList.remove('guest-summary-card-glow', 'card-header-glow', 'card-footer-glow'));

      // 1. Highlight all matching data rows and Column E guest cells
      const matchingRows = [];
      const matchingGuestCells = [];
      containerEl.querySelectorAll('tr[data-row-guest]').forEach(tr => {
        const rowGuest = (tr.getAttribute('data-row-guest') || '').trim().toUpperCase();
        if (rowGuest && (rowGuest === cleanTarget || isNameMatch(rowGuest, cleanTarget))) {
          tr.classList.add('guest-row-selected-glow');
          matchingRows.push(tr);
          const gCell = tr.querySelector('.col-guest');
          if (gCell) {
            gCell.classList.add('guest-cell-selected-glow');
            matchingGuestCells.push(gCell);
          }
        }
      });

      // 2. Highlight matching summary card in Column J
      const summaryCells = [];
      containerEl.querySelectorAll('td[data-summary-guest]').forEach(td => {
        const sg = (td.getAttribute('data-summary-guest') || '').trim().toUpperCase();
        if (sg && (sg === cleanTarget || isNameMatch(sg, cleanTarget))) {
          td.classList.add('guest-summary-card-glow');
          const part = td.getAttribute('data-summary-part');
          if (part === 'header') td.classList.add('card-header-glow');
          if (part === 'result') td.classList.add('card-footer-glow');
          summaryCells.push(td);
        }
      });

      // 3. Smooth scroll to destination
      if (fromSource === 'data' && summaryCells.length > 0) {
        summaryCells[0].scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      } else if (fromSource === 'summary' && matchingRows.length > 0) {
        matchingRows[0].scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      }
    }

    // Attach click listeners to guest names in Column E -> Jump & Glow in Column J Summary
    containerEl.querySelectorAll('.clickable-guest-name').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const gName = link.getAttribute('data-guest');
        if (!gName) return;
        selectAndGlowGuest(gName, 'data');
      });
      // Double click opens the detailed guest modal
      link.addEventListener('dblclick', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const gName = link.getAttribute('data-guest');
        if (!gName) return;
        const activeDate = homeSelectedDate || (allEntriesDatePicker ? allEntriesDatePicker.value : null) || currentBusinessDateStr || currentBusinessDate || getBusinessDate();
        openGuestSummaryPopup(gName, safeEntries, activeDate);
      });
    });

    // Attach click listeners to guest summary headers in Column J -> Jump & Glow back to Column E Data Row
    containerEl.querySelectorAll('.clickable-guest-summary-name').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const gName = link.getAttribute('data-guest');
        if (!gName) return;
        selectAndGlowGuest(gName, 'summary');
      });
      // Double click opens the detailed guest modal
      link.addEventListener('dblclick', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const gName = link.getAttribute('data-guest');
        if (!gName) return;
        const activeDate = homeSelectedDate || (allEntriesDatePicker ? allEntriesDatePicker.value : null) || currentBusinessDateStr || currentBusinessDate || getBusinessDate();
        openGuestSummaryPopup(gName, safeEntries, activeDate);
      });
    });
  }

  // Render entry rows in table
  function renderEntries(entries, options = {}) {
    try {
      const { limit, isArchive } = options;
      
      // Filter to today's business session or homeSelectedDate
      let processedEntries = Array.isArray(entries) ? entries.filter(e => {
        if (homeSelectedDate) {
          const eDate = getEntryDate(e);
          return eDate === homeSelectedDate;
        }
        return isEntryForToday(e);
      }) : [];

      // Sort by latest first
      processedEntries.sort((a, b) => new Date(b.datetime) - new Date(a.datetime));

      const displayEntries = processedEntries.slice(0, limit || processedEntries.length);

      if (!isArchive) {
        if (recordCountBadge) {
          // COUNT ONLY: REMOVED RECORD NAME
          recordCountBadge.textContent = `${displayEntries.length}`;
        }
      }

      if (displayEntries.length === 0) {
        logsTableBody.innerHTML = `
          <tr>
            <td colspan="10" class="no-records-row">
              <div class="empty-state">
                <i data-lucide="inbox"></i>
                <p>No records found matching the filter.</p>
              </div>
            </td>
          </tr>
        `;
        if (homeSentenceView) {
          homeSentenceView.innerHTML = `
            <div class="empty-state">
              <i data-lucide="inbox"></i>
              <p>No records found matching the filter.</p>
            </div>
          `;
        }
        if (homeExcelView) {
          renderStyledExcelGrid([], homeExcelView, homeSelectedDate ? `Date: ${homeSelectedDate}` : 'TODAY');
        }
        lucide.createIcons();
        return;
      }

    // Determine badge class/label based on Type
    function getTypeBadge(type) {
      const t = (type || '').toUpperCase();
      if (CREDIT_TYPES.includes(t)) return { cls: 'badge-credit', label: type };
      if (DEBIT_TYPES.includes(t)) return { cls: 'badge-debit', label: type };
      return { cls: 'badge-synced', label: type };
    }

    let html = '';
    displayEntries.forEach(entry => {
      const displayDate = entry.datetime ? entry.datetime.replace('T', ' ') : 'N/A';
      const cdText = escapeHTML(entry.cd || '—');
      const typeBadge = getTypeBadge(entry.type);
      const amtClass = CREDIT_TYPES.includes((entry.type || '').toUpperCase()) ? 'text-green' : 'text-red';
      const amtFormatted = formatCurrency(Number(entry.amount) || 0);
      const actionButtons = isArchive
        ? '<span class="archive-note">Archive read-only</span>'
        : `
            <div style="display:flex;gap:4px;align-items:center;">
              <button class="btn-edit-entry" data-id="${entry.id}" title="Edit"
                style="background:rgba(59,130,246,0.18);color:#60a5fa;border:1px solid rgba(59,130,246,0.4);border-radius:5px;width:24px;height:24px;padding:0;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:all 0.15s ease;">
                <i data-lucide="edit-2" style="width:12px;height:12px;pointer-events:none;"></i>
              </button>
              <button class="btn-delete-entry" data-id="${entry.id}" title="Delete"
                style="background:rgba(239,68,68,0.18);color:#f87171;border:1px solid rgba(239,68,68,0.4);border-radius:5px;width:24px;height:24px;padding:0;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:all 0.15s ease;">
                <i data-lucide="trash-2" style="width:12px;height:12px;pointer-events:none;"></i>
              </button>
            </div>
          `;

      html += `
        <tr>
          <td><strong>${displayDate}</strong></td>
          <td><span class="badge ${typeBadge.cls}">${typeBadge.label}</span></td>
          <td class="table-amount ${amtClass}">${amtFormatted}</td>
          <td><span class="clickable-guest-name" data-guest="${escapeHTML(entry.guestname || '')}" style="cursor:pointer; color:#60a5fa; text-decoration:underline;">${escapeHTML(entry.guestname || '—')}</span></td>
          <td>${(() => {
            const rowType = (entry.type||'').toUpperCase();
            const showCard = ['ISSUE','DEPOSIT'].includes(rowType);
            return showCard
              ? `<code>${entry.card ? escapeHTML(entry.card) : '—'}</code>`
              : `<span style="color:var(--text-muted)">—</span>`;
          })()}</td>
          <td title="${escapeHTML(entry.otherinfo || '')}">
            <div style="max-width:200px;overflow:hidden;text-overflow:ellipsis;">
              ${entry.otherinfo ? escapeHTML(entry.otherinfo) : '<span style="color:var(--text-muted)">—</span>'}
            </div>
          </td>
          <td>
            ${actionButtons}
          </td>
        </tr>
      `;
    });

    logsTableBody.innerHTML = html;

    // Render Home Sentence View
    if (homeSentenceView) {
      if (displayEntries.length === 0) {
        homeSentenceView.innerHTML = `
          <div class="empty-state">
            <i data-lucide="inbox"></i>
            <p>No records found matching the filter.</p>
          </div>
        `;
      } else {
        homeSentenceView.innerHTML = `<ul class="sentence-list">` + 
          displayEntries.map(e => `<li class="sentence-item ${(e.type||'').toLowerCase().replace('/', '-')}">${getEntrySentence(e, true)}</li>`).join('') +
          `</ul>`;
      }
    }

    // Render Home Excel View
    if (homeExcelView) {
      renderStyledExcelGrid(displayEntries, homeExcelView, homeSelectedDate ? `Date: ${homeSelectedDate}` : 'TODAY');
    }

    lucide.createIcons();

    // Attach Clickable Guest Name listeners to open Guest Summary Popup (Table & Sentence view)
    const homeArea = document.getElementById('home-display-area');
    if (homeArea) {
      homeArea.querySelectorAll('.clickable-guest-name')?.forEach(span => {
        span.addEventListener('click', (e) => {
          e.stopPropagation();
          const gName = span.getAttribute('data-guest');
          if (!gName) return;
          const dayFilter = homeSelectedDate || currentBusinessDateStr || currentBusinessDate || getBusinessDate();
          const candidateEntries = allEntries.filter(entry => {
            const eDate = getEntryDate(entry);
            return eDate === dayFilter;
          });
          openGuestSummaryPopup(gName, candidateEntries, dayFilter);
        });
      });
    }

    // Attach Edit listeners
    logsTableBody.querySelectorAll('.btn-edit-entry')?.forEach(btn => {
      btn.addEventListener('click', () => {
        const idAttr = btn.getAttribute('data-id');
        const entry = allEntries.find(e => String(e.id) === String(idAttr) || e.id == idAttr);
        if (entry) editEntry(entry);
      });
    });

    // Attach Delete listeners
    logsTableBody.querySelectorAll('.btn-delete-entry')?.forEach(btn => {
      btn.addEventListener('click', async () => {
        const idAttr = btn.getAttribute('data-id');
        if (!(await showAppConfirm('Are you sure you want to delete this entry?'))) return;
        try {
          // Instant in-memory removal
          allEntries = allEntries.filter(e => String(e.id) !== String(idAttr) && e.id != idAttr);
          window.allEntries = allEntries;
          if (typeof renderEntries === 'function') renderEntries(allEntries, { limit: CURRENT_ENTRY_LIMIT, isArchive: false });
          if (typeof updateAllEntriesView === 'function') updateAllEntriesView();
          showAppNotification('Entry deleted successfully.', 'success');

          // Fast direct delete call
          fetch(`/api/entries?id=${encodeURIComponent(idAttr)}`, { method: 'DELETE' }).catch(e => console.error(e));
        } catch (err) {
          showAppNotification(`Error deleting entry: ${err.message}`, 'error');
        }
      });
    });

    } catch (err) {
      console.error("renderEntries Error: ", err);
      logsTableBody.innerHTML = `
        <tr>
          <td colspan="9" class="no-records-row">
            <div class="empty-state">
              <i data-lucide="alert-triangle"></i>
              <p>Failed to render entries: ${err.message}</p>
            </div>
          </td>
        </tr>
      `;
      lucide.createIcons();
    }
  }

  // Named submission function to allow clean keyboard and click triggers
  async function handleEntrySubmit(e, skipQuickSave = false) {
    if (e) e.preventDefault();

    const datetime = inputDateTime.value;
    const cd = (inputCD && inputCD.value) ? inputCD.value.toUpperCase() : 'CD-01';
    const cashier = (inputCashier && inputCashier.value) ? inputCashier.value.trim().toUpperCase() : '-';
    let type = inputType.value.trim().toUpperCase();
    if (type === 'C/IN') type = 'CASHIN';
    if (type === 'C/OUT') type = 'CASHOUT';

    const amount = inputAmount.value;
    const guestname = inputGuestName.value.trim().toUpperCase();
    const card = inputCard.value.trim().toUpperCase();
    const otherinfo = inputOtherInfo.value.trim().toUpperCase();
    const surv = inputSurv.value.toUpperCase();

    if (!datetime || !type || !amount || !guestname || !surv) {
      alert('Please fill out all required fields.');
      return;
    }

    // Check if guest is barred before submitting
    if (guestname && !skipQuickSave) {
      const match = await ensureCheckBarredGuest(guestname);
      if (match) {
        await showBarredWarningPopup(match, guestname);
      }
    }

    btnSave.classList.add('loading');

    const now = Date.now();
    const entryPayload = {
      id: editingEntryId !== null ? editingEntryId : now,
      datetime,
      cd: cd || 'CD-01',
      cashier: cashier || '-',
      type,
      amount: parseFloat(amount.replace(/,/g, '')),
      guestname,
      card,
      otherinfo,
      surv,
      businessDate: currentBusinessDateStr || currentBusinessDate || getBusinessDate(),
      archived: false,
      modifiedAt: now
    };

    // If new entry, optimistically update UI instantly with 0ms waiting
    if (editingEntryId === null) {
      allEntries.unshift(entryPayload);
      window.allEntries = allEntries;
      renderEntries(allEntries, { limit: CURRENT_ENTRY_LIMIT, isArchive: false });
      calculateStatistics(allEntries.filter(isEntryForToday));
      populateDataLists(allEntries);
      if (typeof renderMajor === 'function') renderMajor();
      if (typeof updateAllEntriesView === 'function') updateAllEntriesView();
      resetFormInputs();
      closeLogModal();
    }

    try {
      if (editingEntryId !== null) {
        // UPDATE existing entry
        const response = await fetch(`/api/entries?id=${editingEntryId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...entryPayload, id: editingEntryId })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to save entry.');
        resetFormInputs();
        closeLogModal();
        await fetchEntries();
      } else {
        // CREATE new entry in background (Already optimistically rendered)
        fetch('/api/entries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entryPayload)
        }).catch(err => console.error('Save entry background error:', err));
      }
    } catch (err) {
      console.error(err);
      alert(`Error saving entry: ${err.message}`);
    } finally {
      btnSave.classList.remove('loading');
    }
  }

  // Submit and Save / Update Entry
  if (entryForm) entryForm.addEventListener('submit', handleEntrySubmit);

  // Directly attach Enter key down listeners to each input of the log box form
  const logBoxInputs = [inputCD, inputCashier, inputType, inputAmount, inputGuestName, inputCard, inputOtherInfo, inputSurv];
  logBoxInputs.forEach(input => {
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleEntrySubmit(e);
        }
      });
    }
  });

  // ==========================================================================
  // QUICK TEXT ENTRY – shared parsers + reusable widget mount
  // ==========================================================================

  // ── Amount parser: 50K→50000 | 1L→100000 | 1.5K→1500 | 500→500 ──────────
  function parseQuickAmt(s) {
    s = String(s).trim().toUpperCase().replace(/,/g, '');
    const m = s.match(/^(\d+(?:\.\d+)?)\s*([KL]?)$/);
    if (!m) return null;
    let n = parseFloat(m[1]);
    if (m[2] === 'K') n *= 1000;
    if (m[2] === 'L') n *= 100000;
    return Math.round(n);
  }

  function cleanOtherInfo(s) {
    if (!s) return '';
    let str = String(s).trim();
    // Strip leading '(' or '9' and trailing ')' e.g. "(INFO)" -> "INFO", "9INFO)" -> "INFO"
    str = str.replace(/^[\(9]\s*/, '').replace(/\s*\)$/, '').trim();
    return str;
  }

  // ── Multi-entry splitter: handles newlines, semicolons, and comma-separated entries
  function splitMultiEntries(raw) {
    if (!raw) return [];
    const chunks = raw.split(/[\r\n;]+/).map(l => l.trim()).filter(l => l.length > 0);
    const finalLines = [];
    chunks.forEach(chunk => {
      // Split comma separated entries if next part begins with amount (e.g. "50k cashin by a, 20k cashout by b")
      if (chunk.includes(',')) {
        const subParts = chunk.split(/,\s*(?=(?:(?:\d+[\.\)\-:]\s*|[-*•]\s*)?\d+(?:[,\.]\d+)?\s*[KL]?\s+[A-Za-z]))/);
        if (subParts.length > 1) {
          subParts.forEach(sp => {
            if (sp.trim()) finalLines.push(sp.trim());
          });
          return;
        }
      }
      finalLines.push(chunk);
    });
    return finalLines;
  }

  // ── Sentence parser: returns { type, cd, amount, guestname, card, otherinfo } or null
  function parseQuickSentence(raw) {
    if (!raw || typeof raw !== 'string') return null;
    let t = raw.trim();

    // 1. Strip leading numbering or bullet points: e.g. "1.", "1)", "1-", "1:", "-", "*", "•"
    t = t.replace(/^\s*(?:[\d]+[\.\)\-:]\s*|[-*•]\s*)/, '').trim();
    if (!t) return null;

    // 2. Extract bracketed / parenthesized other info
    let bracketInfo = '';
    let bMatch = t.match(/\(([^)]*)\)/);
    if (bMatch) {
      bracketInfo = cleanOtherInfo(bMatch[1]);
      t = t.replace(/\([^)]*\)/, ' ').replace(/\s+/g, ' ').trim();
    } else {
      bMatch = t.match(/(?:\s+|^)9([^)]+)\)/);
      if (bMatch) {
        bracketInfo = cleanOtherInfo(bMatch[1]);
        t = t.replace(/(?:\s+|^)9[^)]+\)/, ' ').replace(/\s+/g, ' ').trim();
      }
    }

    t = t.toUpperCase();

    // 3. Extract Amount (e.g. 50K, 1.5L, 50000, 1,00,000)
    const amtMatch = t.match(/^(\d+(?:[,\.]\d+)?\s*[KL]?)\s+(.+)$/i);
    if (!amtMatch) return null;

    const a = parseQuickAmt(amtMatch[1]);
    if (!a || a <= 0) return null;
    let rest = amtMatch[2].trim();

    // 4. CASHIN / C/IN / C-IN / CIN / CASH IN
    let m = rest.match(/^(?:CASHIN|C[\/\\]IN|C-IN|CIN|CASH\s+IN|CASH-IN)(?:\s+BY)?\s+(.+)$/i);
    if (m) {
      return { type: 'CASHIN', cd: 'CD-01', amount: a, guestname: m[1].trim(), card: '', otherinfo: bracketInfo };
    }

    // 5. CASHOUT / C/OUT / C-OUT / COUT / CASH OUT
    m = rest.match(/^(?:CASHOUT|C[\/\\]OUT|C-OUT|COUT|CASH\s+OUT|CASH-OUT)(?:\s+BY)?\s+(.+)$/i);
    if (m) {
      return { type: 'CASHOUT', cd: 'CD-01', amount: a, guestname: m[1].trim(), card: '', otherinfo: bracketInfo };
    }

    // Helper for ISSUE / DEPOSIT
    function parseCardAndGuest(sub) {
      let guestname = '';
      let card = '';
      let otherinfo = bracketInfo;

      const cardMatch = sub.match(/^(.*?)\s+CARD(?:\s+(.*))?$/i);
      if (cardMatch) {
        const beforeCard = cardMatch[1].trim();
        const afterCard = cardMatch[2] ? cardMatch[2].trim() : '';
        if (!otherinfo && afterCard) {
          otherinfo = cleanOtherInfo(afterCard);
        }

        const connMatch = beforeCard.match(/^(.*?)\s+(?:FROM|C[\/\\]O|ON)\s+(.+)$/i);
        if (connMatch) {
          guestname = connMatch[1].trim();
          card = connMatch[2].trim();
        } else {
          const lastSpace = beforeCard.lastIndexOf(' ');
          if (lastSpace !== -1) {
            guestname = beforeCard.slice(0, lastSpace).trim();
            card = beforeCard.slice(lastSpace + 1).trim();
          } else {
            guestname = beforeCard;
            card = 'SELF';
          }
        }
        return { guestname, card, otherinfo };
      }

      // Fallback if no 'CARD' keyword
      const connNoCard = sub.match(/^(.*?)\s+(?:FROM|C[\/\\]O|ON)\s+(.+)$/i);
      if (connNoCard) {
        guestname = connNoCard[1].trim();
        card = connNoCard[2].trim();
        return { guestname, card, otherinfo };
      }

      // If no card keyword, guestname is entire sub
      if (sub.trim()) {
        return { guestname: sub.trim(), card: '', otherinfo };
      }

      return null;
    }

    // 6. ISSUE
    m = rest.match(/^(?:ISSUE)(?:\s+TO)?\s+(.+)$/i);
    if (m) {
      const res = parseCardAndGuest(m[1].trim());
      if (res) return { type: 'ISSUE', cd: 'CD-01', amount: a, guestname: res.guestname, card: res.card, otherinfo: res.otherinfo };
    }

    // 7. DEPOSIT / DEP
    m = rest.match(/^(?:DEPOSIT|DEP)(?:\s+BY)?\s+(.+)$/i);
    if (m) {
      const res = parseCardAndGuest(m[1].trim());
      if (res) return { type: 'DEPOSIT', cd: 'CD-01', amount: a, guestname: res.guestname, card: res.card, otherinfo: res.otherinfo };
    }

    // 8. KEYIN / KEY IN / KEY-IN
    m = rest.match(/^(?:KEYIN|KEY\s+IN|KEY-IN)(?:\s+BY)?\s+(.+)$/i);
    if (m) {
      return { type: 'KEYIN', cd: 'CD-01', amount: a, guestname: m[1].trim(), card: '', otherinfo: bracketInfo };
    }

    // 9. KEYOUT / KEY OUT / KEY-OUT
    m = rest.match(/^(?:KEYOUT|KEY\s+OUT|KEY-OUT)(?:\s+BY)?\s+(.+)$/i);
    if (m) {
      return { type: 'KEYOUT', cd: 'CD-01', amount: a, guestname: m[1].trim(), card: '', otherinfo: bracketInfo };
    }

    return null;
  }

  // ── Generic widget mount: wire up any textarea/button/feedback trio ────────
  function mountQuickEntry(inputId, saveBtnId, feedbackId, opts) {
    const qInput    = document.getElementById(inputId);
    const qSaveBtn  = document.getElementById(saveBtnId);
    const qFeedback = document.getElementById(feedbackId);
    if (!qInput || !qSaveBtn) return;

    const o = opts || {};
    const qCDSelect = o.cdSelectId ? document.getElementById(o.cdSelectId) : null;
    const qCashier = o.cashierInputId ? document.getElementById(o.cashierInputId) : null;

    // Sync initial values from main form on mount
    if (qCDSelect && inputCD) {
      qCDSelect.value = inputCD.value || 'CD-01';
    }
    if (qCashier && inputCashier) {
      qCashier.value = inputCashier.value || '';
    }

    // Bidirectional sync for Cashier input
    if (qCashier) {
      qCashier.addEventListener('input', () => {
        qCashier.value = qCashier.value.toUpperCase();
        if (inputCashier && inputCashier.value !== qCashier.value) {
          inputCashier.value = qCashier.value;
        }
      });
      
      // Submit on Enter key inside Cashier quick input
      qCashier.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          doSave();
        }
      });
    }

    // Bidirectional sync for CD selection
    if (qCDSelect) {
      qCDSelect.addEventListener('change', () => {
        if (inputCD && inputCD.value !== qCDSelect.value) {
          inputCD.value = qCDSelect.value;
          inputCD.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
      
      // Submit on Enter key inside CD select dropdown
      qCDSelect.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          doSave();
        }
      });
    }

    // Main form listener syncs CD/Cashier to the active quick entry widget
    if (inputCD) {
      inputCD.addEventListener('input', () => {
        const val = inputCD.value.toUpperCase();
        if (qCDSelect && qCDSelect.value !== val) {
          if (['CD-01', 'CD-02', 'CD-03', 'CD-04', 'M-CD', 'F-CD'].includes(val)) {
            qCDSelect.value = val;
          }
        }
      });
    }
    if (inputCashier) {
      inputCashier.addEventListener('input', () => {
        const val = inputCashier.value.toUpperCase();
        if (qCashier && qCashier.value !== val) {
          qCashier.value = val;
        }
      });
    }

    function setFb(msg, color) {
      if (!qFeedback) return;
      qFeedback.textContent = msg;
      qFeedback.style.color = color || '#fff';
    }

    async function doSave() {
      // Force sync cashier and CD from quick entry fields before saving
      if (qCashier && inputCashier && qCashier.value) {
        inputCashier.value = qCashier.value.toUpperCase();
      }
      if (qCDSelect && inputCD) {
        inputCD.value = qCDSelect.value;
      }

      const raw = qInput.value.trim();
      const mainGuest = inputGuestName ? inputGuestName.value.trim() : '';

      if (!raw && !mainGuest) return;

      // Capture CD and Cashier values from log box at the very beginning
      const cashierVal = inputCashier ? inputCashier.value.trim().toUpperCase() : '';
      const cdVal      = inputCD ? inputCD.value.trim().toUpperCase() : '';

      // If main guest is present, save the main form
      let savedMain = false;
      if (mainGuest) {
        // Validate required fields for main form
        const datetime = inputDateTime ? inputDateTime.value : '';
        const type = inputType ? inputType.value.trim() : '';
        const amount = inputAmount ? inputAmount.value : '';
        const surv = inputSurv ? inputSurv.value.toUpperCase() : '';
        if (!datetime || !cdVal || !cashierVal || !type || !amount || !surv) {
          alert('Please fill out all required fields in the log box.');
          return;
        }

        // Check if main guest is barred before proceeding
        const mainMatch = await ensureCheckBarredGuest(mainGuest);
        if (mainMatch) {
          await showBarredWarningPopup(mainMatch, mainGuest);
        }

        await handleEntrySubmit(null, true);
        savedMain = true;

        // If there's no quick entry text, we are done
        if (!raw) {
          setFb('✓ Log box entry saved.', '#86efac');
          if (qCashier) qCashier.value = '';
          if (qCDSelect) qCDSelect.value = 'CD-01';
          if (inputCashier) inputCashier.value = '';
          if (inputCD) inputCD.value = 'CD-01';
          return;
        }
      }

      // Check if input is a question for the Offline AI Assistant
      const trimmedRaw = (raw || '').trim();
      if (trimmedRaw.startsWith('?') || /^ai\b/i.test(trimmedRaw) || /^(who is|what is|how much|total in|total out|result of|summary of|details of)\b/i.test(trimmedRaw)) {
        const aiQ = trimmedRaw.replace(/^(\?|ai\s*)/i, '').trim();
        qInput.value = '';
        setFb('');
        openAiAssistantModal(aiQ || 'OVERALL RESULT');
        return;
      }

      // MULTI-ENTRY PARSER: Allow typing/pasting as many entries at once as desired
      const lines = splitMultiEntries(raw);
      if (lines.length === 0) return;

      const parsedEntries = [];
      const failedLines = [];

      lines.forEach((line, idx) => {
        const p = parseQuickSentence(line);
        if (p) {
          parsedEntries.push(p);
        } else {
          failedLines.push({ num: idx + 1, text: line });
        }
      });

      if (parsedEntries.length === 0) {
        setFb('⚠ Cannot parse — check format.', '#fca5a5');
        return;
      }

      if (failedLines.length > 0) {
        setFb(`⚠ Line ${failedLines[0].num} invalid: "${failedLines[0].text}"`, '#fca5a5');
        return;
      }

      // Check if any parsed quick entry is for a barred guest
      for (const item of parsedEntries) {
        if (item.guestname) {
          const match = checkClientBarredGuest(item.guestname);
          if (match) {
            await showBarredWarningPopup(match, item.guestname);
          }
        }
      }

      const cdFinal = cdVal || 'CD-01';
      const cashierFinal = cashierVal || '-';
      const survVal = (currentUser ? (currentUser.name || currentUser.id) : 'ADMIN').toUpperCase();
      const now = Date.now();
      const isoNow = getLocalTimeISOString();
      const curBDate = currentBusinessDateStr || currentBusinessDate || getBusinessDate();

      const payloads = parsedEntries.map((item, idx) => {
        const itemCd = (item.cd && item.cd !== 'C' && item.cd !== 'D') ? item.cd : cdFinal;
        return {
          id: now + idx,
          datetime: isoNow,
          cd: itemCd,
          cashier: cashierFinal,
          type: item.type,
          amount: item.amount,
          guestname: item.guestname,
          card: item.card || '',
          otherinfo: item.otherinfo || '',
          surv: survVal,
          businessDate: curBDate,
          archived: false,
          modifiedAt: now + idx
        };
      });

      // ─── INSTANTANEOUS ACTIONS ON ENTER (ZERO WAITING / SUDDENLY CLEARS & UPDATES) ───
      qInput.value = '';
      qInput.style.height = '';
      qInput.focus();

      if (qCashier) qCashier.value = '';
      if (inputCashier) inputCashier.value = '';

      if (parsedEntries.length === 1) {
        const p = parsedEntries[0];
        setFb(`✓ ${p.amount.toLocaleString('en-IN')} ${p.type} – ${p.guestname}${p.otherinfo ? ' ('+p.otherinfo+')' : ''}`, '#86efac');
      } else {
        setFb(`✓ Successfully added ${parsedEntries.length} entries!`, '#86efac');
      }

      // Optimistic table update in 0ms: entries appear suddenly on screen
      for (let i = payloads.length - 1; i >= 0; i--) {
        allEntries.unshift(payloads[i]);
      }
      window.allEntries = allEntries;
      renderEntries(allEntries, { limit: CURRENT_ENTRY_LIMIT, isArchive: false });
      calculateStatistics(allEntries.filter(isEntryForToday));
      populateDataLists(allEntries);
      if (typeof renderMajor === 'function') renderMajor();
      if (typeof updateAllEntriesView === 'function') updateAllEntriesView();

      // High-speed single batch background save (non-blocking)
      fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloads.length === 1 ? payloads[0] : payloads)
      }).then(async res => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          console.error('Error saving entries:', errData);
          const errMsg = errData.error || 'Server error';
          setFb(`✗ Error saving: ${errMsg}`, '#fca5a5');
          showAppNotification(`Error saving entry: ${errMsg}`, 'error');
        }
      }).catch(err => {
        console.error('Error saving entries:', err);
        setFb(`✗ Error saving: ${err.message}`, '#fca5a5');
        showAppNotification(`Error saving entry: ${err.message}`, 'error');
      });
    }

    if (qSaveBtn) qSaveBtn.addEventListener('click', doSave);

    // Enter = save (Shift+Enter = new line for typing as many entries as desired)
    if (qInput) qInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        doSave();
      }
    });

    // Live parse preview as user types & dynamic auto-grow
    if (qInput) qInput.addEventListener('input', () => {
      // Auto-grow height based on content
      qInput.style.height = 'auto';
      const newHeight = Math.min(Math.max(qInput.scrollHeight, 46), 140);
      qInput.style.height = newHeight + 'px';

      const raw = qInput.value.trim();
      if (!raw) { setFb(''); return; }

      if (raw.startsWith('?') || /^ai\b/i.test(raw) || /^(who is|what is|how much|total in|total out|result of|summary of|details of)\b/i.test(raw)) {
        setFb('✨ Ask Offline AI Assistant (Press Enter or click SEND)', '#c084fc');
        return;
      }

      const lines = splitMultiEntries(raw);
      if (lines.length > 1) {
        let valid = 0;
        lines.forEach(l => { if (parseQuickSentence(l)) valid++; });
        if (valid === lines.length) {
          setFb(`→ Ready to add ${valid} entries (Click SEND or Enter)`, '#86efac');
        } else {
          setFb(`→ ${valid} of ${lines.length} entries parsed…`, '#fcd34d');
        }
        return;
      }

      const p = parseQuickSentence(lines[0] || raw);
      if (p) {
        setFb(
          `→ ${p.type}  ₹${p.amount.toLocaleString('en-IN')}  ${p.guestname}${p.card ? ' · '+p.card : ''}${p.otherinfo ? ' ('+p.otherinfo+')' : ''}`,
          '#a78bfa'
        );
      } else {
        setFb('…typing…', 'var(--text-muted)');
      }
    });
  } // end mountQuickEntry

  // Mount for home page message box (Telegram layout)
  mountQuickEntry('officer-quick-input', 'btn-officer-quick-save', 'officer-quick-feedback');

  // Real-time Search and Filter on Main Page (latest 20 active only)
  if (tableSearchInput) {
 if (tableSearchInput) tableSearchInput.addEventListener('input', () => {
      const query = tableSearchInput.value.toLowerCase().trim();

      if (!query) {
        renderEntries(allEntries, { limit: CURRENT_ENTRY_LIMIT, isArchive: false });
        return;
      }

      const filtered = allEntries.filter(entry => {
        const nameMatch = entry.guestname && entry.guestname.toLowerCase().includes(query);
        const cashierMatch = entry.cashier && entry.cashier.toLowerCase().includes(query);
        const typeMatch = entry.type && entry.type.toLowerCase().includes(query);
        const survMatch = entry.surv && entry.surv.toLowerCase().includes(query);
        const cdMatch = entry.cd && entry.cd.toLowerCase().includes(query);
        const cardMatch = entry.card && entry.card.toLowerCase().includes(query);
        const otherInfoMatch = entry.otherinfo && entry.otherinfo.toLowerCase().includes(query);
        const amountMatch = entry.amount && String(entry.amount).includes(query);

        return nameMatch || cashierMatch || typeMatch || survMatch || cdMatch || cardMatch || otherInfoMatch || amountMatch;
      });

      renderEntries(filtered, { limit: CURRENT_ENTRY_LIMIT, isArchive: false });
    });
  }

  // Manual Refresh Button
  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      tableSearchInput.value = '';
      fetchEntries();
    });
  }

  // Attach ALL ENTRIES filter listeners
  if (allEntriesDatePicker) {
    allEntriesDatePicker.addEventListener('change', () => {
      const val = allEntriesDatePicker.value;
      if (val) {
        const parts = val.split('-');
        if (parts.length === 3) {
          activeAllEntriesDay = Number(parts[2]);
          renderDayPagination();
        }
      }
      updateAllEntriesView();
    });
  }
  if (allEntriesSearch) {
 if (allEntriesSearch) allEntriesSearch.addEventListener('input', () => {
      updateAllEntriesView();
    });
  }

  // Auto-Refresh checking for 6:00 AM auto-archive clean
  const pageLoadTime = Date.now();
  // Periodic check to see if the date has changed (e.g. 06:00 AM reset)
  setInterval(async () => {
    try {
      const startFetch = Date.now();
      const response = await fetch('/api/status');
      if (response.ok) {
        const data = await response.json();
        if (data.serverTime) {
          const rtt = Date.now() - startFetch;
          timeOffset = data.serverTime + (rtt / 2) - Date.now();
        }
        if (data.currentBusinessDate && currentBusinessDateStr && data.currentBusinessDate !== currentBusinessDateStr) {
          console.log("Daily reset detected. Refreshing site...");
          location.reload();
        }
      }
    } catch (err) {
      console.error('Failed to query server status for daily reset:', err);
    }
  }, 30000);

  // Helper to check if current user is admin
  function isUserAdmin() {
    return !!(currentUser && (currentUser.role === 'admin' || currentUser.id === 'admin' || (currentUser.name && currentUser.name.toLowerCase() === 'admin')));
  }

  // Toggle the Admin Users button visibility based on active user - ONLY ADMIN CAN ADD MEMBER
  function toggleAdminPanel() {
    const admin = isUserAdmin();
    if (btnAdminUsers) {
      btnAdminUsers.style.display = admin ? 'flex' : 'none';
    }
    const userProfileEl = document.getElementById('user-profile-badge') || document.querySelector('.user-profile');
    if (userProfileEl) {
      const name = (currentUser && currentUser.name) ? currentUser.name.toUpperCase() : 'ADMIN';
      userProfileEl.title = admin ? `${name} (ADMIN)` : name;
      if (admin) {
        userProfileEl.classList.add('is-admin');
      } else {
        userProfileEl.classList.remove('is-admin');
      }
    }
  }

  // Admin Account Management: Fetch all accounts
  async function fetchUsers() {
    try {
      const response = await fetch('/api/users?requester=admin');
      if (!response.ok) {
        throw new Error('Failed to retrieve user accounts.');
      }
      const data = await response.json();
      renderUsers(data.users || []);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  }

  // Render users matching wireframe
  function renderUsers(users) {
    const list = document.getElementById('users-list');
    if (!list) return;

    if (users.length === 0) {
      list.innerHTML = '<li style="text-align:center; padding:30px; color:var(--text-muted); font-weight:700;">No active accounts found.</li>';
      return;
    }

    let html = '';
    users.forEach(user => {
      const isSelf = user.username === 'admin';
      const roleUpper = (user.role || 'officer').toUpperCase();
      const roleColor = user.role === 'supervisor' ? '#c084fc' : '#60a5fa';
      const nameDisplay = user.name ? escapeHTML(user.name) : '<span style="color:#f59e0b; font-weight:600; font-size:0.82rem;">(Pending 1st Login)</span>';

      html += `
        <li class="admin-user-card" data-user="${escapeHTML(user.username)}">
          <div class="user-card-left">
            <div class="user-card-row">
              <span class="user-card-label">USER ID:</span>
              <span class="user-card-value user-id-val">${escapeHTML(user.username)}</span>
              <span class="user-role-pill" style="color: ${roleColor}; border-color: ${roleColor};">${roleUpper}</span>
            </div>
            <div class="user-card-row">
              <span class="user-card-label">USER NAME:</span>
              <span class="user-card-value" style="color: #ffffff; font-weight: 800;">${nameDisplay}</span>
            </div>
            <div class="user-card-row">
              <span class="user-card-label">PASSWORD:</span>
              <span class="user-card-value user-pass-val" style="color: #fbbf24 !important; font-family: monospace; font-size: 0.95rem; letter-spacing: 0.5px;">${escapeHTML(user.password || '')}</span>
            </div>
          </div>
          <div class="user-card-right">
            <button type="button" class="btn-user-action btn-delete-user" data-user="${escapeHTML(user.username)}" ${isSelf ? 'disabled' : ''} title="Delete Member">
              <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
              <span>DELETE</span>
            </button>
            <button type="button" class="btn-user-action btn-edit-user" data-user="${escapeHTML(user.username)}" data-name="${escapeHTML(user.name || '')}" data-pass="${escapeHTML(user.password || '')}" data-role="${escapeHTML(user.role || 'officer')}" title="Edit Member">
              <i data-lucide="edit-2" style="width: 14px; height: 14px;"></i>
              <span>EDIT</span>
            </button>
          </div>
        </li>
      `;
    });

    list.innerHTML = html;
    if (window.lucide) lucide.createIcons();

    // Attach click listeners to delete buttons
    list.querySelectorAll('.btn-delete-user').forEach(btn => {
      btn.addEventListener('click', async () => {
        const usernameToDelete = btn.getAttribute('data-user');
        if (usernameToDelete === 'admin') return;

        if (!confirm(`Are you sure you want to delete member "${usernameToDelete}"?`)) {
          return;
        }

        try {
          const response = await fetch(`/api/users?adminUser=admin&username=${encodeURIComponent(usernameToDelete)}`, {
            method: 'DELETE'
          });
          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || 'Failed to delete user.');
          }

          fetchUsers();
          if (window.showAppNotification) {
            window.showAppNotification(`Member ${usernameToDelete} deleted.`, 'success');
          }
        } catch (err) {
          alert(`Error deleting user: ${err.message}`);
        }
      });
    });

    // Attach click listeners to edit buttons
    list.querySelectorAll('.btn-edit-user').forEach(btn => {
      btn.addEventListener('click', () => {
        const username = btn.getAttribute('data-user');
        const name = btn.getAttribute('data-name') || '';
        const pass = btn.getAttribute('data-pass') || '';
        const role = btn.getAttribute('data-role') || 'officer';
        openEditMemberModal(username, name, pass, role);
      });
    });
  }

  // Role selector buttons in Add Member form
  const roleBtnOfficer = document.getElementById('role-btn-officer');
  const roleBtnSupervisor = document.getElementById('role-btn-supervisor');
  const newUserRoleInput = document.getElementById('new-user-role');

  if (roleBtnOfficer && roleBtnSupervisor) {
    roleBtnOfficer.addEventListener('click', () => {
      roleBtnOfficer.classList.add('active');
      roleBtnSupervisor.classList.remove('active');
      if (newUserRoleInput) newUserRoleInput.value = 'officer';
    });
    roleBtnSupervisor.addEventListener('click', () => {
      roleBtnSupervisor.classList.add('active');
      roleBtnOfficer.classList.remove('active');
      if (newUserRoleInput) newUserRoleInput.value = 'supervisor';
    });
  }

  // Edit Member Modal logic
  const editMemberModal = document.getElementById('edit-member-modal');
  const btnCloseEditMember = document.getElementById('btn-close-edit-member');
  const btnCancelEditMember = document.getElementById('btn-cancel-edit-member');
  const editMemberForm = document.getElementById('edit-member-form');
  const editMemberOrigId = document.getElementById('edit-member-orig-id');
  const editMemberId = document.getElementById('edit-member-id');
  const editMemberName = document.getElementById('edit-member-name');
  const editMemberPass = document.getElementById('edit-member-pass');
  const editMemberRole = document.getElementById('edit-member-role');
  const editRoleOfficer = document.getElementById('edit-role-officer');
  const editRoleSupervisor = document.getElementById('edit-role-supervisor');

  function openEditMemberModal(username, name, password, role) {
    if (!editMemberModal) return;
    if (editMemberOrigId) editMemberOrigId.value = username;
    if (editMemberId) editMemberId.value = username;
    if (editMemberName) editMemberName.value = name || '';
    if (editMemberPass) editMemberPass.value = password || '';
    if (editMemberRole) editMemberRole.value = role || 'officer';

    if (role === 'supervisor') {
      if (editRoleSupervisor) editRoleSupervisor.classList.add('active');
      if (editRoleOfficer) editRoleOfficer.classList.remove('active');
    } else {
      if (editRoleOfficer) editRoleOfficer.classList.add('active');
      if (editRoleSupervisor) editRoleSupervisor.classList.remove('active');
    }

    editMemberModal.style.display = 'flex';
    if (window.lucide) lucide.createIcons();
  }

  function closeEditMemberModal() {
    if (editMemberModal) editMemberModal.style.display = 'none';
  }

  if (btnCloseEditMember) btnCloseEditMember.addEventListener('click', closeEditMemberModal);
  if (btnCancelEditMember) btnCancelEditMember.addEventListener('click', closeEditMemberModal);
  if (editMemberModal) {
    editMemberModal.addEventListener('click', (e) => {
      if (e.target === editMemberModal) closeEditMemberModal();
    });
  }

  if (editRoleOfficer && editRoleSupervisor) {
    editRoleOfficer.addEventListener('click', () => {
      editRoleOfficer.classList.add('active');
      editRoleSupervisor.classList.remove('active');
      if (editMemberRole) editMemberRole.value = 'officer';
    });
    editRoleSupervisor.addEventListener('click', () => {
      editRoleSupervisor.classList.add('active');
      editRoleOfficer.classList.remove('active');
      if (editMemberRole) editMemberRole.value = 'supervisor';
    });
  }

  if (editMemberForm) {
    editMemberForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const origUsername = (editMemberOrigId ? editMemberOrigId.value : editMemberId.value).trim();
      const newUsername = editMemberId.value.trim();
      const name = editMemberName ? editMemberName.value.trim().toUpperCase() : '';
      const password = editMemberPass.value;
      const role = editMemberRole ? editMemberRole.value : 'officer';

      if (!isUserAdmin()) {
        if (window.showAppNotification) window.showAppNotification('ONLY ADMIN CAN EDIT MEMBER', 'error');
        return;
      }

      if (!newUsername || !password) return;

      try {
        const response = await fetch('/api/users', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            adminUser: 'admin',
            origUsername,
            newUsername,
            name,
            password,
            role
          })
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to update user.');
        }

        closeEditMemberModal();
        fetchUsers();
        if (window.showAppNotification) {
          window.showAppNotification(`User ${newUsername} updated successfully!`, 'success');
        }
      } catch (err) {
        alert(`Error updating user: ${err.message}`);
      }
    });
  }

  // Submit handler for adding new user account
  const addUserForm = document.getElementById('add-user-form');
  const newUsernameInput = document.getElementById('new-user-id');
  const newNameInput = document.getElementById('new-user-name');
  const newPasswordInput = document.getElementById('new-user-pass');

  if (addUserForm) {
    addUserForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = newUsernameInput.value.trim();
      const name = newNameInput ? newNameInput.value.trim().toUpperCase() : '';
      const password = newPasswordInput ? newPasswordInput.value.trim() : '';
      const roleElement = document.getElementById('new-user-role');
      const role = roleElement ? roleElement.value : 'officer';

      if (!isUserAdmin()) {
        if (window.showAppNotification) window.showAppNotification('ONLY ADMIN CAN ADD MEMBER', 'error');
        return;
      }

      if (!username) return;

      try {
        const response = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            adminUser: 'admin',
            newUsername: username,
            newName: name,
            newPassword: password,
            newRole: role
          })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to add user account.');
        }

        newUsernameInput.value = '';
        if (newNameInput) newNameInput.value = '';
        if (newPasswordInput) newPasswordInput.value = '';
        fetchUsers();
        if (window.showAppNotification) {
          window.showAppNotification(`User ${username} added successfully!`, 'success');
        }
      } catch (err) {
        alert(`Error adding user: ${err.message}`);
      }
    });
  }

  // First-Time Login Profile Setup Modal Logic
  const firstTimeSetupModal = document.getElementById('first-time-setup-modal');
  const firstTimeSetupForm = document.getElementById('first-time-setup-form');
  const setupFullName = document.getElementById('setup-full-name');
  const setupNewPass = document.getElementById('setup-new-password');
  const setupConfirmPass = document.getElementById('setup-confirm-password');
  const setupErrorMsg = document.getElementById('setup-error-msg');

  function checkAndPromptFirstTimeSetup(user) {
    if (!user || user.id === 'admin') return;
    if (user.firstLogin || !user.name || user.name.trim() === '' || user.name.toUpperCase() === user.id.toUpperCase()) {
      openFirstTimeSetupModal(user);
    }
  }

  function openFirstTimeSetupModal(user) {
    if (!firstTimeSetupModal) return;
    if (setupFullName) {
      setupFullName.value = (user.name && user.name.toUpperCase() !== user.id.toUpperCase()) ? user.name : '';
      setupFullName.placeholder = 'USER NAME';
    }
    if (setupNewPass) {
      setupNewPass.value = '';
      setupNewPass.placeholder = 'PASSWORD';
    }
    if (setupConfirmPass) {
      setupConfirmPass.value = '';
      setupConfirmPass.placeholder = 'CONFIRM PASSWORD';
    }
    if (setupErrorMsg) {
      setupErrorMsg.textContent = '';
      setupErrorMsg.style.display = 'none';
    }
    firstTimeSetupModal.style.display = 'flex';
    if (window.lucide) lucide.createIcons();
    setTimeout(() => {
      if (setupFullName) setupFullName.focus();
    }, 200);
  }

  if (firstTimeSetupForm) {
    firstTimeSetupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fullName = (setupFullName ? setupFullName.value : '').trim().toUpperCase();
      const newPass = setupNewPass ? setupNewPass.value : '';
      const confirmPass = setupConfirmPass ? setupConfirmPass.value : '';

      if (!fullName) {
        if (setupErrorMsg) {
          setupErrorMsg.textContent = 'Please enter your User Name.';
          setupErrorMsg.style.display = 'block';
        }
        return;
      }

      if (!newPass) {
        if (setupErrorMsg) {
          setupErrorMsg.textContent = 'Please enter your new password.';
          setupErrorMsg.style.display = 'block';
        }
        return;
      }

      if (newPass !== confirmPass) {
        if (setupErrorMsg) {
          setupErrorMsg.textContent = 'Passwords do not match. Please re-enter.';
          setupErrorMsg.style.display = 'block';
        }
        return;
      }

      try {
        const res = await fetch('/api/user/first-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: currentUser.id,
            newName: fullName,
            newPassword: newPass
          })
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to complete setup.');
        }

        currentUser.name = fullName;
        currentUser.firstLogin = false;
        localStorage.setItem('surv_session', JSON.stringify(currentUser));

        if (userBadgeId) userBadgeId.textContent = fullName;
        if (inputSurv) inputSurv.value = fullName;
        applyUserWallpaper(fullName);

        firstTimeSetupModal.style.display = 'none';

        if (window.showAppNotification) {
          window.showAppNotification(`Welcome, ${fullName}! Profile setup complete.`, 'success');
        }
      } catch (err) {
        if (setupErrorMsg) {
          setupErrorMsg.textContent = err.message || 'Setup error. Please try again.';
          setupErrorMsg.style.display = 'block';
        }
      }
    });
  }

  const btnCancelFirstSetup = document.getElementById('btn-cancel-first-setup');
  if (btnCancelFirstSetup) {
    btnCancelFirstSetup.addEventListener('click', () => {
      if (firstTimeSetupModal) firstTimeSetupModal.style.display = 'none';
      if (btnLogout) {
        btnLogout.click();
      } else {
        localStorage.removeItem('surv_session');
        sessionStorage.removeItem('current_panel');
        currentUser = null;
        showView('login');
      }
    });
  }
  // Helper: Secure HTML escape to avoid XSS
  function escapeHTML(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Helper: Robust copy text to clipboard supporting insecure HTTP contexts
  function copyTextToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    
    // Fallback for non-HTTPS/insecure contexts (e.g. accessing via local IP http://192.168.x.x:3000)
    return new Promise((resolve, reject) => {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.top = '0';
        textarea.style.left = '0';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (successful) {
          resolve();
        } else {
          reject(new Error('execCommand copy failed'));
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  // Initialize datepicker to current business date
  if (allEntriesDatePicker) {
    allEntriesDatePicker.value = getBusinessDate();
  }

  // Bulk Delete Logic
  const selectAllEntries = document.getElementById('select-all-entries');
  const btnDeleteSelected = document.getElementById('btn-delete-selected');

  function updateBulkActionButtonsVisibility() {
    const anyChecked = document.querySelectorAll('.entry-checkbox:checked').length > 0;
    if (btnDeleteSelected) btnDeleteSelected.style.display = anyChecked ? 'inline-block' : 'none';
  }

  if (selectAllEntries) {
 if (selectAllEntries) selectAllEntries.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      document.querySelectorAll('.entry-checkbox:not([disabled])').forEach(cb => {
        cb.checked = isChecked;
      });
      updateBulkActionButtonsVisibility();
    });
  }

  if (btnDeleteSelected) {
    btnDeleteSelected.addEventListener('click', async () => {
      const selectedBoxes = document.querySelectorAll('.entry-checkbox:checked');
      if (selectedBoxes.length === 0) return;

      const idsToDelete = Array.from(selectedBoxes).map(cb => Number(cb.getAttribute('data-id')));
      const isAllSelected = (selectAllEntries && selectAllEntries.checked) && (idsToDelete.length >= (allEntries.length * 0.95));

      try {
        btnDeleteSelected.disabled = true;
        btnDeleteSelected.innerHTML = `<i data-lucide="loader" class="spin"></i> Deleting...`;
        if (window.lucide) lucide.createIcons();

        // 1. Instant in-memory deletion for zero-latency UI response
        const deleteSet = new Set(idsToDelete);
        allEntries = isAllSelected ? [] : allEntries.filter(e => !deleteSet.has(Number(e.id)));

        // Instant UI re-render
        if (typeof updateAllEntriesView === 'function') updateAllEntriesView();
        if (typeof renderEntries === 'function') renderEntries(allEntries, { limit: CURRENT_ENTRY_LIMIT, isArchive: false });
        if (selectAllEntries) selectAllEntries.checked = false;
        updateBulkActionButtonsVisibility();

        // 2. High-speed single bulk HTTP request to server
        const payload = isAllSelected ? { all: true } : { ids: idsToDelete };
        const resp = await fetch('/api/entries/batch-delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}));
          throw new Error(errData.error || 'Bulk delete failed.');
        }

        showAppNotification(`${idsToDelete.length} ENTRIES DELETED QUICKLY`, 'success');
      } catch (err) {
        console.error('Bulk delete error:', err);
        showAppNotification('Error deleting entries: ' + err.message, 'error');
        await fetchEntries(); // Re-fetch as safety fallback
      } finally {
        btnDeleteSelected.disabled = false;
        btnDeleteSelected.innerHTML = `<i data-lucide="trash-2"></i>`;
        if (window.lucide) lucide.createIcons();
      }
    });
  }

  // Delegate checkbox change to allEntriesTableBody since rows are re-rendered
  const allEntriesTableBodyRef = document.getElementById('all-entries-table-body');
  if (allEntriesTableBodyRef) {
 if (allEntriesTableBodyRef) allEntriesTableBodyRef.addEventListener('change', (e) => {
      if (e.target.classList.contains('entry-checkbox')) {
        updateBulkActionButtonsVisibility();
        
        // Update Select All state
        const total = document.querySelectorAll('.entry-checkbox:not([disabled])').length;
        const checked = document.querySelectorAll('.entry-checkbox:checked').length;
        if (selectAllEntries) {
          selectAllEntries.checked = (total > 0 && total === checked);
        }
      }
    });
  }

  // ==========================================================================
  // SUPERVISOR LOGIC
  // ==========================================================================
  let supHomeSearchQuery = '';

  function renderSupervisorHome() {
    if (!supervisorAllEntries || !supervisorSendBox) return;

    const searchInputEl = document.getElementById('sup-home-search-input');
    const isSearchFocused = searchInputEl && document.activeElement === searchInputEl;
    if (searchInputEl) {
      supHomeSearchQuery = searchInputEl.value;
    }
    
    // Filter to today's business session (includes physical-date fallback for timing-bug entries)
    const todayEntries = allEntries.filter(isEntryForToday);
    
    // 1. Render Left Table (Today's Entries Only)
    let entriesHtml = `
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px; margin-bottom: 10px;">
        <div style="background: var(--primary); color: white; padding: 8px 24px; border-radius: 8px; font-weight: bold; font-size: 1.1rem; letter-spacing: 1px; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">
          ALL ENTRIES
        </div>
        <div style="display: flex; gap: 10px;">
          <div style="position: relative; width: 250px;">
            <i data-lucide="search" style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); width: 16px; height: 16px; color: var(--text-muted);"></i>
            <input type="text" id="sup-home-search-input" value="${escapeHTML(supHomeSearchQuery)}" placeholder="Search entries..." style="width: 100%; border: 1px solid rgba(255,255,255,0.2); background: rgba(0,0,0,0.2); color: white; padding: 6px 12px 6px 36px; border-radius: 6px; font-size: 13px;">
          </div>
        </div>
      </div>
      <div style="flex:1; overflow-y:auto;">
        <table class="logs-table" style="width:100%; font-size:12px;">
          <thead>
            <tr>
              <th>Date & Time</th><th>Type</th><th>Amount</th><th>Guest Name</th><th>Surv</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    let sortedEntries = [...todayEntries].sort((a,b) => new Date(b.datetime) - new Date(a.datetime));
    
    const q = supHomeSearchQuery.toLowerCase().trim();
    if (q) {
      sortedEntries = sortedEntries.filter(entry => {
        const nameMatch = entry.guestname && entry.guestname.toLowerCase().includes(q);
        const typeMatch = entry.type && entry.type.toLowerCase().includes(q);
        const survMatch = entry.surv && entry.surv.toLowerCase().includes(q);
        const amountMatch = entry.amount && String(entry.amount).includes(q);
        return nameMatch || typeMatch || survMatch || amountMatch;
      });
    }
    
    if (sortedEntries.length === 0) {
      entriesHtml += `<tr><td colspan="5" class="text-center text-muted" style="padding:20px;">No entries found.</td></tr>`;
    } else {
      sortedEntries.forEach(entry => {
        const amt = entry.amount ? Number(entry.amount).toLocaleString('en-IN') : '0';
        entriesHtml += `
          <tr>
            <td>${entry.datetime || '-'}</td>
            <td>${entry.type || '-'}</td>
            <td>${amt}</td>
            <td>${entry.guestname || '-'}</td>
            <td>${entry.surv || '-'}</td>
          </tr>
        `;
      });
    }
    entriesHtml += `</tbody></table></div>`;
    supervisorAllEntries.innerHTML = entriesHtml;
    
    const newSearchInput = document.getElementById('sup-home-search-input');
    if (newSearchInput) {
 if (newSearchInput) newSearchInput.addEventListener('input', (e) => {
        supHomeSearchQuery = e.target.value;
        renderSupervisorHome();
      });
      if (isSearchFocused) {
        newSearchInput.focus();
        const valLen = newSearchInput.value.length;
        newSearchInput.setSelectionRange(valLen, valLen);
      }
    }
    
    // 2. Render SEND Box (Today's Entries Above 49000 Only)
    const sendEntries = todayEntries.filter(e => {
      const amt = Number(String(e.amount).replace(/,/g, '')) || 0;
      return amt > 49000;
    });
    
    const dismissedIdsStr = localStorage.getItem('dismissed_sends');
    const dismissedIds = dismissedIdsStr ? JSON.parse(dismissedIdsStr) : [];
    const visibleSends = sendEntries.filter(e => !dismissedIds.includes(e.id) && !e.sendBoxDismissed);
    
    let sendHtml = `
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px; margin-bottom: 15px;">
        <h3 style="margin: 0; color: var(--accent); display: flex; align-items: center;">
          <i data-lucide="send" style="margin-right: 8px; width: 20px; height: 20px;"></i> SEND
        </h3>
        <button id="btn-copy-delete-sends" class="btn-primary" style="padding: 6px 12px; font-size: 12px; border: none; border-radius: 4px; color: white; cursor: pointer; display: flex; align-items: center; gap: 6px; font-weight: bold;" title="Copy All">
          <i data-lucide="copy" style="width:14px;height:14px;"></i> COPY
        </button>
      </div>
      <div id="send-box-content" style="display: flex; flex-direction: column; gap: 10px;">
    `;

    let allSentencesText = '';

    if (visibleSends.length === 0) {
      sendHtml += `<div style="text-align:center; padding:20px; color:var(--text-muted);">No pending entries above 49,000.</div>`;
    } else {
      visibleSends.forEach(e => {
        const sentence = getEntrySentence(e);
        allSentencesText += sentence + '\n';
        
        sendHtml += `
          <div class="send-item" style="background: rgba(255,255,255,0.05); padding: 12px; border-radius: 8px; position: relative;">
            <p style="margin: 0; font-size: 14px; line-height: 1.4;">${sentence}</p>
          </div>
        `;
      });
    }
    sendHtml += `</div>`; // Close send-box-content
    
    const sendsListContent = document.getElementById('supervisor-send-box');
    if (sendsListContent) {
      sendsListContent.innerHTML = sendHtml;
      
      // Add event listener to COPY button
      const btnCopySends = document.getElementById('btn-copy-delete-sends');
      if (btnCopySends) {
 if (btnCopySends) btnCopySends.addEventListener('click', async () => {
          if (!allSentencesText.trim()) {
            return;
          }
          try {
            await copyTextToClipboard(allSentencesText);
            
            // Permanently dismiss the copied entries on the server
            btnCopySends.disabled = true;
            btnCopySends.innerHTML = `<i data-lucide="loader" class="spin" style="width:14px;height:14px;"></i> Copying...`;
            lucide.createIcons();
            
            await Promise.all(visibleSends.map(e => {
              const updated = { ...e, sendBoxDismissed: true };
              return fetch(`/api/entries?id=${e.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updated)
              });
            }));
            
            await fetchEntries(); // Re-render supervisor page and refresh entries from database
          } catch (err) {
            console.error('Failed to copy and dismiss: ', err);
          } finally {
            btnCopySends.disabled = false;
            btnCopySends.innerHTML = `<i data-lucide="copy" style="width:14px;height:14px;"></i> COPY`;
            lucide.createIcons();
          }
        });
      }
    }
    
    lucide.createIcons();
  }

  // Warning Modal Close Button Listener
  const btnCloseBarredWarning = document.getElementById('btn-close-barred-warning');
  const barredWarningModal = document.getElementById('barred-warning-modal');
  if (btnCloseBarredWarning && barredWarningModal) {
 if (btnCloseBarredWarning) btnCloseBarredWarning.addEventListener('click', () => {
      barredWarningModal.style.display = 'none';
    });
  }

  // EventSource listener for real-time barred guest notifications
  function startEventSource() {
    if (typeof EventSource === 'undefined') {
      console.warn('EventSource is not defined in this environment.');
      return;
    }
    const eventSource = new EventSource('/api/events');
    const recentlyWarnedGuests = {};
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'date-rollover') {
          console.log('[SSE] Received date-rollover to:', data.newDate);
          currentBusinessDateStr = data.newDate;
          currentBusinessDate = data.newDate;
          updateGamingDateDisplay();
          fetchEntries();
          showAppNotification('New Gaming Day started: ' + formatDisplayDate(data.newDate), 'info');
          return;
        }

        if (data.type === 'entry-updated' || data.type === 'entry-created' || data.type === 'entry-deleted') {
          console.log('[SSE] Live entry event received:', data.type);
          fetchEntries().catch(() => {});
          return;
        }

        if (data.type === 'barred-match') {
          const now = Date.now();
          const guestKey = String(data.guestname || '').toLowerCase().trim();
          if (recentlyWarnedGuests[guestKey] && (now - recentlyWarnedGuests[guestKey] < 3000)) {
            // Throttle duplicate warning popups within 3 seconds
            return;
          }
          recentlyWarnedGuests[guestKey] = now;

          const warningModal = document.getElementById('barred-warning-modal');
          const warningName = document.getElementById('barred-warning-name');
          const warningReason = document.getElementById('barred-warning-reason');
          if (warningModal && warningName && warningReason) {
            warningName.textContent = data.guestname;
            let details = '';
            if (data.content) {
              for (const key in data.content) {
                if (key !== 'id' && key !== 'timestamp') {
                  
                  const kLow = key.toLowerCase();
                  const val = String(data.content[key] || '');
                  if (kLow.includes('photo') || kLow.includes('image')) {
                     if (val.startsWith('data:image/') || val.startsWith('http')) {
                        details += `<div style="text-align:center; margin-bottom:6px;"><img src="${val}" style="max-height:85px; max-width:100%; object-fit:contain; border-radius:6px; border:1.5px solid rgba(239,68,68,0.6);" /></div>`;
                        continue;
                     }
                  }
                  details += `<div style="font-size:0.78rem; line-height:1.35; margin-bottom:2px;"><strong style="color:#ef4444;">${key.toUpperCase()}:</strong> <span style="color:#fff;">${val}</span></div>`;

                }
              }
            }
            warningReason.innerHTML = details || (data.reason || 'No reason specified');
            warningModal.style.display = 'flex';
            if (window.lucide) lucide.createIcons();
          }
        }
      } catch (err) {
        console.error('Error processing event stream message:', err);
      }
    };
    
    eventSource.onerror = (err) => {
      console.error('SSE Connection error, retrying in 5 seconds...', err);
      eventSource.close();
      setTimeout(startEventSource, 5000);
    };
  }
  
  startEventSource();

  updateAllEntriesView();
  checkAuthSession();
});

async function extractExcelImages(arrayBuffer) {
  const imagesMap = {};
  try {
    if (typeof JSZip === 'undefined') return imagesMap;
    const zip = await JSZip.loadAsync(arrayBuffer);
    
    // Find all drawing XML files
    const drawingFiles = Object.keys(zip.files).filter(f => /^xl\/drawings\/drawing\d+\.xml$/.test(f));
    
    for (const dFilePath of drawingFiles) {
      // Find corresponding .rels file
      const dFileName = dFilePath.split('/').pop();
      const relsFilePath = "xl/drawings/_rels/" + dFileName + ".rels";
      
      const drawingsRelFile = zip.file(relsFilePath);
      if (!drawingsRelFile) continue;
      const relsXml = await drawingsRelFile.async("string");
      
      const rIdMap = {};
      const relsMatch = relsXml.matchAll(/<Relationship Id="([^"]+)"[^>]+Target="([^"]+)"/g);
      for (const match of relsMatch) {
         let target = match[2];
         if (target.startsWith('../')) target = target.substring(3);
         rIdMap[match[1]] = target;
      }
      
      const drawingsFile = zip.file(dFilePath);
      const drawingsXml = await drawingsFile.async("string");
      
      const anchors = drawingsXml.split(/<xdr:twoCellAnchor|<xdr:oneCellAnchor/);
      for (let i = 1; i < anchors.length; i++) {
         const anchor = anchors[i];
         const rowMatch = anchor.match(/<xdr:from>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/);
         const blipMatch = anchor.match(/<a:blip[\s\S]*?r:embed="([^"]+)"/);
         if (rowMatch && blipMatch) {
            const rowIdx = parseInt(rowMatch[1], 10);
            const rId = blipMatch[1];
            const mediaPath = rIdMap[rId];
            if (mediaPath) {
               const mediaFile = zip.file("xl/" + mediaPath);
               if (mediaFile) {
                  const base64 = await mediaFile.async("base64");
                  let ext = mediaPath.split('.').pop().toLowerCase();
                  if (ext === 'jpg') ext = 'jpeg';
                  imagesMap[rowIdx] = `data:image/${ext};base64,${base64}`;
               }
            }
         }
      }
    }
  } catch(err) {
    console.error("Image extraction error:", err);
  }
  return imagesMap;
}

document.addEventListener('DOMContentLoaded', () => {
  const directBarredInput = document.getElementById('direct-photo-barred');
  const directStaffInput = document.getElementById('direct-photo-staff');
  let currentPhotoId = null;

  document.body.addEventListener('click', (e) => {
    if (e.target.closest('.btn-photo-barred')) {
      currentPhotoId = e.target.closest('.btn-photo-barred').dataset.id;
      if(directBarredInput) directBarredInput.click();
    }
    if (e.target.closest('.btn-photo-staff')) {
      currentPhotoId = e.target.closest('.btn-photo-staff').dataset.id;
      if(directStaffInput) directStaffInput.click();
    }
  });

  if (directBarredInput) {
 if (directBarredInput) directBarredInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file || !currentPhotoId) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const photo = ev.target.result;
        await fetch(`/api/barred?id=${currentPhotoId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ photo })
        });
        fetchAndRenderBarredGuests();
        directBarredInput.value = '';
      };
      reader.readAsDataURL(file);
    });
  }

  if (directStaffInput) {
    if (directStaffInput) directStaffInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file || !currentPhotoId) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const photo = ev.target.result;
        await fetch(`/api/staff?id=${currentPhotoId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ photo })
        });
        fetchAndRenderStaff();
        directStaffInput.value = '';
      };
      reader.readAsDataURL(file);
    });
  }
  // ==========================================================================
  // OFFLINE SURVEILLANCE AI ASSISTANT QUERY ENGINE
  // ==========================================================================
  const aiAssistantModal = document.getElementById('ai-assistant-modal');
  const btnOpenAiAssistant = document.getElementById('btn-open-ai-assistant');
  const btnCloseAiModal = document.getElementById('btn-close-ai-modal');
  const aiDatePicker = document.getElementById('ai-date-picker');
  const aiSelectedDateBadge = document.getElementById('ai-selected-date-badge');
  const aiChatMessages = document.getElementById('ai-chat-messages');
  const aiQueryInput = document.getElementById('ai-query-input');
  const btnAiSend = document.getElementById('btn-ai-send');
  const btnAiClear = document.getElementById('btn-ai-clear');

  function openAiAssistantModal(initialQuery = '') {
    if (!aiAssistantModal) return;
    aiAssistantModal.style.setProperty('display', 'flex', 'important');
    const allEntriesDatePicker = document.getElementById('all-entries-date-picker');
    const activeDashboardDate = (allEntriesDatePicker && allEntriesDatePicker.value)
      ? allEntriesDatePicker.value
      : (currentBusinessDateStr || currentBusinessDate || getBusinessDate());
    if (aiDatePicker && (!aiDatePicker.value || !initialQuery)) {
      aiDatePicker.value = activeDashboardDate;
    }
    const curDate = aiDatePicker ? aiDatePicker.value : (currentBusinessDateStr || currentBusinessDate || getBusinessDate());
    if (aiSelectedDateBadge) {
      aiSelectedDateBadge.textContent = formatDisplayDate(curDate);
    }
    
    if (initialQuery) {
      if (aiQueryInput) aiQueryInput.value = initialQuery;
      executeAiQuery(initialQuery);
    } else {
      resetAiAssistant();
      setTimeout(() => {
        if (aiQueryInput) aiQueryInput.focus();
      }, 100);
    }
    if (window.lucide) lucide.createIcons();
  }

  function resetAiAssistant() {
    if (aiQueryInput) aiQueryInput.value = '';
    const chipsBar = aiAssistantModal ? aiAssistantModal.querySelector('.ai-chips-bar') : null;
    if (chipsBar) {
      chipsBar.style.removeProperty('display');
    }
    if (aiChatMessages) {
      aiChatMessages.innerHTML = '';
      renderAiWelcome();
      aiChatMessages.scrollTop = 0;
    }
    if (window.lucide) lucide.createIcons();
  }

  function closeAiAssistantModal() {
    if (aiAssistantModal) {
      aiAssistantModal.style.setProperty('display', 'none', 'important');
    }
    resetAiAssistant();
  }

  function renderAiWelcome() {
    if (!aiChatMessages) return;
    const curDate = aiDatePicker ? aiDatePicker.value : (currentBusinessDateStr || currentBusinessDate || getBusinessDate());
    const dispDate = formatDisplayDate(curDate);
    aiChatMessages.innerHTML = `
      <div class="ai-msg-row assistant">
        <div class="ai-assistant-card" style="border-color: rgba(168, 85, 247, 0.45);">
          <div class="ai-card-badge-header">
            <span class="ai-card-title">🤖 SURVEILLANCE AI ASSISTANT (OFFLINE)</span>
            <span style="font-size: 0.72rem; color: #a855f7; font-weight: 800; background: rgba(168, 85, 247, 0.15); padding: 2px 8px; border-radius: 4px;">100% LOCAL & OFFLINE</span>
          </div>
          <p style="color: #cbd5e1; font-size: 0.88rem; margin: 0; line-height: 1.5; font-weight: 700;">
            HELLO! I AM YOUR OFFLINE AI ASSISTANT. ACTIVE GAMING DATE: <span style="color: #38bdf8; font-family: monospace;">${dispDate}</span>.
          </p>
          <div style="color: #94a3b8; font-size: 0.8rem; font-weight: 600; line-height: 1.4;">
            YOU CAN ASK ME ANY QUESTION ABOUT:
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0;">
            <span style="background: rgba(255,255,255,0.06); padding: 3px 8px; border-radius: 4px; font-size: 0.74rem; color: #38bdf8; font-weight: 800;">👤 GUEST DETAILS</span>
            <span style="background: rgba(255,255,255,0.06); padding: 3px 8px; border-radius: 4px; font-size: 0.74rem; color: #34d399; font-weight: 800;">💰 TOTAL IN</span>
            <span style="background: rgba(255,255,255,0.06); padding: 3px 8px; border-radius: 4px; font-size: 0.74rem; color: #f87171; font-weight: 800;">💸 TOTAL OUT</span>
            <span style="background: rgba(255,255,255,0.06); padding: 3px 8px; border-radius: 4px; font-size: 0.74rem; color: #fbbf24; font-weight: 800;">⚖️ RESULT</span>
            <span style="background: rgba(255,255,255,0.06); padding: 3px 8px; border-radius: 4px; font-size: 0.74rem; color: #c084fc; font-weight: 800;">📋 ALL ENTRIES</span>
            <span style="background: rgba(255,255,255,0.06); padding: 3px 8px; border-radius: 4px; font-size: 0.74rem; color: #60a5fa; font-weight: 800;">📅 GAMING DATE SELECT</span>
          </div>
          <span style="color: #64748b; font-size: 0.74rem; font-weight: 700;">CLICK ANY QUICK ACTION BUTTON ABOVE OR TYPE A QUESTION BELOW!</span>
        </div>
      </div>
    `;
  }

  function appendAiMessage(role, htmlContent) {
    if (!aiChatMessages) return;
    const row = document.createElement('div');
    row.className = `ai-msg-row ${role}`;
    if (role === 'user') {
      row.innerHTML = `<div class="ai-user-bubble">${htmlContent}</div>`;
    } else {
      row.innerHTML = htmlContent;
    }
    aiChatMessages.appendChild(row);
    aiChatMessages.scrollTop = aiChatMessages.scrollHeight;

    // Attach listeners on any interactive buttons inside assistant response
    row.querySelectorAll('.ai-open-guest-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const gName = btn.getAttribute('data-guest');
        const activeDate = aiDatePicker ? aiDatePicker.value : (currentBusinessDateStr || currentBusinessDate || getBusinessDate());
        if (gName) {
          const openFn = typeof openGuestSummaryPopup === 'function' ? openGuestSummaryPopup : window.openGuestSummaryPopup;
          const candidateList = (typeof allEntries !== 'undefined' && Array.isArray(allEntries) && allEntries.length > 0)
            ? allEntries
            : (window.allEntries || []);
          if (openFn) openFn(gName, candidateList, activeDate);
        }
      });
    });
    row.querySelectorAll('.ai-ask-suggest-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const q = btn.getAttribute('data-query');
        if (q) executeAiQuery(q);
      });
    });
  }

  window.executeAiQuery = executeAiQuery;
  async function executeAiQuery(rawQuery) {
    if (!rawQuery || !rawQuery.trim()) return;
    const query = rawQuery.trim();
    if (aiQueryInput) aiQueryInput.value = '';

    // HIDE UNNECESSARY THINGS WHEN SHOWING RESULT:
    // 1. Hide the quick action chips bar to maximize result area
    const chipsBar = aiAssistantModal ? aiAssistantModal.querySelector('.ai-chips-bar') : null;
    if (chipsBar) {
      chipsBar.style.setProperty('display', 'none', 'important');
    }

    // 2. Clear out the welcome card and previous queries so ONLY the search result is displayed
    if (aiChatMessages) {
      aiChatMessages.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:center; padding: 40px 20px; gap: 12px; color: #a855f7;">
          <div class="spinner" style="width: 24px; height: 24px; border-width: 2.5px; border-color: #c084fc; border-top-color: transparent;"></div>
          <span style="font-size: 0.9rem; font-weight: 800; letter-spacing: 0.8px; color: #cbd5e1;">SEARCHING SURVEILLANCE RECORDS...</span>
        </div>
      `;
    }

    let candidateList = (typeof allEntries !== 'undefined' && Array.isArray(allEntries) && allEntries.length > 0)
      ? allEntries
      : ((typeof window !== 'undefined' && Array.isArray(window.allEntries)) ? window.allEntries : []);

    if (candidateList.length === 0 && typeof fetchEntries === 'function') {
      try {
        await fetchEntries();
        candidateList = (typeof allEntries !== 'undefined' && Array.isArray(allEntries) && allEntries.length > 0)
          ? allEntries
          : ((typeof window !== 'undefined' && Array.isArray(window.allEntries)) ? window.allEntries : []);
      } catch (e) {
        console.warn('AI fetch fallback error:', e);
      }
    }

    let targetDate = aiDatePicker ? aiDatePicker.value : (currentBusinessDateStr || currentBusinessDate || getBusinessDate());

    // Check for explicit date mentioned in query
    const dateMatch = query.match(/\b(\d{2})[-/](\d{2})[-/](\d{4})\b/);
    if (dateMatch) {
      targetDate = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
      if (aiDatePicker) aiDatePicker.value = targetDate;
    } else {
      const isoDateMatch = query.match(/\b(\d{4})[-/](\d{2})[-/](\d{2})\b/);
      if (isoDateMatch) {
        targetDate = isoDateMatch[0].replace(/\//g, '-');
        if (aiDatePicker) aiDatePicker.value = targetDate;
      } else if (/\byesterday\b/i.test(query)) {
        const d = new Date(targetDate);
        d.setDate(d.getDate() - 1);
        targetDate = d.toISOString().split('T')[0];
        if (aiDatePicker) aiDatePicker.value = targetDate;
      } else if (/\btoday\b/i.test(query)) {
        targetDate = currentBusinessDateStr || currentBusinessDate || getBusinessDate();
        if (aiDatePicker) aiDatePicker.value = targetDate;
      }
    }

    const dispDate = formatDisplayDate(targetDate);
    if (aiSelectedDateBadge) {
      aiSelectedDateBadge.textContent = dispDate;
    }

    // Filter candidate entries for target date
    const dateEntries = candidateList.filter(e => {
      const eDate = getEntryDate(e);
      return eDate === targetDate;
    });

    const answerHtml = processOfflineAiQuestion(query, targetDate, dispDate, dateEntries, candidateList);

    // ONLY DISPLAY THE RESULT CARD DIRECTLY (No extra headers, no reset bar)
    if (aiChatMessages) {
      aiChatMessages.innerHTML = '';
      const resultCard = document.createElement('div');
      resultCard.className = 'ai-msg-row assistant ai-result-only-view';
      resultCard.style.width = '100%';
      resultCard.innerHTML = answerHtml;
      aiChatMessages.appendChild(resultCard);
      aiChatMessages.scrollTop = 0;

      // Re-attach listeners for interactive buttons inside the result card
      resultCard.querySelectorAll('.ai-open-guest-btn').forEach(btn => {
        btn.addEventListener('click', () => {
        const gName = btn.getAttribute('data-guest');
        const activeDate = aiDatePicker ? aiDatePicker.value : (currentBusinessDateStr || currentBusinessDate || getBusinessDate());
        if (gName) {
            const openFn = typeof openGuestSummaryPopup === 'function' ? openGuestSummaryPopup : window.openGuestSummaryPopup;
            const candidateList = (typeof allEntries !== 'undefined' && Array.isArray(allEntries) && allEntries.length > 0)
              ? allEntries
              : (window.allEntries || []);
            if (openFn) openFn(gName, candidateList, activeDate);
          }
        });
      });
      resultCard.querySelectorAll('.ai-ask-suggest-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const q = btn.getAttribute('data-query');
          if (q) executeAiQuery(q);
        });
      });
      resultCard.querySelectorAll('.ai-btn-show-date-all').forEach(btn => {
        btn.addEventListener('click', () => {
          const d = btn.getAttribute('data-date');
          if (typeof window.aiShowDateAllEntries === 'function') {
            window.aiShowDateAllEntries(d);
          } else if (typeof executeAiQuery === 'function') {
            executeAiQuery('ALL ENTRIES');
          }
        });
      });
    }

    if (window.lucide) lucide.createIcons();
  }

  function processOfflineAiQuestion(query, targetDate, dispDate, dateEntries, fullEntriesList) {
    const qLower = query.toLowerCase().trim();
    const candidateList = (Array.isArray(fullEntriesList) && fullEntriesList.length > 0)
      ? fullEntriesList
      : ((typeof allEntries !== 'undefined' && Array.isArray(allEntries) && allEntries.length > 0)
          ? allEntries
          : (window.allEntries || []));
    const barredList = (typeof globalBarredList !== 'undefined' && Array.isArray(globalBarredList) && globalBarredList.length > 0)
      ? globalBarredList
      : (window.globalBarredList || []);
    const clusterFn = (typeof getGuestCluster === 'function')
      ? getGuestCluster
      : (window.getGuestCluster || function(t, c) { return { canonicalName: (t||'').toUpperCase(), entries: [] }; });

    // 0. Detect if query is targeted at a specific guest (No hardcoded names)
    let detectedGuest = null;
    const allUniqueGuests = Array.from(new Set(candidateList.map(e => (e.guestname || '').trim()).filter(Boolean)));
    // Sort longer names first so fuller names match first
    allUniqueGuests.sort((a, b) => b.length - a.length);

    // Pure general overall commands should not match guest names
    const isGeneralQuery = /^(overall\s*total\s*in|total\s*in\s*overall|total\s*in\s*today|today.*total\s*in|how\s*much.*in$|total\s*drop|total\s*cashin|^total\s*in$|overall\s*total\s*out|total\s*out\s*overall|total\s*out\s*today|today.*total\s*out|how\s*much.*out$|total\s*cashout|total\s*paid|^total\s*out$|overall\s*result|gaming\s*result|today\s*result|net\s*result|overall\s*performance|^result$|all\s*entries|how\s*many\s*entries|entries\s*count|all\s*records|^entries$|selected\s*date|that\s*day|day\s*entries|show\s*entries|date|sent[ae]nce.*|.*sent[ae]nce.*|perticular\s*day|particular\s*day|top\s*guests?|top\s*patrons?|major\s*patrons?|major\s*guests?|biggest\s*players?)$/i.test(qLower) || /^\d{2}[-/]\d{2}[-/]\d{4}$/.test(qLower) || /^\d{4}[-/]\d{2}[-/]\d{2}$/.test(qLower);

    if (!isGeneralQuery) {
      for (const g of allUniqueGuests) {
        if (g.length >= 2 && qLower.includes(g.toLowerCase())) {
          detectedGuest = g;
          break;
        }
      }

      if (!detectedGuest) {
        const cleanWords = qLower
          .replace(/total\s*in|total\s*out|result|entries|entry|detail|details|info|guest|patron|how\s*much|what\s*is|tell\s*me\s*about|summary\s*of|show|for|of|on|at|selected|that\s*day|day|date|sent[ae]nce\s*form|sent[ae]nce|perticular|particular|\?/g, '')
          .trim();
        if (cleanWords.length >= 2) {
          for (const g of allUniqueGuests) {
            if (g.toLowerCase().includes(cleanWords) || cleanWords.includes(g.toLowerCase())) {
              detectedGuest = g;
              break;
            }
          }
          if (!detectedGuest && !/^(total|result|entries|in|out|drop|paid|today|yesterday|date|day|sentence|sentences|form)$/i.test(cleanWords)) {
            detectedGuest = cleanWords.toUpperCase();
          }
        }
      }
    }

    // 1. Overall Total In (Cashin / Drop)
    if (!detectedGuest && /overall\s*total\s*in|total\s*in\s*overall|total\s*in\s*today|today.*total\s*in|how\s*much.*in$|total\s*drop|total\s*cashin|^total\s*in$/i.test(qLower)) {
      let totalIn = 0;
      let countIn = 0;
      const guestSums = {};

      dateEntries.forEach(e => {
        const amt = Number(e.amount) || 0;
        if (isTotalInType(e.type)) {
          totalIn += amt;
          countIn++;
          const g = (e.guestname || 'UNKNOWN').trim().toUpperCase();
          guestSums[g] = (guestSums[g] || 0) + amt;
        }
      });

      const topGuests = Object.entries(guestSums)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      return `
        <div class="ai-assistant-card">
          <div class="ai-card-badge-header">
            <span class="ai-card-title">💰 OVERALL TOTAL IN (CASHIN / DROP)</span>
            <span style="font-size: 0.75rem; color: #38bdf8; font-weight: 800; font-family: monospace;">📅 ${dispDate}</span>
          </div>
          <div style="text-align: center; padding: 12px; background: rgba(0, 0, 0, 0.4); border-radius: 8px; border: 1.5px solid rgba(56, 189, 248, 0.4);">
            <div style="font-size: 0.8rem; color: #94a3b8; font-weight: 800;">TOTAL CASH INFLOW</div>
            <div style="font-size: 1.8rem; font-weight: 900; color: #38bdf8; font-family: 'JetBrains Mono', monospace; margin: 4px 0;">₹${formatIndianNumber(totalIn)}</div>
            <div style="font-size: 0.78rem; color: #cbd5e1; font-weight: 700;">${countIn} CASHIN TRANSACTIONS ACROSS ${Object.keys(guestSums).length} GUESTS</div>
          </div>
          ${topGuests.length > 0 ? `
            <div style="font-size: 0.78rem; color: #94a3b8; font-weight: 800; text-transform: uppercase;">TOP CASHIN GUESTS ON THIS DATE:</div>
            <div style="display: flex; flex-direction: column; gap: 4px;">
              ${topGuests.map(([name, sum], idx) => `
                <div class="ai-entry-row" style="cursor: pointer;" onclick="(typeof window.aiQueryGuest === 'function' ? window.aiQueryGuest('${escapeHTML(name)}') : null)">
                  <span style="font-weight: 800; color: #ffffff;">#${idx + 1} ${escapeHTML(name)}</span>
                  <span style="font-weight: 900; color: #38bdf8;">₹${formatIndianNumber(sum)}</span>
                </div>
              `).join('')}
            </div>
          ` : '<div style="color: #94a3b8; font-size: 0.82rem; text-align: center;">NO CASHIN ENTRIES RECORDED FOR THIS DATE.</div>'}
        </div>
      `;
    }

    // 2. Overall Total Out (Cashout / Paid)
    if (!detectedGuest && /overall\s*total\s*out|total\s*out\s*overall|total\s*out\s*today|today.*total\s*out|how\s*much.*out$|total\s*cashout|total\s*paid|^total\s*out$/i.test(qLower)) {
      let totalOut = 0;
      let countOut = 0;
      const guestSums = {};

      dateEntries.forEach(e => {
        const amt = Number(e.amount) || 0;
        if (isTotalOutType(e.type)) {
          totalOut += amt;
          countOut++;
          const g = (e.guestname || 'UNKNOWN').trim().toUpperCase();
          guestSums[g] = (guestSums[g] || 0) + amt;
        }
      });

      const topGuests = Object.entries(guestSums)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      return `
        <div class="ai-assistant-card">
          <div class="ai-card-badge-header">
            <span class="ai-card-title">💸 OVERALL TOTAL OUT (CASHOUT / PAID)</span>
            <span style="font-size: 0.75rem; color: #38bdf8; font-weight: 800; font-family: monospace;">📅 ${dispDate}</span>
          </div>
          <div style="text-align: center; padding: 12px; background: rgba(0, 0, 0, 0.4); border-radius: 8px; border: 1.5px solid rgba(239, 68, 68, 0.4);">
            <div style="font-size: 0.8rem; color: #94a3b8; font-weight: 800;">TOTAL CASHOUT OUTFLOW</div>
            <div style="font-size: 1.8rem; font-weight: 900; color: #f87171; font-family: 'JetBrains Mono', monospace; margin: 4px 0;">₹${formatIndianNumber(totalOut)}</div>
            <div style="font-size: 0.78rem; color: #cbd5e1; font-weight: 700;">${countOut} CASHOUT TRANSACTIONS ACROSS ${Object.keys(guestSums).length} GUESTS</div>
          </div>
          ${topGuests.length > 0 ? `
            <div style="font-size: 0.78rem; color: #94a3b8; font-weight: 800; text-transform: uppercase;">TOP CASHOUT GUESTS ON THIS DATE:</div>
            <div style="display: flex; flex-direction: column; gap: 4px;">
              ${topGuests.map(([name, sum], idx) => `
                <div class="ai-entry-row" style="cursor: pointer;" onclick="(typeof window.aiQueryGuest === 'function' ? window.aiQueryGuest('${escapeHTML(name)}') : null)">
                  <span style="font-weight: 800; color: #ffffff;">#${idx + 1} ${escapeHTML(name)}</span>
                  <span style="font-weight: 900; color: #f87171;">₹${formatIndianNumber(sum)}</span>
                </div>
              `).join('')}
            </div>
          ` : '<div style="color: #94a3b8; font-size: 0.82rem; text-align: center;">NO CASHOUT ENTRIES RECORDED FOR THIS DATE.</div>'}
        </div>
      `;
    }

    // 3. Overall Result & Performance
    if (!detectedGuest && /overall\s*result|gaming\s*result|today\s*result|net\s*result|overall\s*performance|^result$|how\s*did\s*we\s*do|win\s*or\s*loss|pnl|profit/i.test(qLower)) {
      // Consolidate entries by guest on this date
      const dateGuestsMap = {};
      dateEntries.forEach(e => {
        const raw = (e.guestname || 'UNKNOWN').trim();
        if (!raw) return;
        const canonical = clusterFn(raw, dateEntries).canonicalName || raw.toUpperCase();
        if (!dateGuestsMap[canonical]) {
          dateGuestsMap[canonical] = { name: canonical, totalIn: 0, totalOut: 0, count: 0 };
        }
        const amt = Number(e.amount) || 0;
        if (isTotalInType(e.type)) dateGuestsMap[canonical].totalIn += amt;
        else if (isTotalOutType(e.type)) dateGuestsMap[canonical].totalOut += amt;
        dateGuestsMap[canonical].count++;
      });

      const dateGuestList = Object.values(dateGuestsMap).sort((a, b) => b.totalIn - a.totalIn);

      let totalIn = 0;
      let totalOut = 0;
      dateGuestList.forEach(g => {
        totalIn += g.totalIn;
        totalOut += g.totalOut;
      });

      const netResult = totalOut - totalIn;
      const isNegative = netResult < 0;
      // USER RULE: IF NEGATIVE THAN RED, NO COLOUR FOR OTHER (#FFFFFF)
      const resColor = isNegative ? '#FF0000' : '#FFFFFF';
      const resFormatted = formatIndianNumber(Math.abs(netResult));
      const sortedDayEntries = [...dateEntries].sort((a, b) => (a.datetime || '').localeCompare(b.datetime || ''));

      return `
        <div class="ai-assistant-card">
          <div class="ai-card-badge-header">
            <span class="ai-card-title">⚖️ OVERALL GAMING RESULT & PERFORMANCE</span>
            <span style="font-size: 0.75rem; color: #38bdf8; font-weight: 800; font-family: monospace;">📅 ${dispDate}</span>
          </div>
          <div class="ai-stat-grid">
            <div class="ai-stat-box">
              <span class="ai-stat-label">TOTAL IN</span>
              <span class="ai-stat-val">₹${formatIndianNumber(totalIn)}</span>
            </div>
            <div class="ai-stat-box">
              <span class="ai-stat-label">TOTAL OUT</span>
              <span class="ai-stat-val">₹${formatIndianNumber(totalOut)}</span>
            </div>
            <div class="ai-stat-box ${isNegative ? 'is-negative' : ''}" style="border-color: ${isNegative ? '#FF0000' : 'rgba(255,255,255,0.1)'};">
              <span class="ai-stat-label">RESULT</span>
              <span class="ai-stat-val ${isNegative ? 'is-negative' : ''}" style="color: ${resColor}; font-weight: 900;">₹${resFormatted}</span>
            </div>
          </div>

          <!-- ENTRIES OF SELECTED DATE (Matching user drawing) -->
          <div class="ai-date-entries-box">
            <div class="ai-date-entries-title">
              ENTRIES OF SELECTED DATE
            </div>
            <div class="ai-entries-table-wrap">
              <table class="ai-entries-table">
                <thead>
                  <tr>
                    <th>DATE</th>
                    <th>GUEST NAME</th>
                    <th>TOTAL IN</th>
                    <th>TOTAL OUT</th>
                    <th>RESULT</th>
                  </tr>
                </thead>
                <tbody>
                  ${dateGuestList.length === 0 ? `
                    <tr>
                      <td colspan="5" style="padding: 14px; color: #94a3b8; font-weight: 700;">
                        NO ENTRIES RECORDED ON ${dispDate}
                      </td>
                    </tr>
                  ` : `
                    ${dateGuestList.map(g => {
                      const gNet = g.totalOut - g.totalIn;
                      const gIsNeg = gNet < 0;
                      const gResColor = gIsNeg ? '#FF0000' : '#FFFFFF';
                      const gResFormatted = formatIndianNumber(Math.abs(gNet));
                      return `
                        <tr>
                          <td>${dispDate}</td>
                          <td class="guest-clickable" onclick="(typeof window.aiQueryGuest === 'function' ? window.aiQueryGuest('${escapeHTML(g.name)}') : null)">${escapeHTML(g.name)}</td>
                          <td style="font-weight: 700;">₹${formatIndianNumber(g.totalIn)}</td>
                          <td style="font-weight: 700;">₹${formatIndianNumber(g.totalOut)}</td>
                          <td style="color: ${gResColor}; font-weight: 900;">₹${gResFormatted}</td>
                        </tr>
                      `;
                    }).join('')}
                    <tr style="background: rgba(255, 255, 255, 0.08); font-weight: 900; border-top: 1.5px solid rgba(255, 255, 255, 0.35);">
                      <td style="color: #38bdf8;">TOTAL</td>
                      <td style="text-align: center;">${dateGuestList.length} GUESTS (${dateEntries.length} TRANSACTIONS)</td>
                      <td>₹${formatIndianNumber(totalIn)}</td>
                      <td>₹${formatIndianNumber(totalOut)}</td>
                      <td style="color: ${resColor}; font-weight: 900;">₹${resFormatted}</td>
                    </tr>
                  `}
                </tbody>
              </table>
            </div>
          </div>

          <!-- ENTRIES IN SENTENCE FORM (SHOW OF PARTICULAR DAY) -->
          <div class="ai-date-entries-box" style="margin-top: 14px;">
            <div class="ai-date-entries-title" style="display: flex; justify-content: space-between; align-items: center;">
              <span>📝 ENTRIES IN SENTENCE FORM (${dispDate})</span>
              <span style="font-size: 0.75rem; color: #38bdf8; font-weight: 800; font-family: monospace;">${sortedDayEntries.length} ${sortedDayEntries.length === 1 ? 'TRANSACTION' : 'TRANSACTIONS'}</span>
            </div>
            ${sortedDayEntries.length === 0 ? `
              <div style="text-align: center; color: #94a3b8; padding: 16px; font-weight: 700;">
                NO TRANSACTIONS RECORDED ON ${dispDate}
              </div>
            ` : `
              <div style="display: flex; flex-direction: column; gap: 8px; max-height: 320px; overflow-y: auto; padding-right: 4px;">
                ${sortedDayEntries.map(e => {
                  const dt = parseEntryDateTime(e.datetime);
                  const time = dt.time || '--:--';
                  const typeClean = (e.type || '').toLowerCase().replace(/[\/\s]/g, '-');
                  const sentence = getEntrySentence(e, true);
                  const isCredit = isTotalInType(e.type);
                  const borderCol = isCredit ? '#10b981' : '#ef4444';
                  return `
                    <div class="sentence-item ${typeClean}" style="display: flex; align-items: center; gap: 12px; padding: 8px 12px; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.12); border-left: 4px solid ${borderCol}; font-family: 'JetBrains Mono', Consolas, monospace; font-size: 0.86rem; background: rgba(10, 16, 32, 0.65);">
                      <span style="color: #38bdf8; font-weight: 800; min-width: 48px; flex-shrink: 0; letter-spacing: 0.5px;">${time}</span>
                      <span style="color: #ffffff; font-weight: 700; flex: 1; word-break: break-word;">${sentence}</span>
                    </div>
                  `;
                }).join('')}
              </div>
            `}
          </div>
        </div>
      `;
    }

    // 4. All Entries Summary / Date Entries / Sentences View
    if (!detectedGuest && (/all\s*entries|how\s*many\s*entries|entries\s*count|all\s*records|^entries$|selected\s*date|that\s*day|day\s*entries|show\s*entries|sent[ae]nce|particular|perticular/i.test(qLower) || /^\d{2}[-/]\d{2}[-/]\d{4}$/.test(qLower) || /^\d{4}[-/]\d{2}[-/]\d{2}$/.test(qLower))) {
      // Consolidate entries by guest on this date
      const dateGuestsMap = {};
      dateEntries.forEach(e => {
        const raw = (e.guestname || 'UNKNOWN').trim();
        if (!raw) return;
        const canonical = clusterFn(raw, dateEntries).canonicalName || raw.toUpperCase();
        if (!dateGuestsMap[canonical]) {
          dateGuestsMap[canonical] = { name: canonical, totalIn: 0, totalOut: 0, count: 0 };
        }
        const amt = Number(e.amount) || 0;
        if (isTotalInType(e.type)) dateGuestsMap[canonical].totalIn += amt;
        else if (isTotalOutType(e.type)) dateGuestsMap[canonical].totalOut += amt;
        dateGuestsMap[canonical].count++;
      });

      const dateGuestList = Object.values(dateGuestsMap).sort((a, b) => b.totalIn - a.totalIn);

      let totalIn = 0;
      let totalOut = 0;
      dateGuestList.forEach(g => {
        totalIn += g.totalIn;
        totalOut += g.totalOut;
      });

      const netResult = totalOut - totalIn;
      const isNegative = netResult < 0;
      const resColor = isNegative ? '#FF0000' : '#FFFFFF';
      const resFormatted = formatIndianNumber(Math.abs(netResult));
      const sortedDayEntries = [...dateEntries].sort((a, b) => (a.datetime || '').localeCompare(b.datetime || ''));

      return `
        <div class="ai-assistant-card">
          <div class="ai-card-badge-header">
            <span class="ai-card-title">📋 ALL ENTRIES OVERVIEW</span>
            <span style="font-size: 0.75rem; color: #38bdf8; font-weight: 800; font-family: monospace;">📅 ${dispDate}</span>
          </div>
          <div class="ai-stat-grid">
            <div class="ai-stat-box">
              <span class="ai-stat-label">TOTAL IN</span>
              <span class="ai-stat-val">₹${formatIndianNumber(totalIn)}</span>
            </div>
            <div class="ai-stat-box">
              <span class="ai-stat-label">TOTAL OUT</span>
              <span class="ai-stat-val">₹${formatIndianNumber(totalOut)}</span>
            </div>
            <div class="ai-stat-box ${isNegative ? 'is-negative' : ''}" style="border-color: ${isNegative ? '#FF0000' : 'rgba(255,255,255,0.1)'};">
              <span class="ai-stat-label">RESULT</span>
              <span class="ai-stat-val ${isNegative ? 'is-negative' : ''}" style="color: ${resColor}; font-weight: 900;">₹${resFormatted}</span>
            </div>
          </div>

          <!-- ENTRIES OF SELECTED DATE (Matching user drawing) -->
          <div class="ai-date-entries-box">
            <div class="ai-date-entries-title">
              ENTRIES OF SELECTED DATE
            </div>
            <div class="ai-entries-table-wrap">
              <table class="ai-entries-table">
                <thead>
                  <tr>
                    <th>DATE</th>
                    <th>GUEST NAME</th>
                    <th>TOTAL IN</th>
                    <th>TOTAL OUT</th>
                    <th>RESULT</th>
                  </tr>
                </thead>
                <tbody>
                  ${dateGuestList.length === 0 ? `
                    <tr>
                      <td colspan="5" style="padding: 14px; color: #94a3b8; font-weight: 700;">
                        NO ENTRIES RECORDED ON ${dispDate}
                      </td>
                    </tr>
                  ` : `
                    ${dateGuestList.map(g => {
                      const gNet = g.totalOut - g.totalIn;
                      const gIsNeg = gNet < 0;
                      const gResColor = gIsNeg ? '#FF0000' : '#FFFFFF';
                      const gResFormatted = formatIndianNumber(Math.abs(gNet));
                      return `
                        <tr>
                          <td>${dispDate}</td>
                          <td class="guest-clickable" onclick="(typeof window.aiQueryGuest === 'function' ? window.aiQueryGuest('${escapeHTML(g.name)}') : null)">${escapeHTML(g.name)}</td>
                          <td style="font-weight: 700;">₹${formatIndianNumber(g.totalIn)}</td>
                          <td style="font-weight: 700;">₹${formatIndianNumber(g.totalOut)}</td>
                          <td style="color: ${gResColor}; font-weight: 900;">₹${gResFormatted}</td>
                        </tr>
                      `;
                    }).join('')}
                    <tr style="background: rgba(255, 255, 255, 0.08); font-weight: 900; border-top: 1.5px solid rgba(255, 255, 255, 0.35);">
                      <td style="color: #38bdf8;">TOTAL</td>
                      <td style="text-align: center;">${dateGuestList.length} GUESTS (${dateEntries.length} TRANSACTIONS)</td>
                      <td>₹${formatIndianNumber(totalIn)}</td>
                      <td>₹${formatIndianNumber(totalOut)}</td>
                      <td style="color: ${resColor}; font-weight: 900;">₹${resFormatted}</td>
                    </tr>
                  `}
                </tbody>
              </table>
            </div>
          </div>

          <!-- ENTRIES IN SENTENCE FORM (SHOW OF PARTICULAR DAY) -->
          <div class="ai-date-entries-box" style="margin-top: 14px;">
            <div class="ai-date-entries-title" style="display: flex; justify-content: space-between; align-items: center;">
              <span>📝 ENTRIES IN SENTENCE FORM (${dispDate})</span>
              <span style="font-size: 0.75rem; color: #38bdf8; font-weight: 800; font-family: monospace;">${sortedDayEntries.length} ${sortedDayEntries.length === 1 ? 'TRANSACTION' : 'TRANSACTIONS'}</span>
            </div>
            ${sortedDayEntries.length === 0 ? `
              <div style="text-align: center; color: #94a3b8; padding: 16px; font-weight: 700;">
                NO TRANSACTIONS RECORDED ON ${dispDate}
              </div>
            ` : `
              <div style="display: flex; flex-direction: column; gap: 8px; max-height: 320px; overflow-y: auto; padding-right: 4px;">
                ${sortedDayEntries.map(e => {
                  const dt = parseEntryDateTime(e.datetime);
                  const time = dt.time || '--:--';
                  const typeClean = (e.type || '').toLowerCase().replace(/[\/\s]/g, '-');
                  const sentence = getEntrySentence(e, true);
                  const isCredit = isTotalInType(e.type);
                  const borderCol = isCredit ? '#10b981' : '#ef4444';
                  return `
                    <div class="sentence-item ${typeClean}" style="display: flex; align-items: center; gap: 12px; padding: 8px 12px; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.12); border-left: 4px solid ${borderCol}; font-family: 'JetBrains Mono', Consolas, monospace; font-size: 0.86rem; background: rgba(10, 16, 32, 0.65);">
                      <span style="color: #38bdf8; font-weight: 800; min-width: 48px; flex-shrink: 0; letter-spacing: 0.5px;">${time}</span>
                      <span style="color: #ffffff; font-weight: 700; flex: 1; word-break: break-word;">${sentence}</span>
                    </div>
                  `;
                }).join('')}
              </div>
            `}
          </div>
        </div>
      `;
    }

    // 5. Top Guests / Major Patrons
    if (!detectedGuest && /top\s*guest|top\s*patron|major\s*patron|major\s*guest|biggest|highest/i.test(qLower)) {
      const guestGroups = {};
      dateEntries.forEach(e => {
        const raw = (e.guestname || '').trim();
        if (!raw) return;
        const canonical = clusterFn(raw, dateEntries).canonicalName || raw.toUpperCase();
        if (!guestGroups[canonical]) guestGroups[canonical] = { in: 0, out: 0, entries: 0 };
        const amt = Number(e.amount) || 0;
        if (isTotalInType(e.type)) guestGroups[canonical].in += amt;
        else if (isTotalOutType(e.type)) guestGroups[canonical].out += amt;
        guestGroups[canonical].entries++;
      });

      const ranked = Object.entries(guestGroups)
        .map(([name, d]) => ({ name, ...d, result: d.out - d.in }))
        .sort((a, b) => b.in - a.in)
        .slice(0, 8);

      return `
        <div class="ai-assistant-card">
          <div class="ai-card-badge-header">
            <span class="ai-card-title">⭐ TOP MAJOR PATRONS / GUESTS</span>
            <span style="font-size: 0.75rem; color: #38bdf8; font-weight: 800; font-family: monospace;">📅 ${dispDate}</span>
          </div>
          ${ranked.length > 0 ? `
            <div style="display: flex; flex-direction: column; gap: 6px;">
              ${ranked.map((g, idx) => {
                const resColor = g.result < 0 ? '#FF0000' : '#FFFFFF';
                return `
                  <div class="ai-entry-row" style="cursor: pointer;" onclick="(typeof window.aiQueryGuest === 'function' ? window.aiQueryGuest('${escapeHTML(g.name)}') : null)">
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <span style="color: #fbbf24; font-weight: 900;">#${idx + 1}</span>
                      <span style="font-weight: 800; color: #ffffff;">${escapeHTML(g.name)}</span>
                      <span style="font-size: 0.7rem; color: #94a3b8;">(${g.entries} entries)</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px;">
                      <span style="color: #38bdf8; font-weight: 900;">IN: ₹${formatIndianNumber(g.in)}</span>
                      <span style="color: ${resColor}; font-weight: 900;">RES: ₹${formatIndianNumber(Math.abs(g.result))}</span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          ` : '<div style="color: #94a3b8; font-size: 0.82rem; text-align: center;">NO PATRON ACTIVITY RECORDED FOR THIS DATE.</div>'}
        </div>
      `;
    }

    // 6. Barred Guests Check
    if (/barred|banned|blacklist/i.test(qLower)) {
      const words = qLower.replace(/is|guest|patron|barred|banned|blacklisted|check|\?/g, '').trim();
      if (words.length > 1) {
        const found = barredList.filter(b => {
          const bName = String(b.guestname || b.Name || b['Guest Name'] || b.name || '').toLowerCase();
          return bName.includes(words) || words.includes(bName);
        });

        if (found.length > 0) {
          const bg = found[0];
          return `
            <div class="ai-assistant-card" style="border-color: #ef4444;">
              <div class="ai-card-badge-header">
                <span class="ai-card-title" style="color: #ef4444;">🚨 ALERT: BARRED GUEST FOUND</span>
                <span style="font-size: 0.72rem; background: #ef4444; color: #fff; font-weight: 900; padding: 2px 8px; border-radius: 4px;">BARRED</span>
              </div>
              <div style="background: rgba(239, 68, 68, 0.15); border: 1.2px solid rgba(239, 68, 68, 0.4); border-radius: 8px; padding: 12px;">
                <div style="font-size: 1.1rem; font-weight: 900; color: #ffffff; margin-bottom: 6px;">${escapeHTML((bg.guestname || bg.Name || words).toUpperCase())}</div>
                <div style="font-size: 0.84rem; color: #fca5a5; font-weight: 700; margin-bottom: 4px;">REASON: <span style="color: #ef4444; font-weight: 900;">${escapeHTML(String(bg.reason || bg.Reason || 'BARRED').toUpperCase())}</span></div>
                <div style="font-size: 0.82rem; color: #cbd5e1; font-weight: 600;">DATE: ${escapeHTML(String(bg.date || bg.Date || '-'))}</div>
                <div style="font-size: 0.82rem; color: #cbd5e1; font-weight: 600;">INSTRUCTION: ${escapeHTML(String(bg.inst || bg.Inst || 'MANAGEMENT').toUpperCase())}</div>
                <div style="font-size: 0.82rem; color: #cbd5e1; font-weight: 600;">PROPERTY: ${escapeHTML(String(bg.property || bg.Property || 'CADILLAC').toUpperCase())}</div>
              </div>
            </div>
          `;
        } else {
          return `
            <div class="ai-assistant-card">
              <div class="ai-card-badge-header">
                <span class="ai-card-title" style="color: #34d399;">✅ GUEST IS NOT BARRED</span>
              </div>
              <p style="color: #cbd5e1; font-size: 0.88rem; margin: 0; font-weight: 700;">
                NO BARRED RECORDS FOUND FOR <span style="color: #38bdf8;">"${escapeHTML(words.toUpperCase())}"</span> IN THE SURVEILLANCE BARRED DIRECTORY.
              </p>
            </div>
          `;
        }
      }

      return `
        <div class="ai-assistant-card">
          <div class="ai-card-badge-header">
            <span class="ai-card-title" style="color: #ef4444;">🚫 BARRED GUESTS DIRECTORY</span>
            <span style="font-size: 0.72rem; color: #ef4444; font-weight: 900; background: rgba(239, 68, 68, 0.15); padding: 2px 8px; border-radius: 4px;">${barredList.length} TOTAL BARRED</span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 6px; max-height: 220px; overflow-y: auto;">
            ${barredList.slice(0, 10).map(b => `
              <div class="ai-entry-row">
                <span style="font-weight: 800; color: #ffffff;">${escapeHTML(String(b.guestname || b.Name || b.name || '-').toUpperCase())}</span>
                <span style="color: #ef4444; font-weight: 800; font-size: 0.75rem;">${escapeHTML(String(b.reason || b.Reason || 'BARRED').toUpperCase())}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    // 7. Specific Guest Detail, Total In, Total Out, Result & Entries
    if (detectedGuest) {
      const allCluster = clusterFn(detectedGuest, candidateList);
      const canonicalName = allCluster.canonicalName || detectedGuest.toUpperCase();
      let allGuestEntries = (allCluster && Array.isArray(allCluster.entries) && allCluster.entries.length > 0)
        ? allCluster.entries
        : candidateList.filter(e => {
            const gn = (e.guestname || '').trim().toUpperCase();
            return gn === canonicalName || gn.includes(detectedGuest.toUpperCase()) || detectedGuest.toUpperCase().includes(gn);
          });

      if (allGuestEntries.length === 0) {
        return `
          <div class="ai-assistant-card">
            <div class="ai-card-badge-header">
              <span class="ai-card-title">👤 GUEST: ${escapeHTML(canonicalName)}</span>
              <span style="font-size: 0.72rem; color: #ef4444; font-weight: 800; background: rgba(239, 68, 68, 0.15); padding: 2px 8px; border-radius: 4px;">NO RECORDS</span>
            </div>
            <p style="color: #cbd5e1; font-size: 0.88rem; margin: 0; font-weight: 700;">
              NO TRANSACTION RECORDS FOUND FOR GUEST "${escapeHTML(canonicalName)}" IN THE SURVEILLANCE DATABASE.
            </p>
          </div>
        `;
      }

      // 1. Group all entries of this guest by date
      const guestDatesMap = {};
      allGuestEntries.forEach(e => {
        const dIso = getEntryDate(e) || (parseEntryDateTime(e.datetime).date);
        if (!dIso) return;
        if (!guestDatesMap[dIso]) {
          guestDatesMap[dIso] = { dateIso: dIso, totalIn: 0, totalOut: 0, count: 0 };
        }
        const amt = Number(e.amount) || 0;
        if (isTotalInType(e.type)) guestDatesMap[dIso].totalIn += amt;
        else if (isTotalOutType(e.type)) guestDatesMap[dIso].totalOut += amt;
        guestDatesMap[dIso].count++;
      });

      // Selected date summary
      const currentDayData = guestDatesMap[targetDate] || { totalIn: 0, totalOut: 0, count: 0 };
      const dayTotalIn = currentDayData.totalIn;
      const dayTotalOut = currentDayData.totalOut;
      const countTx = currentDayData.count;

      const dayNetResult = dayTotalOut - dayTotalIn;
      const isNegative = dayNetResult < 0;
      // USER RULE: IF NEGATIVE THAN RED, NO COLOUR FOR OTHER (#FFFFFF)
      const resColor = isNegative ? '#FF0000' : '#FFFFFF';
      const resFormatted = formatIndianNumber(Math.abs(dayNetResult));

      // 2. Barred Status Check
      const isBarred = barredList.some(b => {
        const bName = String(b.guestname || b.Name || b.name || '').toLowerCase();
        return bName && canonicalName.toLowerCase().includes(bName);
      });

      // Overall sum to check major patron status
      let allTotalIn = 0;
      let allTotalOut = 0;
      Object.values(guestDatesMap).forEach(d => {
        allTotalIn += d.totalIn;
        allTotalOut += d.totalOut;
      });
      const allNetResult = allTotalOut - allTotalIn;
      const allIsNegative = allNetResult < 0;
      const allResColor = allIsNegative ? '#FF0000' : '#FFFFFF';
      const allResFormatted = formatIndianNumber(Math.abs(allNetResult));

      const isMajor = dayTotalIn >= 1000000 || allTotalIn >= 1000000;
      const statusBadge = isBarred
        ? '<span style="background: #ef4444; color: #fff; font-size: 0.72rem; font-weight: 900; padding: 2px 8px; border-radius: 4px;">🚨 BARRED</span>'
        : (isMajor
            ? '<span style="background: rgba(251, 191, 36, 0.2); color: #fbbf24; border: 1px solid rgba(251, 191, 36, 0.4); font-size: 0.72rem; font-weight: 900; padding: 2px 8px; border-radius: 4px;">⭐ MAJOR PATRON</span>'
            : '<span style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; font-size: 0.72rem; font-weight: 800; padding: 2px 8px; border-radius: 4px;">PATRON</span>');

      // 3. Transactions count text for current day
      const txText = `${countTx} ${countTx === 1 ? 'TRANSACTION' : 'TRANSACTIONS'}`;
      const dayGuestEntries = allGuestEntries.filter(e => {
        const d = getEntryDate(e) || (parseEntryDateTime(e.datetime).date);
        return d === targetDate;
      });
      const sortedGuestDayEntries = [...dayGuestEntries].sort((a, b) => (a.datetime || '').localeCompare(b.datetime || ''));

      // Dates sorted descending
      const sortedDateKeys = Object.keys(guestDatesMap).sort((a, b) => b.localeCompare(a));
      const hasSelectedDateActivity = guestDatesMap[targetDate] !== undefined;
      const otherDateKeys = sortedDateKeys.filter(k => k !== targetDate);
      const lastEntryDateIso = sortedDateKeys[0] || '';
      const dispLastDate = lastEntryDateIso ? formatDisplayDate(lastEntryDateIso) : '';

      // Construct table rows: Consolidated row per date
      let tableRowsHtml = '';
      if (hasSelectedDateActivity) {
        tableRowsHtml += `
          <tr style="background: rgba(56, 189, 248, 0.12); border-left: 3px solid #38bdf8;">
            <td style="font-weight: 900; color: #38bdf8; white-space: nowrap;">${dispDate}</td>
            <td style="font-weight: 800;">${escapeHTML(canonicalName)}</td>
            <td style="font-weight: 700;">₹${formatIndianNumber(dayTotalIn)}</td>
            <td style="font-weight: 700;">₹${formatIndianNumber(dayTotalOut)}</td>
            <td style="color: ${resColor}; font-weight: 900;">₹${resFormatted}</td>
          </tr>
        `;
      } else {
        tableRowsHtml += `
          <tr style="background: rgba(255, 255, 255, 0.03); opacity: 0.7;">
            <td style="font-weight: 800; color: #94a3b8; white-space: nowrap;">${dispDate}</td>
            <td style="font-weight: 800;">${escapeHTML(canonicalName)}</td>
            <td style="font-weight: 700;">₹0</td>
            <td style="font-weight: 700;">₹0</td>
            <td style="font-weight: 700;">₹0</td>
          </tr>
        `;
      }

      // If guest has other dates recorded:
      otherDateKeys.forEach(dIso => {
        const item = guestDatesMap[dIso];
        const itemNet = item.totalOut - item.totalIn;
        const itemIsNeg = itemNet < 0;
        const itemResColor = itemIsNeg ? '#FF0000' : '#FFFFFF';
        const itemDisp = formatDisplayDate(dIso);
        tableRowsHtml += `
          <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.15);">
            <td style="cursor: pointer; text-decoration: underline; color: #38bdf8; font-weight: 700; white-space: nowrap;" title="Click to view this date" onclick="(typeof window.aiSwitchDate === 'function' ? window.aiSwitchDate('${dIso}', '${escapeHTML(canonicalName)}') : null)">${itemDisp}</td>
            <td style="font-weight: 800;">${escapeHTML(canonicalName)}</td>
            <td style="font-weight: 700;">₹${formatIndianNumber(item.totalIn)}</td>
            <td style="font-weight: 700;">₹${formatIndianNumber(item.totalOut)}</td>
            <td style="color: ${itemResColor}; font-weight: 900;">₹${formatIndianNumber(Math.abs(itemNet))}</td>
          </tr>
        `;
      });

      // If multiple dates exist in history, append overall total row
      if (sortedDateKeys.length > 1) {
        tableRowsHtml += `
          <tr style="background: rgba(255, 255, 255, 0.08); font-weight: 900; border-top: 1.5px solid rgba(255, 255, 255, 0.35);">
            <td style="color: #38bdf8;">OVERALL TOTAL</td>
            <td style="text-align: center;">${escapeHTML(canonicalName)} (${sortedDateKeys.length} DATES)</td>
            <td>₹${formatIndianNumber(allTotalIn)}</td>
            <td>₹${formatIndianNumber(allTotalOut)}</td>
            <td style="color: ${allResColor}; font-weight: 900;">₹${allResFormatted}</td>
          </tr>
        `;
      }

      return `
        <div class="ai-assistant-card">
          <!-- Card Header with Guest Name, Badge & Current Day Transactions -->
          <div class="ai-card-badge-header">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="ai-card-title">${escapeHTML(canonicalName)}</span>
              ${statusBadge}
            </div>
            <span style="font-size: 0.75rem; color: #38bdf8; font-weight: 800; font-family: monospace;">
              ${txText}
            </span>
          </div>

          <!-- Current Day Overview: TOTAL IN | TOTAL OUT | RESULT (Matching photo) -->
          <div class="ai-stat-grid">
            <div class="ai-stat-box">
              <span class="ai-stat-label">TOTAL IN</span>
              <span class="ai-stat-val">₹${formatIndianNumber(dayTotalIn)}</span>
            </div>
            <div class="ai-stat-box">
              <span class="ai-stat-label">TOTAL OUT</span>
              <span class="ai-stat-val">₹${formatIndianNumber(dayTotalOut)}</span>
            </div>
            <div class="ai-stat-box ${isNegative ? 'is-negative' : ''}" style="border-color: ${isNegative ? '#FF0000' : 'rgba(255,255,255,0.1)'};">
              <span class="ai-stat-label">RESULT</span>
              <span class="ai-stat-val ${isNegative ? 'is-negative' : ''}" style="color: ${resColor}; font-weight: 900;">₹${resFormatted}</span>
            </div>
          </div>
          ${countTx === 0 && lastEntryDateIso ? `
            <div style="font-size: 0.74rem; color: #94a3b8; font-weight: 700; text-align: center; margin-top: 4px;">
              NO TRANSACTIONS ON ${dispDate} · LAST RECORDED: <span style="color: #38bdf8; cursor: pointer; text-decoration: underline;" onclick="(typeof window.aiSwitchDate === 'function' ? window.aiSwitchDate('${lastEntryDateIso}', '${escapeHTML(canonicalName)}') : null)">${dispLastDate}</span>
            </div>
          ` : ''}

          <!-- ENTRIES OF SELECTED DATE (Matching user drawing) -->
          <div class="ai-date-entries-box">
            <div class="ai-date-entries-title">
              ENTRIES OF SELECTED DATE
            </div>
            <div class="ai-entries-table-wrap">
              <table class="ai-entries-table">
                <thead>
                  <tr>
                    <th>DATE</th>
                    <th>GUEST NAME</th>
                    <th>TOTAL IN</th>
                    <th>TOTAL OUT</th>
                    <th>RESULT</th>
                  </tr>
                </thead>
                <tbody>
                  ${tableRowsHtml}
                </tbody>
              </table>
            </div>
            <div style="display: flex; gap: 8px; margin-top: 10px;">
              <button type="button" class="ai-chip-btn" style="flex: 1; justify-content: center; font-size: 0.82rem; padding: 7px 12px; background: rgba(56, 189, 248, 0.15); border: 1px solid #38bdf8; color: #38bdf8; font-weight: 800;" onclick="(typeof window.aiOpenGuestSummary === 'function' ? window.aiOpenGuestSummary('${escapeHTML(canonicalName)}') : null)">
                👤 OPEN GUEST SUMMARY POPUP
              </button>
              <button type="button" class="ai-chip-btn ai-ask-suggest-btn ai-btn-show-date-all" data-query="ALL ENTRIES" data-date="${targetDate}" style="flex: 1; justify-content: center; font-size: 0.82rem; padding: 7px 12px;" onclick="(typeof window.aiShowDateAllEntries === 'function' ? window.aiShowDateAllEntries('${targetDate}') : (typeof executeAiQuery === 'function' ? executeAiQuery('ALL ENTRIES') : null))">
                📋 VIEW ALL GUESTS
              </button>
            </div>
          </div>

          <!-- ENTRIES IN SENTENCE FORM FOR THIS GUEST ON SELECTED DATE -->
          <div class="ai-date-entries-box" style="margin-top: 14px;">
            <div class="ai-date-entries-title" style="display: flex; justify-content: space-between; align-items: center;">
              <span>📝 ENTRIES IN SENTENCE FORM (${dispDate})</span>
              <span style="font-size: 0.75rem; color: #38bdf8; font-weight: 800; font-family: monospace;">${sortedGuestDayEntries.length} ${sortedGuestDayEntries.length === 1 ? 'TRANSACTION' : 'TRANSACTIONS'}</span>
            </div>
            ${sortedGuestDayEntries.length === 0 ? `
              <div style="text-align: center; color: #94a3b8; padding: 14px; font-weight: 700; font-size: 0.84rem;">
                NO TRANSACTIONS FOR ${escapeHTML(canonicalName)} ON ${dispDate}
              </div>
            ` : `
              <div style="display: flex; flex-direction: column; gap: 8px; max-height: 280px; overflow-y: auto; padding-right: 4px;">
                ${sortedGuestDayEntries.map(e => {
                  const dt = parseEntryDateTime(e.datetime);
                  const time = dt.time || '--:--';
                  const typeClean = (e.type || '').toLowerCase().replace(/[\/\s]/g, '-');
                  const sentence = getEntrySentence(e, true);
                  const isCredit = isTotalInType(e.type);
                  const borderCol = isCredit ? '#10b981' : '#ef4444';
                  return `
                    <div class="sentence-item ${typeClean}" style="display: flex; align-items: center; gap: 12px; padding: 8px 12px; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.12); border-left: 4px solid ${borderCol}; font-family: 'JetBrains Mono', Consolas, monospace; font-size: 0.86rem; background: rgba(10, 16, 32, 0.65);">
                      <span style="color: #38bdf8; font-weight: 800; min-width: 48px; flex-shrink: 0; letter-spacing: 0.5px;">${time}</span>
                      <span style="color: #ffffff; font-weight: 700; flex: 1; word-break: break-word;">${sentence}</span>
                    </div>
                  `;
                }).join('')}
              </div>
            `}
          </div>
        </div>
      `;
    }

    // 8. Default / Fallback Assistance (Zero guest names used as examples)
    return `
      <div class="ai-assistant-card">
        <div class="ai-card-badge-header">
          <span class="ai-card-title">🤖 SURVEILLANCE AI ASSISTANT</span>
          <span style="font-size: 0.75rem; color: #38bdf8; font-weight: 800; font-family: monospace;">📅 ${dispDate}</span>
        </div>
        <p style="color: #cbd5e1; font-size: 0.88rem; margin: 0; font-weight: 700;">
          I COULD NOT FIND SPECIFIC RECORDS MATCHING "${escapeHTML(query.toUpperCase())}".
        </p>
        <div style="font-size: 0.8rem; color: #94a3b8; font-weight: 600;">
          TRY ONE OF THESE QUICK ACTIONS OR TYPE A GUEST NAME:
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0;">
          <button type="button" class="ai-chip-btn ai-ask-suggest-btn" data-query="OVERALL TOTAL IN">⚡ OVERALL TOTAL IN</button>
          <button type="button" class="ai-chip-btn ai-ask-suggest-btn" data-query="OVERALL TOTAL OUT">⚡ OVERALL TOTAL OUT</button>
          <button type="button" class="ai-chip-btn ai-ask-suggest-btn" data-query="OVERALL RESULT">⚡ OVERALL RESULT</button>
          <button type="button" class="ai-chip-btn ai-ask-suggest-btn" data-query="ALL ENTRIES SUMMARY">📋 ALL ENTRIES</button>
          <button type="button" class="ai-chip-btn ai-ask-suggest-btn" data-query="TOP MAJOR PATRONS">⭐ TOP GUESTS</button>
          <button type="button" class="ai-chip-btn ai-ask-suggest-btn" data-query="BARRED GUESTS CHECK">🚫 BARRED GUESTS</button>
        </div>
      </div>
    `;
  }
  window.processOfflineAiQuestion = processOfflineAiQuestion;

  // Global helpers for inline click handlers in AI cards
  window.aiOpenGuestSummary = function(guestName) {
    if (!guestName) return;
    const activeDate = (aiDatePicker && aiDatePicker.value)
      ? aiDatePicker.value
      : (currentBusinessDateStr || currentBusinessDate || getBusinessDate());
    const candidateList = (typeof allEntries !== 'undefined' && Array.isArray(allEntries) && allEntries.length > 0)
      ? allEntries
      : (window.allEntries || []);
    const openFn = typeof window.openGuestSummaryPopup === 'function' ? window.openGuestSummaryPopup : (typeof openGuestSummaryPopup === 'function' ? openGuestSummaryPopup : null);
    if (openFn) {
      openFn(guestName, candidateList, activeDate);
    }
  };

  window.aiQueryGuest = function(guestName) {
    window.aiOpenGuestSummary(guestName);
  };

  window.aiSwitchDate = function(dStr, guestName) {
    if (dStr && aiDatePicker) aiDatePicker.value = dStr;
    if (dStr && aiSelectedDateBadge) aiSelectedDateBadge.textContent = formatDisplayDate(dStr);
    if (guestName && aiQueryInput) aiQueryInput.value = guestName;
    executeAiQuery(guestName || 'ALL ENTRIES');
  };

  window.aiShowDateAllEntries = function(dStr) {
    if (dStr && aiDatePicker) aiDatePicker.value = dStr;
    if (dStr && aiSelectedDateBadge) aiSelectedDateBadge.textContent = formatDisplayDate(dStr);
    if (aiQueryInput) aiQueryInput.value = '';
    executeAiQuery('ALL ENTRIES');
  };

  // Event Listeners for Offline AI Assistant
  document.querySelectorAll('.btn-open-ai-assistant').forEach(btn => {
    btn.addEventListener('click', () => openAiAssistantModal());
  });
  if (btnOpenAiAssistant) {
    btnOpenAiAssistant.addEventListener('click', () => openAiAssistantModal());
  }
  if (btnCloseAiModal) {
    btnCloseAiModal.addEventListener('click', closeAiAssistantModal);
  }
  if (aiAssistantModal) {
    aiAssistantModal.addEventListener('click', (e) => {
      if (e.target === aiAssistantModal) closeAiAssistantModal();
    });
  }
  if (btnAiSend && aiQueryInput) {
    btnAiSend.addEventListener('click', () => executeAiQuery(aiQueryInput.value));
    aiQueryInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        executeAiQuery(aiQueryInput.value);
      }
    });
  }
  if (btnAiClear) {
    btnAiClear.addEventListener('click', () => {
      resetAiAssistant();
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && aiAssistantModal && (aiAssistantModal.style.display === 'flex' || aiAssistantModal.offsetParent !== null)) {
      closeAiAssistantModal();
    }
  });
  if (aiDatePicker) {
    const pickerWrap = aiDatePicker.parentElement;
    if (pickerWrap) {
      pickerWrap.addEventListener('click', (e) => {
        if (e.target !== aiDatePicker && typeof aiDatePicker.showPicker === 'function') {
          try { aiDatePicker.showPicker(); } catch (err) {}
        }
      });
    }

    if (aiSelectedDateBadge) {
      aiSelectedDateBadge.style.cursor = 'pointer';
      aiSelectedDateBadge.title = 'Click Calendar to select date';
      aiSelectedDateBadge.addEventListener('click', () => {
        if (typeof aiDatePicker.showPicker === 'function') {
          try { aiDatePicker.showPicker(); } catch (err) { aiDatePicker.click(); }
        } else {
          aiDatePicker.click();
        }
      });
    }

    let dateDebounceTimer = null;
    const triggerDateFilter = () => {
      clearTimeout(dateDebounceTimer);
      dateDebounceTimer = setTimeout(() => {
        const val = aiDatePicker.value;
        if (aiSelectedDateBadge) {
          aiSelectedDateBadge.textContent = formatDisplayDate(val);
        }
        if (val) {
          // As requested: AFTER CLICKING DATE SHOW ALL ENTRIES OF PARTICULAR DATE
          if (aiQueryInput) aiQueryInput.value = '';
          executeAiQuery('ALL ENTRIES');
        }
      }, 30);
    };

    aiDatePicker.addEventListener('change', triggerDateFilter);
    aiDatePicker.addEventListener('input', triggerDateFilter);
  }

  // Quick Action Chips in AI Header
  document.querySelectorAll('.ai-chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const q = btn.getAttribute('data-query');
      if (q) executeAiQuery(q);
    });
  });

  // Global document click delegation for AI Assistant buttons & clickable guest names
  document.addEventListener('click', (e) => {
    const showAllBtn = e.target.closest('.ai-btn-show-date-all');
    if (showAllBtn) {
      e.preventDefault();
      const d = showAllBtn.getAttribute('data-date');
      if (typeof window.aiShowDateAllEntries === 'function') {
        window.aiShowDateAllEntries(d);
      } else if (typeof executeAiQuery === 'function') {
        executeAiQuery('ALL ENTRIES');
      }
      return;
    }

    const aiGuestSpan = e.target.closest('#ai-chat-messages .clickable-guest-name, #ai-chat-messages .guest-clickable');
    if (aiGuestSpan) {
      e.preventDefault();
      e.stopPropagation();
      const g = aiGuestSpan.getAttribute('data-guest') || aiGuestSpan.textContent.trim();
      if (g && typeof window.aiOpenGuestSummary === 'function') {
        window.aiOpenGuestSummary(g);
      } else if (g && typeof window.aiQueryGuest === 'function') {
        window.aiQueryGuest(g);
      }
      return;
    }
  });
});

function saveActivePanel(panelId) {
  localStorage.setItem('activeSurveillancePanel', panelId);
}


// ==========================================================================
// WINDOW MAXIMIZE DETECTION ENGINE ("FIT TO PAGE ONLY IF PAGE IS MAXIMISE")
// ==========================================================================
function updateWindowMaximizedState() {
  try {
    const availW = window.screen.availWidth || window.screen.width || 0;
    const availH = window.screen.availHeight || window.screen.height || 0;
    
    // Check if browser window matches full available desktop screen dimensions
    const isAvailW = availW > 0 && (window.innerWidth >= availW - 35 || (window.outerWidth && window.outerWidth >= availW - 10));
    const isAvailH = availH > 0 && (window.innerHeight >= availH - 95 || (window.outerHeight && window.outerHeight >= availH - 20));
    const isFullScreen = !!(document.fullscreenElement || window.fullScreen);
    
    const isMaximized = (isAvailW && isAvailH) || isFullScreen;

    if (isMaximized) {
      document.documentElement.classList.add('page-maximized');
      document.body.classList.add('page-maximized');
    } else {
      document.documentElement.classList.remove('page-maximized');
      document.body.classList.remove('page-maximized');
    }
  } catch (err) {
    // fallback
  }
}

window.addEventListener('resize', updateWindowMaximizedState);
window.addEventListener('orientationchange', updateWindowMaximizedState);
window.addEventListener('load', updateWindowMaximizedState);
document.addEventListener('DOMContentLoaded', updateWindowMaximizedState);
updateWindowMaximizedState();
