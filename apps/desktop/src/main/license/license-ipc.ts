import { app, ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc-channels.js';
import type { LicenseActivateResult, LicenseStatus } from '../../shared/license-types.js';
import { LicenseService } from './license-service.js';
import { machineCode } from './machine-id.js';
import { LICENSE_PUBLIC_KEY } from './public-key.js';

let service: LicenseService | null = null;

/**
 * An installed copy asks for its key; a development run does not, unless it is told to
 * (STOHID_LICENSE_ENFORCE=1, for trying the activation screen).
 */
function getService(): LicenseService {
  service ??= new LicenseService(
    app.getPath('userData'),
    machineCode(),
    LICENSE_PUBLIC_KEY,
    app.isPackaged || process.env['STOHID_LICENSE_ENFORCE'] === '1',
  );
  return service;
}

/** For the handlers that do the program's real work: no key, no vehicle link. */
export function isLicensed(): boolean {
  return getService().licensed;
}

export function registerLicenseHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.LICENSE_STATUS, (): LicenseStatus => getService().status());
  ipcMain.handle(IPC_CHANNELS.LICENSE_ACTIVATE, (_, key: unknown): LicenseActivateResult =>
    getService().activate(typeof key === 'string' ? key.slice(0, 4000) : ''));
}
