-- ---------------------------------------------------------------------
-- Two warnings from Supabase's Security Advisor (7 Oct 2026).
--
-- 1. prune_login_attempts() runs with its creator's rights but did not
--    fix its search_path, so a caller could in principle have it resolve
--    a table name to something of their own. Pinned to public.
--
-- 2. The old product-photos bucket let anyone LIST its files through a
--    broad SELECT policy. A public bucket serves its files by URL without
--    one. Photos moved to Cloudflare R2 long ago; nothing points here.
--    The owner's own upload/remove policy is left as it is.
--
-- Safe to run twice. All or nothing.
-- ---------------------------------------------------------------------

begin;

alter function public.prune_login_attempts() set search_path = public, pg_temp;

drop policy if exists "public read photos" on storage.objects;

commit;
