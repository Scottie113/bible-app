import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { formatRef, fromVerseId } from '@/bible/verse-id';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { HighlightColors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAccount, useStoreState } from '@/sync/account';
import { HIGHLIGHT_COLORS, type HighlightColor } from '@/sync/types';

type Props = {
  verseId: number;
  /** Text of the verse and its translation label, quoted when adding to a note. */
  quote: { text: string; translation: string };
  onClose: () => void;
};

/** Bar shown under a tapped verse: highlight colors, add to note, close. */
export function VerseActions({ verseId, quote, onClose }: Props) {
  const { session, store } = useAccount();
  const { highlights } = useStoreState();
  const router = useRouter();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [choosingNote, setChoosingNote] = useState(false);
  const label = formatRef(fromVerseId(verseId));
  const current = highlights[verseId];
  const currentColor = current && !current.deleted_at ? current.color : null;

  if (!session || !store) {
    return (
      <ThemedView type="backgroundElement" style={styles.bar}>
        <ThemedText type="small">{label}</ThemedText>
        <Pressable onPress={() => router.push('/notes')} accessibilityRole="link">
          <ThemedText type="linkPrimary">Sign in to highlight and take notes</ThemedText>
        </Pressable>
        <CloseButton onPress={onClose} />
      </ThemedView>
    );
  }

  const toggle = (color: HighlightColor) => store.setHighlight(verseId, currentColor === color ? null : color);

  return (
    <ThemedView type="backgroundElement" style={styles.bar}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <View style={styles.colors}>
        {HIGHLIGHT_COLORS.map((color) => (
          <Pressable
            key={color}
            onPress={() => toggle(color)}
            accessibilityRole="button"
            accessibilityLabel={`${currentColor === color ? 'Remove' : 'Highlight'} ${color}`}
            accessibilityState={{ selected: currentColor === color }}
            hitSlop={4}>
            <View
              style={[
                styles.swatch,
                { backgroundColor: HighlightColors[scheme][color] },
                currentColor === color && styles.swatchOn,
              ]}
            />
          </Pressable>
        ))}
      </View>
      <Pressable onPress={() => setChoosingNote(true)} accessibilityRole="button">
        <ThemedText type="linkPrimary">+ Add to note</ThemedText>
      </Pressable>
      <CloseButton onPress={onClose} />

      <ChooseNote
        visible={choosingNote}
        onClose={() => setChoosingNote(false)}
        onPick={(noteId) => {
          const line = `${label} (${quote.translation}) — “${quote.text}”`;
          const existing = noteId ? store.getState().notes[noteId] : undefined;
          const note = store.saveNote({
            id: existing?.id,
            title: existing?.title ?? label,
            body: existing ? `${existing.body.trimEnd()}\n\n${line}\n` : `${line}\n\n`,
          });
          setChoosingNote(false);
          onClose();
          router.push(`/notes/${note.id}`);
        }}
      />
    </ThemedView>
  );
}

function CloseButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} style={styles.close}>
      <ThemedText themeColor="textSecondary">✕</ThemedText>
    </Pressable>
  );
}

/** Pick an existing note (most recent first) or start a new one. */
function ChooseNote({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (noteId: string | null) => void;
}) {
  const { notes } = useStoreState();
  const recent = useMemo(
    () =>
      Object.values(notes)
        .filter((n) => !n.deleted_at)
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        .slice(0, 30),
    [notes],
  );
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Cancel" />
      <ThemedView style={styles.sheet}>
        <SafeAreaView edges={['bottom']}>
          <ScrollView contentContainerStyle={styles.sheetContent}>
            <ThemedText type="smallBold">Add to which note?</ThemedText>
            <Pressable onPress={() => onPick(null)} accessibilityRole="button">
              <ThemedView type="backgroundSelected" style={styles.noteRow}>
                <ThemedText type="smallBold">+ New note</ThemedText>
              </ThemedView>
            </Pressable>
            {recent.map((n) => (
              <Pressable key={n.id} onPress={() => onPick(n.id)} accessibilityRole="button">
                <ThemedView type="backgroundElement" style={styles.noteRow}>
                  <ThemedText type="small" numberOfLines={1}>
                    {n.title || 'Untitled note'}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            ))}
          </ScrollView>
        </SafeAreaView>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  colors: { flexDirection: 'row', gap: Spacing.two },
  swatch: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(0,0,0,0.15)' },
  swatchOn: { borderWidth: 3, borderColor: '#3c87f7' },
  close: { marginLeft: 'auto' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    maxHeight: '60%',
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  sheetContent: { padding: Spacing.four, gap: Spacing.two },
  noteRow: { padding: Spacing.three, borderRadius: Spacing.two },
});
