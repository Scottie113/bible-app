import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { getBook } from '@/bible/books';
import {
  LANGUAGE_LABEL,
  MEANING_LANGUAGES,
  languageOf,
  useMeanings,
  useOriginalChapter,
  type MeaningLanguage,
  type Word,
} from '@/bible/original';
import { useReadingLocation } from '@/bible/reading-location';
import { useChapters } from '@/bible/source';
import { getTranslation, TRANSLATIONS } from '@/bible/translations';
import { formatRef } from '@/bible/verse-id';
import { ChapterHeader } from '@/components/chapter-header';
import { InterlinearVerse, type InterlinearOptions } from '@/components/interlinear-verse';
import { PickerSheet } from '@/components/picker-sheet';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useVerseScroll } from '@/components/use-verse-scroll';
import { WordSheet } from '@/components/word-sheet';
import { Accent, Fonts, Spacing } from '@/constants/theme';

/**
 * Original-language view: each verse in the Hebrew (Old Testament) or Greek
 * (New Testament) it was written in, word by word, with the chosen modern
 * translations underneath. Tap a word to see what it means and why it was
 * translated that way.
 */
export default function OriginalScreen() {
  const { book, chapter, compare, setCompareList, show } = useReadingLocation();
  const language = languageOf(book);
  const original = useOriginalChapter(book, chapter);
  const translations = useChapters(compare, book, chapter);
  const [options, setOptions] = useState<InterlinearOptions>({ showTranslit: true, meaning: 'en' });
  const meanings = useMeanings(options.meaning, book, chapter);
  const [picker, setPicker] = useState<'versions' | 'meaning' | null>(null);
  const meaningLabel = MEANING_LANGUAGES.find((m) => m.id === options.meaning)?.label ?? 'English';
  const [picked, setPicked] = useState<{ verse: number; word: Word } | null>(null);
  const { scrollRef, focused: highlight, onListLayout, onVerseLayout } = useVerseScroll();

  const onPressWord = useCallback((verse: number, word: Word) => setPicked({ verse, word }), []);

  const loaded =
    original.verses && compare.every((id) => translations[id]) && (options.meaning === 'en' || options.meaning === 'none' || meanings);
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
        <View style={styles.row}>
          <PickerButton label="Versions" onPress={() => setPicker('versions')} />
          {compare.length ? (
            compare.map((id) => <Chip key={id} label={getTranslation(id).abbreviation} />)
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              None — only the {LANGUAGE_LABEL[language]}
            </ThemedText>
          )}
        </View>
        <View style={styles.row}>
          <PickerButton label="Meaning" onPress={() => setPicker('meaning')} />
          <Chip label={meaningLabel} />
          <Toggle
            label="Pronunciation"
            on={options.showTranslit}
            onPress={() => setOptions({ ...options, showTranslit: !options.showTranslit })}
          />
        </View>
      </View>

      <PickerSheet
        visible={picker === 'versions'}
        title="Versions to compare"
        hint={`Shown under each verse, below the ${LANGUAGE_LABEL[language]}. Pick as many as you like.`}
        mode="many"
        options={TRANSLATIONS.map((t) => ({ id: t.id, label: t.name, detail: `Shown as “${t.abbreviation}”` }))}
        selected={compare}
        onChange={setCompareList}
        onClose={() => setPicker(null)}
      />
      <PickerSheet
        visible={picker === 'meaning'}
        title="Meaning under each word"
        hint="One language at a time. Except English, it shows the word(s) that Bible used for each Hebrew/Greek word; · means it has no word for it."
        mode="one"
        options={MEANING_LANGUAGES}
        selected={[options.meaning]}
        onChange={([id]) => setOptions({ ...options, meaning: id as MeaningLanguage })}
        onClose={() => setPicker(null)}
      />

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
                meanings={meanings?.[verse - 1]}
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
        meaning={
          picked && options.meaning !== 'en' && options.meaning !== 'none'
            ? { label: meaningLabel, text: meanings?.[picked.verse - 1]?.[picked.word.index] ?? '' }
            : null
        }
        verseRef={picked ? { book, chapter, verse: picked.verse } : null}
        onClose={() => setPicked(null)}
        onGoToVerse={show}
      />
    </Screen>
  );
}

/** Opens a picker window: "Versions ▾". */
function PickerButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => pressed && styles.pressed}>
      <View style={styles.pickerButton}>
        <ThemedText type="smallBold" style={styles.pickerButtonText}>
          {label} ▾
        </ThemedText>
      </View>
    </Pressable>
  );
}

/** Shows something that is selected (not a button). */
function Chip({ label }: { label: string }) {
  return (
    <ThemedView type="backgroundSelected" style={styles.toggle}>
      <ThemedText type="smallBold">{label}</ThemedText>
    </ThemedView>
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
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.two },
  pickerButton: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: Accent,
  },
  pickerButtonText: { color: Accent },
  toggle: { paddingVertical: Spacing.one, paddingHorizontal: Spacing.three, borderRadius: Spacing.three },
  heading: { fontFamily: Fonts.serif },
  loading: { marginTop: Spacing.five },
  verses: { gap: Spacing.three },
  verse: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two },
  translation: { fontFamily: Fonts.serif, fontSize: 17, lineHeight: 27, fontWeight: 400 },
  pressed: { opacity: 0.6 },
});
