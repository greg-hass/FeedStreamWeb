"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userSettings = exports.briefings = exports.syncQueue = exports.articleStates = exports.articles = exports.feeds = exports.folders = exports.users = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
// Users table (simple device-based auth)
exports.users = (0, pg_core_1.pgTable)('users', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    deviceId: (0, pg_core_1.varchar)('device_id', { length: 255 }).notNull().unique(),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
// Folders
exports.folders = (0, pg_core_1.pgTable)('folders', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    userId: (0, pg_core_1.uuid)('user_id').references(() => exports.users.id).notNull(),
    name: (0, pg_core_1.varchar)('name', { length: 255 }).notNull(),
    position: (0, pg_core_1.integer)('position').default(0),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
    deletedAt: (0, pg_core_1.timestamp)('deleted_at'),
}, (table) => ({
    userIdIdx: (0, pg_core_1.index)('folders_user_id_idx').on(table.userId),
}));
// Feeds
exports.feeds = (0, pg_core_1.pgTable)('feeds', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    userId: (0, pg_core_1.uuid)('user_id').references(() => exports.users.id).notNull(),
    folderId: (0, pg_core_1.uuid)('folder_id').references(() => exports.folders.id),
    title: (0, pg_core_1.varchar)('title', { length: 500 }).notNull(),
    feedUrl: (0, pg_core_1.text)('feed_url').notNull(),
    siteUrl: (0, pg_core_1.text)('site_url'),
    type: (0, pg_core_1.varchar)('type', { length: 50 }).default('rss'), // rss, atom, json, youtube, reddit, podcast
    iconUrl: (0, pg_core_1.text)('icon_url'),
    isPaused: (0, pg_core_1.boolean)('is_paused').default(false),
    sortOrder: (0, pg_core_1.integer)('sort_order').default(0),
    isFavorite: (0, pg_core_1.boolean)('is_favorite').default(false),
    lastSyncAt: (0, pg_core_1.timestamp)('last_sync_at'),
    lastError: (0, pg_core_1.text)('last_error'),
    consecutiveFailures: (0, pg_core_1.integer)('consecutive_failures').default(0),
    etag: (0, pg_core_1.text)('etag'),
    lastModified: (0, pg_core_1.text)('last_modified'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
    deletedAt: (0, pg_core_1.timestamp)('deleted_at'),
}, (table) => ({
    userIdIdx: (0, pg_core_1.index)('feeds_user_id_idx').on(table.userId),
    feedUrlIdx: (0, pg_core_1.uniqueIndex)('feeds_user_feed_url_idx').on(table.userId, table.feedUrl),
}));
// Articles with full-text search
exports.articles = (0, pg_core_1.pgTable)('articles', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    feedId: (0, pg_core_1.uuid)('feed_id').references(() => exports.feeds.id).notNull(),
    userId: (0, pg_core_1.uuid)('user_id').references(() => exports.users.id).notNull(),
    externalId: (0, pg_core_1.varchar)('external_id', { length: 255 }), // Stable ID from feed
    title: (0, pg_core_1.text)('title').notNull(),
    author: (0, pg_core_1.varchar)('author', { length: 255 }),
    summary: (0, pg_core_1.text)('summary'),
    content: (0, pg_core_1.text)('content'),
    url: (0, pg_core_1.text)('url'),
    publishedAt: (0, pg_core_1.timestamp)('published_at'),
    mediaKind: (0, pg_core_1.varchar)('media_kind', { length: 50 }).default('none'), // none, video, audio, youtube
    thumbnailUrl: (0, pg_core_1.text)('thumbnail_url'),
    enclosureUrl: (0, pg_core_1.text)('enclosure_url'),
    enclosureType: (0, pg_core_1.varchar)('enclosure_type', { length: 100 }),
    // Full-text search vector
    searchVector: (0, pg_core_1.text)('search_vector'),
    fetchedAt: (0, pg_core_1.timestamp)('fetched_at').defaultNow(),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
}, (table) => ({
    feedIdIdx: (0, pg_core_1.index)('articles_feed_id_idx').on(table.feedId),
    userIdIdx: (0, pg_core_1.index)('articles_user_id_idx').on(table.userId),
    publishedAtIdx: (0, pg_core_1.index)('articles_published_at_idx').on(table.publishedAt),
    searchIdx: (0, pg_core_1.index)('articles_search_idx').on(table.searchVector),
}));
// Article states (read/bookmarked per user)
exports.articleStates = (0, pg_core_1.pgTable)('article_states', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    userId: (0, pg_core_1.uuid)('user_id').references(() => exports.users.id).notNull(),
    articleId: (0, pg_core_1.uuid)('article_id').references(() => exports.articles.id).notNull(),
    isRead: (0, pg_core_1.boolean)('is_read').default(false),
    isBookmarked: (0, pg_core_1.boolean)('is_bookmarked').default(false),
    playbackPosition: (0, pg_core_1.integer)('playback_position').default(0),
    readAt: (0, pg_core_1.timestamp)('read_at'),
    bookmarkedAt: (0, pg_core_1.timestamp)('bookmarked_at'),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
}, (table) => ({
    userArticleIdx: (0, pg_core_1.uniqueIndex)('article_states_user_article_idx').on(table.userId, table.articleId),
    userIdIdx: (0, pg_core_1.index)('article_states_user_id_idx').on(table.userId),
}));
// Sync queue for offline support
exports.syncQueue = (0, pg_core_1.pgTable)('sync_queue', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    userId: (0, pg_core_1.uuid)('user_id').references(() => exports.users.id).notNull(),
    tableName: (0, pg_core_1.varchar)('table_name', { length: 50 }).notNull(), // feeds, articles, folders
    recordId: (0, pg_core_1.uuid)('record_id').notNull(),
    operation: (0, pg_core_1.varchar)('operation', { length: 20 }).notNull(), // insert, update, delete
    data: (0, pg_core_1.jsonb)('data'),
    attempts: (0, pg_core_1.integer)('attempts').default(0),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
}, (table) => ({
    userIdIdx: (0, pg_core_1.index)('sync_queue_user_id_idx').on(table.userId),
    createdAtIdx: (0, pg_core_1.index)('sync_queue_created_at_idx').on(table.createdAt),
}));
// AI Briefings
exports.briefings = (0, pg_core_1.pgTable)('briefings', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    userId: (0, pg_core_1.uuid)('user_id').references(() => exports.users.id).notNull(),
    date: (0, pg_core_1.varchar)('date', { length: 10 }).notNull(), // YYYY-MM-DD
    content: (0, pg_core_1.text)('content').notNull(),
    articlesCovered: (0, pg_core_1.jsonb)('articles_covered').default('[]'),
    generatedAt: (0, pg_core_1.timestamp)('generated_at').defaultNow(),
}, (table) => ({
    userDateIdx: (0, pg_core_1.uniqueIndex)('briefings_user_date_idx').on(table.userId, table.date),
}));
// User settings
exports.userSettings = (0, pg_core_1.pgTable)('user_settings', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    userId: (0, pg_core_1.uuid)('user_id').references(() => exports.users.id).notNull().unique(),
    settings: (0, pg_core_1.jsonb)('settings').default('{}'),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
//# sourceMappingURL=schema.js.map