import { useEffect } from 'react';

// Reference-counted so multiple overlapping modals (e.g. cart + checkout) don't
// stomp on each other's `document.body.style.overflow` when they open/close out of order.
let lockCount = 0;

export function useBodyScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;

    lockCount += 1;
    if (lockCount === 1) {
      document.body.style.overflow = 'hidden';
    }

    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) {
        document.body.style.overflow = '';
      }
    };
  }, [active]);
}
