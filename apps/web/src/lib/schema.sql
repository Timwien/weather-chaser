-- Run this in Supabase Dashboard -> SQL Editor

-- saved_routes
create table if not exists saved_routes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  stops_json  jsonb not null,
  date_from   date,
  date_to     date,
  created_at  timestamptz default now()
);
alter table saved_routes enable row level security;
create policy "Users can CRUD own routes"
  on saved_routes for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- saved_finder_searches
create table if not exists saved_finder_searches (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  config_json jsonb not null,
  created_at  timestamptz default now()
);
alter table saved_finder_searches enable row level security;
create policy "Users can CRUD own finder searches"
  on saved_finder_searches for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- favorites
create table if not exists favorites (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  place_name  text not null,
  lat         double precision not null,
  lng         double precision not null,
  created_at  timestamptz default now(),
  unique (user_id, lat, lng)
);
alter table favorites enable row level security;
create policy "Users can CRUD own favorites"
  on favorites for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- subscriptions (Phase 4 — written ONLY by the Stripe webhook via service_role;
-- users can read their own row, never write it)
create table if not exists subscriptions (
  user_id                uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id     text,
  stripe_subscription_id text,
  status                 text not null default 'inactive', -- active | trialing | past_due | canceled | inactive
  price_id               text,
  current_period_end     timestamptz,
  updated_at             timestamptz default now()
);
alter table subscriptions enable row level security;
create policy "Users can read own subscription"
  on subscriptions for select to authenticated
  using ((select auth.uid()) = user_id);
-- No insert/update/delete policies: only the service_role key (webhook) writes.

-- search_history (X3 — recent searches, capped to newest 15 per user client-side)
create table if not exists search_history (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('finder','route')),
  config_json jsonb not null,           -- SavedSearchConfigV1
  created_at  timestamptz not null default now()
);
alter table search_history enable row level security;
create policy "Users can CRUD own history"
  on search_history for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create index if not exists search_history_user_created_idx
  on search_history (user_id, created_at desc);

-- feedback (analytics-2026-07 — in-app feedback, guest-capable)
-- Written ONLY by /api/feedback via service_role. RLS enabled with NO
-- policies = deny-all for anon + authenticated (same posture as subscriptions).
create table if not exists feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,  -- null = guest
  rating      smallint not null check (rating between 1 and 5),
  message     text check (message is null or char_length(message) <= 2000),
  context     jsonb,  -- { source, mode, locale, viewport_w, viewport_h, is_mobile }
  created_at  timestamptz not null default now()
);
alter table feedback enable row level security;
create index if not exists feedback_created_idx on feedback (created_at desc);
