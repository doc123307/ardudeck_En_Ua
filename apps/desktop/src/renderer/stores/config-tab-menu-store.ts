import { create } from 'zustand';

/** Which configuration tab group has its dropdown open, so a tour step can show one. */
interface ConfigTabMenuStore {
  openGroupId: string | null;
  setOpenGroupId: (id: string | null) => void;
}

export const useConfigTabMenuStore = create<ConfigTabMenuStore>((set) => ({
  openGroupId: null,
  setOpenGroupId: (openGroupId) => set({ openGroupId }),
}));
