-- Migration for X3 (recent searches / "Letzte Suchen").
-- Run this in Supabase Dashboard -> SQL Editor against the existing project.
-- Idempotent: safe to run more than once.
--
-- Until this is applied, the X3 UI degrades gracefully — recordSearch() and the
-- history section swallow the "relation does not exist" error and simply show
-- nothing.

create table if not exists search_history (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('finder','route')),
  config_json jsonb not null,
  created_at  timestamptz not null default now()
);

alter table search_history enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'search_history'
      and policyname = 'Users can CRUD own history'
  ) then
    create policy "Users can CRUD own history"
      on search_history for all to authenticated
      using ((select auth.uid()) = user_id)
      with check ((select auth.uid()) = user_id);
  end if;
end $$;

create index if not exists search_history_user_created_idx
  on search_history (user_id, created_at desc);

-- Note: the favorites table already carries `unique (user_id, lat, lng)`
-- (see src/lib/schema.sql), so R4's dedupe constraint needs no migration.
