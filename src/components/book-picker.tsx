import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BOOKS, getBook, type Book } from '@/bible/books';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';

type Props = {
  visible: boolean;
  currentBook: number;
  onClose: () => void;
  onPick: (book: number, chapter: number) => void;
};

/** Full-screen picker: choose a book, then a chapter. */
export function BookPicker({ visible, currentBook, onClose, onPick }: Props) {
  const [book, setBook] = useState<Book | null>(null);

  const close = () => {
    setBook(null);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <ThemedView style={styles.fill}>
        <SafeAreaView style={styles.fill}>
          <View style={styles.header}>
            {book ? (
              <Pressable onPress={() => setBook(null)} hitSlop={12} accessibilityRole="button">
                <ThemedText type="linkPrimary">‹ Books</ThemedText>
              </Pressable>
            ) : (
              <View />
            )}
            <ThemedText type="smallBold">{book ? book.name : 'Choose a book'}</ThemedText>
            <Pressable onPress={close} hitSlop={12} accessibilityRole="button">
              <ThemedText type="linkPrimary">Close</ThemedText>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            {book ? (
              <View style={styles.grid}>
                {Array.from({ length: book.chapters }, (_, i) => i + 1).map((chapter) => (
                  <Cell
                    key={chapter}
                    label={String(chapter)}
                    square
                    onPress={() => {
                      onPick(book.id, chapter);
                      close();
                    }}
                  />
                ))}
              </View>
            ) : (
              (['OT', 'NT'] as const).map((testament) => (
                <View key={testament} style={styles.section}>
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    {testament === 'OT' ? 'Old Testament' : 'New Testament'}
                  </ThemedText>
                  <View style={styles.grid}>
                    {BOOKS.filter((b) => b.testament === testament).map((b) => (
                      <Cell
                        key={b.id}
                        label={b.name}
                        selected={b.id === currentBook}
                        onPress={() =>
                          getBook(b.id).chapters === 1 ? (onPick(b.id, 1), close()) : setBook(b)
                        }
                      />
                    ))}
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </SafeAreaView>
      </ThemedView>
    </Modal>
  );
}

function Cell({
  label,
  selected,
  square,
  onPress,
}: {
  label: string;
  selected?: boolean;
  square?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView
        type={selected ? 'backgroundSelected' : 'backgroundElement'}
        style={[styles.cell, square && styles.square]}>
        <ThemedText type="small">{label}</ThemedText>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  content: {
    padding: Spacing.three,
    gap: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  section: { gap: Spacing.two },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  cell: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
  },
  square: { minWidth: 48, alignItems: 'center' },
  pressed: { opacity: 0.6 },
});
