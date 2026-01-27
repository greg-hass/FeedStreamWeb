/**
 * Backend API Client for FeedStream
 * 
 * This client communicates with the self-hosted backend API
 * for AI features, feed syncing, and cross-device support.
 */

import { getApiUrl } from './api-config';

const API_BASE_URL = getApiUrl();

// Generate or retrieve device ID for authentication
function getDeviceId(): string {
  if (typeof localStorage === 'undefined') return '';
  
  let deviceId = localStorage.getItem('fs_device_id');
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem('fs_device_id', deviceId);
  }
  return deviceId;
}

interface ApiOptions {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
}

async function apiClient(endpoint: string, options: ApiOptions = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Device-Id': getDeviceId(),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `API error: ${response.status}`);
  }

  return response.json();
}

// === FEEDS ===

export async function getFeeds() {
  return apiClient('/feeds');
}

export async function addFeed(url: string, folderId?: string) {
  return apiClient('/feeds', {
    method: 'POST',
    body: { url, folderId },
  });
}

export async function deleteFeed(id: string) {
  return apiClient(`/feeds/${id}`, { method: 'DELETE' });
}

export async function syncFeed(id: string) {
  return apiClient(`/feeds/${id}/sync`, { method: 'POST' });
}

export async function syncAllFeeds() {
  return apiClient('/feeds/sync-all', { method: 'POST' });
}

// === ARTICLES ===

export async function getArticles(options?: {
  feedId?: string;
  unread?: boolean;
  bookmarked?: boolean;
  limit?: number;
  offset?: number;
}) {
  const params = new URLSearchParams();
  if (options?.feedId) params.append('feedId', options.feedId);
  if (options?.unread) params.append('unread', 'true');
  if (options?.bookmarked) params.append('bookmarked', 'true');
  if (options?.limit) params.append('limit', String(options.limit));
  if (options?.offset) params.append('offset', String(options.offset));
  
  return apiClient(`/articles?${params.toString()}`);
}

export async function searchArticles(query: string, limit = 50) {
  return apiClient(`/articles/search?q=${encodeURIComponent(query)}&limit=${limit}`);
}

export async function markArticleRead(id: string, isRead: boolean) {
  return apiClient(`/articles/${id}/read`, {
    method: 'POST',
    body: { isRead },
  });
}

export async function markArticleBookmarked(id: string, isBookmarked: boolean) {
  return apiClient(`/articles/${id}/bookmark`, {
    method: 'POST',
    body: { isBookmarked },
  });
}

// === FOLDERS ===

export async function getFolders() {
  return apiClient('/folders');
}

export async function createFolder(name: string, position?: number) {
  return apiClient('/folders', {
    method: 'POST',
    body: { name, position },
  });
}

// === AI FEATURES ===

export async function generateBriefing(): Promise<{ content: string }> {
  return apiClient('/ai/briefing', { method: 'POST' });
}

export async function getTodayBriefing() {
  return apiClient('/ai/briefing');
}

export async function getFeedRecommendations(): Promise<Array<{
  title: string;
  url: string;
  description: string;
  category: string;
  type: string;
}>> {
  return apiClient('/ai/recommendations', { method: 'POST' });
}

// === SYNC ===

export async function syncData(data: {
  folders?: any[];
  feeds?: any[];
  articles?: any[];
  since?: string;
}) {
  return apiClient('/sync', {
    method: 'POST',
    body: data,
  });
}

// === SETTINGS ===

export async function getSettings() {
  return apiClient('/settings');
}

export async function saveSettings(settings: Record<string, any>) {
  return apiClient('/settings', {
    method: 'POST',
    body: settings,
  });
}

// === HEALTH ===

export async function checkHealth() {
  try {
    const response = await fetch(`${API_BASE_URL.replace('/api', '')}/health`);
    return response.ok;
  } catch {
    return false;
  }
}
