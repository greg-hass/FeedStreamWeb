
import Dexie, { type EntityTable } from 'dexie';

// Interfaces matching the iOS schema

export type FeedType = 'rss' | 'atom' | 'json' | 'youtube' | 'reddit' | 'podcast';

export interface Folder {
  id: string;
  name: string;
  position: number;
}

export interface Feed {
  id: string;
  title: string;
  siteURL?: string;
  isFaviconLoaded?: boolean;
  feedURL: string;
  type: FeedType;
  folderID?: string;
  faviconPath?: string;
  iconURL?: string; // NEW: Favicon/channel icon URL
  lastSync?: Date;
  etag?: string;
  lastModified?: string;
  defaultViewMode?: string;
  lastError?: string;
  lastSuccessfulSync?: Date;
  consecutiveFailures: number;
  isPaused: boolean;
  sortOrder: number;
  isFavorite: boolean;
  dateAdded?: Date;
}

export interface Article {
  id: string;
  feedID: string;
  title: string;
  author?: string;
  summary?: string;
  contentHTML?: string;
  readerHTML?: string;
  url?: string;
  publishedAt?: Date;
  updatedAt?: Date;
  isRead: number; // 0 = unread, 1 = read
  isBookmarked: number; // 0 = no, 1 = yes
  mediaKind: string; // 'none' | 'video' | 'audio'
  thumbnailPath?: string;
  duration?: number;
  cachedReadingTime?: number;

  // Offline/Cache
  contentPrefetchedAt?: Date;
  imageCacheStatus: number; // 0=not_cached, 1=cached, 2=failed
  imageWidth?: number;
  imageHeight?: number;

  // Enclosure
  enclosureURL?: string;
  enclosureType?: string;

  // Content Hash (Deduplication)
  content_hash?: string;

  // Podcast
  playbackPosition: number;
  localFilePath?: string;
  downloadStatus: number;
  playedAt?: Date;
}

export interface PlaybackQueueItem {
  id: string;
  articleID: string;
  position: number;
  addedAt: Date;
}

export interface FeedCollectionMembership {
  id: string;
  feedID: string;
  folderID: string;
  addedAt: Date;
}

// Database Class
export class FeedStreamDB extends Dexie {
  folders!: EntityTable<Folder, 'id'>;
  feeds!: EntityTable<Feed, 'id'>;
  articles!: EntityTable<Article, 'id'>;
  playbackQueue!: EntityTable<PlaybackQueueItem, 'id'>;
  feedCollectionMembership!: EntityTable<FeedCollectionMembership, 'id'>;
  rules!: EntityTable<AutomationRule, 'id'>;
  briefings!: EntityTable<DailyBriefing, 'id'>;
  syncQueue!: EntityTable<SyncQueueItem, 'id'>;

  constructor() {
    super('FeedStreamDB');

    // Schema version 1 (matching iOS v25)
    this.version(1).stores({
      folders: 'id, position',
      feeds: 'id, folderID, type, &feedURL, isPaused, sortOrder, isFavorite, dateAdded',
      articles: 'id, feedID, [feedID+isRead+publishedAt], [isRead+publishedAt], publishedAt, url, &content_hash, [contentPrefetchedAt+isRead]',
      playbackQueue: 'id, articleID, &position',
      feedCollectionMembership: 'id, [feedID+folderID], folderID'
    });

    // Schema version 2: Add indices for sidebar counts (isBookmarked, mediaKind)
    this.version(2).stores({
      articles: 'id, feedID, [feedID+isRead+publishedAt], [isRead+publishedAt], publishedAt, url, &content_hash, [contentPrefetchedAt+isRead], isBookmarked, mediaKind'
    });

    // Schema version 3: Add iconURL for feed icons/favicons
    this.version(3).stores({
      feeds: 'id, folderID, type, &feedURL, isPaused, sortOrder, isFavorite, dateAdded, iconURL'
    });

    // Schema version 4: Add compound indexes for efficient filtering + sorting
    this.version(4).stores({
      articles: 'id, feedID, [feedID+isRead+publishedAt], [isRead+publishedAt], publishedAt, url, &content_hash, [contentPrefetchedAt+isRead], isBookmarked, mediaKind, [mediaKind+publishedAt], [isBookmarked+publishedAt]'
    });

    // Schema version 5: Automation Rules & AI Briefings
    this.version(5).stores({
      rules: 'id, name, isActive', // Simple index, full scan is fine for rules (usually < 50)
      briefings: 'id, date, generatedAt'
    });

    // Schema version 6: Performance Indexes
    this.version(6).stores({
        articles: 'id, feedID, [feedID+isRead+publishedAt], [isRead+publishedAt], publishedAt, url, &content_hash, [contentPrefetchedAt+isRead], isBookmarked, mediaKind, [mediaKind+publishedAt], [isBookmarked+publishedAt], [feedID+publishedAt]'
    });

    // Schema version 7: Sync Queue for offline-first cloud sync
    // Note: Only new/changed tables need to be declared; others are inherited
    this.version(7).stores({
        syncQueue: '++id, table, recordId, createdAt, attempts'
    });

    // Schema version 8: Fix potential schema issues - redeclare all tables
    this.version(8).stores({
        folders: 'id, position',
        feeds: 'id, folderID, type, &feedURL, isPaused, sortOrder, isFavorite, dateAdded, iconURL',
        articles: 'id, feedID, [feedID+isRead+publishedAt], [isRead+publishedAt], publishedAt, url, &content_hash, [contentPrefetchedAt+isRead], isBookmarked, mediaKind, [mediaKind+publishedAt], [isBookmarked+publishedAt], [feedID+publishedAt]',
        playbackQueue: 'id, articleID, &position',
        feedCollectionMembership: 'id, [feedID+folderID], folderID',
        rules: 'id, name, isActive',
        briefings: 'id, date, generatedAt',
        syncQueue: '++id, table, recordId, createdAt, attempts'
    });

    // Schema version 9: Remove unique constraint from content_hash (null values conflict)
    this.version(9).stores({
        folders: 'id, position',
        feeds: 'id, folderID, type, &feedURL, isPaused, sortOrder, isFavorite, dateAdded, iconURL',
        articles: 'id, feedID, [feedID+isRead+publishedAt], [isRead+publishedAt], publishedAt, url, content_hash, [contentPrefetchedAt+isRead], isBookmarked, mediaKind, [mediaKind+publishedAt], [isBookmarked+publishedAt], [feedID+publishedAt]',
        playbackQueue: 'id, articleID, position',
        feedCollectionMembership: 'id, [feedID+folderID], folderID',
        rules: 'id, name, isActive',
        briefings: 'id, date, generatedAt',
        syncQueue: '++id, table, recordId, createdAt, attempts'
    });
  }

  async search(query: string, limit: number = 50): Promise<Article[]> {
    const q = query.toLowerCase();
    return this.articles
      .filter(a => 
        (a.title && a.title.toLowerCase().includes(q)) || 
        (a.summary && a.summary.toLowerCase().includes(q)) ||
        (a.contentHTML && a.contentHTML.toLowerCase().includes(q) || false)
      )
      .limit(limit)
      .reverse() // Newest first usually implies higher id/insertion order, or we should sort by publishedAt
      .sortBy('publishedAt');
  }
}

export interface AutomationRule {
  id: string;
  name: string;
  conditionType: 'title_contains' | 'content_contains' | 'feed_is' | 'author_contains';
  conditionValue: string; // e.g. "Sponsor" or FeedID
  action: 'mark_read' | 'delete' | 'star' | 'tag_important';
  isActive: boolean;
  createdAt: Date;
}

export interface DailyBriefing {
  id: string;
  date: string; // YYYY-MM-DD key
  content: string; // Markdown content
  generatedAt: Date;
  articlesCovered: string[]; // List of article IDs included
}

export interface SyncQueueItem {
  id?: number;
  table: 'folders' | 'feeds' | 'articles';
  recordId: string;
  operation: 'insert' | 'update' | 'delete';
  data: object;
  createdAt: Date;
  attempts: number;
}

export const db = new FeedStreamDB();

// Track if we're currently recovering to prevent loops
let isRecovering = false;

/**
 * Check if an error is related to database cursor/connection issues
 */
export function isDatabaseConnectionError(error: any): boolean {
    const errorMsg = error?.message || String(error);
    return (
        errorMsg.includes('cursor') ||
        errorMsg.includes('iterate') ||
        errorMsg.includes('transaction') ||
        errorMsg.includes('database connection') ||
        errorMsg.includes('UnknownError') ||
        errorMsg.includes('InvalidStateError')
    );
}

/**
 * Reopen the database connection
 * Used when iOS Safari closes IndexedDB on background
 */
export async function reopenDatabase(): Promise<void> {
    if (isRecovering) return;

    isRecovering = true;
    try {
        db.close();
        await db.open();
        console.log('[DB] Database reopened successfully');
    } finally {
        isRecovering = false;
    }
}

/**
 * Wrapper for database operations that automatically retries on iOS cursor errors
 * Use this to wrap any db query that uses cursors (.toArray(), .filter(), etc.)
 *
 * @example
 * // For critical operations that must succeed:
 * const articles = await withDatabaseRetry(() =>
 *   db.articles.where('feedID').equals(feedId).toArray()
 * );
 *
 * @example
 * // For operations in useEffect or event handlers:
 * useEffect(() => {
 *   withDatabaseRetry(async () => {
 *     const feeds = await db.feeds.toArray();
 *     setFeeds(feeds);
 *   }).catch(console.error);
 * }, []);
 */
export async function withDatabaseRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 2
): Promise<T> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            const isLastAttempt = attempt === maxRetries;

            if (isDatabaseConnectionError(error) && !isLastAttempt) {
                console.log(`[DB] Cursor/connection error detected (attempt ${attempt + 1}/${maxRetries + 1}), reopening database...`);
                await reopenDatabase();
                // Wait a bit before retrying
                await new Promise(resolve => setTimeout(resolve, 100));
            } else {
                // Either not a DB error, or we've exhausted retries
                throw error;
            }
        }
    }

    // This should never be reached, but TypeScript needs it
    throw new Error('Database operation failed after all retries');
}

// Handle database errors globally - auto-recover from iOS background issues
// Use window error handler since Dexie doesn't expose a global error event
if (typeof window !== 'undefined') {
    window.addEventListener('unhandledrejection', (event) => {
        if (isDatabaseConnectionError(event.reason) && !isRecovering) {
            console.log('[DB] Detected unhandled database error, attempting recovery...');
            event.preventDefault(); // Prevent error from propagating
            reopenDatabase().then(() => {
                // Reload the page to reset React state
                window.location.reload();
            }).catch(console.error);
        }
    });
}

/**
 * Setup visibility change handler to reopen DB on iOS
 * Call this once on app initialization
 */
export function setupDatabaseReconnection(): void {
    if (typeof document === 'undefined') return;

    // Proactively reopen database when app becomes visible
    const handleVisibilityChange = async () => {
        if (document.visibilityState === 'visible') {
            console.log('[DB] App became visible, ensuring database is open');
            try {
                await reopenDatabase();
            } catch (error) {
                console.error('[DB] Failed to reopen database on visibility change:', error);
            }
        }
    };

    // Handle focus event (sometimes fires before visibilitychange)
    const handleFocus = async () => {
        console.log('[DB] Window focused, ensuring database is open');
        try {
            await reopenDatabase();
        } catch (error) {
            console.error('[DB] Failed to reopen database on focus:', error);
        }
    };

    // Handle resume event (iOS-specific, fires when app returns from background)
    const handleResume = async () => {
        console.log('[DB] App resumed, ensuring database is open');
        try {
            await reopenDatabase();
        } catch (error) {
            console.error('[DB] Failed to reopen database on resume:', error);
        }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('resume', handleResume); // iOS PWA specific

    // Also handle page show event (iOS back-forward cache)
    window.addEventListener('pageshow', async (event) => {
        if (event.persisted) {
            console.log('[DB] Page restored from bfcache, reopening database');
            try {
                await reopenDatabase();
            } catch (error) {
                console.error('[DB] Failed to reopen database from bfcache:', error);
            }
        }
    });

    // Handle online event (reconnecting after being offline)
    window.addEventListener('online', async () => {
        console.log('[DB] Network online, ensuring database is open');
        try {
            await reopenDatabase();
        } catch (error) {
            console.error('[DB] Failed to reopen database when online:', error);
        }
    });
}
