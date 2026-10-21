import { useEffect, useState } from 'react';
import { useIsMobile } from './useIsMobile.ts';

const QUERY = '(pointer: coarse)';

function read(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(QUERY).matches;
}

/** True on touch-first devices or the mobile layout — decides "Tippe" vs "Klicke" wording. */
export function useIsTouch(): boolean {
  const isMobile = useIsMobile();
  const [coarse, setCoarse] = useState<boolean>(read);

  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const onChange = () => setCoarse(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return isMobile || coarse;
}
