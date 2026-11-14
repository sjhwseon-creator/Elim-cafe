-- Fix Elim Cafe category ticket grouping for customer orders.
-- Safe to run more than once. Existing orders and financial data are preserved.

begin;

alter table public.order_items
  add column if not exists category text;

-- The column default is 'Other'. Previous trigger logic treated that as a real
-- category, so customer RPCs that omitted category produced one combined ticket.
update public.order_items as oi
set category = mi.category
from public.menu_items as mi
where (
    oi.category is null
    or btrim(oi.category) = ''
    or lower(btrim(oi.category)) = 'other'
  )
  and lower(btrim(oi.item_name)) = lower(btrim(mi.name));

create or replace function public.set_order_item_category()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.category is null
     or btrim(new.category) = ''
     or lower(btrim(new.category)) = 'other' then
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

commit;

notify pgrst, 'reload schema';
