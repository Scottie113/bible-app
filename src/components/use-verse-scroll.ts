import { useCallback, useEffect, useRef, useState } from 'react';
import type { LayoutChangeEvent, ScrollViewInstance } from 'react-native';

import { useReadingLocation } from '@/bible/reading-location';
import { Spacing } from '@/constants/theme';

/**
 * Scrolls a chapter screen to the verse requested with `show(ref)` (from the
 * "go to" box, a note link, a word's "where else" list…) and highlights it.
 * Verse positions are remembered per chapter, so a jump to another chapter
 * waits until that chapter has been laid out.
 */
export function useVerseScroll() {
  const { book, chapter, focus } = useReadingLocation();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const listY = useRef(0);
  const positions = useRef(new Map<string, number>());
  const pending = useRef<number | null>(null);
  const chapterKey = `${book}:${chapter}`;

  // Which verse is highlighted: the one just jumped to, or the one tapped.
  // A new jump sets it; moving to another chapter some other way clears it.
  // (Starts from the current request too, for a screen opened by the jump itself.)
  const [focused, setFocused] = useState<number | null>(focus?.verse || null);
  const [seen, setSeen] = useState({ focus, chapterKey });
  if (seen.focus !== focus || seen.chapterKey !== chapterKey) {
    setSeen({ focus, chapterKey });
    setFocused(seen.focus !== focus ? focus?.verse || null : null);
  }

  const scrollTo = useCallback(
    (verse: number) => {
      const y = positions.current.get(`${chapterKey}:${verse}`);
      if (y == null) return false;
      scrollRef.current?.scrollTo({ y: Math.max(listY.current + y - Spacing.six, 0), animated: true });
      return true;
    },
    [chapterKey],
  );

  // Declared before the chapter effect so a jump into a new chapter is known first.
  // The jump stays "pending" for a moment: if the screen was hidden (another tab was
  // showing) its verse positions are re-measured as it appears, and each new
  // measurement re-scrolls to the right place.
  useEffect(() => {
    if (!focus) return;
    pending.current = focus.verse || null;
    if (pending.current) scrollTo(pending.current);
    const settle = setTimeout(() => (pending.current = null), 1200);
    return () => clearTimeout(settle);
    // Only re-run for a new request, not when scrollTo changes with the chapter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  useEffect(() => {
    if (pending.current == null) scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [chapterKey]);

  const onListLayout = useCallback(
    (e: LayoutChangeEvent) => {
      listY.current = e.nativeEvent.layout.y;
      if (pending.current) scrollTo(pending.current);
    },
    [scrollTo],
  );

  const onVerseLayout = useCallback(
    (verse: number, e: LayoutChangeEvent) => {
      positions.current.set(`${chapterKey}:${verse}`, e.nativeEvent.layout.y);
      if (pending.current === verse) scrollTo(verse);
    },
    [chapterKey, scrollTo],
  );

  return { scrollRef, focused, setFocused, onListLayout, onVerseLayout };
}
