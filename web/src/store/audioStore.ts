
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AudioTrack {
    id: string;
    url: string;
    title: string;
    artist?: string;
    artwork?: string;
    duration?: number;
}

interface AudioState {
    currentTrack: AudioTrack | null;
    isPlaying: boolean;
    progress: number; // 0-100
    duration: number; // seconds
    currentTime: number; // seconds
    isExpanded: boolean;
    playbackRate: number;
    sleepTimerEndTime: number | null; // Timestamp when audio should pause

    setTrack: (track: AudioTrack) => void;
    play: () => void;
    pause: () => void;
    setProgress: (progress: number, currentTime: number) => void;
    setDuration: (duration: number) => void;
    setPlaybackRate: (rate: number) => void;
    setSleepTimer: (minutes: number) => void;
    cancelSleepTimer: () => void;
    toggleExpand: () => void;
    close: () => void;
}

export const useAudioStore = create<AudioState>()(
    persist(
        (set) => ({
            currentTrack: null,
            isPlaying: false,
            progress: 0,
            duration: 0,
            currentTime: 0,
            isExpanded: false,
            playbackRate: 1,
            sleepTimerEndTime: null,

            setTrack: (track) => set({ currentTrack: track, isPlaying: true, progress: 0, currentTime: 0 }),
            play: () => set({ isPlaying: true }),
            pause: () => set({ isPlaying: false }),
            setProgress: (progress, currentTime) => set({ progress, currentTime }),
            setDuration: (duration) => set({ duration }),
            setPlaybackRate: (rate) => set({ playbackRate: rate }),
            setSleepTimer: (minutes) => set({ sleepTimerEndTime: Date.now() + minutes * 60 * 1000 }),
            cancelSleepTimer: () => set({ sleepTimerEndTime: null }),
            toggleExpand: () => set((state) => ({ isExpanded: !state.isExpanded })),
            close: () => set({ currentTrack: null, isPlaying: false }),
        }),
        {
            name: 'feedstream-audio-storage',
            partialize: (state) => ({ 
                currentTrack: state.currentTrack, 
                progress: state.progress, 
                currentTime: state.currentTime,
                playbackRate: state.playbackRate 
            }), 
        }
    )
);
