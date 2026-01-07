import { StateStorage } from 'zustand/middleware';
import {
  encrypt,
  decrypt,
  hashPassword,
  verifyPassword,
  isEncryptedFormat,
  isEncryptionSupported,
} from './encryption-service';

/**
 * Secure Storage for Zustand with AES-256-GCM Encryption
 *
 * This module provides secure storage with optional master password protection:
 *
 * - Without master password: Uses Base64 obfuscation (backward compatible, casual protection)
 * - With master password: Uses AES-256-GCM encryption (strong protection)
 *
 * The master password is never stored - only a hash for verification.
 * If the password is lost, encrypted data cannot be recovered.
 */

const MASTER_PASSWORD_HASH_KEY = 'fs_master_pwd_hash';
const MASTER_PASSWORD_SALT_KEY = 'fs_master_pwd_salt';
const ENCRYPTION_ENABLED_KEY = 'fs_encryption_enabled';

// In-memory cache of the master password (cleared on page refresh)
let cachedMasterPassword: string | null = null;

/**
 * Check if a master password has been set
 */
export function hasMasterPassword(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(MASTER_PASSWORD_HASH_KEY) !== null;
}

/**
 * Check if the master password is currently unlocked (in memory)
 */
export function isMasterPasswordUnlocked(): boolean {
  return cachedMasterPassword !== null;
}

/**
 * Set up a new master password for encryption
 * This will re-encrypt all existing stored data
 */
export async function setMasterPassword(password: string): Promise<boolean> {
  if (!isEncryptionSupported()) {
    console.error('Web Crypto API not supported');
    return false;
  }

  try {
    // Hash the password for verification
    const { hash, salt } = await hashPassword(password);

    // Store the hash and salt (never the actual password)
    localStorage.setItem(MASTER_PASSWORD_HASH_KEY, hash);
    localStorage.setItem(MASTER_PASSWORD_SALT_KEY, salt);
    localStorage.setItem(ENCRYPTION_ENABLED_KEY, 'true');

    // Cache the password in memory
    cachedMasterPassword = password;

    // Re-encrypt existing data with the new password
    await migrateStorageToEncrypted(password);

    return true;
  } catch (error) {
    console.error('Failed to set master password:', error);
    return false;
  }
}

/**
 * Unlock storage with the master password
 * Must be called before reading/writing encrypted data
 */
export async function unlockWithMasterPassword(password: string): Promise<boolean> {
  const storedHash = localStorage.getItem(MASTER_PASSWORD_HASH_KEY);
  const storedSalt = localStorage.getItem(MASTER_PASSWORD_SALT_KEY);

  if (!storedHash || !storedSalt) {
    return false;
  }

  try {
    const isValid = await verifyPassword(password, storedHash, storedSalt);
    if (isValid) {
      cachedMasterPassword = password;
      return true;
    }
    return false;
  } catch (error) {
    console.error('Password verification failed:', error);
    return false;
  }
}

/**
 * Lock the storage (clear cached password)
 */
export function lockStorage(): void {
  cachedMasterPassword = null;
}

/**
 * Change the master password
 * Requires the current password for verification
 */
export async function changeMasterPassword(
  currentPassword: string,
  newPassword: string
): Promise<boolean> {
  // Verify current password
  const isValid = await unlockWithMasterPassword(currentPassword);
  if (!isValid) {
    return false;
  }

  // Decrypt all data with current password, then re-encrypt with new password
  const allData = await getAllStoredData(currentPassword);

  // Set new password hash
  const { hash, salt } = await hashPassword(newPassword);
  localStorage.setItem(MASTER_PASSWORD_HASH_KEY, hash);
  localStorage.setItem(MASTER_PASSWORD_SALT_KEY, salt);

  // Re-encrypt all data with new password
  cachedMasterPassword = newPassword;
  for (const [key, value] of Object.entries(allData)) {
    if (value !== null) {
      await secureStorage.setItem(key, value);
    }
  }

  return true;
}

/**
 * Remove master password and decrypt all data back to Base64 obfuscation
 */
export async function removeMasterPassword(password: string): Promise<boolean> {
  const isValid = await unlockWithMasterPassword(password);
  if (!isValid) {
    return false;
  }

  // Get all encrypted data
  const allData = await getAllStoredData(password);

  // Remove password-related keys
  localStorage.removeItem(MASTER_PASSWORD_HASH_KEY);
  localStorage.removeItem(MASTER_PASSWORD_SALT_KEY);
  localStorage.removeItem(ENCRYPTION_ENABLED_KEY);
  cachedMasterPassword = null;

  // Re-store all data with Base64 obfuscation only
  for (const [key, value] of Object.entries(allData)) {
    if (value !== null && key.startsWith('feedstream-')) {
      const obfuscated = btoa(unescape(encodeURIComponent(value)));
      localStorage.setItem(key, obfuscated);
    }
  }

  return true;
}

/**
 * Check if encryption is enabled (master password set)
 */
export function isEncryptionEnabled(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(ENCRYPTION_ENABLED_KEY) === 'true';
}

/**
 * Get all stored data (for migration/backup)
 */
async function getAllStoredData(password?: string): Promise<Record<string, string | null>> {
  const data: Record<string, string | null> = {};

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('feedstream-')) {
      const value = await secureStorage.getItem(key);
      data[key] = value;
    }
  }

  return data;
}

/**
 * Migrate existing Base64 data to encrypted format
 */
async function migrateStorageToEncrypted(password: string): Promise<void> {
  const keysToMigrate: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('feedstream-')) {
      keysToMigrate.push(key);
    }
  }

  for (const key of keysToMigrate) {
    const rawValue = localStorage.getItem(key);
    if (!rawValue) continue;

    // Skip if already encrypted
    if (isEncryptedFormat(rawValue)) continue;

    try {
      // Decode Base64 obfuscated value
      const decoded = decodeURIComponent(escape(atob(rawValue)));

      // Re-encrypt with AES
      const encrypted = await encrypt(decoded, password);
      localStorage.setItem(key, encrypted);
    } catch (error) {
      console.warn(`Failed to migrate key ${key}:`, error);
    }
  }
}

/**
 * Secure Storage implementation for Zustand
 *
 * - If master password is set and unlocked: uses AES-256-GCM encryption
 * - Otherwise: uses Base64 obfuscation (backward compatible)
 */
export const secureStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    if (typeof localStorage === 'undefined') return null;

    const value = localStorage.getItem(name);
    if (!value) return null;

    try {
      // Check if data is encrypted (AES format)
      if (isEncryptedFormat(value)) {
        // Need master password to decrypt
        if (!cachedMasterPassword) {
          console.warn('Encrypted data found but master password not unlocked');
          return null;
        }
        return await decrypt(value, cachedMasterPassword);
      }

      // Legacy Base64 obfuscation format
      return decodeURIComponent(escape(atob(value)));
    } catch (error) {
      console.warn('Failed to decrypt storage:', error);
      return null;
    }
  },

  setItem: async (name: string, value: string): Promise<void> => {
    if (typeof localStorage === 'undefined') return;

    try {
      let stored: string;

      // Use encryption if master password is set and unlocked
      if (isEncryptionEnabled() && cachedMasterPassword) {
        stored = await encrypt(value, cachedMasterPassword);
      } else {
        // Fall back to Base64 obfuscation
        stored = btoa(unescape(encodeURIComponent(value)));
      }

      localStorage.setItem(name, stored);
    } catch (error) {
      console.error('Failed to encrypt storage:', error);
    }
  },

  removeItem: async (name: string): Promise<void> => {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(name);
  },
};

/**
 * Export utility functions for use in settings UI
 */
export const SecureStorageManager = {
  hasMasterPassword,
  isMasterPasswordUnlocked,
  setMasterPassword,
  unlockWithMasterPassword,
  lockStorage,
  changeMasterPassword,
  removeMasterPassword,
  isEncryptionEnabled,
  isSupported: isEncryptionSupported,
};
