import { StateStorage } from 'zustand/middleware';

// Basic obfuscation to prevent plain-text exposure in LocalStorage.
// NOTE: This is NOT strong encryption. In a client-side app without a user-provided password,
// we cannot securely manage a secret key. This protects against casual snooping (shoulder surfing, devtools).
// For higher security, the app would need a "Master Password" feature to encrypt this vault.

const STORAGE_PREFIX = 'fs_secure_';

export const secureStorage: StateStorage = {
    getItem: async (name: string): Promise<string | null> => {
        if (typeof localStorage === 'undefined') return null;
        const value = localStorage.getItem(name);
        if (!value) return null;
        try {
            // Simple De-Obfuscation (Base64)
            return decodeURIComponent(escape(atob(value)));
        } catch (e) {
            console.warn('Failed to decrypt storage, resetting', e);
            return null;
        }
    },
    setItem: async (name: string, value: string): Promise<void> => {
        if (typeof localStorage === 'undefined') return;
        try {
            // Simple Obfuscation (Base64)
            // We use escape/encodeURIComponent to handle Unicode strings correctly
            const encrypted = btoa(unescape(encodeURIComponent(value)));
            localStorage.setItem(name, encrypted);
        } catch (e) {
            console.error('Failed to encrypt storage', e);
        }
    },
    removeItem: async (name: string): Promise<void> => {
        if (typeof localStorage === 'undefined') return;
        localStorage.removeItem(name);
    },
};
