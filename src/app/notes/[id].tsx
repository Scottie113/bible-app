import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { findRefs, refLabel, type FoundRef } from '@/bible/find-refs';
import { useReadingLocation } from '@/bible/reading-location';
import { Screen } from '@/components/screen';
import { AccountsNotSetUp, SignIn } from '@/components/sign-in';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Accent, Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAccount, useStoreState } from '@/sync/account';

const SAVE_DELAY_MS = 600;

export default function NoteScreen() {
  const { configured, session } = useAccount();
  if (!configured) {
    return (
      <Screen>
        <AccountsNotSetUp />
      </Screen>
    );
  }
  return <Screen>{session ? <NoteEditor /> : session === null ? <SignIn /> : null}</Screen>;
}

/**
 * Write a note. Saves automatically as you type. Any Bible reference in the
 * text (John 3:16, Rom 8:28-30, Ps 23) becomes a link, and the verse gets a
 * 📝 marker in the Read tab.
 */
function NoteEditor() {
  const params = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { show } = useReadingLocation();
  const { store } = useAccount();
  const { notes } = useStoreState();
  const theme = useTheme();

  const [noteId, setNoteId] = useState<string | null>(params.id === 'new' ? null : params.id);
  const note = noteId ? notes[noteId] : undefined;
  const [title, setTitle] = useState(note?.title ?? '');
  const [body, setBody] = useState(note?.body ?? '');
  const [mode, setMode] = useState<'edit' | 'read'>(note?.body.trim() ? 'read' : 'edit');
  const [confirmDelete, setConfirmDelete] = useState(false);
  /** What we last saved (or loaded), to tell our own typing apart from changes made on another device. */
  const [saved, setSaved] = useState({ title: note?.title ?? '', body: note?.body ?? '' });
  const unsaved = title !== saved.title || body !== saved.body;

  // The note changed on another device: show the new version unless there's unsaved typing here.
  const [seenVersion, setSeenVersion] = useState(note?.updated_at);
  if (note && note.updated_at !== seenVersion) {
    setSeenVersion(note.updated_at);
    // Opened before the note finished loading: show it ready to read.
    if (seenVersion === undefined && note.body.trim()) setMode('read');
    if (!unsaved && (note.title !== title || note.body !== body)) {
      setSaved({ title: note.title, body: note.body });
      setTitle(note.title);
      setBody(note.body);
    }
  }

  // Autosave shortly after typing stops.
  useEffect(() => {
    if (!store || !unsaved) return;
    if (!noteId && !title.trim() && !body.trim()) return;
    const timer = setTimeout(() => {
      const result = store.saveNote({ id: noteId ?? undefined, title, body });
      setSaved({ title, body });
      if (!noteId) {
        setNoteId(result.id);
        router.setParams({ id: result.id });
      }
    }, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [store, noteId, title, body, unsaved, router]);

  const refs = useMemo(() => findRefs(`${title}\n${body}`), [title, body]);
  const uniqueRefs = useMemo(() => {
    const seen = new Set<string>();
    return refs.filter((r) => {
      const label = refLabel(r);
      if (seen.has(label)) return false;
      seen.add(label);
      return true;
    });
  }, [refs]);

  const open = (r: FoundRef) => {
    show(r.ref);
    router.navigate('/');
  };

  if (noteId && !note && Object.keys(notes).length > 0) {
    return <ThemedText themeColor="textSecondary">This note was not found. It may have been deleted.</ThemedText>;
  }

  return (
    <>
      <View style={styles.toolbar}>
        <Pressable onPress={() => router.navigate('/notes')} accessibilityRole="link" hitSlop={8}>
          <ThemedText type="linkPrimary">‹ Notes</ThemedText>
        </Pressable>
        <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
          {unsaved ? 'Saving…' : note ? 'Saved' : ''}
        </ThemedText>
        <Segment value={mode} onChange={setMode} />
      </View>

      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="Title"
        placeholderTextColor={theme.textSecondary}
        style={[styles.title, { color: theme.text }]}
        accessibilityLabel="Note title"
      />

      {mode === 'edit' ? (
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder={'Write your note…\n\nType a reference like John 3:16 or Rom 8:28-30 and it becomes a link.'}
          placeholderTextColor={theme.textSecondary}
          multiline
          textAlignVertical="top"
          style={[styles.body, { color: theme.text, backgroundColor: theme.backgroundElement }]}
          accessibilityLabel="Note text"
          autoFocus={!note}
        />
      ) : (
        <Pressable onLongPress={() => setMode('edit')} accessibilityHint="Long-press to edit">
          <ThemedView type="backgroundElement" style={styles.readBox}>
            <LinkedText text={body} onPressRef={open} />
          </ThemedView>
        </Pressable>
      )}

      {uniqueRefs.length > 0 && (
        <View style={styles.section}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            Verses in this note
          </ThemedText>
          <View style={styles.chips}>
            {uniqueRefs.map((r) => (
              <Pressable key={refLabel(r)} onPress={() => open(r)} accessibilityRole="link">
                <ThemedView type="backgroundSelected" style={styles.chip}>
                  <ThemedText type="small">{refLabel(r)}</ThemedText>
                </ThemedView>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {note && (
        <Pressable
          onPress={() => {
            if (!confirmDelete) return setConfirmDelete(true);
            store?.deleteNote(note.id);
            router.navigate('/notes');
          }}
          accessibilityRole="button"
          style={styles.delete}>
          <ThemedText type="small" style={styles.deleteText}>
            {confirmDelete ? 'Tap again to delete this note' : 'Delete note'}
          </ThemedText>
        </Pressable>
      )}
    </>
  );
}

/** Note text with every Bible reference shown as a link. */
function LinkedText({ text, onPressRef }: { text: string; onPressRef: (r: FoundRef) => void }) {
  const parts: React.ReactNode[] = [];
  let at = 0;
  for (const r of findRefs(text)) {
    if (r.start > at) parts.push(text.slice(at, r.start));
    parts.push(
      <ThemedText key={r.start} onPress={() => onPressRef(r)} accessibilityRole="link" style={styles.link}>
        {r.text}
      </ThemedText>,
    );
    at = r.end;
  }
  parts.push(text.slice(at));
  return (
    <ThemedText style={styles.readText}>
      {text.trim() ? parts : <ThemedText themeColor="textSecondary">Empty note. Tap Edit to write.</ThemedText>}
    </ThemedText>
  );
}

function Segment({ value, onChange }: { value: 'edit' | 'read'; onChange: (v: 'edit' | 'read') => void }) {
  return (
    <ThemedView type="backgroundElement" style={styles.segment}>
      {(['read', 'edit'] as const).map((v) => (
        <Pressable key={v} onPress={() => onChange(v)} accessibilityRole="button" accessibilityState={{ selected: value === v }}>
          <ThemedView type={value === v ? 'backgroundSelected' : 'backgroundElement'} style={styles.segmentItem}>
            <ThemedText type={value === v ? 'smallBold' : 'small'}>{v === 'read' ? 'Read' : 'Edit'}</ThemedText>
          </ThemedView>
        </Pressable>
      ))}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  flex: { flex: 1 },
  title: { fontSize: 26, fontWeight: 700, paddingVertical: Spacing.two },
  body: {
    minHeight: 320,
    borderRadius: Spacing.three,
    padding: Spacing.three,
    fontSize: 17,
    lineHeight: 26,
    fontFamily: Fonts.serif,
  },
  readBox: { borderRadius: Spacing.three, padding: Spacing.three, minHeight: 160 },
  readText: { fontSize: 17, lineHeight: 28, fontFamily: Fonts.serif, fontWeight: 400 },
  link: { color: Accent, textDecorationLine: 'underline', fontSize: 17, lineHeight: 28, fontFamily: Fonts.serif },
  section: { gap: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: { paddingVertical: Spacing.one, paddingHorizontal: Spacing.three, borderRadius: Spacing.three },
  segment: { flexDirection: 'row', borderRadius: Spacing.three, padding: 2 },
  segmentItem: { paddingVertical: Spacing.one, paddingHorizontal: Spacing.three, borderRadius: Spacing.three },
  delete: { alignSelf: 'flex-start', marginTop: Spacing.four },
  deleteText: { color: '#d9534f' },
});
