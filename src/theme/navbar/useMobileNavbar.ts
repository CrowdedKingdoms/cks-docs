import {useSyncExternalStore} from 'react';
import {useWindowSize} from '@docusaurus/theme-common';

import {DESKTOP_NAVBAR_BREAKPOINT} from './constants';

function mediaQuery(): MediaQueryList {
  return window.matchMedia(`(max-width: ${DESKTOP_NAVBAR_BREAKPOINT}px)`);
}

function subscribeMedia(onChange: () => void): () => void {
  const mq = mediaQuery();
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

function getMediaSnapshot(): boolean {
  return mediaQuery().matches;
}

/**
 * True when the viewport should use the hamburger / mobile nav drawer.
 * matchMedia via useSyncExternalStore avoids hydration mismatch in Chrome/Safari.
 */
export function useMobileNavbar(): boolean {
  const mediaMatches = useSyncExternalStore(
    subscribeMedia,
    getMediaSnapshot,
    () => false,
  );
  const windowSize = useWindowSize({
    desktopBreakpoint: DESKTOP_NAVBAR_BREAKPOINT,
  });

  return windowSize === 'mobile' || mediaMatches;
}
