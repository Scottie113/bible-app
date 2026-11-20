import { ActivityIndicator, StyleSheet, useWindowDimensions, View } from 'react-native';

import { getBook } from '@/bible/books';
import { useReadingLocation } from '@/bible/reading-location';
import { useChapters } from '@/bible/source';
import { getTranslation } from '@/bible/translations';
import { ChapterHeader } from '@/components/chapter-header';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TranslationChips } from '@/components/translation-chips';
import { Fonts, Spacing } from '@/constants/theme';

/**
 * Parallel view: the same chapter in several translations, lined up verse by
 * verse. Side-by-side columns on wide screens, stacked on phones.
 */
export default function CompareScreen() {
  const { book, chapter, compare, toggleCompare } = useReadingLocation();
  const byId = useChapters(compare, book, chapter);
  const { width } = useWindowDimensions();
  const columns = width >= 700 && compare.length > 1;

  const loaded = compare.every((id) => byId[id]);
  // Verse numbers can differ between translations, so line up on the union of them.
  const verseCount = Math.max(0, ...compare.map((id) => byId[id]?.verses?.length ?? 0));

  return (
    <Screen wide={columns}>
      <ChapterHeader />
      <TranslationChips selected={compare} onPress={toggleCompare} />

      <ThemedText type="subtitle" style={styles.heading}>
        {getBook(book).name} {chapter}
      </ThemedText>

      {!loaded ? (
        <ActivityIndicator style={styles.loading} />
      ) : (
        <View>
          {columns && (
            <View style={styles.row}>
              <View style={styles.number} />
              {compare.map((id) => (
                <ThemedText key={id} type="smallBold" themeColor="textSecondary" style={styles.cell}>
                  {getTranslation(id).name}
                </ThemedText>
              ))}
            </View>
          )}
          {Array.from({ length: verseCount }, (_, i) => i + 1).map((verse) => (
            <ThemedView
              key={verse}
              type={verse % 2 ? 'background' : 'backgroundElement'}
              style={[styles.row, !columns && styles.stacked]}>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.number}>
                {verse}
              </ThemedText>
              <View style={columns ? styles.columns : styles.stackedTexts}>
                {compare.map((id) => {
                  const state = byId[id];
                  const text = state?.error ? `Couldn’t load: ${state.error.message}` : state?.verses?.[verse - 1]?.text;
                  return (
                    <View key={id} style={columns ? styles.cell : undefined}>
                      <ThemedText style={styles.text}>
                        {!columns && (
                          <ThemedText type="smallBold" themeColor="textSecondary">
                            {getTranslation(id).abbreviation}{'  '}
                          </ThemedText>
                        )}
                        {text || <ThemedText themeColor="textSecondary">—</ThemedText>}
                      </ThemedText>
                    </View>
                  );
                })}
              </View>
            </ThemedView>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontFamily: Fonts.serif },
  loading: { marginTop: Spacing.five },
  row: { flexDirection: 'row', gap: Spacing.three, paddingVertical: Spacing.two, paddingHorizontal: Spacing.two, borderRadius: Spacing.one },
  stacked: { alignItems: 'flex-start' },
  number: { width: 28, textAlign: 'right' },
  columns: { flex: 1, flexDirection: 'row', gap: Spacing.three },
  stackedTexts: { flex: 1, gap: Spacing.two },
  cell: { flex: 1 },
  text: { fontFamily: Fonts.serif, fontSize: 17, lineHeight: 27, fontWeight: 400 },
});
