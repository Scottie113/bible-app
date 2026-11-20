import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type ScrollViewInstance } from 'react-native';

import { getBook } from '@/bible/books';
import { LANGUAGE_LABEL, languageOf, useOriginalChapter, type Word } from '@/bible/original';
import { useReadingLocation } from '@/bible/reading-location';
import { useChapters } from '@/bible/source';
import { getTranslation } from '@/bible/translations';
import { formatRef, type VerseRef } from '@/bible/verse-id';
import { ChapterHeader } from '@/components/chapter-header';
import { InterlinearVerse, type InterlinearOptions } from '@/components/interlinear-verse';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TranslationChips } from '@/components/translation-chips';
import { WordSheet } from '@/components/word-sheet';
import { Fonts, Spacing } from '@/constants/theme';

/**
 * Original-language view: each verse in the Hebrew (Old Testament) or Greek
 * (New Testament) it was written in, word by word, with the chosen modern
 * translations underneath. Tap a word to see what it means and why it was
 * translated that way.
 */
export default function OriginalScreen() {
  const { book, chapter, compare, toggleCompare, goTo } = useReadingLocation();
  const language = languageOf(book);
  const original = useOriginalChapter(book, chapter);
  const translations = useChapters(compare, book, chapter);
  const [options, setOptions] = useState<InterlinearOptions>({ showTranslit: true, meaning: 'english' });
  const [picked, setPicked] = useState<{ verse: number; word: Word } | null>(null);

  const scrollRef = useRef<ScrollViewInstance>(null);
  const listY = useRef(0);
  const verseY = useRef(new Map<number, number>());
  const pendingJump = useRef<number | null>(null);
  const [highlight, setHighlight] = useState<number | null>(null);

  useEffect(() => {
    verseY.current.clear();
    if (pendingJump.current == null) {
      setHighlight(null);
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
    setHighlight(ref.verse);
    pendingJump.current = ref.verse;
    if (ref.book === book && ref.chapter === chapter && scrollToVerse(ref.verse)) pendingJump.current = null;
  };

  const onPressWord = useCallback((verse: number, word: Word) => setPicked({ verse, word }), []);

  const loaded = original.verses && compare.every((id) => translations[id]);
  const verseCount = Math.max(
    original.verses?.length ?? 0,
    ...compare.map((id) => translations[id]?.verses?.length ?? 0),
  );

  return (
    <Screen ref={scrollRef}>
      <ChapterHeader onJumpToVerse={jumpTo} />

      <View style={styles.controls}>
        <ThemedText type="small" themeColor="textSecondary">
          Compare the {LANGUAGE_LABEL[language]} with:
        </ThemedText>
        <TranslationChips selected={compare} onPress={toggleCompare} />
        <View style={styles.toggles}>
          <Toggle
            label="Pronunciation"
            on={options.showTranslit}
            onPress={() => setOptions({ ...options, showTranslit: !options.showTranslit })}
          />
          <Toggle
            label="English meaning"
            on={options.meaning === 'english'}
            onPress={() => setOptions({ ...options, meaning: options.meaning === 'english' ? 'none' : 'english' })}
          />
          {language === 'greek' && (
            <Toggle
              label="Significado en español"
              on={options.meaning === 'spanish'}
              onPress={() => setOptions({ ...options, meaning: options.meaning === 'spanish' ? 'none' : 'spanish' })}
            />
          )}
        </View>
      </View>

      <ThemedText type="subtitle" style={styles.heading}>
        {getBook(book).name} {chapter}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {language === 'hebrew'
          ? 'Hebrew text: Leningrad Codex (reads right to left). Tap any word for its meaning.'
          : 'Greek text: Nestle-Aland, with Textus Receptus (KJV) words shown dashed. Tap any word for its meaning.'}
      </ThemedText>

      {original.error ? (
        <ThemedText themeColor="textSecondary">Couldn’t load the {LANGUAGE_LABEL[language]}: {original.error.message}</ThemedText>
      ) : !loaded ? (
        <ActivityIndicator style={styles.loading} />
      ) : (
        <View style={styles.verses} onLayout={(e) => (listY.current = e.nativeEvent.layout.y)}>
          {Array.from({ length: verseCount }, (_, i) => i + 1).map((verse) => (
            <ThemedView
              key={`${book}:${chapter}:${verse}`}
              type={highlight === verse ? 'backgroundSelected' : 'backgroundElement'}
              style={styles.verse}
              onLayout={(e) => {
                verseY.current.set(verse, e.nativeEvent.layout.y);
                if (pendingJump.current === verse && scrollToVerse(verse)) pendingJump.current = null;
              }}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                {formatRef({ book, chapter, verse })}
              </ThemedText>

              <InterlinearVerse
                words={original.verses?.[verse - 1] ?? []}
                language={language}
                options={options}
                selectedIndex={picked?.verse === verse ? picked.word.index : undefined}
                onPressWord={(w) => onPressWord(verse, w)}
              />

              {compare.map((id) => {
                const state = translations[id];
                const text = state?.error ? `Couldn’t load: ${state.error.message}` : state?.verses?.[verse - 1]?.text;
                const t = getTranslation(id);
                return (
                  <ThemedText key={id} style={styles.translation} lang={t.language}>
                    <ThemedText type="smallBold" themeColor="textSecondary">
                      {t.abbreviation}
                      {'  '}
                    </ThemedText>
                    {text || <ThemedText themeColor="textSecondary">—</ThemedText>}
                  </ThemedText>
                );
              })}
            </ThemedView>
          ))}
        </View>
      )}

      <WordSheet
        word={picked?.word ?? null}
        language={language}
        verseRef={picked ? { book, chapter, verse: picked.verse } : null}
        onClose={() => setPicked(null)}
        onGoToVerse={(ref) => {
          jumpTo(ref);
          goTo(ref.book, ref.chapter);
        }}
      />
    </Screen>
  );
}

function Toggle({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView type={on ? 'backgroundSelected' : 'backgroundElement'} style={styles.toggle}>
        <ThemedText type="small" themeColor={on ? 'text' : 'textSecondary'}>
          {on ? '✓ ' : ''}
          {label}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  controls: { gap: Spacing.two },
  toggles: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  toggle: { paddingVertical: Spacing.one, paddingHorizontal: Spacing.three, borderRadius: Spacing.three },
  heading: { fontFamily: Fonts.serif },
  loading: { marginTop: Spacing.five },
  verses: { gap: Spacing.three },
  verse: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two },
  translation: { fontFamily: Fonts.serif, fontSize: 17, lineHeight: 27, fontWeight: 400 },
  pressed: { opacity: 0.6 },
});
