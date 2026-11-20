import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useReadingLocation } from '@/bible/reading-location';
import { lookupVerses } from '@/bible/verse-lookup';
import type { VerseRef } from '@/bible/verse-id';
import RichEditor, { type SavePayload } from '@/components/editor/rich-editor';
import { TEMPLATES } from '@/components/editor/templates';
import { Screen } from '@/components/screen';
import { AccountsNotSetUp, SignIn } from '@/components/sign-in';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { useAccount, useStoreState } from '@/sync/account';

const TITLE_SAVE_DELAY_MS = 600;

export default function DocScreen() {
  const { configured, session } = useAccount();
  if (!configured) {
    return (
      <Screen>
        <AccountsNotSetUp />
      </Screen>
    );
  }
  if (!session) {
    return <Screen>{session === null ? <SignIn /> : <ActivityIndicator />}</Screen>;
  }
  return <DocEditor />;
}

function DocEditor() {
  const params = useLocalSearchParams<{ id: string; template?: string }>();
  const router = useRouter();
  const { show, translation } = useReadingLocation();
  const { store } = useAccount();
  const { documents, notes, status } = useStoreState();
  const theme = useTheme();
  const dark = useColorScheme() === 'dark';

  const template = TEMPLATES.find((t) => t.id === params.template) ?? TEMPLATES[0];
  const [docId, setDocId] = useState<string | null>(params.id === 'new' ? null : params.id);
  const doc = docId ? documents[docId] : undefined;

  // What the editor opens with. For an existing document that is still loading, wait for it.
  const [opened, setOpened] = useState<{ content: SavePayload['content'] | null; version?: string } | null>(
    params.id === 'new' ? { content: template.content } : doc ? { content: doc.content, version: doc.updated_at } : null,
  );
  if (!opened && doc) setOpened({ content: doc.content, version: doc.updated_at });

  const [title, setTitle] = useState(doc?.title ?? (params.id === 'new' ? template.title : ''));
  const [savedTitle, setSavedTitle] = useState(title);
  const [seenTitleVersion, setSeenTitleVersion] = useState(doc?.updated_at);
  if (doc && doc.updated_at !== seenTitleVersion) {
    setSeenTitleVersion(doc.updated_at);
    // Title changed on another device and not being edited here: follow it.
    if (title === savedTitle && doc.title !== title) {
      setTitle(doc.title);
      setSavedTitle(doc.title);
    }
  }

  /** Versions saved from this screen, so the editor isn't sent its own changes back. */
  const [mine, setMine] = useState<Set<string>>(() => new Set());
  const [lastPayload, setLastPayload] = useState<SavePayload | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const persist = useCallback(
    (payload: SavePayload | null, newTitle: string) => {
      if (!store) return;
      const current = docId ? store.getState().documents[docId] : undefined;
      const body = payload ?? {
        content: current?.content ?? opened?.content ?? { type: 'doc', content: [] },
        plainText: current?.plain_text ?? '',
        verseIds: current?.verse_ids ?? [],
        noteIds: current?.note_ids ?? [],
      };
      const saved = store.saveDocument({ id: docId ?? undefined, title: newTitle, ...body });
      setMine((m) => new Set(m).add(saved.updated_at));
      setSavedTitle(newTitle);
      if (!docId) {
        setDocId(saved.id);
        router.setParams({ id: saved.id, template: undefined });
      }
    },
    [store, docId, opened, router],
  );

  const onSave = useCallback(
    async (payload: SavePayload) => {
      setLastPayload(payload);
      persist(payload, title);
    },
    [persist, title],
  );

  // Save the title shortly after typing stops.
  useEffect(() => {
    if (title === savedTitle || (!docId && !title.trim())) return;
    const timer = setTimeout(() => persist(lastPayload, title), TITLE_SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [title, savedTitle, docId, lastPayload, persist]);

  const remote = useMemo(
    () =>
      doc && doc.updated_at !== opened?.version && !mine.has(doc.updated_at)
        ? { content: doc.content, version: doc.updated_at }
        : null,
    [doc, opened?.version, mine],
  );

  const noteSummaries = useMemo(
    () =>
      Object.values(notes)
        .filter((n) => !n.deleted_at)
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        .map((n) => ({ id: n.id, title: n.title, body: n.body })),
    [notes],
  );

  const onOpenVerse = useCallback(
    async (ref: VerseRef) => {
      show(ref);
      router.navigate('/');
    },
    [show, router],
  );
  const onOpenNote = useCallback(async (id: string) => router.push({ pathname: '/notes/[id]', params: { id } }), [router]);
  const getVerse = useCallback((reference: string) => lookupVerses(reference, translation), [translation]);

  if (docId && !doc && status !== 'loading' && Object.keys(documents).length > 0) {
    return (
      <Screen>
        <ThemedText themeColor="textSecondary">This document was not found. It may have been deleted.</ThemedText>
      </Screen>
    );
  }

  return (
    <ThemedView style={styles.fill}>
      <SafeAreaView style={styles.fill} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.navigate('/docs')} accessibilityRole="link" hitSlop={8}>
            <ThemedText type="linkPrimary">‹ Documents</ThemedText>
          </Pressable>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Untitled document"
            placeholderTextColor={theme.textSecondary}
            style={[styles.title, { color: theme.text }]}
            accessibilityLabel="Document title"
          />
          <ThemedText type="small" themeColor="textSecondary">
            {status === 'offline' ? 'Offline · saved on device' : doc ? 'Saved' : ''}
          </ThemedText>
          {doc && (
            <Pressable
              onPress={() => {
                if (!confirmDelete) return setConfirmDelete(true);
                store?.deleteDocument(doc.id);
                router.navigate('/docs');
              }}
              onBlur={() => setConfirmDelete(false)}
              accessibilityRole="button">
              <ThemedText type="small" style={styles.delete}>
                {confirmDelete ? 'Tap again to delete' : 'Delete'}
              </ThemedText>
            </Pressable>
          )}
        </View>

        <View style={styles.editor}>
          {opened ? (
            <RichEditor
              initialContent={opened.content}
              remote={remote}
              notes={noteSummaries}
              dark={dark}
              onSave={onSave}
              onOpenVerse={onOpenVerse}
              onOpenNote={onOpenNote}
              getVerse={getVerse}
              dom={{ style: { flex: 1 }, containerStyle: { flex: 1 } }}
            />
          ) : (
            <ActivityIndicator style={styles.loading} />
          )}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingTop: Platform.OS === 'web' ? 80 : Spacing.two,
    paddingBottom: Spacing.two,
  },
  title: { flex: 1, minWidth: 180, fontSize: 22, fontWeight: 700, paddingVertical: Spacing.one },
  delete: { color: '#d9534f' },
  editor: { flex: 1, paddingBottom: BottomTabInset },
  loading: { marginTop: Spacing.six },
});
