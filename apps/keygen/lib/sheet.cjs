/**
 * The vehicle list kept in a Google Sheet, read as CSV. Only the columns the key generator
 * needs are taken: serial number, status, customer name, hand-over date. Phone numbers and
 * the rest stay in the sheet.
 */

/** The sheet's own address to the address of its CSV export. Null if it is not a Google Sheet link. */
function csvExportUrl(link) {
  const id = /\/spreadsheets\/d\/([A-Za-z0-9_-]{20,})/.exec(String(link ?? ''))?.[1];
  if (!id) return null;
  const gid = /[#?&]gid=(\d+)/.exec(link)?.[1];
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv${gid ? `&gid=${gid}` : ''}`;
}

/** RFC 4180: quoted fields, doubled quotes, line breaks inside quotes. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const src = String(text ?? '').replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field); field = '';
      rows.push(row); row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const COLUMNS = {
  serial: /серійн|serial/i,
  status: /^статус|status/i,
  customer: /ім.?я замовника|customer name/i,
  date: /дата введення|передача замовнику|hand.?over/i,
};

/** CSV text to vehicles: `{ serial, status, customer, date }`, one per serial number. */
function vehiclesFromCsv(text) {
  const rows = parseCsv(text);
  const headerAt = rows.findIndex((r) => r.some((cell) => COLUMNS.serial.test(cell)));
  if (headerAt < 0) return [];
  const header = rows[headerAt];
  const at = Object.fromEntries(Object.entries(COLUMNS).map(([name, re]) => [name, header.findIndex((cell) => re.test(cell.trim()))]));
  const cell = (row, name) => (at[name] >= 0 ? String(row[at[name]] ?? '').trim() : '');
  const seen = new Set();
  const out = [];
  for (const row of rows.slice(headerAt + 1)) {
    const serial = cell(row, 'serial');
    if (!serial || seen.has(serial)) continue;
    seen.add(serial);
    out.push({ serial, status: cell(row, 'status'), customer: cell(row, 'customer'), date: cell(row, 'date') });
  }
  return out;
}

const csvCell = (v) => (/[",\n\r]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
/** Rows to CSV text with a BOM, so a spreadsheet opens Cyrillic properly. */
function toCsv(rows) {
  return `﻿${rows.map((r) => r.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

module.exports = { csvExportUrl, parseCsv, vehiclesFromCsv, toCsv };
