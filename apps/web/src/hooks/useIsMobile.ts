import { useEffect, useState } from 'react';

const QUERY = '(max-width: 768px)';

function read(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(QUERY).matches;
}

/** True on phone/portrait-tablet viewports (≤768px). Updates live on resize/orientation change. */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(read);

  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const onChange = () => setIsMobile(mq.matches);
    mq.addEventListener('change', onChange);
    // sync once in case the media state changed between SSR/first render and effect
    setIsMobile(mq.matches);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}
