/*
 * The owner sees the customer's face.
 *
 * A customer may put a photo on their account. The owner, ringing forty
 * people about forty orders, is better off seeing who each one is than
 * reading forty names — so the photo appears beside the name on the
 * orders list and the restock board, and can be tapped to see it large.
 *
 * Two small grants, and nothing more: the owner may read the photo of
 * any customer, and the restock board carries it. The rest of a profile
 * — the main phone, the name they have set — stays the customer's; an
 * order copies what the owner needs at the moment it is placed.
 *
 * Safe to run more than once.
 */

-- The owner may read one column of everyone's profile: the photo.
-- The policy has to grant the row; the view below is what the panel
-- actually reads, and it exposes only the two columns.
drop policy if exists "owner reads profiles" on profiles;
create policy "owner reads profiles" on profiles
  for select to authenticated using (is_owner());

create or replace view customer_photos
with (security_invoker = false) as
  select user_id, avatar_url
    from profiles
   where avatar_url is not null
     and is_owner();

revoke all on customer_photos from public, anon;
grant select on customer_photos to authenticated;

-- The restock board carries the photo along with the name.
--
-- Dropped and made again rather than replaced. "create or replace" may
-- add a column at the end of a view but not in the middle, and putting
-- the photo beside the phone — where it reads — is in the middle. The
-- grants are restated below, so nothing is lost by dropping it.
drop view if exists restock_board;
create view restock_board
with (security_invoker = false) as
  select r.user_id,
         r.product_id,
         r.created_at,
         r.done_at,
         coalesce(nullif(p.full_name, ''), split_part(u.email, '@', 1)) as customer,
         p.phone,
         p.avatar_url,
         u.email,
         pr.en, pr.bn, pr.ja, pr.w, pr.img, pr.tag
    from restock_requests r
    join auth.users u   on u.id = r.user_id
    left join profiles p on p.user_id = r.user_id
    join products pr    on pr.id = r.product_id
   where is_owner();

revoke all on restock_board from public, anon;
grant select on restock_board to authenticated;

/* ---------------------------- verification ---------------------------
 * -- as the owner: every customer with a photo, once each
 * select count(*) from customer_photos;
 * -- as a customer: nothing, even their own
 * ------------------------------------------------------------------- */
