import { useEffect, useState } from 'react';

import lexiconLoaders from '@/data/lexicon';
import meaningLoaders, { type MeaningBook } from '@/data/meanings';
import originalLoaders from '@/data/original';

/**
 * Language for the meaning shown under each Hebrew/Greek word (one at a time).
 * English is STEPBible's word-by-word gloss. The others are the word(s) a
 * public-domain translation used for that word in that verse, found through
 * the translation's Strong's-number tags (scripts/import-meanings.mjs).
 */
export type MeaningLanguage = 'en' | 'es' | 'zh-Hans' | 'zh-Hant' | 'fr' | 'none';

export const MEANING_LANGUAGES: { id: MeaningLanguage; label: string; detail: string }[] = [
  { id: 'en', label: 'English', detail: 'Word-by-word meaning (STEPBible)' },
  { id: 'es', label: 'Español', detail: 'New Testament: STEPBible · Old Testament: Reina-Valera 1909' },
  { id: 'zh-Hans', label: '中文 (简体)', detail: '和合本 — how the Chinese Union Version translated each word' },
  { id: 'zh-Hant', label: '中文 (繁體)', detail: '和合本 — 和合本如何翻譯每個字' },
  { id: 'fr', label: 'Français', detail: 'Bible J.N. Darby — comment chaque mot a été traduit' },
  { id: 'none', label: 'No meaning', detail: 'Only the Hebrew/Greek (and pronunciation)' },
];

const meaningCache = new Map<string, Promise<MeaningBook>>();

/** Meanings for one chapter in one language: result[v-1][wordIndex]. English uses the words' own gloss. */
export function useMeanings(language: MeaningLanguage, book: number, chapter: number) {
  const key = `${language}:${book}:${chapter}`;
  const [state, setState] = useState<{ key: string; meanings?: string[][] }>({ key: '' });
  useEffect(() => {
    const loader = meaningLoaders[language]?.[book];
    if (!loader) return;
    let cancelled = false;
    const cacheKey = `${language}:${book}`;
    let promise = meaningCache.get(cacheKey);
    if (!promise) {
      promise = loader();
      promise.catch(() => meaningCache.delete(cacheKey));
      meaningCache.set(cacheKey, promise);
    }
    promise.then(
      (data) => !cancelled && setState({ key, meanings: data[chapter - 1] ?? [] }),
      () => !cancelled && setState({ key, meanings: [] }),
    );
    return () => {
      cancelled = true;
    };
  }, [language, book, chapter, key]);
  return state.key === key ? state.meanings : undefined;
}

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
