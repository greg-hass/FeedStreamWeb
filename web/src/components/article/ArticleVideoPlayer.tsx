'use client';

import { useEffect, useRef, useState } from 'react';
import { db } from '@/lib/db';
import { useAudioStore } from '@/store/audioStore';

declare global {
    interface Window {
        YT: any;
        onYouTubeIframeAPIReady: () => void;
    }
}

interface ArticleVideoPlayerProps {
    articleId: string;
    videoId: string;
    playbackPosition?: number;
    className?: string;
}

export function ArticleVideoPlayer({ articleId, videoId, playbackPosition = 0, className }: ArticleVideoPlayerProps) {
    const videoRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<any>(null);

    // Pause global audio when video starts
    const pauseAudio = useAudioStore(s => s.pause);

    useEffect(() => {
        pauseAudio();

        const initPlayer = () => {
            if (!videoRef.current || !window.YT) return;

            playerRef.current = new window.YT.Player(videoRef.current, {
                videoId: videoId,
                playerVars: {
                    autoplay: 1,
                    playsinline: 1,
                    modestbranding: 1,
                    rel: 0,
                    start: Math.floor(playbackPosition),
                },
                events: {
                    onStateChange: (event: any) => {
                        if (event.data === window.YT.PlayerState.PLAYING) {
                            const interval = setInterval(() => {
                                if (playerRef.current?.getCurrentTime) {
                                    db.articles.update(articleId, { playbackPosition: playerRef.current.getCurrentTime() });
                                }
                            }, 5000);
                            playerRef.current._posInterval = interval;
                        } else {
                            if (playerRef.current?._posInterval) clearInterval(playerRef.current._posInterval);
                            if (playerRef.current?.getCurrentTime) {
                                db.articles.update(articleId, { playbackPosition: playerRef.current.getCurrentTime() });
                            }
                        }
                    }
                }
            });
        };

        if (window.YT && window.YT.Player) {
            initPlayer();
        } else {
            // Load YouTube API if not present
            if (!document.getElementById('yt-api-script')) {
                const tag = document.createElement('script');
                tag.id = 'yt-api-script';
                tag.src = "https://www.youtube.com/iframe_api";
                const firstScriptTag = document.getElementsByTagName('script')[0];
                firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
                
                // Initialize the callback mechanism
                window.onYouTubeIframeAPIReady = () => {
                   window.dispatchEvent(new Event('youtube-api-ready'));
                };
            }

            const onApiReady = () => initPlayer();
            window.addEventListener('youtube-api-ready', onApiReady);
            
            // Clean up listener
            return () => {
                window.removeEventListener('youtube-api-ready', onApiReady);
                if (playerRef.current) {
                    if (playerRef.current._posInterval) clearInterval(playerRef.current._posInterval);
                    try {
                        playerRef.current.destroy();
                    } catch (e) {
                        // Ignore destroy errors
                    }
                    playerRef.current = null;
                }
            };
        }

        return () => {
            if (playerRef.current) {
                if (playerRef.current._posInterval) clearInterval(playerRef.current._posInterval);
                try {
                    playerRef.current.destroy();
                } catch (e) {
                    // Ignore destroy errors
                }
                playerRef.current = null;
            }
        };
    }, [videoId, articleId, playbackPosition, pauseAudio]);

    return <div ref={videoRef} className={className} />;
}
