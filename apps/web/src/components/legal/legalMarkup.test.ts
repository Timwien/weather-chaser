import { describe, expect, it } from 'vitest';
import { isSafeHref, parseBlocks, parseInline } from './legalMarkup.ts';
import deLegal from '../../i18n/locales/de/legal.json';
import enLegal from '../../i18n/locales/en/legal.json';

describe('parseInline', () => {
  it('splits text, bold and links', () => {
    expect(parseInline('Siehe **Zweck:** [Datenschutz](/privacy) hier')).toEqual([
      { type: 'text', text: 'Siehe ' },
      { type: 'strong', text: 'Zweck:' },
      { type: 'text', text: ' ' },
      { type: 'link', text: 'Datenschutz', href: '/privacy' },
      { type: 'text', text: ' hier' },
    ]);
  });

  it('marks code spans', () => {
    expect(parseInline('Schlüssel `wc-theme`.')).toEqual([
      { type: 'text', text: 'Schlüssel ' },
      { type: 'code', text: 'wc-theme' },
      { type: 'text', text: '.' },
    ]);
  });

  it('renders unsafe link targets as plain text', () => {
    expect(parseInline('[x](javascript:alert(1))')).toEqual([{ type: 'text', text: 'x' }, { type: 'text', text: ')' }]);
    expect(parseInline('[x](//evil.example)')).toEqual([{ type: 'text', text: 'x' }]);
  });
});

describe('isSafeHref', () => {
  it('allows only web, mail, internal and anchor targets', () => {
    expect(isSafeHref('https://example.com')).toBe(true);
    expect(isSafeHref('mailto:a@b.de')).toBe(true);
    expect(isSafeHref('/tos')).toBe(true);
    expect(isSafeHref('#rechte')).toBe(true);
    expect(isSafeHref('javascript:alert(1)')).toBe(false);
    expect(isSafeHref('//evil.example')).toBe(false);
    expect(isSafeHref('/\\evil.example')).toBe(false);
  });
});

describe('parseBlocks', () => {
  it('builds paragraphs with line breaks and bullet lists', () => {
    const blocks = parseBlocks('Zeile 1\nZeile 2\n\n- eins\n- **zwei**');
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toEqual({
      type: 'p',
      lines: [[{ type: 'text', text: 'Zeile 1' }], [{ type: 'text', text: 'Zeile 2' }]],
    });
    expect(blocks[1]).toEqual({
      type: 'ul',
      items: [[{ type: 'text', text: 'eins' }], [{ type: 'strong', text: 'zwei' }]],
    });
  });
});

// Structural lockstep check: DE is binding, EN must mirror it section by section.
type Doc = { title: string; intro: string; sections: { id: string; h: string; b: string; box?: string }[] };
const DOCS = ['privacy', 'tos', 'imprint'] as const;

describe('legal.json', () => {
  for (const doc of DOCS) {
    it(`${doc}: DE and EN have the same sections, ids and boxes`, () => {
      const de = (deLegal as unknown as Record<string, Doc>)[doc];
      const en = (enLegal as unknown as Record<string, Doc>)[doc];
      expect(de.sections.length).toBeGreaterThan(0);
      expect(en.sections.map((s) => [s.id, s.box ?? null])).toEqual(de.sections.map((s) => [s.id, s.box ?? null]));
      for (const s of [...de.sections, ...en.sections]) {
        expect(s.h.trim()).not.toBe('');
        expect(s.b.trim()).not.toBe('');
      }
    });

    it(`${doc}: list items are never mixed into a paragraph (needs a blank line before "- ")`, () => {
      for (const lang of [deLegal, enLegal]) {
        const d = (lang as unknown as Record<string, Doc>)[doc];
        for (const s of d.sections) {
          for (const block of parseBlocks(s.b)) {
            if (block.type !== 'p') continue;
            for (const line of block.lines) {
              const first = line[0];
              expect(first?.type === 'text' && first.text.startsWith('- '), `${doc}/${s.id}`).toBe(false);
            }
          }
        }
      }
    });

    it(`${doc}: no unsafe or broken links`, () => {
      for (const lang of [deLegal, enLegal]) {
        const d = (lang as unknown as Record<string, Doc>)[doc];
        for (const s of d.sections) {
          for (const m of s.b.matchAll(/\[([^\]]+)\]\(([^)\s]+)\)/g)) {
            expect(isSafeHref(m[2]), `${doc}/${s.id}: ${m[2]}`).toBe(true);
          }
        }
      }
    });
  }

  it('contains no leftover placeholders and no ASCII umlaut substitutes in German', () => {
    const text = JSON.stringify(deLegal);
    expect(text).not.toMatch(/\[(NAME|ADRESSE|E-MAIL-ADRESSE|STRASSE)/);
    expect(JSON.stringify(enLegal)).not.toMatch(/\[(OPERATOR|EMAIL ADDRESS|ADDRESS)/);
    // Common substitutes that must be real umlauts (rule: echte Umlaute).
    expect(text).not.toMatch(/\b(fuer|ueber|koennen|moechte|Aenderung|Loeschung|gemaess|Stra(ss)e)\b/i);
  });
});
