-- ---------------------------------------------------------------------
-- The owner's customer book and restock list, as functions, not views.
--
-- Supabase's security scan flagged customer_directory and restock_board
-- ("auth_users_exposed", critical): views in the public schema that
-- read auth.users and run with their owner's rights. Both filtered on
-- is_owner(), so a customer reading them got no rows and nothing leaked
-- — but a view like that is one forgotten WHERE away from handing every
-- customer's email to anyone signed in.
--
-- Each becomes a SECURITY DEFINER function that returns the same rows,
-- to the owner only, and the views are dropped. The panel calls them
-- with rpc(); PostgREST still lets it filter and order the result.
--
-- customer_photos stays a view (it reads profiles, not auth.users), but
-- runs with the reader's rights from now on.
--
-- Safe to run twice. All or nothing.
-- ---------------------------------------------------------------------

begin;

create or replace function public.owner_customer_directory()
returns table (
  user_id uuid, email text, joined_at timestamptz, full_name text,
  phone text, avatar_url text, addr_label text, addr_phone text,
  postal text, address text
)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select u.id, u.email::text, u.created_at,
         nullif(p.full_name, ''), p.phone, p.avatar_url,
         a.label, a.phone, a.postal, a.address
    from auth.users u
    left join profiles p on p.user_id = u.id
    left join lateral (
      select label, phone, postal, address
        from addresses
       where addresses.user_id = u.id
       order by is_default desc, created_at
       limit 1) a on true
   where is_owner()
     and u.id <> (select owner_uid from settings where id = 1);
$$;

create or replace function public.owner_restock_board()
returns table (
  user_id uuid, product_id uuid, created_at timestamptz, done_at timestamptz,
  customer text, phone text, avatar_url text, email text,
  en text, bn text, ja text, w text, img text, tag text
)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select r.user_id, r.product_id, r.created_at, r.done_at,
         coalesce(nullif(p.full_name, ''), split_part(u.email::text, '@', 1)),
         p.phone, p.avatar_url, u.email::text,
         pr.en, pr.bn, pr.ja, pr.w, pr.img, pr.tag
    from restock_requests r
    join auth.users u on u.id = r.user_id
    left join profiles p on p.user_id = r.user_id
    join products pr on pr.id = r.product_id
   where is_owner();
$$;

-- Signed-in only, and the function itself returns nothing to anyone
-- who is not the owner. Never to the public or the anonymous key.
revoke all on function public.owner_customer_directory() from public, anon;
revoke all on function public.owner_restock_board()      from public, anon;
grant execute on function public.owner_customer_directory() to authenticated;
grant execute on function public.owner_restock_board()      to authenticated;

-- The views go once the panel reads the functions (deployed first).
drop view if exists public.customer_directory;
drop view if exists public.restock_board;

-- customer_photos reads only profiles, and the owner may read every
-- profile by its own policy. So it can run with the reader's rights
-- rather than its creator's, which is what Supabase's scan asks of views.
alter view public.customer_photos set (security_invoker = true);

commit;
