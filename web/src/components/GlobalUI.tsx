'use client';

import { useUIStore } from "@/store/uiStore";
import { RefreshProgress } from "./RefreshProgress";
import { useEffect, useState } from "react";
import { useSettingsStore } from "@/store/settingsStore";
import { differenceInDays, parseISO } from "date-fns";
import { AlertCircle, Download, X } from "lucide-react";
import { BackupService } from "@/lib/backup-service";

export function GlobalUI() {
    const { isSyncing, current, total, feedName, endSync, cancelSync } = useUIStore();
    const { backupFrequency, lastBackupAt } = useSettingsStore();
    const [showBackupReminder, setShowBackupReminder] = useState(false);

    // 1. Request Persistence on Mount
    useEffect(() => {
        if (navigator.storage && navigator.storage.persist) {
            navigator.storage.persist().then(persistent => {
                console.log(persistent ? "Storage is persistent" : "Storage is NOT persistent");
            });
        }
    }, []);

    // 2. Check Backup Schedule
    useEffect(() => {
        if (backupFrequency === 'never') return;

        const now = new Date();
        const last = lastBackupAt ? parseISO(lastBackupAt) : new Date(0); // Epoch if never backed up
        const daysSince = differenceInDays(now, last);

        let threshold = 7;
        if (backupFrequency === 'daily') threshold = 1;
        if (backupFrequency === 'monthly') threshold = 30;

        if (daysSince >= threshold) {
            setShowBackupReminder(true);
        }
    }, [backupFrequency, lastBackupAt]);

    const handleQuickBackup = async () => {
        try {
            const backup = await BackupService.createMasterBackup();
            BackupService.downloadBackup(backup);
            setShowBackupReminder(false);
        } catch (e) {
            alert("Backup failed");
        }
    };

    return (
        <>
            {/* Sync Progress */}
            {isSyncing && (
                <RefreshProgress
                    current={current}
                    total={total}
                    currentFeedName={feedName}
                    onDismiss={cancelSync}
                />
            )}

            {/* Backup Reminder Toast */}
            {showBackupReminder && (
                <div className="fixed bottom-22 md:bottom-6 left-1/2 -translate-x-1/2 md:left-auto md:right-6 md:translate-x-0 z-50 animate-in fade-in slide-in-from-bottom-4">
                    <div className="bg-zinc-900 border border-zinc-800 text-white rounded-xl shadow-2xl p-4 w-80 flex flex-col gap-3">
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-amber-500/10 rounded-lg shrink-0">
                                <AlertCircle size={20} className="text-amber-500" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-semibold text-sm">Backup Due</h3>
                                <p className="text-xs text-zinc-400 mt-1">
                                    It's been a while since your last backup. Secure your data now.
                                </p>
                            </div>
                            <button onClick={() => setShowBackupReminder(false)} className="text-zinc-500 hover:text-white">
                                <X size={16} />
                            </button>
                        </div>
                        <button
                            onClick={handleQuickBackup}
                            className="w-full py-2 bg-white text-zinc-900 rounded-lg text-sm font-bold hover:bg-zinc-200 transition flex items-center justify-center gap-2"
                        >
                            <Download size={16} /> Download Backup
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
