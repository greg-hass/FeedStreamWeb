'use client';

import { useUIStore } from "@/store/uiStore";
import { RefreshProgress } from "./RefreshProgress";

export function GlobalUI() {
    const { isSyncing, current, total, feedName, endSync } = useUIStore();

    if (!isSyncing) return null;

    return (
        <RefreshProgress
            current={current}
            total={total}
            currentFeedName={feedName}
            onDismiss={endSync}
        />
    );
}
