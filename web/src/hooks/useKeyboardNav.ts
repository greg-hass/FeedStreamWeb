import { useState, useEffect, useCallback } from 'react';

interface UseKeyboardNavProps {
    count: number;
    onNext?: (index: number) => void;
    onPrev?: (index: number) => void;
    onSelect?: (index: number) => void;
    onMarkRead?: (index: number) => void;
}

export function useKeyboardNav({ count, onNext, onPrev, onSelect, onMarkRead }: UseKeyboardNavProps) {
    const [selectedIndex, setSelectedIndex] = useState<number>(-1);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        // Ignore if typing in an input
        if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') {
            return;
        }

        switch (e.key) {
            case 'j':
                setSelectedIndex(prev => {
                    const next = Math.min(prev + 1, count - 1);
                    onNext?.(next);
                    return next;
                });
                break;
            case 'k':
                setSelectedIndex(prev => {
                    const next = Math.max(prev - 1, 0);
                    onPrev?.(next);
                    return next;
                });
                break;
            case 'Enter':
            case 'o':
                if (selectedIndex >= 0) {
                    onSelect?.(selectedIndex);
                }
                break;
            case 'm':
                if (selectedIndex >= 0) {
                    onMarkRead?.(selectedIndex);
                }
                break;
            default:
                break;
        }
    }, [count, onNext, onPrev, onSelect, onMarkRead, selectedIndex]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    return { selectedIndex, setSelectedIndex };
}
