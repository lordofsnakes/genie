'use client';

import { useEffect, useRef } from 'react';

/**
 * Tracks window.visualViewport.height and applies it directly to the container.
 * This ensures the layout shrinks to fit the visible area above the keyboard
 * in WebView environments (e.g. World App) where dvh units don't respond to
 * the software keyboard.
 */
export function ViewportContainer({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const vv = window.visualViewport;

    const update = () => {
      const height = vv ? vv.height : window.innerHeight;
      if (ref.current) {
        ref.current.style.height = `${height}px`;
      }
      window.scrollTo(0, 0);
    };

    update();
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);

    return () => {
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
    };
  }, []);

  return (
    <div
      ref={ref}
      className="flex flex-col overflow-hidden w-full"
      style={{ height: '100dvh' }}
    >
      {children}
    </div>
  );
}
