import { useEffect, useState } from 'react';

import lexiconLoaders from '@/data/lexicon';
import originalLoaders from '@/data/original';

/**
 * The Bible in the languages it was written in: Hebrew (Old Testament, from the
 * Leningrad Codex) and Greek (New Testament, Nestle-Aland plus the Textus
 * Receptus words the KJV follows). Word-by-word data and lexicons from
 * STEPBible.org, CC BY 4.0.
 */

/** [text, transliteration, English gloss, Strong's id, grammar code, flags, Spanish gloss?] */
export type RawWord = [string, string, string, string, string, number, string?];
/** chapters[c][v] = words of chapter c+1, verse v+1 */
export type OriginalBook = RawWord[][][];

export type OriginalLanguage = 'hebrew' | 'greek';

export type Word = {
  /** Position in the verse, starting at 0. */
  index: number;
  text: string;
  translit: string;
  /** English meaning of this word in this verse. */
  gloss: string;
  /** Spanish meaning (Greek New Testament only). */
  spanish?: string;
  strong: string;
  morph: string;
  /** Found in some Greek manuscripts (e.g. the KJV's Textus Receptus) but not in Nestle-Aland. */
  variant: boolean;
};

export type LexiconEntry = {
  lemma: string;
  translit: string;
  pos: string;
  gloss: string;
  def: string;
  /** How many times the word appears in the Bible. */
  count?: number;
  /** Most common ways it is translated: [English, times]. */
  renderings?: [string, number][];
  /** Verse ids where it appears (up to 300, spread evenly across the Bible). */
  refs?: number[];
  /** Number of different verses it appears in. */
  verses?: number;
};
export type LexiconChunk = Record<string, LexiconEntry>;

export function languageOf(book: number): OriginalLanguage {
  return book <= 39 ? 'hebrew' : 'greek';
}

export const LANGUAGE_LABEL: Record<OriginalLanguage, string> = {
  hebrew: 'Hebrew',
  greek: 'Greek',
};

const bookCache = new Map<number, Promise<OriginalBook>>();
function loadBook(book: number) {
  let promise = bookCache.get(book);
  if (!promise) {
    promise = originalLoaders[book]();
    promise.catch(() => bookCache.delete(book));
    bookCache.set(book, promise);
  }
  return promise;
}

function toWord(raw: RawWord, index: number): Word {
  return {
    index,
    text: raw[0],
    translit: raw[1],
    gloss: raw[2],
    strong: raw[3],
    morph: raw[4],
    variant: (raw[5] & 1) === 1,
    spanish: raw[6],
  };
}

export async function getOriginalChapter(book: number, chapter: number): Promise<Word[][]> {
  const data = await loadBook(book);
  return (data[chapter - 1] ?? []).map((verse) => verse.map(toWord));
}

/** The Hebrew or Greek of one chapter: result[v-1] = words of verse v. */
export function useOriginalChapter(book: number, chapter: number) {
  const key = `${book}:${chapter}`;
  const [state, setState] = useState<{ key: string; verses?: Word[][]; error?: Error }>({ key: '' });
  useEffect(() => {
    let cancelled = false;
    getOriginalChapter(book, chapter).then(
      (verses) => !cancelled && setState({ key, verses }),
      (error: Error) => !cancelled && setState({ key, error }),
    );
    return () => {
      cancelled = true;
    };
  }, [book, chapter, key]);
  return state.key === key ? state : { key, verses: undefined, error: undefined };
}

const chunkCache = new Map<string, Promise<LexiconChunk>>();
export async function getLexiconEntry(strong: string): Promise<LexiconEntry | undefined> {
  const chunk = strong[0] + Math.floor(Number(strong.slice(1, 5)) / 500);
  const loader = lexiconLoaders[chunk];
  if (!loader) return undefined;
  let promise = chunkCache.get(chunk);
  if (!promise) {
    promise = loader();
    promise.catch(() => chunkCache.delete(chunk));
    chunkCache.set(chunk, promise);
  }
  return (await promise)[strong];
}

export function useLexiconEntry(strong: string | undefined) {
  const [state, setState] = useState<{ strong?: string; entry?: LexiconEntry; loaded: boolean }>({ loaded: false });
  useEffect(() => {
    if (!strong) return;
    let cancelled = false;
    getLexiconEntry(strong).then(
      (entry) => !cancelled && setState({ strong, entry, loaded: true }),
      () => !cancelled && setState({ strong, entry: undefined, loaded: true }),
    );
    return () => {
      cancelled = true;
    };
  }, [strong]);
  return state.strong === strong ? state : { strong, entry: undefined, loaded: false };
}

/** "in/ beginning" -> "in beginning", "<the>" -> "the" (angle brackets = implied in English). */
export function displayGloss(gloss: string) {
  return gloss.replace(/\s*\/\s*/g, ' ').trim();
}

/** Hebrew words are stored with "/" between prefix and word; hide it when reading. */
export function displayOriginal(text: string) {
  return text.replace(/\//g, '');
}

/** "be./re.Shit" -> "bereshit" with the stressed syllable kept readable. */
export function displayTranslit(translit: string) {
  return translit.replace(/[./]/g, '').toLowerCase();
}
