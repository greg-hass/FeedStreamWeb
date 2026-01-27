import { pgTable, uuid, varchar, text, timestamp, boolean, integer, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';

// Users table (simple device-based auth)
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  deviceId: varchar('device_id', { length: 255 }).notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Folders
export const folders = pgTable('folders', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  position: integer('position').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
}, (table) => ({
  userIdIdx: index('folders_user_id_idx').on(table.userId),
}));

// Feeds
export const feeds = pgTable('feeds', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  folderId: uuid('folder_id').references(() => folders.id),
  title: varchar('title', { length: 500 }).notNull(),
  feedUrl: text('feed_url').notNull(),
  siteUrl: text('site_url'),
  type: varchar('type', { length: 50 }).default('rss'), // rss, atom, json, youtube, reddit, podcast
  iconUrl: text('icon_url'),
  isPaused: boolean('is_paused').default(false),
  sortOrder: integer('sort_order').default(0),
  isFavorite: boolean('is_favorite').default(false),
  lastSyncAt: timestamp('last_sync_at'),
  lastError: text('last_error'),
  consecutiveFailures: integer('consecutive_failures').default(0),
  etag: text('etag'),
  lastModified: text('last_modified'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
}, (table) => ({
  userIdIdx: index('feeds_user_id_idx').on(table.userId),
  feedUrlIdx: uniqueIndex('feeds_user_feed_url_idx').on(table.userId, table.feedUrl),
}));

// Articles with full-text search
export const articles = pgTable('articles', {
  id: uuid('id').primaryKey().defaultRandom(),
  feedId: uuid('feed_id').references(() => feeds.id).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  externalId: varchar('external_id', { length: 255 }), // Stable ID from feed
  title: text('title').notNull(),
  author: varchar('author', { length: 255 }),
  summary: text('summary'),
  content: text('content'),
  url: text('url'),
  publishedAt: timestamp('published_at'),
  mediaKind: varchar('media_kind', { length: 50 }).default('none'), // none, video, audio, youtube
  thumbnailUrl: text('thumbnail_url'),
  enclosureUrl: text('enclosure_url'),
  enclosureType: varchar('enclosure_type', { length: 100 }),
  // Full-text search vector
  searchVector: text('search_vector'),
  fetchedAt: timestamp('fetched_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  feedIdIdx: index('articles_feed_id_idx').on(table.feedId),
  userIdIdx: index('articles_user_id_idx').on(table.userId),
  publishedAtIdx: index('articles_published_at_idx').on(table.publishedAt),
  searchIdx: index('articles_search_idx').on(table.searchVector),
}));

// Article states (read/bookmarked per user)
export const articleStates = pgTable('article_states', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  articleId: uuid('article_id').references(() => articles.id).notNull(),
  isRead: boolean('is_read').default(false),
  isBookmarked: boolean('is_bookmarked').default(false),
  playbackPosition: integer('playback_position').default(0),
  readAt: timestamp('read_at'),
  bookmarkedAt: timestamp('bookmarked_at'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userArticleIdx: uniqueIndex('article_states_user_article_idx').on(table.userId, table.articleId),
  userIdIdx: index('article_states_user_id_idx').on(table.userId),
}));

// Sync queue for offline support
export const syncQueue = pgTable('sync_queue', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  tableName: varchar('table_name', { length: 50 }).notNull(), // feeds, articles, folders
  recordId: uuid('record_id').notNull(),
  operation: varchar('operation', { length: 20 }).notNull(), // insert, update, delete
  data: jsonb('data'),
  attempts: integer('attempts').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('sync_queue_user_id_idx').on(table.userId),
  createdAtIdx: index('sync_queue_created_at_idx').on(table.createdAt),
}));

// AI Briefings
export const briefings = pgTable('briefings', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  date: varchar('date', { length: 10 }).notNull(), // YYYY-MM-DD
  content: text('content').notNull(),
  articlesCovered: jsonb('articles_covered').default('[]'),
  generatedAt: timestamp('generated_at').defaultNow(),
}, (table) => ({
  userDateIdx: uniqueIndex('briefings_user_date_idx').on(table.userId, table.date),
}));

// User settings
export const userSettings = pgTable('user_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull().unique(),
  settings: jsonb('settings').default('{}'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
