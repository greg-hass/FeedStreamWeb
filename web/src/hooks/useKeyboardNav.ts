import { useState, useEffect, useCallback } from 'react';

interface UseKeyboardNavProps {
    count: number;
    onNext?: (index: number) => void;
    onPrev?: (index: number) => void;
    onSelect?: (index: number) => void;
    onMarkRead?: (index: number) => void;
    onToggleStar?: (index: number) => void;
    onOpenInNewTab?: (index: number) => void;
    onFocusSearch?: () => void;
    onShowHelp?: () => void;
}

export function useKeyboardNav({
    count,
    onNext,
    onPrev,
    onSelect,
    onMarkRead,
    onToggleStar,
    onOpenInNewTab,
    onFocusSearch,
    onShowHelp
}: UseKeyboardNavProps) {
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
                if (selectedIndex >= 0) {
                    onSelect?.(selectedIndex);
                }
                break;
            case 'o':
                if (e.shiftKey && selectedIndex >= 0) {
                    // Shift+O opens in new tab
                    onOpenInNewTab?.(selectedIndex);
                } else if (selectedIndex >= 0) {
                    onSelect?.(selectedIndex);
                }
                break;
            case 'm':
                if (selectedIndex >= 0) {
                    onMarkRead?.(selectedIndex);
                }
                break;
            case 's':
                if (selectedIndex >= 0) {
                    onToggleStar?.(selectedIndex);
                }
                break;
            case '/':
                e.preventDefault(); // Prevent browser's quick find
                onFocusSearch?.();
                break;
            case '?':
                onShowHelp?.();
                break;
            default:
                break;
        }
    }, [count, onNext, onPrev, onSelect, onMarkRead, onToggleStar, onOpenInNewTab, onFocusSearch, onShowHelp, selectedIndex]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    return { selectedIndex, setSelectedIndex };
}

