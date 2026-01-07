import { create } from 'zustand';

interface RefreshProgressState {
    isSyncing: boolean;
    current: number;
    total: number;
    feedName?: string;
    lastUpdate?: number;
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
    setProgress: (current, total, feedName) => {
        // Simple throttle to avoid UI jitter from rapid updates
        const state = get();
        if (current === total || current === 0 || !state.lastUpdate || Date.now() - state.lastUpdate > 100) {
            set({ current, total, feedName, lastUpdate: Date.now() });
        }
    },
    endSync: () => set({ isSyncing: false, current: 0, total: 0, feedName: undefined, abortController: null, lastUpdate: 0 }),
    cancelSync: () => {
        get().abortController?.abort();
        set({ isSyncing: false, current: 0, total: 0, feedName: undefined, abortController: null });
    }
}));
