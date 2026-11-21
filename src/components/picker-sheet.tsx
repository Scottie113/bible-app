import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Accent, MaxContentWidth, Spacing } from '@/constants/theme';

export type PickerOption = { id: string; label: string; detail?: string };

type Props = {
  visible: boolean;
  title: string;
  hint?: string;
  options: PickerOption[];
  selected: string[];
  /** 'many' = checkboxes (pick any number), 'one' = pick one (closes on pick). */
  mode: 'many' | 'one';
  onChange: (selected: string[]) => void;
  onClose: () => void;
};

/** A window listing choices: tick several (versions) or pick one (meaning language). */
export function PickerSheet({ visible, title, hint, options, selected, mode, onChange, onClose }: Props) {
  const toggle = (id: string) => {
    if (mode === 'one') {
      onChange([id]);
      onClose();
      return;
    }
    // Keep the options' order.
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
    onChange(options.map((o) => o.id).filter((x) => next.includes(x)));
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <ThemedView style={styles.sheet}>
        <SafeAreaView edges={['bottom']}>
          <View style={styles.header}>
            <ThemedText type="smallBold" style={styles.title}>
              {title}
            </ThemedText>
            <Pressable onPress={onClose} accessibilityRole="button" hitSlop={10}>
              <ThemedText type="linkPrimary">Done</ThemedText>
            </Pressable>
          </View>
          {hint && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
              {hint}
            </ThemedText>
          )}
          <ScrollView contentContainerStyle={styles.list}>
            {options.map((o) => {
              const on = selected.includes(o.id);
              return (
                <Pressable
                  key={o.id}
                  onPress={() => toggle(o.id)}
                  accessibilityRole={mode === 'many' ? 'checkbox' : 'radio'}
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={o.label}>
                  <ThemedView type={on ? 'backgroundSelected' : 'backgroundElement'} style={styles.row}>
                    <View style={[mode === 'many' ? styles.box : styles.radio, on && styles.markOn]}>
                      {on && <ThemedText style={styles.mark}>{mode === 'many' ? '✓' : '●'}</ThemedText>}
                    </View>
                    <View style={styles.text}>
                      <ThemedText type="smallBold">{o.label}</ThemedText>
                      {o.detail && (
                        <ThemedText type="small" themeColor="textSecondary">
                          {o.detail}
                        </ThemedText>
                      )}
                    </View>
                  </ThemedView>
                </Pressable>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    zIndex: 1,
    marginTop: 'auto',
    maxHeight: '80%',
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    paddingTop: Spacing.three,
  },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.four },
  title: { flex: 1, fontSize: 17 },
  hint: { paddingHorizontal: Spacing.four, paddingTop: Spacing.one },
  list: { padding: Spacing.three, gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderRadius: Spacing.three },
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#9aa0a6', alignItems: 'center', justifyContent: 'center' },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#9aa0a6', alignItems: 'center', justifyContent: 'center' },
  markOn: { borderColor: Accent, backgroundColor: Accent },
  mark: { color: '#fff', fontSize: 13, lineHeight: 16, fontWeight: 700 },
  text: { flex: 1, gap: 2 },
});
