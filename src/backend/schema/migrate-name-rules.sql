-- ---------------------------------------------------------------------
-- Two house rules, kept by the database so no way of adding things can
-- break them — the owner's panel, a phone, or SQL typed by hand.
--
-- 1. "Others" is always the last category. However many are added or
--    however they are dragged, it goes back to the end.
--
-- 2. Every word of an English name starts with a capital letter —
--    products, categories and deal cards. Only the first letter of each
--    word is raised; the rest is left as typed, so brand names such as
--    IBADAH, OKF or BBQ stay as they are. A word starts after a space,
--    "(", "[", "/" or a quote. Bangla and Japanese have no capitals, and
--    sizes (the separate weight field: 500g, 1 kg) are not touched.
--
-- Existing names are brought into line once, at the end.
-- Safe to run twice. All or nothing.
-- ---------------------------------------------------------------------

begin;

-- ---------------------------- rule 2: capitals -------------------------
create or replace function public.cap_words(s text)
returns text language plpgsql immutable
set search_path = public, pg_temp
as $$
declare out text := ''; prev text := ' '; c text;
begin
  if s is null then return null; end if;
  for i in 1 .. char_length(s) loop
    c := substr(s, i, 1);
    out := out || case when prev ~ '[[:space:](\[/"''“‘]' then upper(c) else c end;
    prev := c;
  end loop;
  return out;
end $$;

create or replace function public.cap_en_name()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.en := cap_words(new.en);
  return new;
end $$;

drop trigger if exists products_cap_en   on products;
drop trigger if exists categories_cap_en on categories;
drop trigger if exists deals_cap_en      on deals;
create trigger products_cap_en   before insert or update of en on products   for each row execute function cap_en_name();
create trigger categories_cap_en before insert or update of en on categories for each row execute function cap_en_name();
create trigger deals_cap_en      before insert or update of en on deals      for each row execute function cap_en_name();

-- --------------------------- rule 1: Others last -----------------------
create or replace function public.others_last()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$
declare top int;
begin
  select max(sort) into top from categories where id <> 'others' and archived_at is null;
  /* Only when it is not already last. The trigger runs once per
     statement, and a statement fires it even when it changes no rows,
     so the update must not run at all when there is nothing to do —
     otherwise it calls itself for ever. */
  if exists (select 1 from categories where id = 'others' and sort <= coalesce(top, 0)) then
    update categories set sort = coalesce(top, 0) + 1 where id = 'others';
  end if;
  return null;
end $$;

drop trigger if exists categories_others_last on categories;
create trigger categories_others_last
  after insert or update of sort, archived_at on categories
  for each statement execute function others_last();

-- Internal helpers: the API has no business calling them.
revoke all on function public.cap_words(text)  from public, anon, authenticated;
revoke all on function public.cap_en_name()    from public, anon, authenticated;
revoke all on function public.others_last()    from public, anon, authenticated;

-- ------------------------- bring today's names in line ------------------
update products   set en = en where en is distinct from cap_words(en);
update categories set en = en where en is distinct from cap_words(en);
update deals      set en = en where en is distinct from cap_words(en);
update categories set sort = sort where id = 'others';   -- fires others_last

commit;
