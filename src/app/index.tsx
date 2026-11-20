import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type ScrollViewInstance } from 'react-native';

import { getBook } from '@/bible/books';
import { useReadingLocation } from '@/bible/reading-location';
import { useChapter } from '@/bible/source';
import { getTranslation } from '@/bible/translations';
import { formatRef, type VerseRef } from '@/bible/verse-id';
import { ChapterHeader } from '@/components/chapter-header';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TranslationChips } from '@/components/translation-chips';
import { Fonts, Spacing } from '@/constants/theme';

export default function ReadScreen() {
  const { book, chapter, translation, setTranslation } = useReadingLocation();
  const { verses, error } = useChapter(translation, book, chapter);
  const [selected, setSelected] = useState<number | null>(null);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const listY = useRef(0);
  const verseY = useRef(new Map<number, number>());
  const pendingJump = useRef<number | null>(null);

  // New chapter: clear the selection and go back to the top (unless jumping to a verse).
  useEffect(() => {
    verseY.current.clear();
    if (pendingJump.current == null) {
      setSelected(null);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }
  }, [book, chapter]);

  const scrollToVerse = (verse: number) => {
    const y = verseY.current.get(verse);
    if (y == null) return false;
    scrollRef.current?.scrollTo({ y: Math.max(listY.current + y - Spacing.five, 0), animated: true });
    return true;
  };

  const jumpTo = (ref: VerseRef) => {
    setSelected(ref.verse);
    pendingJump.current = ref.verse;
    // Same chapter: positions are already known. New chapter: onLayout below finishes the jump.
    const sameChapter = ref.book === book && ref.chapter === chapter;
    if (sameChapter && verses && scrollToVerse(ref.verse)) pendingJump.current = null;
  };

  return (
    <Screen ref={scrollRef}>
      <ChapterHeader onJumpToVerse={jumpTo} />
      <TranslationChips selected={[translation]} onPress={setTranslation} />

      <ThemedText type="subtitle" style={styles.heading}>
        {getBook(book).name} {chapter}
      </ThemedText>

      {error ? (
        <ThemedText themeColor="textSecondary">Couldn’t load this chapter: {error.message}</ThemedText>
      ) : !verses ? (
        <ActivityIndicator style={styles.loading} />
      ) : (
        <View onLayout={(e) => (listY.current = e.nativeEvent.layout.y)}>
          {verses.map((v) => (
            <Pressable
              key={v.id}
              onPress={() => setSelected(selected === v.verse ? null : v.verse)}
              accessibilityLabel={formatRef({ book, chapter, verse: v.verse })}
              onLayout={(e) => {
                verseY.current.set(v.verse, e.nativeEvent.layout.y);
                if (pendingJump.current === v.verse && scrollToVerse(v.verse)) pendingJump.current = null;
              }}>
              <ThemedView type={selected === v.verse ? 'backgroundSelected' : 'background'} style={styles.verse}>
                <ThemedText style={styles.verseText}>
                  <ThemedText type="smallBold" themeColor="textSecondary" style={styles.number}>
                    {v.verse}{' '}
                  </ThemedText>
                  {v.text || <ThemedText themeColor="textSecondary">(not in this translation’s text)</ThemedText>}
                </ThemedText>
              </ThemedView>
            </Pressable>
          ))}
        </View>
      )}

      {selected != null && (
        <ThemedText type="small" themeColor="textSecondary">
          Selected: {formatRef({ book, chapter, verse: selected })} ({getTranslation(translation).abbreviation})
        </ThemedText>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontFamily: Fonts.serif },
  loading: { marginTop: Spacing.five },
  verse: { paddingVertical: Spacing.one, paddingHorizontal: Spacing.two, borderRadius: Spacing.one },
  verseText: { fontFamily: Fonts.serif, fontSize: 18, lineHeight: 30, fontWeight: 400 },
  number: { fontSize: 12 },
});
