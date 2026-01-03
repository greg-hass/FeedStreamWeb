
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
    syncEndpoint: string;
    syncApiKey: string; // The raw username:apikey string or pre-hashed? Fever wants md5(user:key)
    syncUsername: string; // Helper to generate key
    syncEnabled: boolean;

    setSyncConfig: (endpoint: string, username: string, apiKey: string) => void;
    setSyncEnabled: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            syncEndpoint: '',
            syncApiKey: '',
            syncUsername: '',
            syncEnabled: false,

            setSyncConfig: (endpoint, username, apiKey) => set({ syncEndpoint: endpoint, syncUsername: username, syncApiKey: apiKey }),
            setSyncEnabled: (enabled) => set({ syncEnabled: enabled }),
        }),
        {
            name: 'feedstream-settings',
        }
    )
);
