import { useEffect } from 'react';

let lockCount = 0;
let originalHtmlOverflow = '';
let originalBodyPaddingRight = '';

/**
 * Calculates current scrollbar width on desktop to prevent layout shift
 */
function getScrollbarWidth(): number {
  if (typeof window === 'undefined' || typeof document === 'undefined') return 0;
  return window.innerWidth - document.documentElement.clientWidth;
}

/**
 * Locks body scroll cleanly using overflow:hidden without position:fixed
 */
export function lockBodyScroll(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  lockCount++;

  if (lockCount === 1) {
    const scrollbarWidth = getScrollbarWidth();

    // Snapshot original overflow and padding
    originalHtmlOverflow = document.documentElement.style.overflow;
    originalBodyPaddingRight = document.body.style.paddingRight;

    // Compensate scrollbar width to prevent layout jump on desktop
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    // Lock scroll purely via overflow on documentElement without modifying scroll position or coordinates
    document.documentElement.style.overflow = 'hidden';
  }
}

/**
 * Unlocks body scroll and ensures zero scrolling animation
 */
export function unlockBodyScroll(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  if (lockCount <= 0) {
    lockCount = 0;
    return;
  }

  lockCount--;

  if (lockCount === 0) {
    // Restore overflow and padding immediately
    document.documentElement.style.overflow = originalHtmlOverflow;
    document.body.style.paddingRight = originalBodyPaddingRight;
  }
}

/**
 * React Hook to lock/unlock body scroll based on active state
 */
export function useBodyScrollLock(isLocked: boolean): void {
  useEffect(() => {
    if (!isLocked) return;

    lockBodyScroll();

    return () => {
      unlockBodyScroll();
    };
  }, [isLocked]);
}

