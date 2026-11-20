import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Accent, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAccount } from '@/sync/account';

/** Email + password sign in / create account. */
export function SignIn() {
  const { signIn, signUp } = useAccount();
  const theme = useTheme();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async () => {
    if (!email.includes('@')) return setMessage('Enter your email address.');
    if (password.length < 8) return setMessage('Passwords need at least 8 characters.');
    setBusy(true);
    setMessage(null);
    const error = await (mode === 'in' ? signIn(email, password) : signUp(email, password));
    setBusy(false);
    setMessage(error);
  };

  const input = [styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }];

  return (
    <View style={styles.wrap}>
      <ThemedText type="subtitle">{mode === 'in' ? 'Sign in' : 'Create an account'}</ThemedText>
      <ThemedText themeColor="textSecondary">
        Your notes and highlights are saved to your account and appear on every device where you sign in.
      </ThemedText>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        placeholderTextColor={theme.textSecondary}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="username"
        style={input}
        accessibilityLabel="Email"
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        onSubmitEditing={submit}
        placeholder="Password (8+ characters)"
        placeholderTextColor={theme.textSecondary}
        secureTextEntry
        autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
        textContentType={mode === 'in' ? 'password' : 'newPassword'}
        style={input}
        accessibilityLabel="Password"
      />
      {message && <ThemedText type="small">{message}</ThemedText>}
      <Pressable onPress={submit} disabled={busy} accessibilityRole="button" style={({ pressed }) => pressed && styles.pressed}>
        <View style={styles.button}>
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <ThemedText style={styles.buttonText}>{mode === 'in' ? 'Sign in' : 'Create account'}</ThemedText>
          )}
        </View>
      </Pressable>
      <Pressable
        onPress={() => {
          setMode(mode === 'in' ? 'up' : 'in');
          setMessage(null);
        }}
        accessibilityRole="button">
        <ThemedText type="linkPrimary">
          {mode === 'in' ? 'New here? Create an account' : 'Already have an account? Sign in'}
        </ThemedText>
      </Pressable>
    </View>
  );
}

/** Shown when the app has no backend configured (no .env.local). */
export function AccountsNotSetUp() {
  return (
    <ThemedView type="backgroundElement" style={styles.notice}>
      <ThemedText type="smallBold">Accounts aren’t set up on this build</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_KEY to .env.local (see .env.example) and restart the app.
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.three, maxWidth: 420, width: '100%', alignSelf: 'center' },
  input: { borderRadius: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.three, fontSize: 16 },
  button: { backgroundColor: Accent, borderRadius: Spacing.two, paddingVertical: Spacing.three, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: 700 },
  pressed: { opacity: 0.7 },
  notice: { padding: Spacing.four, borderRadius: Spacing.three, gap: Spacing.two },
});
