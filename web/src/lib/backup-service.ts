import { db, Feed, Folder, Article } from './db';
import { useSettingsStore } from '@/store/settingsStore';

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
}
