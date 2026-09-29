create extension if not exists pgcrypto;

create sequence if not exists public.order_number_seq
  start with 100
  increment by 1;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number integer not null unique default nextval('public.order_number_seq'),
  customer_name text not null,
  total_price numeric(10, 2) not null check (total_price >= 0),
  payment_method text check (payment_method is null or payment_method in ('paypal', 'sepa', 'cash')),
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

create index if not exists orders_created_at_idx on public.orders(created_at desc);
create index if not exists order_items_order_id_idx on public.order_items(order_id);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

grant usage on schema public to anon;
grant usage, select on sequence public.order_number_seq to anon;
grant select, insert on public.orders to anon;
grant update(status) on public.orders to anon;
grant select, insert on public.order_items to anon;

drop policy if exists "Anyone can create orders" on public.orders;
create policy "Anyone can create orders"
on public.orders for insert
to anon
with check (status = 'new');

drop policy if exists "Anyone can view orders" on public.orders;
create policy "Anyone can view orders"
on public.orders for select
to anon
using (true);

drop policy if exists "Anyone can update order status" on public.orders;
create policy "Anyone can update order status"
on public.orders for update
to anon
using (true)
with check (status in ('new', 'preparing', 'completed'));

drop policy if exists "Anyone can create order items" on public.order_items;
create policy "Anyone can create order items"
on public.order_items for insert
to anon
with check (true);

drop policy if exists "Anyone can view order items" on public.order_items;
create policy "Anyone can view order items"
on public.order_items for select
to anon
using (true);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'order_items'
  ) then
    alter publication supabase_realtime add table public.order_items;
  end if;
end $$;
