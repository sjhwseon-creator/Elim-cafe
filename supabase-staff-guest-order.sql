-- Elim Cafe staff-entered Guest orders.
-- Run after the existing security, menu, wallet, and printer migrations.

begin;

create table if not exists public.guest_accounts (
  id smallint primary key default 1 check (id = 1),
  account_name text not null default 'Guest',
  total_ordered numeric(12, 2) not null default 0 check (total_ordered >= 0),
  order_count bigint not null default 0 check (order_count >= 0),
  last_order_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.guest_accounts (id, account_name)
values (1, 'Guest')
on conflict (id) do nothing;

alter table public.guest_accounts enable row level security;

drop policy if exists "Staff can read guest account" on public.guest_accounts;
create policy "Staff can read guest account"
on public.guest_accounts
for select
to authenticated
using (public.is_staff());

revoke all on public.guest_accounts from anon, authenticated;
grant select on public.guest_accounts to authenticated;

create or replace function public.staff_create_guest_order(
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
  v_order_id public.orders.id%type;
  v_order_number public.orders.order_number%type;
  v_total numeric(10, 2);
  v_guest_total numeric(12, 2);
  v_guest_order_count bigint;
begin
  if not public.is_staff() then
    raise exception 'Staff access required.' using errcode = '42501';
  end if;

  if char_length(btrim(coalesce(p_customer_name, ''))) not between 1 and 100 then
    raise exception 'Guest name must be between 1 and 100 characters.';
  end if;
  if coalesce(p_payment_method, '') not in ('paypal', 'sepa', 'cash') then
    raise exception 'Payment method must be paypal, sepa, or cash.';
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

  insert into public.orders (
    customer_name,
    customer_user_id,
    total_price,
    payment_method,
    status
  ) values (
    btrim(p_customer_name),
    null,
    v_total,
    p_payment_method,
    'new'
  )
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
  insert into public.order_items (
    order_id, category, item_name, variant, quantity, unit_price
  )
  select
    v_order_id,
    menu.category,
    menu.name,
    requested.variant,
    requested.quantity,
    menu.price + case when requested.variant = 'ice' then 0.50 else 0 end
  from requested
  join public.menu_items as menu
    on menu.id = requested.item_id
   and menu.active = true;

  insert into public.guest_accounts (id, account_name, total_ordered, order_count, last_order_at, updated_at)
  values (1, 'Guest', v_total, 1, now(), now())
  on conflict (id) do update
  set total_ordered = public.guest_accounts.total_ordered + excluded.total_ordered,
      order_count = public.guest_accounts.order_count + 1,
      last_order_at = excluded.last_order_at,
      updated_at = excluded.updated_at
  returning total_ordered, order_count into v_guest_total, v_guest_order_count;

  return jsonb_build_object(
    'id', v_order_id,
    'order_number', v_order_number,
    'total_price', v_total,
    'payment_method', p_payment_method,
    'guest_total_ordered', v_guest_total,
    'guest_order_count', v_guest_order_count
  );
end;
$$;

revoke all on function public.staff_create_guest_order(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.staff_create_guest_order(text, text, jsonb) to authenticated;

commit;

notify pgrst, 'reload schema';
