import { create } from 'zustand';

/** Open state of the mission Survey menu, so a tour step can show it. */
interface SurveyMenuStore {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const useSurveyMenuStore = create<SurveyMenuStore>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));
