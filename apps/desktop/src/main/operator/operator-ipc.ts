import { app, BrowserWindow, dialog, ipcMain, Menu, shell, type WebContents } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc-channels.js';
import type { AdminAuthResult, OperatorState } from '../../shared/operator-types.js';
import type { RcActionResult, RcPad } from '../../shared/operator-rc.js';
import { mediaEngine } from '../media/media-engine.js';
import { OperatorVault } from './operator-vault.js';
import { OperatorRcEngine, type RcEngineDeps } from './operator-rc-engine.js';
import { VehiclesStore } from './vehicles-store.js';
import { pickPanel, samePresetPart, type VehiclePreset, type VehiclesResult } from '../../shared/vehicle-presets.js';

let vault: OperatorVault | null = null;

function getVault(): OperatorVault {
  vault ??= new OperatorVault(app.getPath('userData'));
  return vault;
}

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

/**
 * The window menu (hidden until Alt is pressed) offers Reload and Developer Tools.
 * Those are the administrator's: in operator mode no window has a menu at all - the
 * main one, and the camera and map pop-outs alike. A development run keeps it.
 */
function applyMenu(win: BrowserWindow, state: OperatorState): void {
  if (!app.isPackaged || win.isDestroyed()) return;
  if (state.mode === 'operator') win.removeMenu();
  else win.setMenu(Menu.getApplicationMenu());
}

function applyMenus(state: OperatorState): void {
  for (const win of BrowserWindow.getAllWindows()) applyMenu(win, state);
}

/** How the RC engine reaches the vehicle; the link itself lives in ipc-handlers.ts. */
export type OperatorRcLink = Pick<RcEngineDeps, 'linkUp' | 'send' | 'setServo'>;

/** A reading from the renderer, trusted no further than its shape. */
function readPad(raw: unknown): RcPad | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as { id?: unknown; axes?: unknown; buttons?: unknown };
  if (!Array.isArray(r.axes) || !Array.isArray(r.buttons) || r.axes.length > 32 || r.buttons.length > 64) return null;
  return {
    id: text(r.id).slice(0, 120),
    axes: r.axes.map((a) => (typeof a === 'number' && Number.isFinite(a) ? a : 0)),
    buttons: r.buttons.map((b) => b === true),
  };
}

/** Operator mode: who sees the full UI, the operator screen settings, and the operator's RC control. */
export function registerOperatorHandlers(link: OperatorRcLink): void {
  const withMenus = <T extends AdminAuthResult | OperatorState>(result: T): T => {
    applyMenus('state' in result ? result.state : result);
    return result;
  };
  applyMenus(getVault().state());
  // Windows opened later (pop-outs) follow the mode in force at that moment.
  app.on('browser-window-created', (_, win) => applyMenu(win, getVault().state()));

  const rc = new OperatorRcEngine({
    ...link,
    onState: (state) => {
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) win.webContents.send(IPC_CHANNELS.OPERATOR_RC_STATE_EVENT, state);
      }
    },
  });
  rc.setConfig(getVault().state().config.rc);
  app.on('before-quit', () => rc.dispose());

  mediaEngine.recordSettings = () => {
    const { recordDir, recordSegmentMinutes } = getVault().state().config;
    return { dir: recordDir, segmentMinutes: recordSegmentMinutes };
  };

  ipcMain.handle(IPC_CHANNELS.OPERATOR_STATE, () => getVault().state());
  ipcMain.handle(IPC_CHANNELS.OPERATOR_UNLOCK, (_, password: unknown) => withMenus(getVault().unlock(text(password))));
  ipcMain.handle(IPC_CHANNELS.OPERATOR_CREATE_PASSWORD, (_, password: unknown) => withMenus(getVault().createPassword(text(password))));
  ipcMain.handle(IPC_CHANNELS.OPERATOR_CHANGE_PASSWORD, (_, current: unknown, next: unknown) =>
    getVault().changePassword(text(current), text(next)));
  ipcMain.handle(IPC_CHANNELS.OPERATOR_LOCK, () => withMenus(getVault().lock()));
  ipcMain.handle(IPC_CHANNELS.OPERATOR_SET_CONFIG, (_, patch: unknown) => {
    const result = getVault().setConfig(patch);
    if (result.ok) {
      rc.setConfig(result.state.config.rc);
      // What the administrator sets up belongs to the vehicle in use.
      const { config } = result.state;
      vehicles.updateActive({ panel: pickPanel(config), ...(config.connection ? { connection: config.connection } : {}) });
    }
    return result;
  });

  // ---- Vehicles --------------------------------------------------------------------
  const vehicles = new VehiclesStore(app.getPath('userData'));
  const answer = (ok: boolean, error?: VehiclesResult['error']): VehiclesResult =>
    ({ ok, ...(error ? { error } : {}), vehicles: vehicles.state(), operator: getVault().state() });
  /** The vehicle list is the administrator's: the operator only chooses from it. */
  const mayEdit = () => getVault().state().mode === 'admin';
  /** Puts a vehicle's own settings in force. */
  const applyVehicle = (preset: VehiclePreset) => {
    const state = getVault().applyVehicle({ ...preset.panel, ...(preset.connection ? { connection: preset.connection } : {}) });
    if (state) rc.setConfig(state.config.rc);
    return state !== null;
  };
  ipcMain.handle(IPC_CHANNELS.VEHICLES_STATE, () => vehicles.state());
  ipcMain.handle(IPC_CHANNELS.VEHICLES_SAVE, (_, raw: unknown): VehiclesResult => {
    if (!mayEdit()) return answer(false, 'not-allowed');
    const saved = vehicles.save(raw);
    if (!saved) return answer(false, 'storage');
    // A change to the vehicle in use (its link, say) takes effect at once.
    if (vehicles.state().activeId === saved.id) applyVehicle(saved);
    return answer(true);
  });
  ipcMain.handle(IPC_CHANNELS.VEHICLES_DELETE, (_, id: unknown): VehiclesResult => {
    if (!mayEdit()) return answer(false, 'not-allowed');
    return answer(vehicles.remove(text(id)), 'not-found');
  });
  ipcMain.handle(IPC_CHANNELS.VEHICLES_ACTIVATE, (_, id: unknown): VehiclesResult => {
    const preset = vehicles.setActive(text(id));
    if (!preset) return answer(false, 'not-found');
    return applyVehicle(preset) ? answer(true) : answer(false, 'storage');
  });
  ipcMain.handle(IPC_CHANNELS.VEHICLES_SYNC, (_, part: unknown) => {
    const p = (part && typeof part === 'object' ? part : {}) as { cameras?: unknown; relays?: unknown };
    const active = vehicles.active();
    if (!active) return vehicles.state();
    const next = { ...active };
    if (Array.isArray(p.cameras)) next.cameras = p.cameras as VehiclePreset['cameras'];
    if (Array.isArray(p.relays)) next.relays = p.relays as VehiclePreset['relays'];
    if (!samePresetPart(next.cameras, active.cameras) || !samePresetPart(next.relays, active.relays)) vehicles.save(next);
    return vehicles.state();
  });

  // The recording folder: the administrator's to choose and to look into.
  ipcMain.handle(IPC_CHANNELS.OPERATOR_PICK_RECORD_DIR, async (event) => {
    if (getVault().state().mode !== 'admin') return null;
    const options = {
      properties: ['openDirectory', 'createDirectory'] as ('openDirectory' | 'createDirectory')[],
      defaultPath: mediaEngine.resolveMediaDir().path,
    };
    const win = BrowserWindow.fromWebContents(event.sender);
    const picked = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
    return picked.canceled ? null : picked.filePaths[0] ?? null;
  });
  ipcMain.handle(IPC_CHANNELS.OPERATOR_OPEN_RECORD_DIR, async () => {
    if (getVault().state().mode !== 'admin') return false;
    return (await shell.openPath(mediaEngine.resolveMediaDir().path)) === '';
  });

  // ---- Operator RC ---------------------------------------------------------------
  // The engine follows the operator screen: when that window goes, everything is let go.
  let screen: WebContents | null = null;
  const onScreenGone = () => { screen = null; rc.detach(); };
  ipcMain.handle(IPC_CHANNELS.OPERATOR_RC_ATTACH, (event, on: unknown) => {
    if (on === true) {
      if (screen !== event.sender) {
        screen?.removeListener('destroyed', onScreenGone);
        screen = event.sender;
        screen.once('destroyed', onScreenGone);
      }
      rc.attach();
    } else if (screen === event.sender) {
      screen.removeListener('destroyed', onScreenGone);
      onScreenGone();
    }
    return rc.state();
  });
  ipcMain.handle(IPC_CHANNELS.OPERATOR_RC_STATE, () => rc.state());
  ipcMain.on(IPC_CHANNELS.OPERATOR_RC_GAMEPAD, (_, raw: unknown) => {
    const pad = readPad(raw);
    if (pad) rc.gamepad(pad);
  });
  ipcMain.handle(IPC_CHANNELS.OPERATOR_RC_FUNCTION, (_, id: unknown, value: unknown): RcActionResult =>
    rc.setFunction(text(id), typeof value === 'number' ? value : NaN));
  ipcMain.handle(IPC_CHANNELS.OPERATOR_RC_DRIVE, (_, on: unknown): RcActionResult => rc.setDrive(on === true));
  ipcMain.handle(IPC_CHANNELS.OPERATOR_RC_REVERSE, (_, on: unknown): RcActionResult => rc.setReverse(on === true));
  ipcMain.handle(IPC_CHANNELS.OPERATOR_RC_CRUISE, (_, request: unknown): RcActionResult => {
    const r = (request && typeof request === 'object' ? request : {}) as { on?: unknown; adjust?: unknown };
    if (typeof r.on === 'boolean') return rc.setCruise(r.on);
    if (typeof r.adjust === 'number') return rc.adjustCruise(r.adjust);
    return { ok: false, reason: 'disabled' };
  });
  ipcMain.handle(IPC_CHANNELS.OPERATOR_RC_STOP, () => { rc.stop(); });
}
