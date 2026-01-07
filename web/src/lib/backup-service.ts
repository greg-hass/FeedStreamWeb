import { db, Feed, Folder, Article } from './db';
import { useSettingsStore } from '@/store/settingsStore';
import { encrypt, decrypt, isEncryptedFormat, generateSecureToken } from './encryption-service';

export interface MasterBackup {
    version: number;
    exportedAt: string;
    folders: Folder[];
    feeds: Feed[];
    articles: Partial<Article>[];
    settings: {
        openaiApiKey?: string;
        geminiApiKey?: string;
        syncEndpoint?: string;
        syncUsername?: string;
        syncApiKey?: string;
    };
}

export interface EncryptedBackup {
    version: number;
    format: 'encrypted';
    algorithm: 'AES-256-GCM';
    data: string; // Encrypted MasterBackup JSON
}

export class BackupService {
    static async createMasterBackup(): Promise<MasterBackup> {
        const [folders, feeds, articles] = await Promise.all([
            db.folders.toArray(),
            db.feeds.toArray(),
            db.articles.toArray(),
        ]);

        const settings = useSettingsStore.getState();

        // For articles, we only backup essential state to keep file size reasonable
        // We exclude large contentHTML/readerHTML as those can be re-fetched,
        // but we keep isRead, isBookmarked, and basic metadata.
        const essentialArticles = articles.map(a => ({
            id: a.id,
            feedID: a.feedID,
            title: a.title,
            url: a.url,
            publishedAt: a.publishedAt,
            isRead: a.isRead,
            isBookmarked: a.isBookmarked,
            mediaKind: a.mediaKind,
            thumbnailPath: a.thumbnailPath,
        }));

        // Record successful backup
        useSettingsStore.getState().recordBackup();

        return {
            version: 1,
            exportedAt: new Date().toISOString(),
            folders,
            feeds,
            articles: essentialArticles,
            settings: {
                openaiApiKey: settings.openaiApiKey,
                geminiApiKey: settings.geminiApiKey,
                syncEndpoint: settings.syncEndpoint,
                syncUsername: settings.syncUsername,
                syncApiKey: settings.syncApiKey,
            }
        };
    }

    /**
     * Create an encrypted backup with password protection
     */
    static async createEncryptedBackup(password: string): Promise<EncryptedBackup> {
        const backup = await this.createMasterBackup();
        const json = JSON.stringify(backup);
        const encryptedData = await encrypt(json, password);

        return {
            version: 1,
            format: 'encrypted',
            algorithm: 'AES-256-GCM',
            data: encryptedData,
        };
    }

    /**
     * Decrypt an encrypted backup
     */
    static async decryptBackup(encryptedBackup: EncryptedBackup, password: string): Promise<MasterBackup> {
        if (encryptedBackup.format !== 'encrypted') {
            throw new Error('Backup is not encrypted');
        }

        const decryptedJson = await decrypt(encryptedBackup.data, password);
        return JSON.parse(decryptedJson) as MasterBackup;
    }

    /**
     * Restore from an encrypted backup
     */
    static async restoreEncryptedBackup(encryptedBackup: EncryptedBackup, password: string): Promise<void> {
        const backup = await this.decryptBackup(encryptedBackup, password);
        await this.restoreMasterBackup(backup);
    }

    static async restoreMasterBackup(backup: MasterBackup): Promise<void> {
        if (!backup.feeds || !backup.folders) {
            throw new Error("Invalid backup file: Missing feeds or folders.");
        }

        await db.transaction('rw', db.folders, db.feeds, db.articles, async () => {
            // Clear existing
            await Promise.all([
                db.folders.clear(),
                db.feeds.clear(),
                db.articles.clear(),
            ]);

            // Restore data
            if (backup.folders.length > 0) await db.folders.bulkAdd(backup.folders);
            if (backup.feeds.length > 0) await db.feeds.bulkAdd(backup.feeds);

            // Restore articles (handle Partial correctly)
            if (backup.articles.length > 0) {
                // Fill in defaults for missing fields in partial articles
                const articlesToRestore = backup.articles.map(a => ({
                    ...a,
                    playbackPosition: 0,
                    downloadStatus: 0,
                    imageCacheStatus: 0,
                })) as Article[];
                await db.articles.bulkAdd(articlesToRestore);
            }
        });

        // Restore Settings
        if (backup.settings) {
            const store = useSettingsStore.getState();
            if (backup.settings.openaiApiKey) store.setOpenaiApiKey(backup.settings.openaiApiKey);
            if (backup.settings.geminiApiKey) store.setGeminiApiKey(backup.settings.geminiApiKey);
            if (backup.settings.syncEndpoint) {
                store.setSyncConfig(
                    backup.settings.syncEndpoint,
                    backup.settings.syncUsername || '',
                    backup.settings.syncApiKey || ''
                );
            }
        }
    }

    /**
     * Download backup as unencrypted JSON file
     */
    static downloadBackup(backup: MasterBackup) {
        const json = JSON.stringify(backup, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const date = new Date().toISOString().split('T')[0];
        a.href = url;
        a.download = `feedstream_master_backup_${date}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Download encrypted backup file
     */
    static downloadEncryptedBackup(encryptedBackup: EncryptedBackup) {
        const json = JSON.stringify(encryptedBackup);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const date = new Date().toISOString().split('T')[0];
        a.href = url;
        a.download = `feedstream_encrypted_backup_${date}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Generate a shareable backup URL
     * The backup data is encrypted and encoded in the URL
     */
    static async generateBackupUrl(password: string): Promise<string> {
        const encryptedBackup = await this.createEncryptedBackup(password);
        const json = JSON.stringify(encryptedBackup);
        const encoded = btoa(unescape(encodeURIComponent(json)));

        // Create URL with base64-encoded encrypted backup
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
        return `${baseUrl}/restore?data=${encoded}`;
    }

    /**
     * Restore from a backup URL
     */
    static async restoreFromUrl(url: string, password: string): Promise<void> {
        const urlObj = new URL(url);
        const encoded = urlObj.searchParams.get('data');

        if (!encoded) {
            throw new Error('No backup data found in URL');
        }

        try {
            const json = decodeURIComponent(escape(atob(encoded)));
            const encryptedBackup = JSON.parse(json) as EncryptedBackup;

            if (encryptedBackup.format !== 'encrypted') {
                throw new Error('Invalid backup format');
            }

            await this.restoreEncryptedBackup(encryptedBackup, password);
        } catch (error) {
            if (error instanceof Error && error.message.includes('Decryption failed')) {
                throw new Error('Incorrect password');
            }
            throw error;
        }
    }

    /**
     * Check if a file/data is an encrypted backup
     */
    static isEncryptedBackup(data: unknown): data is EncryptedBackup {
        if (typeof data !== 'object' || data === null) return false;
        const obj = data as Record<string, unknown>;
        return obj.format === 'encrypted' && typeof obj.data === 'string';
    }

    /**
     * Parse backup file content (handles both encrypted and unencrypted)
     */
    static parseBackupFile(content: string): MasterBackup | EncryptedBackup {
        const parsed = JSON.parse(content);

        if (this.isEncryptedBackup(parsed)) {
            return parsed;
        }

        // Validate as MasterBackup
        if (!parsed.version || !parsed.exportedAt) {
            throw new Error('Invalid backup file format');
        }

        return parsed as MasterBackup;
    }
}
