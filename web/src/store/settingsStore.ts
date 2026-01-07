
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { secureStorage } from '@/lib/secure-storage';

interface SettingsState {
    // Fever API Sync (legacy)
    syncEndpoint: string;
    syncApiKey: string; // The raw username:apikey string or pre-hashed? Fever wants md5(user:key)
    syncUsername: string; // Helper to generate key
    syncEnabled: boolean;

    // AI Keys
    openaiApiKey: string;
    geminiApiKey: string;

    setSyncConfig: (endpoint: string, username: string, apiKey: string) => void;
    setSyncEnabled: (enabled: boolean) => void;
    setOpenaiApiKey: (key: string) => void;
    setGeminiApiKey: (key: string) => void;
    lastRefreshTime: number;
    setLastRefreshTime: (time: number) => void;

    // Backup Reminders
    backupFrequency: 'never' | 'daily' | 'weekly' | 'monthly';
    lastBackupAt: string | null;
    setBackupFrequency: (freq: 'never' | 'daily' | 'weekly' | 'monthly') => void;
    recordBackup: () => void;

    // Supabase Cloud Sync
    supabaseEnabled: boolean;
    supabaseEmail: string;
    lastSyncAt: string | null;
    syncOnStartup: boolean;
    syncInterval: number; // minutes, 0 = manual only
    setSupabaseEnabled: (enabled: boolean) => void;
    setSupabaseEmail: (email: string) => void;
    setLastSyncAt: (date: string | null) => void;
    setSyncOnStartup: (enabled: boolean) => void;
    setSyncInterval: (minutes: number) => void;

    // Cache & Storage Settings
    maxArticleAge: number; // days, 0 = unlimited
    maxCacheSize: number; // MB, 0 = unlimited
    autoClearOldArticles: boolean;
    prefetchEnabled: boolean;
    prefetchOnWifiOnly: boolean;
    setMaxArticleAge: (days: number) => void;
    setMaxCacheSize: (mb: number) => void;
    setAutoClearOldArticles: (enabled: boolean) => void;
    setPrefetchEnabled: (enabled: boolean) => void;
    setPrefetchOnWifiOnly: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            // Fever API Sync (legacy)
            syncEndpoint: '',
            syncApiKey: '',
            syncUsername: '',
            syncEnabled: false,

            // AI Keys
            openaiApiKey: '',
            geminiApiKey: '',

            lastRefreshTime: 0,

            // Backup Reminders
            backupFrequency: 'weekly',
            lastBackupAt: null,

            // Supabase Cloud Sync
            supabaseEnabled: false,
            supabaseEmail: '',
            lastSyncAt: null,
            syncOnStartup: true,
            syncInterval: 15, // 15 minutes default

            // Cache & Storage Settings
            maxArticleAge: 30, // 30 days default
            maxCacheSize: 500, // 500MB default
            autoClearOldArticles: true,
            prefetchEnabled: true,
            prefetchOnWifiOnly: true,

            // Fever Sync Actions
            setSyncConfig: (endpoint, username, apiKey) => set({ syncEndpoint: endpoint, syncUsername: username, syncApiKey: apiKey }),
            setSyncEnabled: (enabled) => set({ syncEnabled: enabled }),

            // AI Key Actions
            setOpenaiApiKey: (key) => set({ openaiApiKey: key }),
            setGeminiApiKey: (key) => set({ geminiApiKey: key }),

            setLastRefreshTime: (time) => set({ lastRefreshTime: time }),

            // Backup Actions
            setBackupFrequency: (freq) => set({ backupFrequency: freq }),
            recordBackup: () => set({ lastBackupAt: new Date().toISOString() }),

            // Supabase Cloud Sync Actions
            setSupabaseEnabled: (enabled) => set({ supabaseEnabled: enabled }),
            setSupabaseEmail: (email) => set({ supabaseEmail: email }),
            setLastSyncAt: (date) => set({ lastSyncAt: date }),
            setSyncOnStartup: (enabled) => set({ syncOnStartup: enabled }),
            setSyncInterval: (minutes) => set({ syncInterval: minutes }),

            // Cache & Storage Actions
            setMaxArticleAge: (days) => set({ maxArticleAge: days }),
            setMaxCacheSize: (mb) => set({ maxCacheSize: mb }),
            setAutoClearOldArticles: (enabled) => set({ autoClearOldArticles: enabled }),
            setPrefetchEnabled: (enabled) => set({ prefetchEnabled: enabled }),
            setPrefetchOnWifiOnly: (enabled) => set({ prefetchOnWifiOnly: enabled }),
        }),
        {
            name: 'feedstream-settings',
            storage: createJSONStorage(() => secureStorage),
        }
    )
);
