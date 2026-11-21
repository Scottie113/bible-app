import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Accent, Spacing } from '@/constants/theme';

/** Opens a picker window: "Versions ▾". */
export function PickerButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => pressed && styles.pressed}>
      <View style={styles.button}>
        <ThemedText type="smallBold" style={styles.buttonText}>
          {label} ▾
        </ThemedText>
      </View>
    </Pressable>
  );
}

/** Shows something that is selected (not a button). */
export function SelectedChip({ label }: { label: string }) {
  return (
    <ThemedView type="backgroundSelected" style={styles.chip}>
      <ThemedText type="smallBold">{label}</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: Accent,
  },
  buttonText: { color: Accent },
  chip: { paddingVertical: Spacing.one, paddingHorizontal: Spacing.three, borderRadius: Spacing.three },
  pressed: { opacity: 0.6 },
});
