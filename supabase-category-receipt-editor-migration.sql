-- Elim Cafe category ticket printing and receipt editor migration.
-- Run once in the Supabase SQL Editor before deploying the matching staff files.
-- Existing orders, items, print tracking, authentication, and RLS are preserved.

begin;

alter table public.order_items
  add column if not exists category text;

-- Backfill existing items using the trusted menu catalog where names match.
update public.order_items as oi
set category = mi.category
from public.menu_items as mi
where oi.category is null
  and lower(btrim(oi.item_name)) = lower(btrim(mi.name));

create or replace function public.set_order_item_category()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.category is null or btrim(new.category) = '' then
    select mi.category
    into new.category
    from public.menu_items as mi
    where lower(btrim(mi.name)) = lower(btrim(new.item_name))
    limit 1;
  end if;

  new.category := coalesce(nullif(btrim(new.category), ''), 'Other');
  return new;
end;
$$;

drop trigger if exists set_order_item_category_before_write on public.order_items;
create trigger set_order_item_category_before_write
before insert or update of item_name, category on public.order_items
for each row execute function public.set_order_item_category();

revoke all on function public.set_order_item_category() from public, anon, authenticated;

alter table public.order_items
  alter column category set default 'Other';

update public.order_items
set category = 'Other'
where category is null or btrim(category) = '';

alter table public.order_items
  alter column category set not null;

alter table public.receipt_settings
  add column if not exists custom_text text not null default '',
  add column if not exists show_category boolean not null default true,
  add column if not exists show_category_subtotal boolean not null default true,
  add column if not exists cafe_name_size smallint not null default 2,
  add column if not exists category_size smallint not null default 2,
  add column if not exists details_size smallint not null default 1,
  add column if not exists items_size smallint not null default 2,
  add column if not exists summary_size smallint not null default 1,
  add column if not exists footer_size smallint not null default 1,
  add column if not exists custom_text_size smallint not null default 1,
  add column if not exists cafe_name_align text not null default 'center',
  add column if not exists category_align text not null default 'center',
  add column if not exists details_align text not null default 'left',
  add column if not exists items_align text not null default 'left',
  add column if not exists summary_align text not null default 'left',
  add column if not exists footer_align text not null default 'center',
  add column if not exists custom_text_align text not null default 'center',
  add column if not exists category_bold boolean not null default true,
  add column if not exists items_bold boolean not null default true;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'receipt_settings_custom_text_length_check'
      and conrelid = 'public.receipt_settings'::regclass
  ) then
    alter table public.receipt_settings
      add constraint receipt_settings_custom_text_length_check
      check (char_length(custom_text) <= 240);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'receipt_settings_font_sizes_check'
      and conrelid = 'public.receipt_settings'::regclass
  ) then
    alter table public.receipt_settings
      add constraint receipt_settings_font_sizes_check
      check (
        cafe_name_size between 1 and 3
        and category_size between 1 and 3
        and details_size between 1 and 2
        and items_size between 1 and 3
        and summary_size between 1 and 2
        and footer_size between 1 and 2
        and custom_text_size between 1 and 2
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'receipt_settings_alignments_check'
      and conrelid = 'public.receipt_settings'::regclass
  ) then
    alter table public.receipt_settings
      add constraint receipt_settings_alignments_check
      check (
        cafe_name_align in ('left', 'center', 'right')
        and category_align in ('left', 'center', 'right')
        and details_align in ('left', 'center', 'right')
        and items_align in ('left', 'center', 'right')
        and summary_align in ('left', 'center', 'right')
        and footer_align in ('left', 'center', 'right')
        and custom_text_align in ('left', 'center', 'right')
      );
  end if;
end $$;

-- Existing staff-only RLS policies continue to protect this row. Extend only
-- the already-authorized column update grant for the new editor fields.
grant update (
  custom_text,
  show_category,
  show_category_subtotal,
  cafe_name_size,
  category_size,
  details_size,
  items_size,
  summary_size,
  footer_size,
  custom_text_size,
  cafe_name_align,
  category_align,
  details_align,
  items_align,
  summary_align,
  footer_align,
  custom_text_align,
  category_bold,
  items_bold
) on public.receipt_settings to authenticated;

commit;
