import { useEffect } from 'react';

/**
 * Locks body scroll while the component is mounted.
 * Stacks correctly: tracks how many overlays are open and only
 * restores scroll when the last one unmounts.
 */
let lockCount = 0;

export function useBodyScrollLock() {
  useEffect(() => {
    lockCount += 1;
    if (lockCount === 1) {
      // Preserve current scroll position so the page doesn't jump
      const scrollY = window.scrollY;
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
    }

    return () => {
      lockCount -= 1;
      if (lockCount === 0) {
        const top = document.body.style.top;
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        // Restore exact scroll position
        window.scrollTo(0, parseInt(top || '0', 10) * -1);
      }
    };
  }, []);
}
