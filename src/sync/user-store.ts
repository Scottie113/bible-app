import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'expo-crypto';

import { verseIdsIn } from '@/bible/find-refs';

import type { Highlight, HighlightColor, Note, ReadingState, TableName } from './types';

/**
 * One signed-in person's notes, highlights and reading place, kept on the
 * device and synced with the server.
 *
 * - Every change is saved on the device first (works offline, feels instant),
 *   then queued in the "outbox" and sent to the server.
 * - Changes from other devices arrive live (realtime) and on every pull.
 * - If two devices edit the same thing, the newest edit wins.
 */
export type StoreState = {
  notes: Record<string, Note>;
  highlights: Record<number, Highlight>;
  reading: ReadingState | null;
  /** Server time of the newest row we have pulled. */
  lastPulled: string | null;
  /** Rows changed on this device and not yet confirmed by the server: "table:key". */
  outbox: string[];
  status: 'loading' | 'syncing' | 'synced' | 'offline';
};

const EMPTY: StoreState = {
  notes: {},
  highlights: {},
  reading: null,
  lastPulled: null,
  outbox: [],
  status: 'loading',
};

const RETRY_MS = 15_000;
/** Re-read a few seconds before the last pull, in case of rows committed slightly out of order. */
const PULL_OVERLAP_MS = 5_000;

const now = () => new Date().toISOString();
const newer = (a: { updated_at: string } | undefined, b: { updated_at: string }) =>
  !a || Date.parse(b.updated_at) >= Date.parse(a.updated_at);

export class UserStore {
  private state: StoreState = EMPTY;
  private listeners = new Set<() => void>();
  private channel: RealtimeChannel | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private flushing = false;
  private closed = false;
  private runs = 0;

  constructor(
    private readonly db: SupabaseClient,
    readonly userId: string,
  ) {}

  // ---------------------------------------------------------------- React bindings
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  getState = () => this.state;

  private set(update: Partial<StoreState>, persist = true) {
    this.state = { ...this.state, ...update };
    this.listeners.forEach((l) => l());
    if (persist) this.persistSoon();
  }

  // ---------------------------------------------------------------- lifecycle
  private get storageKey() {
    return `bible-app/v1/user/${this.userId}`;
  }

  /** Load saved data, connect for live updates and sync. Can be called again after stop(). */
  async start() {
    this.closed = false;
    const run = ++this.runs;
    try {
      const saved = await AsyncStorage.getItem(this.storageKey);
      if (saved && this.state.status === 'loading') this.set({ ...JSON.parse(saved), status: 'syncing' }, false);
      else this.set({ status: 'syncing' }, false);
    } catch {
      this.set({ status: 'syncing' }, false);
    }
    // Stopped (or restarted) while loading: let the newest start() carry on.
    if (this.closed || run !== this.runs) return;
    this.listen();
    await this.sync();
  }

  stop() {
    this.closed = true;
    if (this.channel) void this.db.removeChannel(this.channel);
    this.channel = null;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      void this.persist();
    }
  }

  /** Send pending changes, then fetch anything new. Safe to call any time. */
  async sync() {
    if (this.closed) return;
    const sent = await this.flush();
    // Couldn't send: we're offline, so don't wait for a download to time out as well.
    const pulled = sent && (await this.pull());
    if (this.closed) return;
    const ok = sent && pulled;
    this.set({ status: ok && !this.state.outbox.length ? 'synced' : ok ? 'syncing' : 'offline' }, false);
    if (!ok || this.state.outbox.length) this.retrySoon();
  }

  private persistSoon() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => void this.persist(), 300);
  }

  private async persist() {
    this.saveTimer = null;
    const { status: _status, ...data } = this.state;
    try {
      await AsyncStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch {
      // Storage full or unavailable: data is still in memory and on the server.
    }
  }

  private retrySoon() {
    if (this.retryTimer || this.closed) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.sync();
    }, RETRY_MS);
  }

  // ---------------------------------------------------------------- local changes
  private enqueue(entry: string) {
    if (!this.state.outbox.includes(entry)) this.set({ outbox: [...this.state.outbox, entry] });
    void this.sync();
  }

  /** Create or update a note. Returns the saved note. */
  saveNote(input: { id?: string; title: string; body: string }): Note {
    const existing = input.id ? this.state.notes[input.id] : undefined;
    const time = now();
    const note: Note = {
      id: existing?.id ?? input.id ?? randomUUID(),
      user_id: this.userId,
      title: input.title,
      body: input.body,
      verse_ids: verseIdsIn(`${input.title}\n${input.body}`),
      created_at: existing?.created_at ?? time,
      updated_at: time,
      deleted_at: null,
    };
    this.set({ notes: { ...this.state.notes, [note.id]: note } });
    this.enqueue(`notes:${note.id}`);
    return note;
  }

  deleteNote(id: string) {
    const note = this.state.notes[id];
    if (!note) return;
    const time = now();
    this.set({ notes: { ...this.state.notes, [id]: { ...note, deleted_at: time, updated_at: time } } });
    this.enqueue(`notes:${id}`);
  }

  setHighlight(verseId: number, color: HighlightColor | null) {
    const time = now();
    const existing = this.state.highlights[verseId];
    const row: Highlight = {
      user_id: this.userId,
      verse_id: verseId,
      color: color ?? existing?.color ?? 'yellow',
      updated_at: time,
      deleted_at: color ? null : time,
    };
    this.set({ highlights: { ...this.state.highlights, [verseId]: row } });
    this.enqueue(`highlights:${verseId}`);
  }

  setReading(reading: Pick<ReadingState, 'book' | 'chapter' | 'translation' | 'compare'>) {
    const r = this.state.reading;
    if (
      r &&
      r.book === reading.book &&
      r.chapter === reading.chapter &&
      r.translation === reading.translation &&
      r.compare.join() === reading.compare.join()
    ) {
      return;
    }
    this.set({ reading: { ...reading, user_id: this.userId, updated_at: now() } });
    this.enqueue('reading_state:me');
  }

  // ---------------------------------------------------------------- server
  private rowFor(entry: string): { table: TableName; row: object; conflict: string } | null {
    const [table, key] = entry.split(':') as [TableName, string];
    const strip = <T extends { synced_at?: string }>(row: T) => {
      const { synced_at: _synced, ...rest } = row;
      return rest;
    };
    if (table === 'notes') {
      const row = this.state.notes[key];
      return row ? { table, row: strip(row), conflict: 'id' } : null;
    }
    if (table === 'highlights') {
      const row = this.state.highlights[Number(key)];
      return row ? { table, row: strip(row), conflict: 'user_id,verse_id' } : null;
    }
    const row = this.state.reading;
    return row ? { table, row: strip(row), conflict: 'user_id' } : null;
  }

  /** Send the outbox. Returns false if the server could not be reached. */
  private async flush(): Promise<boolean> {
    if (this.flushing) return true;
    this.flushing = true;
    try {
      for (const entry of [...this.state.outbox]) {
        const item = this.rowFor(entry);
        if (item) {
          const sentAt = this.snapshotOf(entry);
          const { data, error } = await this.db
            .from(item.table)
            .upsert(item.row, { onConflict: item.conflict })
            .select();
          if (error) return false;
          // If the row was edited again while sending, keep it queued.
          if (this.snapshotOf(entry) !== sentAt) continue;
          this.set({ outbox: this.state.outbox.filter((e) => e !== entry) });
          for (const row of data ?? []) this.merge(item.table, row, true);
        } else {
          this.set({ outbox: this.state.outbox.filter((e) => e !== entry) });
        }
      }
      return true;
    } catch {
      return false;
    } finally {
      this.flushing = false;
    }
  }

  private snapshotOf(entry: string) {
    const item = this.rowFor(entry);
    return item ? JSON.stringify(item.row) : '';
  }

  /** Fetch every row changed since the last pull. Returns false if offline. */
  private async pull(): Promise<boolean> {
    const since = this.state.lastPulled
      ? new Date(Date.parse(this.state.lastPulled) - PULL_OVERLAP_MS).toISOString()
      : '1970-01-01T00:00:00Z';
    let newest = this.state.lastPulled;
    try {
      for (const table of ['notes', 'highlights', 'reading_state'] as const) {
        const { data, error } = await this.db
          .from(table)
          .select('*')
          .gt('synced_at', since)
          .order('synced_at', { ascending: true });
        if (error) return false;
        for (const row of data ?? []) {
          this.merge(table, row);
          if (!newest || row.synced_at > newest) newest = row.synced_at;
        }
      }
      this.set({ lastPulled: newest });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Take in a row from the server. Rows with unsent local changes are left
   * alone (the local edit is newer and will be sent). `force` is used for the
   * server's answer to our own upsert, which is the final word.
   */
  private merge(table: TableName, row: Note | Highlight | ReadingState, force = false) {
    if (table === 'notes') {
      const note = row as Note;
      if (!force && this.state.outbox.includes(`notes:${note.id}`)) return;
      if (force || newer(this.state.notes[note.id], note)) {
        this.set({ notes: { ...this.state.notes, [note.id]: note } });
      }
    } else if (table === 'highlights') {
      const h = row as Highlight;
      if (!force && this.state.outbox.includes(`highlights:${h.verse_id}`)) return;
      if (force || newer(this.state.highlights[h.verse_id], h)) {
        this.set({ highlights: { ...this.state.highlights, [h.verse_id]: h } });
      }
    } else {
      const r = row as ReadingState;
      if (!force && this.state.outbox.includes('reading_state:me')) return;
      if (force || newer(this.state.reading ?? undefined, r)) this.set({ reading: r });
    }
  }

  /** Live updates from other devices. */
  private listen() {
    const filter = `user_id=eq.${this.userId}`;
    const channel = this.db.channel(`user-${this.userId}`);
    for (const table of ['notes', 'highlights', 'reading_state'] as const) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table, filter }, (payload) => {
        if (payload.new && 'updated_at' in payload.new) {
          this.merge(table, payload.new as Note | Highlight | ReadingState);
        }
      });
    }
    channel.subscribe((status) => {
      // After a reconnect, catch up on anything missed while disconnected.
      if (status === 'SUBSCRIBED') void this.sync();
    });
    this.channel = channel;
  }
}
