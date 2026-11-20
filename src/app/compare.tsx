import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { getBook } from '@/bible/books';
import { LANGUAGE_LABEL, languageOf, useOriginalChapter, type Word } from '@/bible/original';
import { useReadingLocation } from '@/bible/reading-location';
import { useChapters } from '@/bible/source';
import { getTranslation } from '@/bible/translations';
import { formatRef } from '@/bible/verse-id';
import { ChapterHeader } from '@/components/chapter-header';
import { InterlinearVerse, type InterlinearOptions } from '@/components/interlinear-verse';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TranslationChips } from '@/components/translation-chips';
import { useVerseScroll } from '@/components/use-verse-scroll';
import { WordSheet } from '@/components/word-sheet';
import { Fonts, Spacing } from '@/constants/theme';

/**
 * Original-language view: each verse in the Hebrew (Old Testament) or Greek
 * (New Testament) it was written in, word by word, with the chosen modern
 * translations underneath. Tap a word to see what it means and why it was
 * translated that way.
 */
export default function OriginalScreen() {
  const { book, chapter, compare, toggleCompare, show } = useReadingLocation();
  const language = languageOf(book);
  const original = useOriginalChapter(book, chapter);
  const translations = useChapters(compare, book, chapter);
  const [options, setOptions] = useState<InterlinearOptions>({ showTranslit: true, meaning: 'english' });
  const [picked, setPicked] = useState<{ verse: number; word: Word } | null>(null);
  const { scrollRef, focused: highlight, onListLayout, onVerseLayout } = useVerseScroll();

  const onPressWord = useCallback((verse: number, word: Word) => setPicked({ verse, word }), []);

  const loaded = original.verses && compare.every((id) => translations[id]);
  const verseCount = Math.max(
    original.verses?.length ?? 0,
    ...compare.map((id) => translations[id]?.verses?.length ?? 0),
  );

  return (
    <Screen ref={scrollRef}>
      <ChapterHeader />

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
        <View style={styles.verses} onLayout={onListLayout}>
          {Array.from({ length: verseCount }, (_, i) => i + 1).map((verse) => (
            <ThemedView
              key={`${book}:${chapter}:${verse}`}
              type={highlight === verse ? 'backgroundSelected' : 'backgroundElement'}
              style={styles.verse}
              onLayout={(e) => onVerseLayout(verse, e)}>
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
                  <ThemedText key={id} style={styles.translation} accessibilityLanguage={t.language}>
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
        onGoToVerse={show}
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
