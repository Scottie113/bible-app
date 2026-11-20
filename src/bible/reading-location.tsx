import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { BOOKS, getBook } from './books';
import { DEFAULT_TRANSLATION, TRANSLATIONS } from './translations';

/**
 * Where the reader is (book + chapter) and which translations are chosen.
 * Shared by the Read and Compare tabs so switching tabs keeps your place.
 * (Saved per user and synced across devices in step 2.)
 */
type ReadingLocation = {
  book: number;
  chapter: number;
  translation: string;
  compare: string[];
  goTo: (book: number, chapter: number) => void;
  next: () => void;
  previous: () => void;
  setTranslation: (id: string) => void;
  toggleCompare: (id: string) => void;
};

const Context = createContext<ReadingLocation | null>(null);

export function ReadingLocationProvider({ children }: { children: ReactNode }) {
  const [place, setPlace] = useState({ book: 43, chapter: 1 }); // John 1
  const [translation, setTranslation] = useState(DEFAULT_TRANSLATION);
  // Translations shown under the Hebrew/Greek on the Original tab.
  const [compare, setCompare] = useState<string[]>([DEFAULT_TRANSLATION]);

  const value = useMemo<ReadingLocation>(() => {
    const goTo = (book: number, chapter: number) =>
      setPlace({ book, chapter: Math.min(Math.max(chapter, 1), getBook(book).chapters) });
    return {
      ...place,
      translation,
      compare,
      goTo,
      next: () => {
        const book = getBook(place.book);
        if (place.chapter < book.chapters) goTo(place.book, place.chapter + 1);
        else if (place.book < BOOKS.length) goTo(place.book + 1, 1);
      },
      previous: () => {
        if (place.chapter > 1) goTo(place.book, place.chapter - 1);
        else if (place.book > 1) goTo(place.book - 1, getBook(place.book - 1).chapters);
      },
      setTranslation,
      toggleCompare: (id) =>
        setCompare((current) => {
          // Turning every translation off is allowed: then only the Hebrew/Greek shows.
          if (current.includes(id)) return current.filter((x) => x !== id);
          // keep the same order as TRANSLATIONS
          return TRANSLATIONS.map((t) => t.id).filter((x) => x === id || current.includes(x));
        }),
    };
  }, [place, translation, compare]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useReadingLocation(): ReadingLocation {
  const value = useContext(Context);
  if (!value) throw new Error('useReadingLocation must be used inside ReadingLocationProvider');
  return value;
}
