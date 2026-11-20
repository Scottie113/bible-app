import { useEffect, useState } from 'react';

import { getTranslation } from './translations';
import type { BookText, Verse } from './types';
import { toVerseId } from './verse-id';

/**
 * The one place the app reads Bible text from. Screens never touch the data
 * files directly, so the storage can later move to downloadable SQLite files
 * without changing any screen.
 */
const cache = new Map<string, Promise<BookText>>();

function loadBook(translationId: string, book: number): Promise<BookText> {
  const key = `${translationId}:${book}`;
  let promise = cache.get(key);
  if (!promise) {
    const loader = getTranslation(translationId).load[book];
    if (!loader) return Promise.reject(new Error(`No book ${book} in ${translationId}`));
    promise = loader();
    promise.catch(() => cache.delete(key));
    cache.set(key, promise);
  }
  return promise;
}

export async function getChapter(translationId: string, book: number, chapter: number): Promise<Verse[]> {
  const text = await loadBook(translationId, book);
  return (text[chapter - 1] ?? []).map((t, i) => ({
    id: toVerseId({ book, chapter, verse: i + 1 }),
    verse: i + 1,
    text: t,
  }));
}

type ChapterState = { verses: Verse[] | undefined; error: Error | undefined };

/** Load one chapter of one translation for a screen. */
export function useChapter(translationId: string, book: number, chapter: number) {
  return useChapters([translationId], book, chapter)[translationId] ?? { verses: undefined, error: undefined };
}

/** Load the same chapter in several translations (for the compare view). */
export function useChapters(translationIds: string[], book: number, chapter: number) {
  const key = translationIds.join(',');
  const [state, setState] = useState<{ key: string; byId: Record<string, ChapterState> }>({ key: '', byId: {} });
  const requestKey = `${key}|${book}|${chapter}`;

  useEffect(() => {
    let cancelled = false;
    const ids = key ? key.split(',') : [];
    Promise.all(
      ids.map((id) =>
        getChapter(id, book, chapter).then(
          (verses): [string, ChapterState] => [id, { verses, error: undefined }],
          (error: Error): [string, ChapterState] => [id, { verses: undefined, error }],
        ),
      ),
    ).then((entries) => {
      if (!cancelled) setState({ key: requestKey, byId: Object.fromEntries(entries) });
    });
    return () => {
      cancelled = true;
    };
  }, [key, book, chapter, requestKey]);

  return state.key === requestKey ? state.byId : {};
}
