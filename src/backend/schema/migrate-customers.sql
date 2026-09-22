/*
 * The owner's customer book.
 *
 * Every registered account, on a card: who they are, how to reach them,
 * where the box goes, and what they have ordered and asked for. A new
 * registration appears the moment it exists — the list comes from the
 * accounts themselves, not from anything the customer chose to fill in,
 * so somebody who signed up an hour ago and typed nothing is there with
 * their email and a blank face.
 *
 * Orders and restock requests are already the owner's to read; the
 * panel joins them by user id. What was missing was the list of people:
 * auth.users is not reachable through the API, and a profile row only
 * exists once a customer has set something. This view reaches across
 * both and hands the owner one row per account.
 *
 * Safe to run more than once.
 */

create or replace view customer_directory
with (security_invoker = false) as
  select u.id                                   as user_id,
         u.email,
         u.created_at                           as joined_at,
         nullif(p.full_name, '')                as full_name,
         p.phone,
         p.avatar_url,
         a.label                                as addr_label,
         a.phone                                as addr_phone,
         a.postal,
         a.address
    from auth.users u
    left join profiles p on p.user_id = u.id
    left join lateral (
      /* Their default address, or the oldest one if none is marked —
         the same choice the checkout makes. */
      select label, phone, postal, address
        from addresses
       where user_id = u.id
       order by is_default desc, created_at
       limit 1
    ) a on true
   where is_owner()
     /* The owner's own account is not a customer. */
     and u.id <> (select owner_uid from settings where id = 1);

revoke all on customer_directory from public, anon;
grant select on customer_directory to authenticated;

/* ---------------------------- verification ---------------------------
 * -- as the owner: one row per account, the owner's own excluded
 * select count(*) from customer_directory;
 * -- as a customer: nothing
 * ------------------------------------------------------------------- */
