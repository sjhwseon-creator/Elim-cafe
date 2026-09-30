-- Elim Cafe public-deployment security migration.
-- Safe to run more than once. Existing orders and order_items are preserved.

create extension if not exists pgcrypto;

create sequence if not exists public.order_number_seq
  start with 100
  increment by 1;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number integer not null unique default nextval('public.order_number_seq'),
  customer_name text not null,
  total_price numeric(10, 2) not null check (total_price >= 0),
  payment_method text,
  status text not null default 'new' check (status in ('new', 'preparing', 'completed')),
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  item_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10, 2) not null check (unit_price >= 0)
);

alter table public.orders
  add column if not exists payment_method text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_payment_method_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_payment_method_check
      check (payment_method is null or payment_method in ('paypal', 'sepa', 'cash'));
  end if;
end $$;

alter table public.orders
  alter column order_number set default nextval('public.order_number_seq');

select setval(
  'public.order_number_seq',
  greatest(coalesce((select max(order_number) from public.orders), 99), 99),
  true
);

create table if not exists public.staff_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('staff')),
  created_at timestamptz not null default now()
);

create table if not exists public.menu_items (
  id text primary key,
  category text not null,
  name text not null,
  price numeric(10, 2) not null check (price >= 0),
  active boolean not null default true
);

create index if not exists orders_created_at_idx on public.orders(created_at desc);
create index if not exists order_items_order_id_idx on public.order_items(order_id);

insert into public.menu_items (id, category, name, price, active)
values
  ('espresso', 'Coffee', 'Espresso', 2.00, true),
  ('americano', 'Coffee', 'Americano', 2.00, true),
  ('cappuccino', 'Coffee', 'Cappuccino', 2.50, true),
  ('mocha', 'Coffee', 'Mocha-Latte', 2.50, true),
  ('caramel-macchiato', 'Coffee', 'Caramel Macchiato', 2.50, true),
  ('vanilla-latte', 'Coffee', 'Vanilla Latte', 2.50, true),
  ('korean-mix-coffee', 'Coffee', 'Korean mix-coffee', 2.50, true),
  ('matcha-latte', 'Latte', 'Matcha Latte', 3.00, true),
  ('strawberry-latte', 'Latte', 'Strawberry Latte', 3.00, true),
  ('chocolate-latte', 'Latte', 'Chocolate Latte', 3.00, true),
  ('yuzu-tea', 'Latte', 'Yuzu-tea', 2.00, true),
  ('blue-lemon-ade', 'Ade', 'BLUE Lemon-Ade', 2.50, true),
  ('strawberry-ade', 'Ade', 'Strawberry-Ade', 2.50, true),
  ('sunset-mango-ade', 'Ade', 'Sunset Mango-Ade', 2.50, true)
on conflict (id) do update
set category = excluded.category,
    name = excluded.name,
    price = excluded.price,
    active = excluded.active;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.staff_profiles
    where user_id = auth.uid()
      and role = 'staff'
  );
$$;

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
  v_requested_count integer;
  v_matched_count integer;
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
    from jsonb_to_recordset(p_items) as item(item_id text, quantity integer)
    where item.item_id is null
       or item.quantity is null
       or item.quantity < 1
       or item.quantity > 99
  ) then
    raise exception 'Each item needs a valid ID and quantity between 1 and 99.';
  end if;

  with requested as (
    select item.item_id, sum(item.quantity)::integer as quantity
    from jsonb_to_recordset(p_items) as item(item_id text, quantity integer)
    group by item.item_id
  )
  select count(*) into v_requested_count from requested;

  with requested as (
    select item.item_id, sum(item.quantity)::integer as quantity
    from jsonb_to_recordset(p_items) as item(item_id text, quantity integer)
    group by item.item_id
  )
  select count(*), sum(menu.price * requested.quantity)::numeric(10, 2)
  into v_matched_count, v_total
  from requested
  join public.menu_items as menu
    on menu.id = requested.item_id
   and menu.active = true;

  if v_matched_count <> v_requested_count or v_total is null then
    raise exception 'One or more menu items are unavailable.';
  end if;

  insert into public.orders (customer_name, total_price, payment_method, status)
  values (btrim(p_customer_name), v_total, p_payment_method, 'new')
  returning id, order_number into v_order_id, v_order_number;

  with requested as (
    select item.item_id, sum(item.quantity)::integer as quantity
    from jsonb_to_recordset(p_items) as item(item_id text, quantity integer)
    group by item.item_id
  )
  insert into public.order_items (order_id, item_name, quantity, unit_price)
  select v_order_id, menu.name, requested.quantity, menu.price
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

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.staff_profiles enable row level security;
alter table public.menu_items enable row level security;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('orders', 'order_items', 'staff_profiles', 'menu_items')
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  end loop;
end $$;

revoke all on public.orders from anon, authenticated;
revoke all on public.order_items from anon, authenticated;
revoke all on public.staff_profiles from anon, authenticated;
revoke all on public.menu_items from anon, authenticated;
revoke all on sequence public.order_number_seq from anon, authenticated;

grant usage on schema public to anon, authenticated;

revoke all on function public.is_staff() from public, anon, authenticated;
grant execute on function public.is_staff() to authenticated;

revoke all on function public.create_order(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.create_order(text, text, jsonb) to anon, authenticated;

grant select on public.orders to authenticated;
grant update (status) on public.orders to authenticated;
grant select on public.order_items to authenticated;
grant select (user_id, role) on public.staff_profiles to authenticated;

create policy "Staff can read own profile"
on public.staff_profiles
for select
to authenticated
using (user_id = auth.uid() and public.is_staff());

create policy "Staff can read orders"
on public.orders
for select
to authenticated
using (public.is_staff());

create policy "Staff can update order status"
on public.orders
for update
to authenticated
using (public.is_staff())
with check (
  public.is_staff()
  and status in ('new', 'preparing', 'completed')
);

create policy "Staff can read order items"
on public.order_items
for select
to authenticated
using (public.is_staff());

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'order_items'
  ) then
    alter publication supabase_realtime add table public.order_items;
  end if;
end $$;

-- After creating the shared staff user in Supabase Authentication, run this
-- separately with the real email address in the SQL editor:
-- insert into public.staff_profiles (user_id, role)
-- select id, 'staff' from auth.users where email = 'STAFF_EMAIL_HERE'
-- on conflict (user_id) do update set role = excluded.role;
