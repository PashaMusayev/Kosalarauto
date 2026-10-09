import { useEffect, RefObject } from 'react';
import { animate, MotionValue } from 'motion/react';
import { DETAIL_CLOSE_TRANSITION } from '../utils/detailTransition';

const EDGE_GUARD_PX = 24;          // leave the screen's left edge to the phone's own back gesture
const LOCK_THRESHOLD_PX = 10;
const CLOSE_DISTANCE_RATIO = 0.33;
const CLOSE_VELOCITY = 0.5;        // px per ms
const SNAP_BACK = { duration: 0.25, ease: 'easeOut' } as const;

interface Options { enabled: boolean; detailX: MotionValue<number>; onClose: () => void; }

export function useSwipeToClose(ref: RefObject<HTMLElement | null>, { enabled, detailX, onClose }: Options) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    let startX = 0, startY = 0, lastX = 0, lastT = 0, prevX = 0, prevT = 0;
    let state: 'idle' | 'pending' | 'swiping' | 'ignored' = 'idle';
    let closing = false;

    const onStart = (e: TouchEvent) => {
      if (closing || e.touches.length !== 1) { state = 'ignored'; return; }
      const t = e.touches[0];
      const target = e.target as Element | null;
      if (t.clientX < EDGE_GUARD_PX || target?.closest('[data-swipe-close-ignore]')) { state = 'ignored'; return; }
      startX = lastX = prevX = t.clientX; startY = t.clientY; lastT = prevT = e.timeStamp;
      state = 'pending';
    };
    const onMove = (e: TouchEvent) => {
      if (state === 'idle' || state === 'ignored') return;
      const t = e.touches[0];
      const dx = t.clientX - startX, dy = t.clientY - startY;
      if (state === 'pending') {
        if (Math.abs(dx) < LOCK_THRESHOLD_PX && Math.abs(dy) < LOCK_THRESHOLD_PX) return;
        if (dx > 0 && Math.abs(dx) > Math.abs(dy) * 1.5) { state = 'swiping'; detailX.stop(); }
        else { state = 'ignored'; return; }
      }
      if (e.cancelable) e.preventDefault();
      prevX = lastX; prevT = lastT; lastX = t.clientX; lastT = e.timeStamp;
      detailX.set(Math.max(0, dx));
    };
    const onEnd = (e: TouchEvent) => {
      if (state !== 'swiping') { state = 'idle'; return; }
      state = 'idle';
      const dx = Math.max(0, lastX - startX);
      const paused = e.timeStamp - lastT > 100;
      const velocity = paused ? 0 : (lastX - prevX) / Math.max(1, lastT - prevT);
      if (dx > window.innerWidth * CLOSE_DISTANCE_RATIO || velocity > CLOSE_VELOCITY) {
        closing = true;
        animate(detailX, window.innerWidth, DETAIL_CLOSE_TRANSITION);
        onClose();
      } else {
        animate(detailX, 0, SNAP_BACK);
      }
    };
    const onCancel = () => {
      if (state === 'swiping') animate(detailX, 0, SNAP_BACK);
      state = 'idle';
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onCancel);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onCancel);
    };
  }, [ref, enabled, detailX, onClose]);
}
