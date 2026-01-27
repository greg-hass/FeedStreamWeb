'use client';

import { useUIStore } from "@/store/uiStore";
import { RefreshProgress } from "./RefreshProgress";

export function GlobalUI() {
    const { isSyncing, isImporting, current, total, feedName, cancelSync } = useUIStore();

    return (
        <>
            {/* Sync Progress or Import Progress */}
            {(isSyncing || isImporting) && (
                <RefreshProgress
                    current={current}
                    total={total}
                    currentFeedName={feedName}
                    onDismiss={isSyncing ? cancelSync : undefined}
                    title={isSyncing ? "Refreshing Feeds" : "Importing OPML"}
                />
            )}
        </>
    );
}
