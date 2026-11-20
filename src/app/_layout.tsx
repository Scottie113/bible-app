import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

import { ReadingLocationProvider } from '@/bible/reading-location';
import AppTabs from '@/components/app-tabs';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <ReadingLocationProvider>
        <AppTabs />
      </ReadingLocationProvider>
    </ThemeProvider>
  );
}
