
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { secureStorage } from '@/lib/secure-storage';

interface SettingsState {
    syncEndpoint: string;
    syncApiKey: string; // The raw username:apikey string or pre-hashed? Fever wants md5(user:key)
    syncUsername: string; // Helper to generate key
    syncEnabled: boolean;
    openaiApiKey: string;
    geminiApiKey: string; // NEW

    setSyncConfig: (endpoint: string, username: string, apiKey: string) => void;
    setSyncEnabled: (enabled: boolean) => void;
    setOpenaiApiKey: (key: string) => void;
    setGeminiApiKey: (key: string) => void; // NEW
    lastRefreshTime: number;
    setLastRefreshTime: (time: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            syncEndpoint: '',
            syncApiKey: '',
            syncUsername: '',
            syncEnabled: false,
            openaiApiKey: '',
            geminiApiKey: '', // NEW
            lastRefreshTime: 0,

            setSyncConfig: (endpoint, username, apiKey) => set({ syncEndpoint: endpoint, syncUsername: username, syncApiKey: apiKey }),
            setSyncEnabled: (enabled) => set({ syncEnabled: enabled }),
            setOpenaiApiKey: (key) => set({ openaiApiKey: key }),
            setGeminiApiKey: (key) => set({ geminiApiKey: key }), // NEW
            setLastRefreshTime: (time) => set({ lastRefreshTime: time }),
        }),
        {
            name: 'feedstream-settings',
            storage: createJSONStorage(() => secureStorage),
        }
    )
);
