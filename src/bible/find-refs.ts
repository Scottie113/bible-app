import { BOOKS, findBook } from './books';
import { formatRef, toVerseId, type VerseRef } from './verse-id';

/**
 * Find Bible references inside free text, e.g. in a note:
 *   "Compare John 3:16 with Rom 8:28-30 and Psalm 23."
 * Returns each match with its position so the text can be shown with links.
 */
export type FoundRef = {
  start: number;
  end: number;
  text: string;
  ref: VerseRef; // verse 0 = whole chapter
  endVerse?: number;
};

// Every way a book can be written, longest first so "1 John" wins over "John".
const names = [...new Set(BOOKS.flatMap((b) => [b.name, b.code, ...b.aliases]))]
  .map((n) => n.toLowerCase())
  .sort((a, b) => b.length - a.length);
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s*');
const PATTERN = new RegExp(
  `(?<![\\p{L}\\d])(${names.map(escape).join('|')})\\.?\\s*(\\d{1,3})(?:\\s*:\\s*(\\d{1,3})(?:\\s*[-–]\\s*(\\d{1,3}))?)?(?![\\p{L}\\d:])`,
  'giu',
);

export function findRefs(text: string): FoundRef[] {
  const found: FoundRef[] = [];
  for (const m of text.matchAll(PATTERN)) {
    const book = findBook(m[1]);
    if (!book) continue;
    const isFullName = m[1].toLowerCase().replace(/\s+/g, ' ') === book.name.toLowerCase();
    // Short abbreviations ("is", "am", "jn") only count with a verse ("Is 53:5"), to avoid "I am 5".
    if (!isFullName && m[1].length <= 3 && !m[3]) continue;
    const chapter = Number(m[2]);
    if (chapter < 1 || chapter > book.chapters) continue;
    const verse = m[3] ? Number(m[3]) : 0;
    const endVerse = m[4] ? Number(m[4]) : undefined;
    if (endVerse !== undefined && endVerse < verse) continue;
    found.push({
      start: m.index,
      end: m.index + m[0].length,
      text: m[0],
      ref: { book: book.id, chapter, verse },
      endVerse,
    });
  }
  return found;
}

/** All verse ids a text links to (ranges expanded, max 200 per range); chapters use verse 0. */
export function verseIdsIn(text: string): number[] {
  const ids = new Set<number>();
  for (const { ref, endVerse } of findRefs(text)) {
    const last = Math.min(endVerse ?? ref.verse, ref.verse + 199);
    for (let v = ref.verse; v <= last; v++) ids.add(toVerseId({ ...ref, verse: v }));
  }
  return [...ids].sort((a, b) => a - b);
}

export function refLabel(found: Pick<FoundRef, 'ref' | 'endVerse'>) {
  return formatRef(found.ref, found.endVerse);
}
