/**
 * STOHID key generator: the vendor's own tool. It holds the private signing key, makes a
 * licence key for a PC code, and keeps the list of every key made - whose it is and which
 * vehicles go with it. Nothing here is sent anywhere; the only network request is reading
 * the vehicle list from the sheet when asked to.
 */

const { app, BrowserWindow, clipboard, dialog, ipcMain, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const core = require('./lib/license-core.cjs');
const sheet = require('./lib/sheet.cjs');

// One fixed data folder whatever the build is called: the signing key must be found again.
app.setName('stohid-keygen');
// STOHID_KEYGEN_DATA points a trial run at a folder of its own, away from the real key and list.
app.setPath('userData', process.env.STOHID_KEYGEN_DATA || path.join(app.getPath('appData'), 'stohid-keygen'));

const dataDir = () => app.getPath('userData');
const keyFile = () => path.join(dataDir(), 'signing-key.pem');
const registryFile = () => path.join(dataDir(), 'registry.json');
const settingsFile = () => path.join(dataDir(), 'settings.json');

const readJson = (file, fallback) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
};
/** Written beside the target and renamed over it: a crash half-way never leaves half a list. */
const writeJson = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8');
  fs.renameSync(tmp, file);
};

const readKey = () => {
  try {
    const pem = fs.readFileSync(keyFile(), 'utf8');
    const publicKey = core.publicKeyOf(pem);
    return { pem, publicKey, fingerprint: crypto.createHash('sha256').update(publicKey).digest('hex').slice(0, 16).toUpperCase() };
  } catch {
    return null;
  }
};

const registry = () => readJson(registryFile(), []);
const settings = () => ({ sheetUrl: '', vehicles: [], vehiclesLoadedAt: null, ...readJson(settingsFile(), {}) });

function state() {
  const key = readKey();
  return {
    hasKey: !!key,
    fingerprint: key?.fingerprint ?? '',
    publicKey: key?.publicKey ?? '',
    registry: registry(),
    settings: settings(),
    dataDir: dataDir(),
    version: app.getVersion(),
  };
}

const fileName = (text) => String(text).replace(/[^\p{L}\p{N}_-]+/gu, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'stohid';

function registerHandlers(win) {
  ipcMain.handle('state', () => state());

  ipcMain.handle('issue', (_, input) => {
    const key = readKey();
    if (!key) return { ok: false, error: 'no-signing-key' };
    const machine = core.normalizeMachineCode(input?.machine);
    if (!machine) return { ok: false, error: 'bad-machine-code' };
    const list = registry();
    const id = `K${String(list.reduce((max, r) => Math.max(max, Number(String(r.id).slice(1)) || 0), 0) + 1).padStart(4, '0')}`;
    const record = {
      id,
      machine,
      owner: String(input?.owner ?? '').trim().slice(0, 80),
      vehicles: [...new Set((Array.isArray(input?.vehicles) ? input.vehicles : []).map((s) => String(s).trim()).filter(Boolean))].slice(0, 50),
      note: String(input?.note ?? '').trim().slice(0, 300),
      issued: Date.now(),
      revoked: false,
    };
    record.key = core.issueLicense(key.pem, record);
    writeJson(registryFile(), [record, ...list]);
    return { ok: true, record, state: state() };
  });

  ipcMain.handle('registry:update', (_, id, patch) => {
    const list = registry().map((r) => (r.id === id ? {
      ...r,
      ...(typeof patch?.note === 'string' ? { note: patch.note.trim().slice(0, 300) } : {}),
      ...(typeof patch?.revoked === 'boolean' ? { revoked: patch.revoked } : {}),
    } : r));
    writeJson(registryFile(), list);
    return state();
  });

  ipcMain.handle('registry:delete', (_, id) => {
    writeJson(registryFile(), registry().filter((r) => r.id !== id));
    return state();
  });

  ipcMain.handle('registry:export', async () => {
    const result = await dialog.showSaveDialog(win, { defaultPath: 'stohid-keys.csv', filters: [{ name: 'CSV', extensions: ['csv'] }] });
    if (result.canceled || !result.filePath) return false;
    const rows = [['№', 'Дата', 'Власник', 'Код ПК', 'Борти', 'Примітка', 'Відкликано', 'Ключ']];
    for (const r of registry()) rows.push([r.id, new Date(r.issued).toISOString().slice(0, 10), r.owner, r.machine, r.vehicles.join(' '), r.note, r.revoked ? 'так' : '', r.key]);
    fs.writeFileSync(result.filePath, sheet.toCsv(rows), 'utf8');
    return true;
  });

  ipcMain.handle('copy', (_, text) => { clipboard.writeText(String(text ?? '')); return true; });

  ipcMain.handle('key-file:save', async (_, id) => {
    const record = registry().find((r) => r.id === id);
    if (!record) return false;
    const result = await dialog.showSaveDialog(win, {
      defaultPath: `stohid-${fileName(record.owner || record.id)}-${record.id}.key`,
      filters: [{ name: 'STOHID key', extensions: ['key'] }],
    });
    if (result.canceled || !result.filePath) return false;
    fs.writeFileSync(result.filePath, `${record.key}\n`, 'utf8');
    return true;
  });

  // The signing key: made once, backed up, carried to another PC when the generator moves.
  ipcMain.handle('signing-key:create', () => {
    if (readKey()) return state();
    fs.mkdirSync(dataDir(), { recursive: true });
    fs.writeFileSync(keyFile(), core.generateKeyPair().privateKey, { encoding: 'utf8', mode: 0o600 });
    return state();
  });

  ipcMain.handle('signing-key:export', async () => {
    if (!readKey()) return false;
    const result = await dialog.showSaveDialog(win, { defaultPath: 'stohid-signing-key.pem', filters: [{ name: 'PEM', extensions: ['pem'] }] });
    if (result.canceled || !result.filePath) return false;
    fs.copyFileSync(keyFile(), result.filePath);
    return true;
  });

  ipcMain.handle('signing-key:import', async () => {
    const result = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'PEM', extensions: ['pem'] }] });
    if (result.canceled || !result.filePaths[0]) return { ok: false, error: null, state: state() };
    try {
      const pem = fs.readFileSync(result.filePaths[0], 'utf8');
      if (crypto.createPrivateKey(pem).asymmetricKeyType !== 'ed25519') throw new Error('not ed25519');
      fs.mkdirSync(dataDir(), { recursive: true });
      if (fs.existsSync(keyFile())) fs.copyFileSync(keyFile(), `${keyFile()}.${Date.now()}.bak`);
      fs.writeFileSync(keyFile(), pem, { encoding: 'utf8', mode: 0o600 });
      return { ok: true, error: null, state: state() };
    } catch {
      return { ok: false, error: 'bad-key-file', state: state() };
    }
  });

  ipcMain.handle('settings:set', (_, patch) => {
    const next = { ...settings(), ...(typeof patch?.sheetUrl === 'string' ? { sheetUrl: patch.sheetUrl.trim().slice(0, 500) } : {}) };
    writeJson(settingsFile(), next);
    return state();
  });

  ipcMain.handle('sheet:load', async () => {
    const current = settings();
    const url = sheet.csvExportUrl(current.sheetUrl);
    if (!url) return { ok: false, error: 'bad-sheet-url', state: state() };
    try {
      const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20000) });
      const text = await res.text();
      // A sheet that is not shared by link answers with a sign-in page, not CSV.
      if (!res.ok || /^\s*<(!doctype|html)/i.test(text)) return { ok: false, error: 'sheet-not-shared', state: state() };
      const vehicles = sheet.vehiclesFromCsv(text);
      if (vehicles.length === 0) return { ok: false, error: 'sheet-no-serials', state: state() };
      writeJson(settingsFile(), { ...current, vehicles, vehiclesLoadedAt: Date.now() });
      return { ok: true, error: null, state: state() };
    } catch {
      return { ok: false, error: 'sheet-unreachable', state: state() };
    }
  });

  ipcMain.handle('data-dir:open', () => shell.openPath(dataDir()));
}

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0b0f17',
    autoHideMenuBar: true,
    title: 'ТУНЕЛЬ — STOHID · генератор ключів',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.removeMenu();
  // The window shows only its own page.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  registerHandlers(win);
  void win.loadFile(path.join(__dirname, 'ui', 'index.html'));
});

app.on('window-all-closed', () => app.quit());
