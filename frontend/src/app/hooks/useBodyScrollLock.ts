import { useEffect } from 'react';

// Reference-counted so multiple overlapping modals (e.g. cart + checkout) don't
// stomp on each other's `document.body.style.overflow` when they open/close out of order.
let lockCount = 0;
let previousBodyOverflow = '';
let previousHtmlOverflow = '';

function applyScrollLock() {
  previousBodyOverflow = document.body.style.overflow;
  previousHtmlOverflow = document.documentElement.style.overflow;
  document.body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';
}

function releaseScrollLock() {
  document.body.style.overflow = previousBodyOverflow;
  document.documentElement.style.overflow = previousHtmlOverflow;
  previousBodyOverflow = '';
  previousHtmlOverflow = '';
}

export function forceBodyScrollUnlock(): void {
  lockCount = 0;
  document.body.style.overflow = '';
  document.documentElement.style.overflow = '';
}

export function useBodyScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;

    lockCount += 1;
    if (lockCount === 1) {
      applyScrollLock();
    }

    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) {
        releaseScrollLock();
      }
    };
  }, [active]);
}
