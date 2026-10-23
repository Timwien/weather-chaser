// Tiny markup for the legal texts in legal.json — just enough for readable
// paragraphs, lists, bold labels and links, without pulling in a Markdown lib.
//
//   blank line          → new block
//   lines all "- …"     → bullet list
//   other lines         → paragraph (single newlines become line breaks)
//   **bold**            → <strong>
//   `code`              → <code> (storage key names)
//   [text](href)        → link (only https:, http:, mailto:, /path or #anchor)

export type Inline =
  | { type: 'text'; text: string }
  | { type: 'strong'; text: string }
  | { type: 'code'; text: string }
  | { type: 'link'; text: string; href: string };

export type Block =
  | { type: 'p'; lines: Inline[][] }
  | { type: 'ul'; items: Inline[][] };

const INLINE_RE = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)|`([^`]+)`/g;

/** Only safe link targets; anything else is rendered as plain text. */
export function isSafeHref(href: string): boolean {
  return /^(https?:\/\/|mailto:)/i.test(href) || /^\/(?![/\\])/.test(href) || href.startsWith('#');
}

export function parseInline(line: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of line.matchAll(INLINE_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push({ type: 'text', text: line.slice(last, idx) });
    if (m[1] !== undefined) {
      out.push({ type: 'strong', text: m[1] });
    } else if (m[4] !== undefined) {
      out.push({ type: 'code', text: m[4] });
    } else if (isSafeHref(m[3])) {
      out.push({ type: 'link', text: m[2], href: m[3] });
    } else {
      out.push({ type: 'text', text: m[2] });
    }
    last = idx + m[0].length;
  }
  if (last < line.length) out.push({ type: 'text', text: line.slice(last) });
  return out;
}

export function parseBlocks(body: string): Block[] {
  return body
    .split(/\n\s*\n/)
    .map((chunk) => chunk.split('\n').filter((l) => l.trim() !== ''))
    .filter((lines) => lines.length > 0)
    .map((lines): Block =>
      lines.every((l) => l.startsWith('- '))
        ? { type: 'ul', items: lines.map((l) => parseInline(l.slice(2))) }
        : { type: 'p', lines: lines.map(parseInline) },
    );
}
