// R6: locale-aware date formatting. Replaces hardcoded 'de'/'de-DE' formatters
// that showed German dates to English users.

function toLocale(lang: string): string {
  return lang.startsWith('de') ? 'de-DE' : 'en-GB';
}

/** Short day + month, e.g. "3. Juli" / "3 Jul". */
export function formatDay(dateISO: string, lang: string): string {
  const d = new Date(dateISO + (dateISO.length === 10 ? 'T00:00:00' : ''));
  return new Intl.DateTimeFormat(toLocale(lang), { day: 'numeric', month: 'short' }).format(d);
}

/** Weekday + day-of-month, e.g. "Mo 3" / "Mon 3" (UTC to match calendar keys). */
export function formatWeekday(dateISO: string, lang: string): string {
  const d = new Date(dateISO + 'T00:00:00Z');
  const weekday = new Intl.DateTimeFormat(toLocale(lang), { weekday: 'short', timeZone: 'UTC' }).format(d);
  return `${weekday} ${d.getUTCDate()}`;
}

/** Numeric day/month (+ optional year on the end date), e.g. "03.07.–04.07.2026". */
export function formatRange(fromISO: string | null, toISO: string | null, lang: string): string {
  const locale = toLocale(lang);
  if (fromISO && toISO) {
    const f = new Date(fromISO).toLocaleDateString(locale, { day: '2-digit', month: '2-digit' });
    const t = new Date(toISO).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
    return `${f} – ${t}`;
  }
  if (fromISO) return new Date(fromISO).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
  return '';
}
