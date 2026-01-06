import { create } from 'zustand';

interface RefreshProgressState {
    isSyncing: boolean;
    current: number;
    total: number;
    feedName?: string;
    setProgress: (current: number, total: number, feedName?: string) => void;
    startSync: (total: number) => void;
    endSync: () => void;
}

export const useUIStore = create<RefreshProgressState>((set) => ({
    isSyncing: false,
    current: 0,
    total: 0,
    feedName: undefined,
    
    startSync: (total: number) => set({ isSyncing: true, current: 0, total, feedName: 'Starting...' }),
    setProgress: (current, total, feedName) => set({ current, total, feedName }),
    endSync: () => set({ isSyncing: false, current: 0, total: 0, feedName: undefined }),
}));
