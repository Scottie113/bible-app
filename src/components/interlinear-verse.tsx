import { memo } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { displayGloss, displayOriginal, displayTranslit, type OriginalLanguage, type Word } from '@/bible/original';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

export const ORIGINAL_FONT = Platform.select({
  web: "'SBL BibLit', 'SBL Hebrew', 'Ezra SIL', 'Gentium Plus', 'Times New Roman', serif",
  default: undefined,
});

export type InterlinearOptions = {
  showTranslit: boolean;
  /** Which meaning to show under each word. */
  meaning: 'english' | 'spanish' | 'none';
};

type Props = {
  words: Word[];
  language: OriginalLanguage;
  options: InterlinearOptions;
  selectedIndex?: number;
  onPressWord: (word: Word) => void;
};

/**
 * One verse in Hebrew or Greek, word by word. Each word is a small stack:
 * original word, pronunciation, meaning. Hebrew reads right to left.
 */
export const InterlinearVerse = memo(function InterlinearVerse({
  words,
  language,
  options,
  selectedIndex,
  onPressWord,
}: Props) {
  if (!words.length) {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        (This verse is not in the {language === 'hebrew' ? 'Hebrew' : 'Greek'} text used here.)
      </ThemedText>
    );
  }
  return (
    <View style={[styles.words, language === 'hebrew' && styles.rtl]}>
      {words.map((w) => {
        const meaning =
          options.meaning === 'english'
            ? displayGloss(w.gloss)
            : options.meaning === 'spanish'
              ? (w.spanish ?? displayGloss(w.gloss))
              : '';
        return (
          <Pressable
            key={w.index}
            onPress={() => onPressWord(w)}
            accessibilityRole="button"
            accessibilityLabel={`${displayOriginal(w.text)}, ${displayTranslit(w.translit)}, ${displayGloss(w.gloss)}`}
            style={({ pressed }) => pressed && styles.pressed}>
            <ThemedView
              type={selectedIndex === w.index ? 'backgroundSelected' : 'background'}
              style={[styles.word, w.variant && styles.variant]}>
              <ThemedText
                style={[styles.original, language === 'hebrew' ? styles.hebrew : styles.greek]}
                accessibilityLanguage={language === 'hebrew' ? 'he' : 'grc'}>
                {displayOriginal(w.text)}
              </ThemedText>
              {options.showTranslit && (
                <ThemedText type="small" themeColor="textSecondary" style={styles.translit}>
                  {displayTranslit(w.translit)}
                </ThemedText>
              )}
              {!!meaning && (
                <ThemedText type="small" style={styles.meaning}>
                  {meaning}
                </ThemedText>
              )}
            </ThemedView>
          </Pressable>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  words: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  rtl: { flexDirection: 'row-reverse' },
  word: {
    alignItems: 'center',
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
    maxWidth: 160,
  },
  variant: { opacity: 0.55, borderWidth: 1, borderStyle: 'dashed', borderColor: '#999' },
  original: { fontFamily: ORIGINAL_FONT, fontWeight: 400 },
  hebrew: { fontSize: 26, lineHeight: 40 },
  greek: { fontSize: 21, lineHeight: 30 },
  translit: { fontStyle: 'italic', fontSize: 12, lineHeight: 16 },
  meaning: { fontSize: 13, lineHeight: 17, textAlign: 'center' },
  pressed: { opacity: 0.6 },
});
