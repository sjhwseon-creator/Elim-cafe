-- Add Hot/Ice variants without changing existing orders or RLS policies.
-- Run this migration before deploying the matching customer and staff code.

begin;

alter table public.order_items
  add column if not exists variant text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'order_items_variant_check'
      and conrelid = 'public.order_items'::regclass
  ) then
    alter table public.order_items
      add constraint order_items_variant_check
      check (variant is null or variant in ('hot', 'ice'));
  end if;
end $$;

create or replace function public.create_order(
  p_customer_name text,
  p_payment_method text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order_id uuid;
  v_order_number integer;
  v_total numeric(10, 2);
begin
  if char_length(btrim(coalesce(p_customer_name, ''))) not between 1 and 100 then
    raise exception 'Customer name must be between 1 and 100 characters.';
  end if;

  if p_payment_method not in ('paypal', 'sepa', 'cash') then
    raise exception 'Invalid payment method.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'At least one order item is required.';
  end if;

  if jsonb_array_length(p_items) > 50 then
    raise exception 'Too many order items.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_items) as item(item_id text, variant text, quantity integer)
    where item.item_id is null
       or item.quantity is null
       or item.quantity < 1
       or item.quantity > 99
  ) then
    raise exception 'Each item needs a valid ID and quantity between 1 and 99.';
  end if;

  -- Coffee except Espresso and every Latte support Hot/Ice. Missing variants
  -- from an older cached customer app are treated as Hot for compatibility.
  if exists (
    select 1
    from jsonb_to_recordset(p_items) as item(item_id text, variant text, quantity integer)
    left join public.menu_items as menu
      on menu.id = item.item_id
     and menu.active = true
    where menu.id is null
       or (
         menu.id <> 'espresso'
         and menu.category in ('Coffee', 'Latte')
         and coalesce(nullif(lower(btrim(item.variant)), ''), 'hot') not in ('hot', 'ice')
       )
       or (
         not (menu.id <> 'espresso' and menu.category in ('Coffee', 'Latte'))
         and nullif(btrim(coalesce(item.variant, '')), '') is not null
       )
  ) then
    raise exception 'One or more menu items or variants are unavailable.';
  end if;

  with requested as (
    select
      item.item_id,
      case
        when menu.id <> 'espresso' and menu.category in ('Coffee', 'Latte')
          then coalesce(nullif(lower(btrim(item.variant)), ''), 'hot')
        else null
      end as variant,
      sum(item.quantity)::integer as quantity
    from jsonb_to_recordset(p_items) as item(item_id text, variant text, quantity integer)
    join public.menu_items as menu
      on menu.id = item.item_id
     and menu.active = true
    group by
      item.item_id,
      case
        when menu.id <> 'espresso' and menu.category in ('Coffee', 'Latte')
          then coalesce(nullif(lower(btrim(item.variant)), ''), 'hot')
        else null
      end
  )
  select sum(
    (menu.price + case when requested.variant = 'ice' then 0.50 else 0 end)
    * requested.quantity
  )::numeric(10, 2)
  into v_total
  from requested
  join public.menu_items as menu
    on menu.id = requested.item_id
   and menu.active = true;

  if v_total is null then
    raise exception 'One or more menu items are unavailable.';
  end if;

  insert into public.orders (customer_name, total_price, payment_method, status)
  values (btrim(p_customer_name), v_total, p_payment_method, 'new')
  returning id, order_number into v_order_id, v_order_number;

  with requested as (
    select
      item.item_id,
      case
        when menu.id <> 'espresso' and menu.category in ('Coffee', 'Latte')
          then coalesce(nullif(lower(btrim(item.variant)), ''), 'hot')
        else null
      end as variant,
      sum(item.quantity)::integer as quantity
    from jsonb_to_recordset(p_items) as item(item_id text, variant text, quantity integer)
    join public.menu_items as menu
      on menu.id = item.item_id
     and menu.active = true
    group by
      item.item_id,
      case
        when menu.id <> 'espresso' and menu.category in ('Coffee', 'Latte')
          then coalesce(nullif(lower(btrim(item.variant)), ''), 'hot')
        else null
      end
  )
  insert into public.order_items (order_id, item_name, variant, quantity, unit_price)
  select
    v_order_id,
    menu.name,
    requested.variant,
    requested.quantity,
    menu.price + case when requested.variant = 'ice' then 0.50 else 0 end
  from requested
  join public.menu_items as menu
    on menu.id = requested.item_id
   and menu.active = true;

  return jsonb_build_object(
    'id', v_order_id,
    'order_number', v_order_number,
    'total_price', v_total
  );
end;
$$;

revoke all on function public.create_order(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.create_order(text, text, jsonb) to anon, authenticated;

commit;
