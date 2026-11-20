import { findBook, getBook } from './books';

/**
 * Every verse in the app has one number: BBCCCVVV.
 *   John 3:16  ->  43 003 016  ->  43003016
 * Translations, highlights, note links, interlinear words and AI citations
 * all point at verses with this number, which is what ties them together.
 */
export type VerseId = number;

export type VerseRef = { book: number; chapter: number; verse: number };

export function toVerseId({ book, chapter, verse }: VerseRef): VerseId {
  return book * 1_000_000 + chapter * 1_000 + verse;
}

export function fromVerseId(id: VerseId): VerseRef {
  return {
    book: Math.floor(id / 1_000_000),
    chapter: Math.floor(id / 1_000) % 1_000,
    verse: id % 1_000,
  };
}

/** "John 3:16", "John 3:16-18", or "John 3" when verse is 0. */
export function formatRef(ref: VerseRef, endVerse?: number): string {
  const name = getBook(ref.book).name;
  if (!ref.verse) return `${name} ${ref.chapter}`;
  const range = endVerse && endVerse > ref.verse ? `-${endVerse}` : '';
  return `${name} ${ref.chapter}:${ref.verse}${range}`;
}

export type ParsedRef = VerseRef & { endVerse?: number };

/**
 * Parse what a person types: "John 3:16", "jn 3", "1 Cor 13:4-7", "Psalm 23".
 * Returns undefined when the book is unknown or the chapter is out of range.
 * verse is 0 when only a chapter was given.
 */
export function parseRef(input: string): ParsedRef | undefined {
  const m = input
    .trim()
    .match(/^((?:[1-3]|i{1,3})?\s*[a-z][a-z .]*?)\s*(\d+)(?:\s*[:.]\s*(\d+)(?:\s*[-–]\s*(\d+))?)?$/i);
  if (!m) return undefined;
  const book = findBook(m[1]);
  if (!book) return undefined;
  const chapter = Number(m[2]);
  if (chapter < 1 || chapter > book.chapters) return undefined;
  const verse = m[3] ? Number(m[3]) : 0;
  const endVerse = m[4] ? Number(m[4]) : undefined;
  return { book: book.id, chapter, verse, endVerse };
}
