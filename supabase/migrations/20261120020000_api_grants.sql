-- Newer Supabase cloud projects don't expose new tables to the Data API on
-- their own (auto_expose_new_tables = false), so grant access explicitly.
-- Signed-in users only; row-level security still limits each person to their
-- own rows. Signed-out visitors (anon) get no access.
grant select, insert, update, delete
  on table public.notes, public.highlights, public.reading_state, public.documents
  to authenticated;
