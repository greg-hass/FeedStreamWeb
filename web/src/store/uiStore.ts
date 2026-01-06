import { create } from 'zustand';

interface RefreshProgressState {
    isSyncing: boolean;
    current: number;
    total: number;
    feedName?: string;
    abortController: AbortController | null;
    setProgress: (current: number, total: number, feedName?: string) => void;
    startSync: (total: number) => void;
    endSync: () => void;
    cancelSync: () => void;
}

export const useUIStore = create<RefreshProgressState>((set, get) => ({
    isSyncing: false,
    current: 0,
    total: 0,
    feedName: undefined,
    abortController: null,
    
    startSync: (total: number) => {
        // Cancel previous if exists
        get().abortController?.abort();
        const controller = new AbortController();
        set({ isSyncing: true, current: 0, total, feedName: 'Starting...', abortController: controller });
    },
    setProgress: (current, total, feedName) => set({ current, total, feedName }),
    endSync: () => set({ isSyncing: false, current: 0, total: 0, feedName: undefined, abortController: null }),
    cancelSync: () => {
        get().abortController?.abort();
        set({ isSyncing: false, current: 0, total: 0, feedName: undefined, abortController: null });
    }
}));
