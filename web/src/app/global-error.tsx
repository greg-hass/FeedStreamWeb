'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, Trash2, Database } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [autoRetryAttempts, setAutoRetryAttempts] = useState(0);

  // Check if this is a database error (common on iOS background/foreground)
  const isDatabaseError = error.message?.includes('cursor') ||
                          error.message?.includes('iterate') ||
                          error.message?.includes('transaction') ||
                          error.message?.includes('IndexedDB') ||
                          error.message?.includes('database') ||
                          error.message?.includes('UnknownError') ||
                          error.message?.includes('InvalidStateError');

  useEffect(() => {
    console.error('Global Error:', error);

    // Auto-retry database errors once (common iOS backgrounding issue)
    if (isDatabaseError && autoRetryAttempts === 0) {
      setAutoRetryAttempts(1);
      console.log('[Error Recovery] Auto-retrying database error...');

      const retryTimer = setTimeout(async () => {
        try {
          const { reopenDatabase } = await import('@/lib/db');
          await reopenDatabase();
          reset();
        } catch (e) {
          console.error('[Error Recovery] Auto-retry failed:', e);
          // Error will remain visible for manual retry
        }
      }, 500);

      return () => clearTimeout(retryTimer);
    }
  }, [error, isDatabaseError, autoRetryAttempts, reset]);

  const handleRetry = async () => {
    setIsRetrying(true);

    try {
      // If it's a database error, try to reopen the connection first
      if (isDatabaseError) {
        console.log('[Error Recovery] Attempting to reopen database...');

        // Import db module dynamically to avoid issues
        const { db } = await import('@/lib/db');

        // Force close and reopen
        if (db.isOpen()) {
          db.close();
        }
        await db.open();

        console.log('[Error Recovery] Database reopened successfully');
      }
    } catch (e) {
      console.error('[Error Recovery] Failed to reopen database:', e);
    }

    setIsRetrying(false);
    reset();
  };

  const handleHardReset = async () => {
    if (!confirm('This will delete all local data (feeds, articles, settings) and reset the app. Are you sure?')) return;
    
    try {
      // Clear LocalStorage
      localStorage.clear();
      
      // Clear IndexedDB (FeedStreamDB)
      // We use raw IDB API to avoid importing the potentially crashing DB module
      const dbs = await window.indexedDB.databases();
      for (const db of dbs) {
        if (db.name && (db.name === 'FeedStreamDB' || db.name.includes('feedstream'))) {
           window.indexedDB.deleteDatabase(db.name);
        }
      }
      
      // Clear Service Workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
      }

      window.location.reload();
    } catch (e) {
      alert('Failed to reset: ' + e);
      window.location.reload();
    }
  };

  return (
    <html>
      <body className="bg-zinc-950 text-zinc-100 flex items-center justify-center min-h-screen p-4 font-sans">
        <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl space-y-6 text-center">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
            <span className="text-3xl">💥</span>
          </div>
          
          <div className="space-y-2">
            <h2 className="text-xl font-bold">Something went wrong</h2>
            <p className="text-sm text-zinc-400">
              {error.message || 'A critical error occurred while loading the application.'}
            </p>
            {error.digest && (
              <p className="text-xs text-zinc-600 font-mono">ID: {error.digest}</p>
            )}
          </div>

          <div className="space-y-3 pt-2">
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="w-full py-3 bg-zinc-100 text-zinc-900 rounded-xl font-semibold hover:bg-white transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isRetrying ? (
                <>
                  <RefreshCw size={18} className="animate-spin" /> Reconnecting...
                </>
              ) : (
                <>
                  <RefreshCw size={18} /> Try Again
                </>
              )}
            </button>

            <button
              onClick={handleHardReset}
              className="w-full py-3 bg-red-500/10 text-red-500 rounded-xl font-semibold hover:bg-red-500/20 transition flex items-center justify-center gap-2"
            >
              <Trash2 size={18} /> Reset All Data
            </button>
          </div>

          <p className="text-xs text-zinc-600">
            {isDatabaseError
              ? 'This may be caused by the app being backgrounded. "Try Again" will attempt to reconnect.'
              : 'If this persists, try "Reset All Data" to clear corrupted local storage.'}
          </p>
        </div>
      </body>
    </html>
  );
}
