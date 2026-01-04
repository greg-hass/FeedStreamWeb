import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ScrollState {
    positions: Record<string, number>;
    sidebarWidth: number;
    setScrollPosition: (key: string, position: number) => void;
    getScrollPosition: (key: string) => number;
    setSidebarWidth: (width: number) => void;
}

export const useScrollStore = create<ScrollState>()(
    persist(
        (set, get) => ({
            positions: {},
            sidebarWidth: 256, // default 16rem = 256px
            setScrollPosition: (key, position) => set((state) => ({
                positions: { ...state.positions, [key]: position }
            })),
            getScrollPosition: (key) => get().positions[key] || 0,
            setSidebarWidth: (width) => set({ sidebarWidth: Math.max(200, Math.min(400, width)) }),
        }),
        {
            name: 'feedstream-scroll',
        }
    )
);
