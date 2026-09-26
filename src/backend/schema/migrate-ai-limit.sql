-- ---------------------------------------------------------------------
-- A ceiling on the smart search.
--
-- Run this once in the Supabase SQL editor. Safe to run twice.
--
-- The smart search is public: any shopper's search box may call it, with
-- the public key, and each call spends the shop's Groq allowance. Without
-- a count, one script in a loop could use the whole day's allowance in
-- minutes and leave every real customer with plain local ranking. So the
-- Edge Function writes one row per call here and refuses once an address
-- has made 30 in the last hour, or the shop 2000 in the last day.
--
-- Written and read by the Edge Function using the service key, never by
-- a browser: RLS is on and there is deliberately no policy, which denies
-- everyone except the service key. The anon key can neither read these
-- rows nor forge them.
-- ---------------------------------------------------------------------

create table if not exists ai_calls (
  id  bigserial primary key,
  ip  text not null,
  at  timestamptz not null default now()
);

-- One address's calls in the last hour.
create index if not exists ai_calls_ip_idx on ai_calls(ip, at desc);

-- Everybody's calls in the last day, and the pruning of older ones.
create index if not exists ai_calls_at_idx on ai_calls(at);

-- Supabase's default privileges hand every new table to anon and
-- authenticated; RLS with no policy already refuses them, and this says
-- so outright.
revoke all on ai_calls from anon, authenticated;
revoke all on sequence ai_calls_id_seq from anon, authenticated;

alter table ai_calls enable row level security;
-- No policies on purpose: only the service key may touch this table.

-- Old rows are pruned by the Edge Function itself, as it writes new ones:
-- nothing here needs anything older than a day, and pg_cron is not
-- enabled on this project.

-- ---------------------------------------------------------------------
-- Check it worked:
--
--   select relrowsecurity from pg_class where relname = 'ai_calls';
--   select policyname from pg_policies where tablename = 'ai_calls';
--
-- Expect true, and no rows: nobody but the service key may touch it.
-- ---------------------------------------------------------------------
