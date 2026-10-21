import { useEffect } from 'react';

const APP_NAME = 'WeatherChaser';

/** Sets "<title> – WeatherChaser" (null = leave alone) while mounted and restores the previous title on unmount (D8). */
export function useDocumentTitle(title: string | null): void {
  useEffect(() => {
    if (title === null) return; // caller defers to a child that sets its own title
    const previous = document.title;
    document.title = title ? `${title} – ${APP_NAME}` : APP_NAME;
    return () => { document.title = previous; };
  }, [title]);
}
