import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { useAccount, useStoreState } from '@/sync/account';

import { BOOKS, getBook } from './books';
import { DEFAULT_TRANSLATION, TRANSLATIONS } from './translations';
import type { VerseRef } from './verse-id';

/**
 * Where the reader is (book + chapter) and which translations are chosen.
 * Shared by all tabs so switching tabs keeps your place, and synced to the
 * signed-in account so another device opens where you left off.
 */
type ReadingLocation = {
  book: number;
  chapter: number;
  translation: string;
  compare: string[];
  /** A verse a screen should scroll to and highlight; `key` changes on every request. */
  focus: { verse: number; key: number } | null;
  goTo: (book: number, chapter: number) => void;
  /** Go to a chapter and scroll to a verse (verse 0 = top of chapter). */
  show: (ref: VerseRef) => void;
  next: () => void;
  previous: () => void;
  setTranslation: (id: string) => void;
  toggleCompare: (id: string) => void;
  /** Replace the list of translations shown under the Hebrew/Greek. */
  setCompareList: (ids: string[]) => void;
};

const Context = createContext<ReadingLocation | null>(null);

export function ReadingLocationProvider({ children }: { children: ReactNode }) {
  const [place, setPlace] = useState({ book: 43, chapter: 1 }); // John 1
  const [translation, setTranslationState] = useState(DEFAULT_TRANSLATION);
  // Translations shown under the Hebrew/Greek on the Original tab.
  const [compare, setCompare] = useState<string[]>([DEFAULT_TRANSLATION]);
  const [focus, setFocus] = useState<ReadingLocation['focus']>(null);
  /** True once the person has moved somewhere themselves (so the default "John 1" never overwrites a synced place). */
  const touched = useRef(false);

  const { store } = useAccount();
  const { reading, lastPulled } = useStoreState();

  // Another device (or the first sync) moved the reading place: follow it.
  // (Adjusting state while rendering when an input changes, as React recommends, instead of in an effect.)
  const [seenReading, setSeenReading] = useState(reading);
  if (reading !== seenReading) {
    setSeenReading(reading);
    if (reading) {
      if (place.book !== reading.book || place.chapter !== reading.chapter) {
        setPlace({ book: reading.book, chapter: reading.chapter });
      }
      if (TRANSLATIONS.some((x) => x.id === reading.translation)) setTranslationState(reading.translation);
      if (compare.join() !== reading.compare.join()) {
        setCompare(reading.compare.filter((id) => TRANSLATIONS.some((t) => t.id === id)));
      }
    }
  }

  // This device moved: save it (after the first sync, so we don't overwrite a newer place from elsewhere).
  useEffect(() => {
    if (!store || !touched.current || lastPulled === null) return;
    const timer = setTimeout(() => store.setReading({ ...place, translation, compare }), 800);
    return () => clearTimeout(timer);
  }, [store, place, translation, compare, lastPulled]);

  const value = useMemo<ReadingLocation>(() => {
    const goTo = (book: number, chapter: number) => {
      touched.current = true;
      setPlace({ book, chapter: Math.min(Math.max(chapter, 1), getBook(book).chapters) });
    };
    return {
      ...place,
      translation,
      compare,
      focus,
      goTo,
      show: (ref) => {
        goTo(ref.book, ref.chapter);
        setFocus((f) => ({ verse: ref.verse, key: (f?.key ?? 0) + 1 }));
      },
      next: () => {
        const book = getBook(place.book);
        if (place.chapter < book.chapters) goTo(place.book, place.chapter + 1);
        else if (place.book < BOOKS.length) goTo(place.book + 1, 1);
      },
      previous: () => {
        if (place.chapter > 1) goTo(place.book, place.chapter - 1);
        else if (place.book > 1) goTo(place.book - 1, getBook(place.book - 1).chapters);
      },
      setTranslation: (id) => {
        touched.current = true;
        setTranslationState(id);
      },
      setCompareList: (ids) => {
        touched.current = true;
        setCompare(TRANSLATIONS.map((t) => t.id).filter((x) => ids.includes(x)));
      },
      toggleCompare: (id) => {
        touched.current = true;
        setCompare((current) => {
          // Turning every translation off is allowed: then only the Hebrew/Greek shows.
          if (current.includes(id)) return current.filter((x) => x !== id);
          // keep the same order as TRANSLATIONS
          return TRANSLATIONS.map((t) => t.id).filter((x) => x === id || current.includes(x));
        });
      },
    };
  }, [place, translation, compare, focus]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useReadingLocation(): ReadingLocation {
  const value = useContext(Context);
  if (!value) throw new Error('useReadingLocation must be used inside ReadingLocationProvider');
  return value;
}
