
'use client';

import React, { useRef, useState } from 'react';
import { Check, Bookmark } from 'lucide-react';
import { clsx } from 'clsx';

interface ArticleSwipeRowProps {
    children: React.ReactNode;
    onSwipeLeft?: () => void; // Usually Bookmark/More
    onSwipeRight?: () => void; // Usually Toggle Read
    isRead: number;
    isBookmarked: number;
}

export function ArticleSwipeRow({ children, onSwipeLeft, onSwipeRight, isRead, isBookmarked }: ArticleSwipeRowProps) {
    const contentRef = useRef<HTMLDivElement>(null);
    const [offset, setOffset] = useState(0);
    const touchStartX = useRef<number | null>(null);
    const touchStartY = useRef<number | null>(null);
    const currentX = useRef(0);
    const isDragging = useRef(false);

    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
        isDragging.current = true;
        if (contentRef.current) {
            contentRef.current.style.transition = 'none';
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (touchStartX.current === null || touchStartY.current === null || !isDragging.current) return;

        const deltaX = e.touches[0].clientX - touchStartX.current;
        const deltaY = e.touches[0].clientY - touchStartY.current;

        // Vertical Scroll Lock: If moving more vertically than horizontally, ignore swipe
        if (Math.abs(deltaY) > Math.abs(deltaX)) {
            return;
        }

        // Lock vertical scroll if we are definitely swiping horizontally
        if (e.cancelable) {
            // e.preventDefault(); // React synthetic events might complain, but usually needed for native feel
        }

        // Lock vertical scroll if dragging horizontal? 
        // Simple logic: limit drag to reasonable bounds (-150 to 150)
        // Add resistance
        const resistedX = deltaX * 0.5;

        // Only allow dragging if we have actions
        if ((resistedX > 0 && !onSwipeRight) || (resistedX < 0 && !onSwipeLeft)) {
            return;
        }

        currentX.current = resistedX;

        if (contentRef.current) {
            contentRef.current.style.transform = `translateX(${resistedX}px)`;
        }
    };

    const handleTouchEnd = () => {
        if (!isDragging.current) return;
        isDragging.current = false;
        touchStartX.current = null;

        if (!contentRef.current) return;

        contentRef.current.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';

        if (currentX.current > 80 && onSwipeRight) {
            // Trigger Right
            contentRef.current.style.transform = `translateX(100%)`;
            setTimeout(() => {
                onSwipeRight();
                resetPosition();
            }, 200);
        } else if (currentX.current < -80 && onSwipeLeft) {
            // Trigger Left
            contentRef.current.style.transform = `translateX(-100%)`;
            setTimeout(() => {
                onSwipeLeft();
                resetPosition();
            }, 200);
        } else {
            // Reset
            resetPosition();
        }
    };

    const resetPosition = () => {
        if (contentRef.current) {
            contentRef.current.style.transform = 'translateX(0px)';
        }
        currentX.current = 0;
    };

    return (
        <div className="swipe-row relative overflow-hidden bg-white dark:bg-black border-b border-zinc-100 dark:border-zinc-900 last:border-0 select-none">
            {/* Background Layer */}
            <div className="absolute inset-0 flex items-center justify-between pointer-events-none">
                {/* Left Action (Swipe Right) -> Read */}
                <div className={clsx(
                    "flex-1 h-full flex items-center justify-start px-6 transition-opacity duration-200",
                    onSwipeRight ? "bg-brand" : "bg-transparent"
                )}>
                    {onSwipeRight && <Check className="text-white fill-current" size={24} />}
                </div>

                {/* Right Action (Swipe Left) -> Bookmark */}
                <div className={clsx(
                    "flex-1 h-full flex items-center justify-end px-6 transition-opacity duration-200",
                    onSwipeLeft ? "bg-amber-500" : "bg-transparent"
                )}>
                    {onSwipeLeft && <Bookmark className={clsx("text-white", isBookmarked && "fill-current")} size={24} />}
                </div>
            </div>

            {/* Content Layer */}
            <div
                ref={contentRef}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                className="relative bg-white dark:bg-black z-10 touch-pan-y will-change-transform"
            >
                {children}
            </div>
        </div>
    );
}

// Memoize to prevent re-renders during virtualized scrolling
export const MemoizedArticleSwipeRow = React.memo(ArticleSwipeRow);
