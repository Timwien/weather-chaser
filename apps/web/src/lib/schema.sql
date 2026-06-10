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
