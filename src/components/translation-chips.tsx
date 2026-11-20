import { Pressable, StyleSheet, View } from 'react-native';

import { TRANSLATIONS } from '@/bible/translations';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

/** A row of translation buttons ("KJV", "WEB", …). */
export function TranslationChips({ selected, onPress }: { selected: string[]; onPress: (id: string) => void }) {
  return (
    <View style={styles.row}>
      {TRANSLATIONS.map((t) => {
        const on = selected.includes(t.id);
        return (
          <Pressable
            key={t.id}
            onPress={() => onPress(t.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={t.name}
            style={({ pressed }) => pressed && styles.pressed}>
            <ThemedView type={on ? 'backgroundSelected' : 'backgroundElement'} style={styles.chip}>
              <ThemedText type={on ? 'smallBold' : 'small'} themeColor={on ? 'text' : 'textSecondary'}>
                {t.abbreviation}
              </ThemedText>
            </ThemedView>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: { paddingVertical: Spacing.one, paddingHorizontal: Spacing.three, borderRadius: Spacing.three },
  pressed: { opacity: 0.6 },
});
