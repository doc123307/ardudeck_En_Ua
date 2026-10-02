import { app, ipcMain, Menu, type BrowserWindow } from 'electron';
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
 * Those are the administrator's: on the operator screen the window has no menu at all.
 * A development run keeps it either way.
 */
function applyWindowMenu(mainWindow: BrowserWindow, state: OperatorState): void {
  if (!app.isPackaged || mainWindow.isDestroyed()) return;
  if (state.mode === 'operator') mainWindow.removeMenu();
  else mainWindow.setMenu(Menu.getApplicationMenu());
}

/** Operator mode: who sees the full UI, and the operator screen settings. */
export function registerOperatorHandlers(mainWindow: BrowserWindow): void {
  const withMenu = <T extends AdminAuthResult | OperatorState>(result: T): T => {
    applyWindowMenu(mainWindow, 'state' in result ? result.state : result);
    return result;
  };
  applyWindowMenu(mainWindow, getVault().state());

  ipcMain.handle(IPC_CHANNELS.OPERATOR_STATE, () => getVault().state());
  ipcMain.handle(IPC_CHANNELS.OPERATOR_UNLOCK, (_, password: unknown) => withMenu(getVault().unlock(text(password))));
  ipcMain.handle(IPC_CHANNELS.OPERATOR_CREATE_PASSWORD, (_, password: unknown) => withMenu(getVault().createPassword(text(password))));
  ipcMain.handle(IPC_CHANNELS.OPERATOR_CHANGE_PASSWORD, (_, current: unknown, next: unknown) =>
    getVault().changePassword(text(current), text(next)));
  ipcMain.handle(IPC_CHANNELS.OPERATOR_LOCK, () => withMenu(getVault().lock()));
  ipcMain.handle(IPC_CHANNELS.OPERATOR_SET_CONFIG, (_, patch: unknown) => getVault().setConfig(patch));
}
