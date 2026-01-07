import { create } from 'zustand';

interface RefreshProgressState {
    isSyncing: boolean;
    isImporting: boolean;
    current: number;
    total: number;
    feedName?: string;
    lastUpdate?: number;
    abortController: AbortController | null;
    setProgress: (current: number, total: number, feedName?: string) => void;
    setImportProgress: (current: number, total: number, message?: string) => void;
    startSync: (total: number) => void;
    startImport: (total: number) => void;
    endSync: () => void;
    endImport: () => void;
    cancelSync: () => void;
}

export const useUIStore = create<RefreshProgressState>((set, get) => ({
    isSyncing: false,
    isImporting: false,
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
    startImport: (total: number) => {
        set({ isImporting: true, current: 0, total, feedName: 'Importing OPML...' });
    },
    setProgress: (current, total, feedName) => {
        // Simple throttle to avoid UI jitter from rapid updates
        const state = get();
        if (current === total || current === 0 || !state.lastUpdate || Date.now() - state.lastUpdate > 100) {
            set({ current, total, feedName, lastUpdate: Date.now() });
        }
    },
    setImportProgress: (current, total, message) => {
        set({ current, total, feedName: message, lastUpdate: Date.now() });
    },
    endSync: () => set({ isSyncing: false, current: 0, total: 0, feedName: undefined, abortController: null, lastUpdate: 0 }),
    endImport: () => set({ isImporting: false, current: 0, total: 0, feedName: undefined, lastUpdate: 0 }),
    cancelSync: () => {
        get().abortController?.abort();
        set({ isSyncing: false, current: 0, total: 0, feedName: undefined, abortController: null });
    }
}));
