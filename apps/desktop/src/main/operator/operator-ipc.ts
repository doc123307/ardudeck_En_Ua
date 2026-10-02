import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc-channels.js';
import type { AdminAuthResult, OperatorState } from '../../shared/operator-types.js';
import { OperatorVault } from './operator-vault.js';

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

/** Operator mode: who sees the full UI, and the operator screen settings. */
export function registerOperatorHandlers(): void {
  const withMenus = <T extends AdminAuthResult | OperatorState>(result: T): T => {
    applyMenus('state' in result ? result.state : result);
    return result;
  };
  applyMenus(getVault().state());
  // Windows opened later (pop-outs) follow the mode in force at that moment.
  app.on('browser-window-created', (_, win) => applyMenu(win, getVault().state()));

  ipcMain.handle(IPC_CHANNELS.OPERATOR_STATE, () => getVault().state());
  ipcMain.handle(IPC_CHANNELS.OPERATOR_UNLOCK, (_, password: unknown) => withMenus(getVault().unlock(text(password))));
  ipcMain.handle(IPC_CHANNELS.OPERATOR_CREATE_PASSWORD, (_, password: unknown) => withMenus(getVault().createPassword(text(password))));
  ipcMain.handle(IPC_CHANNELS.OPERATOR_CHANGE_PASSWORD, (_, current: unknown, next: unknown) =>
    getVault().changePassword(text(current), text(next)));
  ipcMain.handle(IPC_CHANNELS.OPERATOR_LOCK, () => withMenus(getVault().lock()));
  ipcMain.handle(IPC_CHANNELS.OPERATOR_SET_CONFIG, (_, patch: unknown) => getVault().setConfig(patch));
}
