
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
  isRead: boolean;
  isBookmarked: boolean;
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

export const db = new FeedStreamDB();
