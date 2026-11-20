import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Screen } from '@/components/screen';
import { AccountsNotSetUp, SignIn } from '@/components/sign-in';
import { TEMPLATES } from '@/components/editor/templates';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAccount, useStoreState } from '@/sync/account';

/** Documents: sermons, study guides and other longer writing. */
export default function DocsScreen() {
  const { configured, session } = useAccount();
  if (!configured) {
    return (
      <Screen>
        <ThemedText type="subtitle">Documents</ThemedText>
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
  return <Screen>{session ? <DocsList /> : <SignIn />}</Screen>;
}

function DocsList() {
  const { documents } = useStoreState();
  const [query, setQuery] = useState('');
  const router = useRouter();
  const theme = useTheme();

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return Object.values(documents)
      .filter((d) => !d.deleted_at)
      .filter((d) => !q || d.title.toLowerCase().includes(q) || d.plain_text.toLowerCase().includes(q))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }, [documents, query]);

  return (
    <>
      <ThemedText type="subtitle">Documents</ThemedText>
      <ThemedText themeColor="textSecondary">
        Sermons, study guides and longer writing — with fonts, colors and highlights. Add your notes and Bible verses
        right into the page.
      </ThemedText>

      <View style={styles.templates}>
        {TEMPLATES.map((t) => (
          <Pressable
            key={t.id}
            onPress={() => router.push({ pathname: '/docs/[id]', params: { id: 'new', template: t.id } })}
            accessibilityRole="button"
            style={({ pressed }) => [styles.templateWrap, pressed && styles.pressed]}>
            <ThemedView type="backgroundElement" style={styles.template}>
              <ThemedText type="smallBold">+ {t.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t.description}
              </ThemedText>
            </ThemedView>
          </Pressable>
        ))}
      </View>

      {Object.keys(documents).length > 0 && (
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search your documents"
          placeholderTextColor={theme.textSecondary}
          style={[styles.search, { color: theme.text, backgroundColor: theme.backgroundElement }]}
          accessibilityLabel="Search documents"
        />
      )}

      {list.length === 0 && query ? (
        <ThemedText themeColor="textSecondary">No documents match.</ThemedText>
      ) : (
        list.map((doc) => (
          <Pressable
            key={doc.id}
            onPress={() => router.push({ pathname: '/docs/[id]', params: { id: doc.id } })}
            accessibilityRole="link">
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="smallBold" numberOfLines={1}>
                {doc.title || 'Untitled document'}
              </ThemedText>
              {!!doc.plain_text.trim() && (
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
                  {doc.plain_text.trim()}
                </ThemedText>
              )}
              <ThemedText type="small" themeColor="textSecondary">
                {new Date(doc.updated_at).toLocaleDateString()}
                {doc.verse_ids.length ? ` · ${doc.verse_ids.length} verse link${doc.verse_ids.length > 1 ? 's' : ''}` : ''}
                {doc.note_ids.length ? ` · ${doc.note_ids.length} note${doc.note_ids.length > 1 ? 's' : ''}` : ''}
              </ThemedText>
            </ThemedView>
          </Pressable>
        ))
      )}
    </>
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: Spacing.six },
  templates: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  templateWrap: { flexGrow: 1, flexBasis: 180 },
  template: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.one },
  search: { borderRadius: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, fontSize: 16 },
  card: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.one },
  pressed: { opacity: 0.7 },
});
