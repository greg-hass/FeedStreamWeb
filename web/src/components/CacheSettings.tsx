'use client';

import { useState, useEffect } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import { CacheManager, CacheUsage } from '@/lib/cache-manager';

export function CacheSettings() {
    const [usage, setUsage] = useState<CacheUsage | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [isPersistent, setIsPersistent] = useState<boolean | null>(null);

    const maxArticleAge = useSettingsStore((s) => s.maxArticleAge);
    const maxCacheSize = useSettingsStore((s) => s.maxCacheSize);
    const autoClearOldArticles = useSettingsStore((s) => s.autoClearOldArticles);
    const prefetchEnabled = useSettingsStore((s) => s.prefetchEnabled);
    const prefetchOnWifiOnly = useSettingsStore((s) => s.prefetchOnWifiOnly);
    const setMaxArticleAge = useSettingsStore((s) => s.setMaxArticleAge);
    const setMaxCacheSize = useSettingsStore((s) => s.setMaxCacheSize);
    const setAutoClearOldArticles = useSettingsStore((s) => s.setAutoClearOldArticles);
    const setPrefetchEnabled = useSettingsStore((s) => s.setPrefetchEnabled);
    const setPrefetchOnWifiOnly = useSettingsStore((s) => s.setPrefetchOnWifiOnly);

    useEffect(() => {
        loadUsage();
        checkPersistent();
    }, []);

    const loadUsage = async () => {
        try {
            const u = await CacheManager.getUsage();
            setUsage(u);
        } catch (e) {
            console.error('Failed to get cache usage:', e);
        }
    };

    const checkPersistent = async () => {
        const persistent = await CacheManager.isPersistent();
        setIsPersistent(persistent);
    };

    const handleClearOldArticles = async () => {
        setIsLoading(true);
        setMessage(null);

        try {
            const count = await CacheManager.clearOldArticles(maxArticleAge);
            setMessage(`Cleared content from ${count} old articles`);
            await loadUsage();
        } catch (e) {
            setMessage('Failed to clear old articles');
        } finally {
            setIsLoading(false);
        }
    };

    const handleClearImageCache = async () => {
        setIsLoading(true);
        setMessage(null);

        try {
            await CacheManager.clearImageCache();
            setMessage('Image cache cleared');
            await loadUsage();
        } catch (e) {
            setMessage('Failed to clear image cache');
        } finally {
            setIsLoading(false);
        }
    };

    const handleClearPrefetched = async () => {
        setIsLoading(true);
        setMessage(null);

        try {
            await CacheManager.clearPrefetchedContent();
            setMessage('Prefetched content cleared');
            await loadUsage();
        } catch (e) {
            setMessage('Failed to clear prefetched content');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRequestPersistent = async () => {
        const granted = await CacheManager.requestPersistentStorage();
        setIsPersistent(granted);
        if (granted) {
            setMessage('Persistent storage enabled');
        } else {
            // Check if iOS
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
            if (isIOS) {
                setMessage('On iOS, add this app to your Home Screen (Share → Add to Home Screen) to enable persistent storage');
            } else {
                setMessage('Could not enable persistent storage. Try installing as a PWA.');
            }
        }
    };

    const usedPercent = usage?.usedPercent || 0;

    return (
        <div className="space-y-6">
            <h3 className="text-lg font-medium">Storage & Cache</h3>

            {/* Storage usage bar */}
            <div className="space-y-2">
                <div className="flex justify-between text-sm">
                    <span>Storage Used</span>
                    <span>
                        {usage ? `${CacheManager.formatBytes(usage.used)} / ${CacheManager.formatBytes(usage.quota)}` : 'Loading...'}
                    </span>
                </div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                        className={`h-full transition-all ${usedPercent > 90 ? 'bg-red-500' : usedPercent > 70 ? 'bg-yellow-500' : 'bg-blue-500'}`}
                        style={{ width: `${Math.min(usedPercent, 100)}%` }}
                    />
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-gray-500">
                    <div>Articles: {usage ? CacheManager.formatBytes(usage.articles) : '-'}</div>
                    <div>Images: {usage ? CacheManager.formatBytes(usage.images) : '-'}</div>
                    <div>Prefetch: {usage ? CacheManager.formatBytes(usage.prefetched) : '-'}</div>
                </div>
            </div>

            {/* Persistent storage */}
            {isPersistent === false && (
                <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div className="flex-1">
                            <p className="text-sm text-yellow-800 dark:text-yellow-200">
                                Your browser may automatically clear cached data. Enable persistent storage to prevent this.
                            </p>
                            <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                                <strong>iOS:</strong> Add to Home Screen (Share → Add to Home Screen)
                            </p>
                            <button
                                onClick={handleRequestPersistent}
                                className="mt-2 text-sm text-yellow-600 dark:text-yellow-400 underline"
                            >
                                Enable Persistent Storage
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Auto cleanup settings */}
            <div className="space-y-4 pt-4 border-t dark:border-gray-700">
                <h4 className="font-medium">Auto Cleanup</h4>

                <div className="flex items-center justify-between">
                    <div>
                        <label className="font-medium">Auto-clear old articles</label>
                        <p className="text-sm text-gray-500">Remove content from articles older than the limit</p>
                    </div>
                    <button
                        onClick={() => setAutoClearOldArticles(!autoClearOldArticles)}
                        className={`w-12 h-6 rounded-full transition-colors ${autoClearOldArticles ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                    >
                        <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${autoClearOldArticles ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>

                <div className="flex items-center justify-between">
                    <div>
                        <label className="font-medium">Article age limit</label>
                        <p className="text-sm text-gray-500">Keep articles for this long</p>
                    </div>
                    <select
                        value={maxArticleAge}
                        onChange={(e) => setMaxArticleAge(Number(e.target.value))}
                        className="px-3 py-1.5 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                    >
                        <option value={7}>7 days</option>
                        <option value={14}>14 days</option>
                        <option value={30}>30 days</option>
                        <option value={60}>60 days</option>
                        <option value={90}>90 days</option>
                        <option value={0}>Unlimited</option>
                    </select>
                </div>

                <div className="flex items-center justify-between">
                    <div>
                        <label className="font-medium">Cache size limit</label>
                        <p className="text-sm text-gray-500">Maximum storage for images</p>
                    </div>
                    <select
                        value={maxCacheSize}
                        onChange={(e) => setMaxCacheSize(Number(e.target.value))}
                        className="px-3 py-1.5 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                    >
                        <option value={100}>100 MB</option>
                        <option value={250}>250 MB</option>
                        <option value={500}>500 MB</option>
                        <option value={1000}>1 GB</option>
                        <option value={0}>Unlimited</option>
                    </select>
                </div>
            </div>

            {/* Prefetch settings */}
            <div className="space-y-4 pt-4 border-t dark:border-gray-700">
                <h4 className="font-medium">Content Prefetching</h4>

                <div className="flex items-center justify-between">
                    <div>
                        <label className="font-medium">Enable prefetching</label>
                        <p className="text-sm text-gray-500">Download articles for offline reading</p>
                    </div>
                    <button
                        onClick={() => setPrefetchEnabled(!prefetchEnabled)}
                        className={`w-12 h-6 rounded-full transition-colors ${prefetchEnabled ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                    >
                        <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${prefetchEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>

                {prefetchEnabled && (
                    <div className="flex items-center justify-between">
                        <div>
                            <label className="font-medium">WiFi only</label>
                            <p className="text-sm text-gray-500">Only prefetch on WiFi connections</p>
                        </div>
                        <button
                            onClick={() => setPrefetchOnWifiOnly(!prefetchOnWifiOnly)}
                            className={`w-12 h-6 rounded-full transition-colors ${prefetchOnWifiOnly ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                        >
                            <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${prefetchOnWifiOnly ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>
                )}
            </div>

            {/* Manual clear buttons */}
            <div className="space-y-3 pt-4 border-t dark:border-gray-700">
                <h4 className="font-medium">Manual Cleanup</h4>

                <div className="grid grid-cols-1 gap-2">
                    <button
                        onClick={handleClearOldArticles}
                        disabled={isLoading}
                        className="py-2 px-4 text-left border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                    >
                        <div className="font-medium">Clear old article content</div>
                        <div className="text-sm text-gray-500">Remove content older than {maxArticleAge} days</div>
                    </button>

                    <button
                        onClick={handleClearImageCache}
                        disabled={isLoading}
                        className="py-2 px-4 text-left border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                    >
                        <div className="font-medium">Clear image cache</div>
                        <div className="text-sm text-gray-500">Remove all cached images</div>
                    </button>

                    <button
                        onClick={handleClearPrefetched}
                        disabled={isLoading}
                        className="py-2 px-4 text-left border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                    >
                        <div className="font-medium">Clear prefetched content</div>
                        <div className="text-sm text-gray-500">Remove all prefetched articles</div>
                    </button>
                </div>

                {message && (
                    <div className="text-sm text-green-500">{message}</div>
                )}
            </div>
        </div>
    );
}
