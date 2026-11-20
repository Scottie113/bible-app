import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';

import { getBook } from '@/bible/books';
import { useReadingLocation } from '@/bible/reading-location';
import { useChapter } from '@/bible/source';
import { getTranslation } from '@/bible/translations';
import { toVerseId } from '@/bible/verse-id';
import { ChapterHeader } from '@/components/chapter-header';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TranslationChips } from '@/components/translation-chips';
import { useVerseScroll } from '@/components/use-verse-scroll';
import { VerseActions } from '@/components/verse-actions';
import { Fonts, HighlightColors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useStoreState } from '@/sync/account';
import type { Note } from '@/sync/types';

export default function ReadScreen() {
  const { book, chapter, translation, setTranslation } = useReadingLocation();
  const { verses, error } = useChapter(translation, book, chapter);
  const { scrollRef, focused, setFocused, onListLayout, onVerseLayout } = useVerseScroll();
  const { highlights, notes } = useStoreState();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [notesFor, setNotesFor] = useState<Note[] | null>(null);
  const router = useRouter();

  // Which notes mention each verse of this chapter (and the chapter as a whole).
  const chapterStart = toVerseId({ book, chapter, verse: 0 });
  const notesByVerse = useMemo(() => {
    const map = new Map<number, Note[]>();
    for (const note of Object.values(notes)) {
      if (note.deleted_at) continue;
      for (const id of note.verse_ids) {
        if (id < chapterStart || id >= chapterStart + 1000) continue;
        const list = map.get(id) ?? [];
        if (!list.includes(note)) list.push(note);
        map.set(id, list);
      }
    }
    return map;
  }, [notes, chapterStart]);
  const chapterNotes = notesByVerse.get(chapterStart);

  const selected = focused && verses?.[focused - 1];

  return (
    <Screen ref={scrollRef}>
      <ChapterHeader />
      <TranslationChips selected={[translation]} onPress={setTranslation} />

      <View style={styles.headingRow}>
        <ThemedText type="subtitle" style={styles.heading}>
          {getBook(book).name} {chapter}
        </ThemedText>
        {chapterNotes && <NoteMarker count={chapterNotes.length} onPress={() => setNotesFor(chapterNotes)} />}
      </View>

      {error ? (
        <ThemedText themeColor="textSecondary">Couldn’t load this chapter: {error.message}</ThemedText>
      ) : !verses ? (
        <ActivityIndicator style={styles.loading} />
      ) : (
        <View onLayout={onListLayout}>
          {verses.map((v) => {
            const highlight = highlights[v.id];
            const color = highlight && !highlight.deleted_at ? HighlightColors[scheme][highlight.color] : undefined;
            const verseNotes = notesByVerse.get(v.id);
            return (
              <View key={v.id} onLayout={(e) => onVerseLayout(v.verse, e)}>
                <Pressable onPress={() => setFocused(focused === v.verse ? null : v.verse)}>
                  <ThemedView
                    type={focused === v.verse ? 'backgroundSelected' : 'background'}
                    style={[styles.verse, color ? { backgroundColor: color } : null, focused === v.verse && styles.verseFocused]}>
                    <ThemedText style={styles.verseText}>
                      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.number}>
                        {v.verse}{' '}
                      </ThemedText>
                      {v.text || <ThemedText themeColor="textSecondary">(not in this translation’s text)</ThemedText>}
                      {verseNotes && (
                        <ThemedText
                          onPress={() => setNotesFor(verseNotes)}
                          accessibilityRole="button"
                          accessibilityLabel={`${verseNotes.length} note${verseNotes.length > 1 ? 's' : ''}`}
                          style={styles.inlineMarker}>
                          {'  '}📝{verseNotes.length > 1 ? verseNotes.length : ''}
                        </ThemedText>
                      )}
                    </ThemedText>
                  </ThemedView>
                </Pressable>
                {focused === v.verse && selected && (
                  <VerseActions
                    verseId={v.id}
                    quote={{ text: v.text, translation: getTranslation(translation).abbreviation }}
                    onClose={() => setFocused(null)}
                  />
                )}
              </View>
            );
          })}
        </View>
      )}

      <NotesList
        notes={notesFor}
        onClose={() => setNotesFor(null)}
        onOpen={(id) => {
          setNotesFor(null);
          router.push(`/notes/${id}`);
        }}
      />
    </Screen>
  );
}

function NoteMarker({ count, onPress }: { count: number; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${count} notes on this chapter`}>
      <ThemedView type="backgroundElement" style={styles.marker}>
        <ThemedText type="small">📝 {count}</ThemedText>
      </ThemedView>
    </Pressable>
  );
}

/** Small popup listing the notes that mention a verse. */
function NotesList({ notes, onClose, onOpen }: { notes: Note[] | null; onClose: () => void; onOpen: (id: string) => void }) {
  return (
    <Modal visible={!!notes} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <ThemedView style={styles.popup}>
        <ThemedText type="smallBold">Your notes on this</ThemedText>
        {notes?.map((n) => (
          <Pressable key={n.id} onPress={() => onOpen(n.id)} accessibilityRole="link">
            <ThemedView type="backgroundElement" style={styles.popupRow}>
              <ThemedText type="smallBold" numberOfLines={1}>
                {n.title || 'Untitled note'}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
                {n.body.trim()}
              </ThemedText>
            </ThemedView>
          </Pressable>
        ))}
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  heading: { fontFamily: Fonts.serif },
  loading: { marginTop: Spacing.five },
  verse: { paddingVertical: Spacing.one, paddingHorizontal: Spacing.two, borderRadius: Spacing.one },
  verseFocused: { borderWidth: 1, borderColor: '#3c87f7' },
  verseText: { fontFamily: Fonts.serif, fontSize: 18, lineHeight: 30, fontWeight: 400 },
  number: { fontSize: 12 },
  inlineMarker: { fontSize: 14 },
  marker: { paddingVertical: Spacing.one, paddingHorizontal: Spacing.two, borderRadius: Spacing.two },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.35)' },
  popup: {
    marginTop: 'auto',
    marginBottom: 'auto',
    marginHorizontal: Spacing.three,
    padding: Spacing.four,
    gap: Spacing.two,
    borderRadius: Spacing.four,
    width: '90%',
    maxWidth: MaxContentWidth / 1.5,
    alignSelf: 'center',
  },
  popupRow: { padding: Spacing.three, borderRadius: Spacing.two, gap: Spacing.one },
});
