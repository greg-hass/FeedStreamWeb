
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
    syncEndpoint: string;
    syncApiKey: string; // The raw username:apikey string or pre-hashed? Fever wants md5(user:key)
    syncUsername: string; // Helper to generate key
    syncEnabled: boolean;

    setSyncConfig: (endpoint: string, username: string, apiKey: string) => void;
    setSyncEnabled: (enabled: boolean) => void;
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
            lastRefreshTime: 0,

            setSyncConfig: (endpoint, username, apiKey) => set({ syncEndpoint: endpoint, syncUsername: username, syncApiKey: apiKey }),
            setSyncEnabled: (enabled) => set({ syncEnabled: enabled }),
            setLastRefreshTime: (time) => set({ lastRefreshTime: time }),
        }),
        {
            name: 'feedstream-settings',
        }
    )
);
