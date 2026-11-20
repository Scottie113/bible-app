/** Rows as stored in Postgres (supabase/migrations) and on the device. Times are ISO strings. */

export type Note = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  /** Verse ids (BBCCCVVV) the body links to; chapter-only links use verse 0. */
  verse_ids: number[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  synced_at?: string;
};

export const HIGHLIGHT_COLORS = ['yellow', 'green', 'blue', 'pink', 'purple'] as const;
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];

export type Highlight = {
  user_id: string;
  verse_id: number;
  color: HighlightColor;
  updated_at: string;
  deleted_at: string | null;
  synced_at?: string;
};

export type ReadingState = {
  user_id: string;
  book: number;
  chapter: number;
  translation: string;
  compare: string[];
  updated_at: string;
  synced_at?: string;
};

/** Rich-text document (sermon, study guide…). `content` is Tiptap/ProseMirror JSON. */
export type DocumentRow = {
  id: string;
  user_id: string;
  title: string;
  content: RichContent;
  plain_text: string;
  verse_ids: number[];
  note_ids: string[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  synced_at?: string;
};

/** ProseMirror JSON node. */
export type RichContent = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: RichContent[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
};

export type TableName = 'notes' | 'highlights' | 'reading_state' | 'documents';
