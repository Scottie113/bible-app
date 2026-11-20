import { forwardRef, type ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, View, type ScrollViewInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

/** Scrolling page with a centered, readable column that leaves room for the tab bar. */
export const Screen = forwardRef<ScrollViewInstance,{ children: ReactNode; wide?: boolean }>(function Screen(
  { children, wide },
  ref,
) {
  return (
    <ThemedView style={styles.fill}>
      <SafeAreaView style={styles.fill} edges={['top', 'left', 'right']}>
        <ScrollView ref={ref} contentContainerStyle={styles.scroll}>
          <View style={[styles.column, wide && styles.wide]}>{children}</View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
});

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scroll: {
    paddingHorizontal: Spacing.three,
    // web: tab bar floats at the top; native: tab bar is at the bottom
    paddingTop: Platform.OS === 'web' ? 88 : Spacing.three,
    paddingBottom: BottomTabInset + Spacing.six,
  },
  column: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: Spacing.three },
  wide: { maxWidth: 1200 },
});
