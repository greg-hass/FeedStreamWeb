
'use client';

import React, { useRef, useState } from 'react';
import { motion, useMotionValue, useTransform, PanInfo, animate } from 'framer-motion';
import { Check, Bookmark, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';

interface SwipeAction {
    icon: React.ElementType;
    color: string; // bg color class
    onClick: () => void;
}

interface ArticleSwipeRowProps {
    children: React.ReactNode;
    onSwipeLeft?: () => void; // Usually Bookmark/More
    onSwipeRight?: () => void; // Usually Toggle Read
    isRead: boolean;
    isBookmarked: boolean;
}

export function ArticleSwipeRow({ children, onSwipeLeft, onSwipeRight, isRead, isBookmarked }: ArticleSwipeRowProps) {
    const x = useMotionValue(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const [swiped, setSwiped] = useState(false);

    // Background Styles
    const bgLeftOpacity = useTransform(x, [0, 60], [0, 1]);
    const bgRightOpacity = useTransform(x, [-60, 0], [1, 0]);

    const handleDragEnd = async (_: any, info: PanInfo) => {
        const offset = info.offset.x;
        const velocity = info.velocity.x;

        if (offset > 80 || velocity > 500) {
            // Right Swipe (Read/Unread)
            if (onSwipeRight) {
                await animate(x, 100, { duration: 0.2 }).then(() => {
                    onSwipeRight();
                    x.set(0);
                });
            } else {
                animate(x, 0, { type: 'spring', bounce: 0, duration: 0.3 });
            }
        } else if (offset < -80 || velocity < -500) {
            // Left Swipe (Bookmark)
            if (onSwipeLeft) {
                await animate(x, -100, { duration: 0.2 }).then(() => {
                    onSwipeLeft();
                    x.set(0);
                });
            } else {
                animate(x, 0, { type: 'spring', bounce: 0, duration: 0.3 });
            }
        } else {
            animate(x, 0, { type: 'spring', bounce: 0, duration: 0.3 });
        }
    };

    return (
        <div className="relative overflow-hidden bg-white dark:bg-black border-b border-zinc-100 dark:border-zinc-900 last:border-0" ref={containerRef}>

            {/* Left Action Background (Read Status) */}
            <motion.div
                className="absolute inset-y-0 left-0 w-full bg-brand flex items-center justify-start px-6"
                style={{ opacity: bgLeftOpacity }}
            >
                <Check className="text-white fill-current" size={24} />
            </motion.div>

            {/* Right Action Background (Bookmark) */}
            <motion.div
                className="absolute inset-y-0 right-0 w-full bg-amber-500 flex items-center justify-end px-6"
                style={{ opacity: bgRightOpacity }}
            >
                <Bookmark className={clsx("text-white", isBookmarked && "fill-current")} size={24} />
            </motion.div>

            {/* Content */}
            <motion.div
                drag="x"
                dragConstraints={{ left: 0, right: 0 }} // Elastic drag
                dragElastic={0.1} // Resistance
                onDragEnd={handleDragEnd}
                style={{ x }}
                className="relative bg-white dark:bg-black z-10"
            >
                {children}
            </motion.div>
        </div>
    );
}
