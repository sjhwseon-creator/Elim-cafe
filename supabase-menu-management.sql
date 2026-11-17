-- Dynamic staff-managed menu for Elim Cafe.
-- Run this after the existing security, wallet, guest-order, and Hot/Ice migrations.
-- Existing menu IDs, prices, orders, and order_items are preserved.

begin;

alter table public.menu_items
  add column if not exists sold_out boolean not null default false,
  add column if not exists variant_mode text,
  add column if not exists display_order integer;

update public.menu_items
set variant_mode = case
  when id = 'espresso' then 'hot_only'
  when category in ('Coffee', 'Latte') then 'hot_ice'
  else 'standard'
end
where variant_mode is null;

with ranked as (
  select id, row_number() over (
    partition by category
    order by case id
      when 'espresso' then 10 when 'americano' then 20 when 'cappuccino' then 30
      when 'mocha' then 40 when 'caramel-macchiato' then 50 when 'vanilla-latte' then 60
      when 'korean-mix-coffee' then 70 when 'matcha-latte' then 10
      when 'strawberry-latte' then 20 when 'chocolate-latte' then 30 when 'yuzu-tea' then 40
      when 'blue-lemon-ade' then 10 when 'strawberry-ade' then 20
      when 'sunset-mango-ade' then 30 else 1000 end,
      name
  ) * 10 as position
  from public.menu_items
)
update public.menu_items as menu
set display_order = ranked.position
from ranked
where menu.id = ranked.id
  and menu.display_order is null;

alter table public.menu_items
  alter column variant_mode set default 'standard',
  alter column variant_mode set not null,
  alter column display_order set default 0,
  alter column display_order set not null;

alter table public.menu_items drop constraint if exists menu_items_category_check;
alter table public.menu_items add constraint menu_items_category_check
  check (category in ('Coffee', 'Latte', 'Ade'));
alter table public.menu_items drop constraint if exists menu_items_variant_mode_check;
alter table public.menu_items add constraint menu_items_variant_mode_check
  check (variant_mode in ('hot_ice', 'hot_only', 'standard'));
alter table public.menu_items drop constraint if exists menu_items_name_not_blank_check;
alter table public.menu_items add constraint menu_items_name_not_blank_check
  check (char_length(btrim(name)) between 1 and 100);
alter table public.menu_items drop constraint if exists menu_items_display_order_check;
alter table public.menu_items add constraint menu_items_display_order_check
  check (display_order between 0 and 100000);

create index if not exists menu_items_display_idx
  on public.menu_items (active desc, category, display_order, name);

alter table public.menu_items enable row level security;
drop policy if exists "Anyone can read active menu items" on public.menu_items;
drop policy if exists "Staff can read all menu items" on public.menu_items;
drop policy if exists "Menu items are readable" on public.menu_items;
drop policy if exists "Menu catalog is publicly readable" on public.menu_items;
-- All menu rows are readable so Realtime can deliver active -> hidden updates.
-- Customer and Guest UIs still render only active rows, and every write/order
-- RPC independently enforces active/sold_out/variant rules.
create policy "Menu catalog is publicly readable"
on public.menu_items
for select
to anon, authenticated
using (true);

revoke all on public.menu_items from anon, authenticated;
grant select on public.menu_items to anon, authenticated;

create or replace function public.staff_create_menu_item(
  p_name text,
  p_category text,
  p_price numeric,
  p_variant_mode text default null,
  p_display_order integer default 0
)
returns public.menu_items
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_base_id text;
  v_id text;
  v_suffix integer := 1;
  v_variant_mode text;
  v_result public.menu_items%rowtype;
begin
  if not public.is_staff() then
    raise exception 'Staff access required.' using errcode = '42501';
  end if;
  if char_length(v_name) not between 1 and 100 then raise exception 'Menu name must be between 1 and 100 characters.'; end if;
  if p_category not in ('Coffee', 'Latte', 'Ade') then raise exception 'Invalid menu category.'; end if;
  if p_price is null or p_price < 0 or p_price > 10000 then raise exception 'Price must be between 0 and 10000.'; end if;
  if coalesce(p_display_order, 0) not between 0 and 100000 then raise exception 'Invalid display order.'; end if;

  v_variant_mode := coalesce(nullif(p_variant_mode, ''), case when p_category in ('Coffee', 'Latte') then 'hot_ice' else 'standard' end);
  if v_variant_mode not in ('hot_ice', 'hot_only', 'standard') then raise exception 'Invalid variant mode.'; end if;

  v_base_id := trim(both '-' from regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'));
  if v_base_id = '' then v_base_id := 'item-' || substr(md5(v_name || clock_timestamp()::text || random()::text), 1, 8); end if;
  v_id := v_base_id;
  while exists (select 1 from public.menu_items where id = v_id) loop
    v_suffix := v_suffix + 1;
    v_id := v_base_id || '-' || v_suffix::text;
  end loop;

  insert into public.menu_items (id, category, name, price, active, sold_out, variant_mode, display_order)
  values (v_id, p_category, v_name, round(p_price, 2), true, false, v_variant_mode, coalesce(p_display_order, 0))
  returning * into v_result;
  return v_result;
end;
$$;

create or replace function public.staff_update_menu_item(
  p_id text,
  p_name text,
  p_category text,
  p_price numeric,
  p_variant_mode text,
  p_sold_out boolean,
  p_active boolean,
  p_display_order integer default 0
)
returns public.menu_items
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_result public.menu_items%rowtype;
begin
  if not public.is_staff() then raise exception 'Staff access required.' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 100 then raise exception 'Menu name must be between 1 and 100 characters.'; end if;
  if p_category not in ('Coffee', 'Latte', 'Ade') then raise exception 'Invalid menu category.'; end if;
  if p_variant_mode not in ('hot_ice', 'hot_only', 'standard') then raise exception 'Invalid variant mode.'; end if;
  if p_price is null or p_price < 0 or p_price > 10000 then raise exception 'Price must be between 0 and 10000.'; end if;
  if coalesce(p_display_order, 0) not between 0 and 100000 then raise exception 'Invalid display order.'; end if;

  update public.menu_items
  set name = btrim(p_name), category = p_category, price = round(p_price, 2),
      variant_mode = p_variant_mode, sold_out = coalesce(p_sold_out, false),
      active = coalesce(p_active, false), display_order = coalesce(p_display_order, 0)
  where id = p_id
  returning * into v_result;
  if not found then raise exception 'Menu item not found.'; end if;
  return v_result;
end;
$$;

create or replace function public.staff_set_menu_sold_out(p_id text, p_sold_out boolean)
returns public.menu_items language plpgsql security definer set search_path = public, pg_temp as $$
declare v_result public.menu_items%rowtype;
begin
  if not public.is_staff() then raise exception 'Staff access required.' using errcode = '42501'; end if;
  update public.menu_items set sold_out = coalesce(p_sold_out, false) where id = p_id returning * into v_result;
  if not found then raise exception 'Menu item not found.'; end if;
  return v_result;
end; $$;

create or replace function public.staff_set_menu_active(p_id text, p_active boolean)
returns public.menu_items language plpgsql security definer set search_path = public, pg_temp as $$
declare v_result public.menu_items%rowtype;
begin
  if not public.is_staff() then raise exception 'Staff access required.' using errcode = '42501'; end if;
  update public.menu_items set active = coalesce(p_active, false) where id = p_id returning * into v_result;
  if not found then raise exception 'Menu item not found.'; end if;
  return v_result;
end; $$;

revoke all on function public.staff_create_menu_item(text, text, numeric, text, integer) from public, anon, authenticated;
revoke all on function public.staff_update_menu_item(text, text, text, numeric, text, boolean, boolean, integer) from public, anon, authenticated;
revoke all on function public.staff_set_menu_sold_out(text, boolean) from public, anon, authenticated;
revoke all on function public.staff_set_menu_active(text, boolean) from public, anon, authenticated;
grant execute on function public.staff_create_menu_item(text, text, numeric, text, integer) to authenticated;
grant execute on function public.staff_update_menu_item(text, text, text, numeric, text, boolean, boolean, integer) to authenticated;
grant execute on function public.staff_set_menu_sold_out(text, boolean) to authenticated;
grant execute on function public.staff_set_menu_active(text, boolean) to authenticated;

create or replace function public.validated_menu_request(p_items jsonb)
returns table(item_id text, variant text, quantity integer, category text, item_name text, unit_price numeric)
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'At least one order item is required.'; end if;
  if jsonb_array_length(p_items) > 50 then raise exception 'Too many order items.'; end if;
  -- Hold the selected menu rows stable until the surrounding order transaction
  -- commits, so a concurrent staff price/availability edit cannot create a
  -- mismatch between the order total and its item snapshots.
  perform 1
  from public.menu_items
  where id in (
    select requested.item_id
    from jsonb_to_recordset(p_items) as requested(item_id text, variant text, quantity integer)
  )
  for share;
  if exists (
    select 1 from jsonb_to_recordset(p_items) as requested(item_id text, variant text, quantity integer)
    left join public.menu_items menu on menu.id = requested.item_id
    where requested.item_id is null or requested.quantity is null or requested.quantity < 1 or requested.quantity > 99
       or menu.id is null or not menu.active or menu.sold_out
       or (menu.variant_mode = 'hot_ice' and coalesce(nullif(lower(btrim(requested.variant)), ''), 'hot') not in ('hot', 'ice'))
       or (menu.variant_mode = 'hot_only' and coalesce(nullif(lower(btrim(requested.variant)), ''), 'hot') <> 'hot')
       or (menu.variant_mode = 'standard' and nullif(btrim(coalesce(requested.variant, '')), '') is not null)
  ) then raise exception 'One or more menu items or variants are unavailable.'; end if;

  return query
  with normalized as (
    select requested.item_id,
      case when menu.variant_mode = 'hot_ice' then coalesce(nullif(lower(btrim(requested.variant)), ''), 'hot') else null end as normalized_variant,
      requested.quantity, menu.category, menu.name, menu.price
    from jsonb_to_recordset(p_items) as requested(item_id text, variant text, quantity integer)
    join public.menu_items menu on menu.id = requested.item_id and menu.active and not menu.sold_out
  )
  select normalized.item_id, normalized.normalized_variant, sum(normalized.quantity)::integer,
    normalized.category, normalized.name,
    (normalized.price + case when normalized.normalized_variant = 'ice' then 0.50 else 0 end)::numeric(10,2)
  from normalized
  group by normalized.item_id, normalized.normalized_variant, normalized.category, normalized.name, normalized.price;
end; $$;
revoke all on function public.validated_menu_request(jsonb) from public, anon, authenticated;

create or replace function public.create_order(p_customer_name text, p_payment_method text, p_items jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_order_id public.orders.id%type; v_order_number public.orders.order_number%type; v_total numeric(10,2);
begin
  if char_length(btrim(coalesce(p_customer_name, ''))) not between 1 and 100 then raise exception 'Customer name must be between 1 and 100 characters.'; end if;
  if p_payment_method not in ('paypal', 'sepa', 'cash') then raise exception 'Invalid payment method.'; end if;
  select sum(unit_price * quantity)::numeric(10,2) into v_total from public.validated_menu_request(p_items);
  if v_total is null then raise exception 'One or more menu items are unavailable.'; end if;
  insert into public.orders (customer_name, total_price, payment_method, status)
  values (btrim(p_customer_name), v_total, p_payment_method, 'new') returning id, order_number into v_order_id, v_order_number;
  insert into public.order_items (order_id, category, item_name, variant, quantity, unit_price)
  select v_order_id, category, item_name, variant, quantity, unit_price from public.validated_menu_request(p_items);
  return jsonb_build_object('id', v_order_id, 'order_number', v_order_number, 'total_price', v_total);
end; $$;

create or replace function public.create_wallet_order(p_customer_name text, p_items jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_user_id uuid := auth.uid(); v_order_id public.orders.id%type; v_order_number public.orders.order_number%type; v_total numeric(10,2); v_new_balance numeric(10,2);
begin
  if v_user_id is null then raise exception 'Customer sign-in required.' using errcode = '42501'; end if;
  if not exists (select 1 from public.customer_profiles where user_id = v_user_id and active) then raise exception 'Active customer account not found.' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_customer_name, ''))) not between 1 and 100 then raise exception 'Customer name must be between 1 and 100 characters.'; end if;
  select sum(unit_price * quantity)::numeric(10,2) into v_total from public.validated_menu_request(p_items);
  if v_total is null then raise exception 'One or more menu items are unavailable.'; end if;
  insert into public.wallet_accounts (user_id) values (v_user_id) on conflict (user_id) do nothing;
  perform 1 from public.wallet_accounts where user_id = v_user_id for update;
  insert into public.orders (customer_name, customer_user_id, total_price, payment_method, status)
  values (btrim(p_customer_name), v_user_id, v_total, 'wallet', 'new') returning id, order_number into v_order_id, v_order_number;
  insert into public.order_items (order_id, category, item_name, variant, quantity, unit_price)
  select v_order_id, category, item_name, variant, quantity, unit_price from public.validated_menu_request(p_items);
  update public.wallet_accounts set balance = balance - v_total, updated_at = now() where user_id = v_user_id returning balance into v_new_balance;
  insert into public.wallet_transactions (user_id, type, amount, balance_after, order_id, created_by, note)
  values (v_user_id, 'purchase', -v_total, v_new_balance, v_order_id::text, v_user_id, 'Order #' || v_order_number::text);
  return jsonb_build_object('id', v_order_id, 'order_number', v_order_number, 'total_price', v_total, 'balance', v_new_balance);
end; $$;

create or replace function public.staff_create_guest_order(p_customer_name text, p_payment_method text, p_items jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_order_id public.orders.id%type; v_order_number public.orders.order_number%type; v_total numeric(10,2); v_guest_total numeric(12,2); v_guest_order_count bigint;
begin
  if not public.is_staff() then raise exception 'Staff access required.' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_customer_name, ''))) not between 1 and 100 then raise exception 'Guest name must be between 1 and 100 characters.'; end if;
  if coalesce(p_payment_method, '') not in ('paypal', 'sepa', 'cash') then raise exception 'Invalid payment method.'; end if;
  select sum(unit_price * quantity)::numeric(10,2) into v_total from public.validated_menu_request(p_items);
  if v_total is null then raise exception 'One or more menu items are unavailable.'; end if;
  insert into public.orders (customer_name, customer_user_id, total_price, payment_method, status)
  values (btrim(p_customer_name), null, v_total, p_payment_method, 'new') returning id, order_number into v_order_id, v_order_number;
  insert into public.order_items (order_id, category, item_name, variant, quantity, unit_price)
  select v_order_id, category, item_name, variant, quantity, unit_price from public.validated_menu_request(p_items);
  insert into public.guest_accounts (id, account_name, total_ordered, order_count, last_order_at, updated_at)
  values (1, 'Guest', v_total, 1, now(), now()) on conflict (id) do update
  set total_ordered = public.guest_accounts.total_ordered + excluded.total_ordered,
      order_count = public.guest_accounts.order_count + 1, last_order_at = excluded.last_order_at, updated_at = excluded.updated_at
  returning total_ordered, order_count into v_guest_total, v_guest_order_count;
  return jsonb_build_object('id', v_order_id, 'order_number', v_order_number, 'total_price', v_total,
    'payment_method', p_payment_method, 'guest_total_ordered', v_guest_total, 'guest_order_count', v_guest_order_count);
end; $$;

revoke all on function public.create_order(text, text, jsonb) from public, anon, authenticated;
revoke all on function public.create_wallet_order(text, jsonb) from public, anon, authenticated;
revoke all on function public.staff_create_guest_order(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.create_order(text, text, jsonb) to anon, authenticated;
grant execute on function public.create_wallet_order(text, jsonb) to authenticated;
grant execute on function public.staff_create_guest_order(text, text, jsonb) to authenticated;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'menu_items') then
    alter publication supabase_realtime add table public.menu_items;
  end if;
end $$;

commit;
notify pgrst, 'reload schema';
