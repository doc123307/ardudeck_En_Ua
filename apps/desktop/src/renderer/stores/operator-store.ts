/**
 * Operator mode in the renderer: which UI is showing and the operator screen settings.
 * The decision itself is made in the main process (see main/operator/operator-vault.ts);
 * this store only mirrors it.
 */

import { create } from 'zustand';
import {
  DEFAULT_OPERATOR_CONFIG,
  type AdminAuthResult,
  type AppMode,
  type OperatorConfig,
  type OperatorState,
} from '../../shared/operator-types';

interface OperatorStore {
  /** False until the main process has answered: nothing mode-dependent is drawn before that. */
  ready: boolean;
  mode: AppMode;
  hasPassword: boolean;
  config: OperatorConfig;

  load: () => Promise<void>;
  unlock: (password: string) => Promise<AdminAuthResult>;
  createPassword: (password: string) => Promise<AdminAuthResult>;
  changePassword: (current: string, next: string) => Promise<AdminAuthResult>;
  lock: () => Promise<void>;
  saveConfig: (patch: Partial<OperatorConfig>) => Promise<boolean>;
}

const adopt = (state: OperatorState) => ({ ready: true, mode: state.mode, hasPassword: state.hasPassword, config: state.config });

export const useOperatorStore = create<OperatorStore>((set) => {
  const applied = async (call: Promise<AdminAuthResult>): Promise<AdminAuthResult> => {
    const result = await call;
    set(adopt(result.state));
    return result;
  };

  return {
    ready: false,
    mode: 'operator',
    hasPassword: false,
    config: DEFAULT_OPERATOR_CONFIG,

    load: async () => {
      // The main process answers at once in practice. Should it not, show the operator
      // screen with default settings rather than a blank window: the restricted mode is
      // the safe one to fall back to.
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          set(adopt(await window.electronAPI.operatorState()));
          return;
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 400));
        }
      }
      set({ ready: true, mode: 'operator' });
    },
    unlock: (password) => applied(window.electronAPI.operatorUnlock(password)),
    createPassword: (password) => applied(window.electronAPI.operatorCreatePassword(password)),
    changePassword: (current, next) => applied(window.electronAPI.operatorChangePassword(current, next)),
    lock: async () => {
      set(adopt(await window.electronAPI.operatorLock()));
    },
    saveConfig: async (patch) => (await applied(window.electronAPI.operatorSetConfig(patch))).ok,
  };
});
