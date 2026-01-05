
'use client';

import React, { useRef, useEffect } from 'react';
import { useAudioStore } from '@/store/audioStore';
import { Play, Pause, X, ChevronUp, ChevronDown, SkipBack, SkipForward } from 'lucide-react';
import { clsx } from 'clsx';
import { format } from 'date-fns';

export function AudioPlayer() {
    const {
        currentTrack, isPlaying, progress, duration, currentTime,
        play, pause, setProgress, setDuration, close, toggleExpand, isExpanded
    } = useAudioStore();

    const audioRef = useRef<HTMLAudioElement>(null);

    // Handle Play/Pause
    useEffect(() => {
        if (!audioRef.current || !currentTrack) return;

        if (isPlaying) {
            audioRef.current.play().catch(() => pause());
        } else {
            audioRef.current.pause();
        }
    }, [isPlaying, currentTrack, pause]);

    // Handle Source Change
    useEffect(() => {
        if (audioRef.current && currentTrack) {
            audioRef.current.src = currentTrack.url;
            // Restore position if persisting? For now start fresh or handled by onTimeUpdate initial seek if complex.
            // Simple: just play.
            if (isPlaying) audioRef.current.play();
        }
    }, [currentTrack]);

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            const current = audioRef.current.currentTime;
            const dur = audioRef.current.duration;
            if (dur > 0) {
                setProgress((current / dur) * 100, current);
                setDuration(dur);
            }
        }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (audioRef.current) {
            const newTime = (Number(e.target.value) / 100) * duration;
            audioRef.current.currentTime = newTime;
            setProgress(Number(e.target.value), newTime);
        }
    };

    const formatTime = (seconds: number) => {
        if (!seconds) return "0:00";
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    if (!currentTrack) return null;

    return (
        <>
            <audio
                ref={audioRef}
                onTimeUpdate={handleTimeUpdate}
                onEnded={() => pause()}
                className="hidden"
            />

            <div className={clsx(
                "fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 shadow-lg transition-all duration-300 z-50",
                "pb-[env(safe-area-inset-bottom)]", // Respect Home Indicator
                isExpanded ? "h-full md:h-96" : "h-20" // simple expandable logic
            )}>
                {/* Progress Bar (Mini) */}
                {!isExpanded && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-zinc-200 dark:bg-zinc-800">
                        <div
                            className="h-full bg-brand transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                )}

                <div className="flex flex-col h-full">
                    {/* Header / Mini Player Control */}
                    <div className="flex items-center justify-between px-4 h-20 shrink-0" onClick={toggleExpand}>
                        <div className="flex items-center gap-3 overflow-hidden cursor-pointer flex-1">
                            {currentTrack.artwork ? (
                                <img src={currentTrack.artwork} alt="Art" className="w-12 h-12 rounded object-cover" />
                            ) : (
                                <div className="w-12 h-12 bg-zinc-200 dark:bg-zinc-800 rounded flex items-center justify-center">
                                    <span className="text-xs text-zinc-500">Audio</span>
                                </div>
                            )}
                            <div className="flex flex-col overflow-hidden">
                                <span className="font-semibold text-sm truncate dark:text-gray-100">{currentTrack.title}</span>
                                <span className="text-xs text-zinc-500 truncate">{currentTrack.artist || 'Unknown Artist'}</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 ml-4" onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => audioRef.current && (audioRef.current.currentTime -= 15)} className="hidden md:block p-2 text-zinc-600 dark:text-zinc-400 hover:text-brand">
                                <SkipBack size={20} />
                            </button>

                            <button onClick={isPlaying ? pause : play} className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-full hover:scale-105 transition active:scale-95">
                                {isPlaying ? <Pause size={24} className="fill-current text-zinc-900 dark:text-zinc-100" /> : <Play size={24} className="fill-current ml-1 text-zinc-900 dark:text-zinc-100" />}
                            </button>

                            <button onClick={() => audioRef.current && (audioRef.current.currentTime += 30)} className="hidden md:block p-2 text-zinc-600 dark:text-zinc-400 hover:text-brand">
                                <SkipForward size={20} />
                            </button>
                            {!isExpanded && (
                                <button onClick={close} className="p-2 ml-2 text-zinc-400 hover:text-red-500">
                                    <X size={20} />
                                </button>
                            )}
                            {isExpanded && (
                                <button onClick={toggleExpand} className="p-2 ml-2 text-zinc-400">
                                    <ChevronDown size={24} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-8 animate-in slide-in-from-bottom-5">
                            {/* Big Artwork */}
                            <div className="w-64 h-64 shadow-2xl rounded-xl overflow-hidden">
                                {currentTrack.artwork ? (
                                    <img src={currentTrack.artwork} alt="Art" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
                                        No Artwork
                                    </div>
                                )}
                            </div>

                            {/* Timeline */}
                            <div className="w-full max-w-xl space-y-2">
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={progress || 0}
                                    onChange={handleSeek}
                                    className="w-full accent-brand h-2 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                                />
                                <div className="flex justify-between text-xs text-zinc-500 font-mono">
                                    <span>{formatTime(currentTime)}</span>
                                    <span>{formatTime(duration)}</span>
                                </div>
                            </div>

                            {/* Controls */}
                            <div className="flex items-center gap-12">
                                <button onClick={() => audioRef.current && (audioRef.current.currentTime -= 15)} className="p-4 text-zinc-600 dark:text-zinc-400 hover:text-brand transition">
                                    <SkipBack size={32} />
                                </button>
                                <button onClick={isPlaying ? pause : play} className="p-6 bg-brand rounded-full hover:scale-110 shadow-xl transition active:scale-95 text-white">
                                    {isPlaying ? <Pause size={40} fill="currentColor" /> : <Play size={40} fill="currentColor" className="ml-2" />}
                                </button>
                                <button onClick={() => audioRef.current && (audioRef.current.currentTime += 30)} className="p-4 text-zinc-600 dark:text-zinc-400 hover:text-brand transition">
                                    <SkipForward size={32} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
