# FeedStream Web – Full Code Audit Prompt

You are a senior full‑stack auditor. Your job is to review this project end‑to‑end and surface bugs, security risks, data‑integrity issues, and missing test coverage. Treat the repo as production‑critical.

## Project Context
- Code lives inside `web/` and is a Next.js 16 App Router PWA that freezes UI state in IndexedDB (Dexie) so it can run offline/self‑hosted. Styling is Tailwind 4, logic is TypeScript + React client components, and Vitest is available for unit tests.
- The app mimics the FeedStream iOS client: it fetches RSS/Atom/JSON feeds through a custom proxy (`src/app/api/proxy/route.ts`), normalizes them (`src/lib/feed-parser.ts`), stores entities in Dexie (`src/lib/db.ts`), and renders them through virtualized lists (`src/components/ArticleList.tsx`, `src/components/ArticleItem.tsx`, `src/components/Reader.tsx`).
- A Fever/FreshRSS sync layer (`src/lib/fever-api.ts`, `src/lib/feed-service.ts`) mirrors remote folders/feeds/articles; automation rules (`src/lib/rules-engine.ts`) mutate incoming articles; AI summarization (`src/lib/ai-service.ts`) posts user keys to OpenAI/Gemini; OPML import/export (`src/lib/opml-service.ts`) and feed discovery/search (`src/lib/feed-search-service.ts`, `src/lib/url-detector.ts`, `src/lib/feed-discovery.ts`) accept untrusted URLs; icon fetching (`src/lib/icon-service.ts`), stats, and audio playback round out the feature set.
- Layout, navigation, and persistence rely heavily on client‑side stores (`src/store/*.ts`) and live Dexie queries. API routes run server‑side; everything else executes in the browser.

## Audit Expectations
1. **Architecture & Data Model**
   - Confirm Dexie schemas, compound indexes, and migrations in `src/lib/db.ts` match how the app queries data (counts, filters, sorts). Flag potential race conditions, broken indexes, or schema drift (e.g., `StatsService` iterating entire tables, or rules lacking indexes).
   - Validate the state stores (settings, audio, scroll) properly persist sensitive data (API keys, sync credentials, playback progress) without leaking or corrupting state.

2. **Feed ingestion, merging, and sync**
   - `src/lib/feed-service.ts`: audit `addFeed`, `refreshFeed`, `mergeArticles`, Fever sync helpers, bookmark/read toggles, and bulk mark operations. Look for duplicated writes, trust on first use, missing transaction boundaries, concurrency issues with `db.transaction`, and inconsistent rule application vs. existing article state. Consider how failures affect `consecutiveFailures`, icon fetching, and optimistic updates.
   - `src/lib/rules-engine.ts`: ensure rule matching is deterministic, case handling is correct, and destructive actions (delete, mark_read, star) occur before writes without leaving DB gaps.

3. **Parsing & sanitization**
   - `src/lib/feed-parser.ts` and `src/lib/utils.ts`: check XML/JSON handling, YouTube/reddit heuristics, stable ID hashing (`sha256` fallback), HTML entity decoding, enclosure processing, and time parsing. Confirm protections against XXE, HTML injection, and truncated feeds. Review `src/__tests__/feed-parser.test.ts` and note missing coverage (e.g., reddit image detection, podcast enclosures).
   - `src/components/Reader.tsx`: inspect DOMPurify usage, Readability parsing through `/api/proxy`, speech synthesis, `dangerouslySetInnerHTML` paths, and fallback content when `article.readerHTML` is absent. Verify sanitized tags/attributes reflect threat model.

4. **Networking & API routes**
   - `src/app/api/proxy/route.ts`: validate SSRF defenses (DNS lookup, protocol restrictions), cache headers, request headers, large payload handling, redirect policy, and error paths. Ensure denial paths cannot be bypassed (e.g., IPv6, DNS rebinding).
   - `src/app/api/fever-proxy/route.ts`: confirm POST proxying to remote PHP endpoints can’t hit internal hosts, handles timeouts/errors, sanitizes user input, and enforces content-type expectations.
   - `src/lib/feed-search-service.ts`, `src/lib/icon-service.ts`, `src/lib/url-detector.ts`, `src/lib/feed-discovery.ts`: evaluate how user input flows into fetches (YouTube scraping, DuckDuckGo HTML parsing, Reddit JSON, podcast + favicon fetches). Flag CORS/proxy bypass, XSS within scraped HTML, and rate-limit/abuse impacts.
   - `src/lib/ai-service.ts`: check API key storage, network calls from the browser to OpenAI/Gemini, lack of server proxying, and whether failures leak stack traces or block UX.

5. **UI, UX, and offline behavior**
   - Navigation shell (`src/app/layout.tsx`, `src/components/Sidebar.tsx`, `src/components/TabBar.tsx`, `src/components/AppHeader.tsx`, `src/components/ArticleList.tsx`, `src/components/AudioPlayer.tsx`): verify hydration boundaries, `use client` placement, virtualization, keyboard navigation, and resize handlers. Look for unbounded Dexie queries (`db.articles.filter`), derived counts done per render, and event handlers that trigger alerts instead of accessible feedback.
   - Feature pages (`src/app/page.tsx`, feed/folder/history/saved routes, settings/rules/stats pages, API key forms) should be checked for race conditions, state leaks, blocking confirmations, and missing permissions checks (e.g., wiping databases without secondary confirmation).

6. **Import/Export & tooling**
   - `src/lib/opml-service.ts`: audit recursion over nested outlines, folder creation, error handling when feeds fail, and escaping when exporting XML.
   - Stats (`src/lib/stats-service.ts`) and history features: note any expensive `toArray()` usage, inaccurate streak math, or ghost‑feed logic that loads entire tables unnecessarily.

7. **Testing & Tooling**
   - Only `src/__tests__/feed-parser.test.ts` exists. Document the missing coverage (FeedService, proxy routes, Dexie migrations, automation rules, search services, Reader). Recommend specific Vitest suites or Playwright scenarios (add feed, refresh feed, Reader sanitization, Fever sync, OPML import, AI briefing failure).
   - Build/test scripts: `npm run lint`, `npm run test`, `npm run build`. If tests or lint cannot run, explain why and what to run instead.

## Deliverable Requirements
- Produce a prioritized findings list ordered by severity (blocker ➝ low). Each finding must include: severity, short title, description, affected file(s) with line numbers (e.g., `src/lib/feed-service.ts:42`), impact, and a concrete fix or mitigation.
- Call out any unclear assumptions or missing requirements before finalizing.
- Highlight systemic risks (architecture, process, dependency issues) separately from localized bugs.
- Identify the highest‑value additional tests the team should add and map them to files/flows.
- Conclude with a readiness verdict (ship / needs work) and summarize blocking issues.

Focus relentlessly on correctness, data safety, and self‑hosted threat vectors. Assume everything runs in untrusted networks and browsers. Your analysis should give maintainers a clear action plan to harden FeedStream Web.
