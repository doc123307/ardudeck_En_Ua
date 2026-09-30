import { create } from 'zustand';
import type { ConnectionState, ConnectOptions } from '../../shared/ipc-channels';
import { t } from '../i18n';

interface ConnectionStore {
  // State
  connectionState: ConnectionState;
  isConnecting: boolean;
  error: string | null;
  platformChangeInProgress: boolean; // Keep MspConfigView mounted during platform change

  // Actions
  setConnectionState: (state: ConnectionState) => void;
  setError: (error: string | null) => void;
  setPlatformChangeInProgress: (inProgress: boolean) => void;
  connect: (options: ConnectOptions) => Promise<boolean>;
  disconnect: () => Promise<void>;
  cancelReconnect: () => Promise<void>; // Cancel auto-reconnect during expected reboots
}

export const useConnectionStore = create<ConnectionStore>((set, get) => ({
  connectionState: {
    isConnected: false,
    packetsReceived: 0,
    packetsSent: 0,
  },
  isConnecting: false,
  error: null,
  platformChangeInProgress: false,

  setConnectionState: (state) => set({ connectionState: state }),
  setError: (error) => set({ error }),
  setPlatformChangeInProgress: (inProgress) => set({ platformChangeInProgress: inProgress }),

  connect: async (options) => {
    set({ isConnecting: true, error: null });
    try {
      const success = await window.electronAPI.connect(options);
      if (!success) {
        set({ error: t('stores.connection_store.connectionFailed') });
      }
      return success;
    } catch (err) {
      const message = err instanceof Error ? err.message : t('stores.connection_store.unknownError');
      set({ error: message });
      return false;
    } finally {
      set({ isConnecting: false });
    }
  },

  disconnect: async () => {
    await window.electronAPI.disconnect();
  },

  cancelReconnect: async () => {
    await window.electronAPI.cancelReconnect();
  },
}));
