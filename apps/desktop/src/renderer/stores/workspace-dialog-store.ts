import { create } from 'zustand';

/** Open state of the telemetry Workspace dialog, so a tour step can open it for its anchor. */
interface WorkspaceDialogStore {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const useWorkspaceDialogStore = create<WorkspaceDialogStore>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));
