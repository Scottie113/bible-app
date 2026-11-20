import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { refLabel, findRefs } from '@/bible/find-refs';
import { Screen } from '@/components/screen';
import { AccountsNotSetUp, SignIn } from '@/components/sign-in';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Accent, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAccount, useStoreState } from '@/sync/account';

export default function NotesScreen() {
  const { configured, session } = useAccount();

  if (!configured) {
    return (
      <Screen>
        <ThemedText type="subtitle">Notes</ThemedText>
        <AccountsNotSetUp />
      </Screen>
    );
  }
  if (session === undefined) {
    return (
      <Screen>
        <ActivityIndicator style={styles.loading} />
      </Screen>
    );
  }
  return <Screen>{session ? <NotesList /> : <SignIn />}</Screen>;
}

const STATUS_TEXT = {
  loading: 'Loading…',
  syncing: 'Syncing…',
  synced: 'All changes saved',
  offline: 'Offline — changes are saved on this device and will sync when you’re back online',
} as const;

function NotesList() {
  const { session, signOut } = useAccount();
  const { notes, status, outbox } = useStoreState();
  const [query, setQuery] = useState('');
  const router = useRouter();
  const theme = useTheme();

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return Object.values(notes)
      .filter((n) => !n.deleted_at)
      .filter((n) => !q || n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }, [notes, query]);

  return (
    <>
      <View style={styles.header}>
        <ThemedText type="subtitle">Notes</ThemedText>
        <Pressable onPress={() => router.push('/notes/new')} accessibilityRole="button" style={({ pressed }) => pressed && styles.pressed}>
          <View style={styles.newButton}>
            <ThemedText style={styles.newButtonText}>+ New note</ThemedText>
          </View>
        </Pressable>
      </View>

      <View style={styles.account}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
          {session?.user.email} · {status === 'syncing' && outbox.length ? `Saving ${outbox.length}…` : STATUS_TEXT[status]}
        </ThemedText>
        <Pressable onPress={signOut} accessibilityRole="button">
          <ThemedText type="linkPrimary">Sign out</ThemedText>
        </Pressable>
      </View>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search your notes"
        placeholderTextColor={theme.textSecondary}
        style={[styles.search, { color: theme.text, backgroundColor: theme.backgroundElement }]}
        accessibilityLabel="Search notes"
      />

      {list.length === 0 ? (
        <ThemedText themeColor="textSecondary">
          {query
            ? 'No notes match.'
            : 'No notes yet. Tap “+ New note”, or tap a verse in the Read tab and choose “Add to note”. Any reference you type, like John 3:16, becomes a link.'}
        </ThemedText>
      ) : (
        list.map((note) => {
          const refs = findRefs(note.body);
          return (
            <Pressable key={note.id} onPress={() => router.push(`/notes/${note.id}`)} accessibilityRole="link">
              <ThemedView type="backgroundElement" style={styles.card}>
                <ThemedText type="smallBold" numberOfLines={1}>
                  {note.title || 'Untitled note'}
                </ThemedText>
                {!!note.body.trim() && (
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
                    {note.body.trim()}
                  </ThemedText>
                )}
                <View style={styles.refs}>
                  {[...new Set(refs.map(refLabel))].slice(0, 4).map((label) => (
                    <ThemedView key={label} type="backgroundSelected" style={styles.ref}>
                      <ThemedText type="small">{label}</ThemedText>
                    </ThemedView>
                  ))}
                  <ThemedText type="small" themeColor="textSecondary" style={styles.date}>
                    {new Date(note.updated_at).toLocaleDateString()}
                  </ThemedText>
                </View>
              </ThemedView>
            </Pressable>
          );
        })
      )}
    </>
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: Spacing.six },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  newButton: { backgroundColor: Accent, borderRadius: Spacing.two, paddingVertical: Spacing.two, paddingHorizontal: Spacing.three },
  newButtonText: { color: '#fff', fontWeight: 700 },
  account: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  flex: { flex: 1 },
  search: { borderRadius: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, fontSize: 16 },
  card: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.one },
  refs: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.two, marginTop: Spacing.one },
  ref: { paddingVertical: 2, paddingHorizontal: Spacing.two, borderRadius: Spacing.two },
  date: { marginLeft: 'auto' },
  pressed: { opacity: 0.7 },
});
