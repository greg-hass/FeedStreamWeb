
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
  }
}

export const db = new FeedStreamDB();
