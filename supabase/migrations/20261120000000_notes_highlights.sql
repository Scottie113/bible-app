-- Notes, highlights and reading place, one set per user.
--
-- Sync model (see src/sync/):
--   * Rows get their id on the device (uuid), so they can be created offline.
--   * updated_at is set by the device when the user makes the change; the
--     newer edit wins (last-write-wins), enforced by keep_newest() below.
--   * synced_at is set by the server on every write; devices pull
--     "everything with synced_at after the last time I pulled".
--   * Deletes are soft (deleted_at) so other devices learn about them.

create table public.notes (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null default '',
  body text not null default '',
  -- Every verse id (BBCCCVVV) the note links to; chapter-only links use verse 0.
  -- Computed on the device from the body text.
  verse_ids integer[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  synced_at timestamptz not null default now()
);
create index notes_user_synced on public.notes (user_id, synced_at);
create index notes_verse_ids on public.notes using gin (verse_ids);

create table public.highlights (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  verse_id integer not null,
  color text not null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  synced_at timestamptz not null default now(),
  primary key (user_id, verse_id)
);
create index highlights_user_synced on public.highlights (user_id, synced_at);

create table public.reading_state (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  book smallint not null,
  chapter smallint not null,
  translation text not null,
  compare text[] not null default '{}',
  updated_at timestamptz not null default now(),
  synced_at timestamptz not null default now()
);

-- Keep the newest edit and stamp synced_at.
create function public.keep_newest() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return old; -- an older (e.g. offline) edit arrived late: ignore it
  end if;
  new.synced_at := clock_timestamp();
  return new;
end;
$$;

create trigger notes_keep_newest before insert or update on public.notes
  for each row execute function public.keep_newest();
create trigger highlights_keep_newest before insert or update on public.highlights
  for each row execute function public.keep_newest();
create trigger reading_state_keep_newest before insert or update on public.reading_state
  for each row execute function public.keep_newest();

-- Row-level security: each person can only see and change their own rows.
alter table public.notes enable row level security;
alter table public.highlights enable row level security;
alter table public.reading_state enable row level security;

create policy "own notes" on public.notes for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own highlights" on public.highlights for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own reading state" on public.reading_state for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Live updates to other devices.
alter publication supabase_realtime add table public.notes, public.highlights, public.reading_state;
