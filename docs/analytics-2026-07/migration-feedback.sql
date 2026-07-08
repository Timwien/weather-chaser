-- Migration: feedback table (analytics-2026-07)
-- Run this in the Supabase SQL editor (like migration-search-history.sql).
--
-- Feedback is guest-capable and written ONLY by the /api/feedback Vercel
-- function using the service_role key. RLS is enabled with NO policies =
-- deny-all for anon + authenticated (same posture as `subscriptions`).
-- The check constraints are defense-in-depth behind the API validation.

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
