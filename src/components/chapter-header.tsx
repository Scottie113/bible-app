import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { getBook } from '@/bible/books';
import { useReadingLocation } from '@/bible/reading-location';
import { parseRef } from '@/bible/verse-id';
import { BookPicker } from '@/components/book-picker';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Top bar shared by Read and Compare: previous / "John 3 ▾" / next, plus a
 * box where you can type a reference like "Rom 8:28" or "Psalm 23".
 */
export function ChapterHeader() {
  const { book, chapter, goTo, show, next, previous } = useReadingLocation();
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState('');
  const [invalid, setInvalid] = useState(false);
  const theme = useTheme();

  const submit = () => {
    const ref = parseRef(query);
    if (!ref) {
      setInvalid(true);
      return;
    }
    show(ref);
    setQuery('');
    setInvalid(false);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <NavButton label="‹" onPress={previous} accessibilityLabel="Previous chapter" />
        <Pressable
          onPress={() => setPicking(true)}
          accessibilityRole="button"
          accessibilityLabel="Choose book and chapter"
          style={({ pressed }) => [styles.title, pressed && styles.pressed]}>
          <ThemedText type="smallBold" style={styles.titleText}>
            {getBook(book).name} {chapter} ▾
          </ThemedText>
        </Pressable>
        <NavButton label="›" onPress={next} accessibilityLabel="Next chapter" />
      </View>

      <ThemedView type="backgroundElement" style={[styles.search, invalid && styles.invalid]}>
        <TextInput
          value={query}
          onChangeText={(t) => {
            setQuery(t);
            setInvalid(false);
          }}
          onSubmitEditing={submit}
          placeholder="Go to… (e.g. John 3:16)"
          placeholderTextColor={theme.textSecondary}
          returnKeyType="go"
          autoCorrect={false}
          autoCapitalize="words"
          style={[styles.input, { color: theme.text }]}
          accessibilityLabel="Go to reference"
        />
      </ThemedView>
      {invalid && (
        <ThemedText type="small" themeColor="textSecondary">
          Couldn’t find that reference. Try “John 3:16” or “Ps 23”.
        </ThemedText>
      )}

      <BookPicker
        visible={picking}
        currentBook={book}
        onClose={() => setPicking(false)}
        onPick={(b, c) => goTo(b, c)}
      />
    </View>
  );
}

function NavButton({ label, onPress, accessibilityLabel }: { label: string; onPress: () => void; accessibilityLabel: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView type="backgroundElement" style={styles.navButton}>
        <ThemedText type="default">{label}</ThemedText>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  title: { flex: 1, alignItems: 'center', paddingVertical: Spacing.two },
  titleText: { fontSize: 18 },
  navButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  search: { borderRadius: Spacing.two, paddingHorizontal: Spacing.three },
  invalid: { borderWidth: 1, borderColor: '#d9534f' },
  input: { paddingVertical: Spacing.two, fontSize: 16 },
  pressed: { opacity: 0.6 },
});
