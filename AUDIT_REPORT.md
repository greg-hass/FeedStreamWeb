# FeedStream Web Audit Report
**Date:** January 6, 2026
**Auditor:** Gemini (Next.js Expert)
**Verdict:** 🔴 **NEEDS WORK** (Critical Security & Performance Issues)

This report details the findings from a comprehensive code audit of the `FeedStreamWeb` project. While the core architecture (Next.js + Dexie.js + PWA) is sound and modern, there are **critical security vulnerabilities** and scalability bottlenecks that must be addressed before production use.

---

## 🚨 Critical Severity (Blockers)

### 1. Server-Side Request Forgery (SSRF) in Fever Proxy
*   **Location:** `src/app/api/fever-proxy/route.ts:7`
*   **Description:** The route accepts a `url` query parameter and performs a `fetch` (POST) to it without any validation. An attacker can use this to probe internal network services (e.g., `localhost:22`, `169.254.169.254`, `192.168.1.1`) or perform DoS attacks, bypassing the protections present in the main `proxy` route.
*   **Impact:** Full compromise of internal network visibility; potential cloud metadata exfiltration.
*   **Fix:** Import and use the `validateUrl` and `isPrivateIP` logic from `src/app/api/proxy/route.ts`. Ensure the target is a public HTTP/HTTPS URL.

### 2. XXE Vulnerability in OPML Import
*   **Location:** `src/lib/opml-service.ts:10`
*   **Description:** The `XMLParser` is instantiated with default settings. Unlike `feed-parser.ts`, it lacks `processEntities: false` and `ignoreDeclaration: true`.
*   **Impact:** Processing a malicious OPML file could lead to XML External Entity (XXE) attacks, causing Denial of Service (Billion Laughs attack) or potential local file exfiltration (depending on browser/environment constraints).
*   **Fix:** Configure `XMLParser` with security flags:
    ```typescript
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "",
        processEntities: false, // Prevent entity expansion
        ignoreDeclaration: true // Ignore DTDs
    });
    ```

---

## 🟠 High Severity (Security & Data Integrity)

### 3. Stored XSS / Phishing via Permissive Iframe Policy
*   **Location:** `src/components/Reader.tsx:142`
*   **Description:** `DOMPurify` is configured with `ADD_TAGS: ['iframe']`. While necessary for YouTube, this allows *any* iframe (e.g., `<iframe src="malicious-login.com">`).
*   **Impact:** An attacker can embed a phishing page or drive-by download inside a feed article.
*   **Fix:** Use a `DOMPurify` hook (`beforeSanitizeElements`) to whitelist specific domains (YouTube, Vimeo) for iframes and remove all others.

### 4. Insecure Storage of API Keys
*   **Location:** `src/store/settingsStore.ts` & `src/lib/secure-storage.ts`
*   **Description:** "Secure" storage is merely Base64 obfuscation (`btoa`). API keys (OpenAI, Gemini, Fever) are stored effectively in plain text in `localStorage`.
*   **Impact:** Any XSS vulnerability (like #3) allows immediate exfiltration of all user credentials.
*   **Fix:** Since this is a client-side app, true "secret" storage is impossible without a user-supplied encryption password.
    *   *Mitigation:* Implement an encryption layer using `window.crypto.subtle` derived from a user pin/password.
    *   *Alternative:* Do not store keys; require entry per session (poor UX) or accept the risk but document it clearly.

---

## 🟡 Medium Severity (Performance & Logic)

### 5. Sidebar Scalability Bottleneck
*   **Location:** `src/components/Sidebar.tsx:23`
*   **Description:** The sidebar recalculates counts (`db.articles.filter(...)`) on every render/update. `filter()` performs a full table scan.
*   **Impact:** With 10k+ articles, the UI will freeze or lag significantly during syncs.
*   **Fix:**
    *   Use Dexie `where()` clauses with the compound indexes already created (`[isRead+publishedAt]`).
    *   Cache counts in a separate `stats` table or `localStorage` and update incrementally.

### 6. Memory Exhaustion in Stats Service
*   **Location:** `src/lib/stats-service.ts:24`
*   **Description:** `recentArticles.toArray()` loads all articles from the last 30 days into RAM to count them.
*   **Impact:** Out of Memory (OOM) crashes on mobile devices with large libraries.
*   **Fix:** Use `.count()` directly on the query or use `.each()` for iteration without loading all objects.

### 7. Search Logic Performance
*   **Location:** `src/lib/db.ts:60`
*   **Description:** The `search()` method uses `.filter(a => ...)` which performs a full DB scan and regex/string match in JavaScript.
*   **Impact:** Extremely slow searches on large datasets.
*   **Fix:** Implement a full-text search index (e.g., `dexie-search-hooks` or a dedicated FTS library like `flexsearch` that indexes titles/summaries separately).

---

## 🧪 Missing Test Coverage

The project currently has only basic unit tests. The following critical paths are untested:

1.  **Fever Sync Logic:** `src/lib/feed-service.ts` (merge logic, deletions, read status sync).
2.  **Security Sanitization:** `src/components/Reader.tsx` (Prove that `<script>` and malicious `<iframe>` are stripped).
3.  **Proxy Routes:** `src/app/api/proxy/route.ts` (Prove that private IPs are blocked).
4.  **OPML Import:** `src/lib/opml-service.ts` (Test with malicious XML).

## 📋 Action Plan

1.  **Immediate Fix:** Patch the SSRF in `fever-proxy` and XXE in `opml-service`.
2.  **Harden:** Tighten `DOMPurify` config in `Reader.tsx`.
3.  **Optimize:** Refactor Sidebar queries to use indexes.
4.  **Test:** Add integration tests for the Proxy and FeedService.

---
*End of Report*
