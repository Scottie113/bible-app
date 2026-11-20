import type { VerseId } from './verse-id';

/** One book of one translation: chapters[c][v] is the text of chapter c+1, verse v+1. */
export type BookText = string[][];

/** Book id (1-66) -> function that loads that book's text on demand. */
export type BookLoaders = Record<number, () => Promise<BookText>>;

export type Verse = { id: VerseId; verse: number; text: string };

export type Translation = {
  id: string;
  /** Short label shown in the UI, e.g. "KJV". */
  abbreviation: string;
  name: string;
  /** BCP-47 language tag, e.g. "en", "zh-Hans", "fr", "es". */
  language: string;
  license: string;
  source: string;
  load: BookLoaders;
};
