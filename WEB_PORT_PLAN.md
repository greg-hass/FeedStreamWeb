# FeedStream Web/PWA Implementation Plan

## Goal Description
Create a "self-hosted" web application and Progressive Web App (PWA) that is a like-for-like copy of the FeedStream iOS app in terms of UI, functionality, and features. The app will be built with **Next.js**, allowing for a robust self-hosted deployment with a backend for CORS proxying and a rich client-side PWA experience.

## Feasibility Analysis
- **UI**: Replicable using React + Tailwind CSS (configured to match iOS system specifications/fonts).
- **Database**: GRDB (SQLite) schema can be ported 1:1 to **IndexedDB** using **Dexie.js**.
- **Parsing**: Mozilla's `readability` library is available as an NPM package, matching the iOS implementation.
- **Sync**: FreshRSS (Fever API) client logic can be ported from Swift to TypeScript.
- **Offline**: Service Workers (Next-PWA) will handle asset caching; IndexedDB handles data persistence.
- **CORS**: A major challenge for client-side RSS fetching. The "Self-Hosted" nature allows us to include a lightweight **API Proxy** (Next.js API Routes) to relay feed requests, bypassing CORS issues.

## User Review Required
> [!IMPORTANT]
> **CORS Handling**: The web app cannot fetch RSS feeds directly from 3rd party domains due to browser security (CORS). We will implement a `proxy` API route in the Next.js backend. This means the self-hosted instance must have internet access.

> [!NOTE]
> **Biometrics**: FaceID/TouchID is limited on the web (WebAuthn), but we can implement a simple PIN/Passcode lock similar to the app's fallback.

## Proposed Architecture

### Tech Stack
- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS (with custom design system extending iOS tokens)
- **State/Logic**: React Query (for sync/fetching), Zustand (global UI state)
- **Database**: Dexie.js (IndexedDB wrapper)
- **PWA**: `next-pwa` or `serwist`
- **Parsing**: `@mozilla/readability`, `dompurify`, `rss-parser` (or custom XML parser if needed)

### 1. Database Layer (Dexie.js)
We will replicate the `FeedStream/Core/Database/MigrationManager+Migrations.swift` schema.
- **Tables**: `feeds`, `folders`, `articles`, `playback_queue`, `feed_collection_membership`
- **Indexing**: Port composite indexes (e.g., `[isRead+publishedAt]`) to Dexie compound indices.
- **FTS**: Use `lunr.js` or `flexsearch` for Full Text Search (since IndexedDB FTS is weak).

### 2. Core Logic Porting
- **FeedEngine**:
    - Port `Parser.swift` logic to a TypeScript `FeedParser` class.
    - Implement `applyFeedUpdate` logic to handle diffing and database updates.
- **Sync Service**:
    - Port `FreshRSS/FeverAPI` client logic to a `SyncManager` class.
- **Readability**:
    - Use `@mozilla/readability` in a Web Worker or Server Action to keep the main thread unblocked.

### 3. UI Component Mapping
| iOS Component | Web Component |
|---|---|
| `ArticleList` | `VirtualArticleList` (using `react-virtuoso` for performance) |
| `ArticleDetailView` | `ArticleReader` (clean semantic HTML + custom CSS) |
| `SmartFolderGrid` | `SmartFolderGrid` (CSS Grid) |
| `PodcastPlayer` | `GlobalAudioPlayer` (HTML5 Audio + Sticky Footer) |
| `SettingsView` | `SettingsLayout` + Child Pages |

## Implementation Stages

### Phase 1: Foundation (Current Scope)
1.  **Project Setup**: Initialize Next.js project with Tailwind, TypeScript, ESLint.
2.  **Database Design**: Implement Dexie schema matching iOS v25 migrations.
3.  **Basic UI Skeleton**: App Shell (Sidebar/Tabbar for mobile), Navigation.

### Phase 2: Core Engine
1.  **Feed Fetching**: Implement `/api/proxy?url=...` and client-side fetcher.
2.  **Parser**: Port parser logic.
3.  **Feed Management**: Add/Edit/Delete feeds.

### Phase 3: Reader & Sync
1.  **Article View**: Implement Reader Mode (Readability.js).
2.  **FreshRSS Sync**: Implement Fever API auth and sync.

## Verification Plan

### Automated Tests
- **Unit Tests**: Jest/Vitest for `FeedParser` and `ApplyFeedUpdate` logic.
- **E2E Tests**: Playwright tests to verify:
    - Adding a feed.
    - Article rendering.
    - Offline capability (Service Worker loading).

### Manual Verification
- **Visual Comparison**: Run iOS Simulator side-by-side with Localhost to verify "Like for Like" UI.
- **Data Integrity**: Inspect IndexedDB to ensure schema matches expectations.
