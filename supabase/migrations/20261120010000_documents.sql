-- Documents: sermons, study guides, longer writing. Rich text (Tiptap JSON),
-- same sync model as notes (see 20261120000000_notes_highlights.sql).

create table public.documents (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null default '',
  -- The document as Tiptap/ProseMirror JSON: paragraphs, headings, fonts, colors, note cards…
  content jsonb not null default '{"type":"doc","content":[]}',
  -- Plain text version, for search and previews.
  plain_text text not null default '',
  -- Verses the document links to (BBCCCVVV; chapter-only links use verse 0).
  verse_ids integer[] not null default '{}',
  -- Notes placed in the document as cards.
  note_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  synced_at timestamptz not null default now()
);
create index documents_user_synced on public.documents (user_id, synced_at);
create index documents_verse_ids on public.documents using gin (verse_ids);

create trigger documents_keep_newest before insert or update on public.documents
  for each row execute function public.keep_newest();

alter table public.documents enable row level security;
create policy "own documents" on public.documents for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter publication supabase_realtime add table public.documents;
