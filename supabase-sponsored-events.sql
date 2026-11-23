-- Sponsored Events for Elim Cafe.
-- Run after supabase-menu-management.sql and the existing wallet/guest migrations.
-- Existing orders, wallet balances, transactions, Guest totals, and sessions are preserved.

begin;

create table if not exists public.sponsored_events (
  id uuid primary key default gen_random_uuid(),
  sponsor_name text not null,
  message text,
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  constraint sponsored_events_sponsor_name_check
    check (char_length(btrim(sponsor_name)) between 1 and 120),
  constraint sponsored_events_message_check
    check (message is null or char_length(message) <= 1000),
  constraint sponsored_events_time_order_check
    check (starts_at is null or ends_at is null or starts_at < ends_at)
);

-- Version 1 intentionally permits only one enabled event. Optional start/end
-- times control when that enabled event is valid for ordering.
create unique index if not exists sponsored_events_one_active_idx
  on public.sponsored_events ((active))
  where active;

create index if not exists sponsored_events_created_at_idx
  on public.sponsored_events (created_at desc);

alter table public.orders
  add column if not exists sponsored_event_id uuid
    references public.sponsored_events(id) on delete restrict,
  add column if not exists sponsored_amount numeric(10,2) not null default 0;

alter table public.orders
  drop constraint if exists orders_sponsored_amount_check;
alter table public.orders
  add constraint orders_sponsored_amount_check
  check (
    sponsored_amount >= 0
    and sponsored_amount <= total_price
    and (
      (sponsored_event_id is null and sponsored_amount = 0)
      or (sponsored_event_id is not null and sponsored_amount = total_price)
    )
  );

create index if not exists orders_sponsored_event_id_idx
  on public.orders (sponsored_event_id, created_at desc)
  where sponsored_event_id is not null;

alter table public.sponsored_events enable row level security;

drop policy if exists "Customers can read current sponsored event" on public.sponsored_events;
create policy "Customers can read current sponsored event"
on public.sponsored_events
for select
to authenticated
using (
  active
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at > now())
);

drop policy if exists "Staff can read sponsored events" on public.sponsored_events;
create policy "Staff can read sponsored events"
on public.sponsored_events
for select
to authenticated
using (public.is_staff());

revoke all on public.sponsored_events from public, anon, authenticated;
grant select on public.sponsored_events to authenticated;

create or replace function public.staff_create_sponsored_event(
  p_sponsor_name text,
  p_message text default null,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null
)
returns public.sponsored_events
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result public.sponsored_events%rowtype;
begin
  if not public.is_staff() then
    raise exception 'Staff access required.' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_sponsor_name, ''))) not between 1 and 120 then
    raise exception 'Sponsor name must be between 1 and 120 characters.';
  end if;
  if char_length(coalesce(p_message, '')) > 1000 then
    raise exception 'Event message must not exceed 1000 characters.';
  end if;
  if p_starts_at is not null and p_ends_at is not null and p_starts_at >= p_ends_at then
    raise exception 'Event end must be later than its start.';
  end if;
  if p_ends_at is not null and p_ends_at <= now() then
    raise exception 'Event end must be in the future.';
  end if;

  -- Serialize activation attempts so two Staff devices cannot create
  -- overlapping active events. The unique index is the final safeguard.
  perform pg_advisory_xact_lock(hashtext('elim-cafe-sponsored-event'));
  if exists (select 1 from public.sponsored_events where active) then
    raise exception 'End the current Sponsored Event before activating another one.';
  end if;

  insert into public.sponsored_events (sponsor_name, message, starts_at, ends_at, active)
  values (
    btrim(p_sponsor_name),
    nullif(btrim(coalesce(p_message, '')), ''),
    p_starts_at,
    p_ends_at,
    true
  )
  returning * into v_result;
  return v_result;
end;
$$;

create or replace function public.staff_end_sponsored_event(p_event_id uuid)
returns public.sponsored_events
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result public.sponsored_events%rowtype;
begin
  if not public.is_staff() then
    raise exception 'Staff access required.' using errcode = '42501';
  end if;

  update public.sponsored_events
  set active = false,
      ended_at = coalesce(ended_at, now())
  where id = p_event_id and active
  returning * into v_result;

  if not found then raise exception 'Active Sponsored Event not found.'; end if;
  return v_result;
end;
$$;

create or replace function public.staff_list_sponsored_events()
returns table (
  id uuid,
  sponsor_name text,
  message text,
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean,
  created_at timestamptz,
  ended_at timestamptz,
  order_count bigint,
  drink_count bigint,
  sponsored_value numeric
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_staff() then
    raise exception 'Staff access required.' using errcode = '42501';
  end if;

  return query
  select
    event.id,
    event.sponsor_name,
    event.message,
    event.starts_at,
    event.ends_at,
    event.active,
    event.created_at,
    event.ended_at,
    (select count(*) from public.orders o where o.sponsored_event_id = event.id)::bigint,
    coalesce((
      select sum(item.quantity)::bigint
      from public.orders o
      join public.order_items item on item.order_id = o.id
      where o.sponsored_event_id = event.id
    ), 0)::bigint,
    coalesce((
      select sum(o.sponsored_amount)
      from public.orders o
      where o.sponsored_event_id = event.id
    ), 0)::numeric
  from public.sponsored_events event
  order by event.created_at desc;
end;
$$;

-- Replace the currently active dynamic-menu wallet RPC. Menu snapshots and
-- totals remain authoritative; only the wallet debit branch changes.
create or replace function public.create_wallet_order(p_customer_name text, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_order_id public.orders.id%type;
  v_order_number public.orders.order_number%type;
  v_total numeric(10,2);
  v_new_balance numeric(10,2);
  v_event public.sponsored_events%rowtype;
begin
  if v_user_id is null then raise exception 'Customer sign-in required.' using errcode = '42501'; end if;
  if not exists (select 1 from public.customer_profiles where user_id = v_user_id and active) then
    raise exception 'Active customer account not found.' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_customer_name, ''))) not between 1 and 100 then
    raise exception 'Customer name must be between 1 and 100 characters.';
  end if;

  select sum(unit_price * quantity)::numeric(10,2)
  into v_total
  from public.validated_menu_request(p_items);
  if v_total is null then raise exception 'One or more menu items are unavailable.'; end if;

  insert into public.wallet_accounts (user_id) values (v_user_id) on conflict (user_id) do nothing;
  select balance into v_new_balance
  from public.wallet_accounts
  where user_id = v_user_id
  for update;

  -- The shared lock makes a concurrent Staff End action wait until this order
  -- has committed, removing ambiguity at the exact checkout boundary.
  select event.* into v_event
  from public.sponsored_events event
  where event.active
    and (event.starts_at is null or event.starts_at <= now())
    and (event.ends_at is null or event.ends_at > now())
  order by event.created_at desc
  limit 1
  for share;

  insert into public.orders (
    customer_name, customer_user_id, total_price, payment_method, status,
    sponsored_event_id, sponsored_amount
  )
  values (
    btrim(p_customer_name), v_user_id, v_total, 'wallet', 'new',
    v_event.id, case when v_event.id is null then 0 else v_total end
  )
  returning id, order_number into v_order_id, v_order_number;

  insert into public.order_items (order_id, category, item_name, variant, quantity, unit_price)
  select v_order_id, category, item_name, variant, quantity, unit_price
  from public.validated_menu_request(p_items);

  if v_event.id is null then
    update public.wallet_accounts
    set balance = balance - v_total,
        updated_at = now()
    where user_id = v_user_id
    returning balance into v_new_balance;

    insert into public.wallet_transactions (
      user_id, type, amount, balance_after, order_id, created_by, note
    )
    values (
      v_user_id, 'purchase', -v_total, v_new_balance,
      v_order_id::text, v_user_id, 'Order #' || v_order_number::text
    );
  end if;

  return jsonb_build_object(
    'id', v_order_id,
    'order_number', v_order_number,
    'total_price', v_total,
    'balance', v_new_balance,
    'sponsored', v_event.id is not null,
    'sponsored_amount', case when v_event.id is null then 0 else v_total end,
    'sponsored_event_id', v_event.id,
    'sponsor_name', v_event.sponsor_name
  );
end;
$$;

-- New four-argument Guest RPC. Sponsorship is opt-in for Staff-entered orders.
create or replace function public.staff_create_guest_order(
  p_customer_name text,
  p_payment_method text,
  p_items jsonb,
  p_apply_sponsorship boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order_id public.orders.id%type;
  v_order_number public.orders.order_number%type;
  v_total numeric(10,2);
  v_guest_total numeric(12,2);
  v_guest_order_count bigint;
  v_event public.sponsored_events%rowtype;
begin
  if not public.is_staff() then raise exception 'Staff access required.' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_customer_name, ''))) not between 1 and 100 then
    raise exception 'Guest name must be between 1 and 100 characters.';
  end if;
  if coalesce(p_payment_method, '') not in ('paypal', 'sepa', 'cash') then
    raise exception 'Invalid payment method.';
  end if;

  select sum(unit_price * quantity)::numeric(10,2)
  into v_total
  from public.validated_menu_request(p_items);
  if v_total is null then raise exception 'One or more menu items are unavailable.'; end if;

  if coalesce(p_apply_sponsorship, false) then
    select event.* into v_event
    from public.sponsored_events event
    where event.active
      and (event.starts_at is null or event.starts_at <= now())
      and (event.ends_at is null or event.ends_at > now())
    order by event.created_at desc
    limit 1
    for share;
    if v_event.id is null then
      raise exception 'The Sponsored Event is no longer active. Refresh and choose a payment method.';
    end if;
  end if;

  insert into public.orders (
    customer_name, customer_user_id, total_price, payment_method, status,
    sponsored_event_id, sponsored_amount
  )
  values (
    btrim(p_customer_name), null, v_total,
    case when v_event.id is null then p_payment_method else null end,
    'new', v_event.id, case when v_event.id is null then 0 else v_total end
  )
  returning id, order_number into v_order_id, v_order_number;

  insert into public.order_items (order_id, category, item_name, variant, quantity, unit_price)
  select v_order_id, category, item_name, variant, quantity, unit_price
  from public.validated_menu_request(p_items);

  insert into public.guest_accounts (id, account_name)
  values (1, 'Guest')
  on conflict (id) do nothing;

  if v_event.id is null then
    update public.guest_accounts
    set total_ordered = total_ordered + v_total,
        order_count = order_count + 1,
        last_order_at = now(),
        updated_at = now()
    where id = 1
    returning total_ordered, order_count into v_guest_total, v_guest_order_count;
  else
    select total_ordered, order_count
    into v_guest_total, v_guest_order_count
    from public.guest_accounts
    where id = 1;
  end if;

  return jsonb_build_object(
    'id', v_order_id,
    'order_number', v_order_number,
    'total_price', v_total,
    'payment_method', case when v_event.id is null then p_payment_method else null end,
    'guest_total_ordered', v_guest_total,
    'guest_order_count', v_guest_order_count,
    'sponsored', v_event.id is not null,
    'sponsored_amount', case when v_event.id is null then 0 else v_total end,
    'sponsored_event_id', v_event.id,
    'sponsor_name', v_event.sponsor_name
  );
end;
$$;

-- Preserve compatibility with already-deployed Staff pages that still call
-- the original three-argument RPC.
create or replace function public.staff_create_guest_order(
  p_customer_name text,
  p_payment_method text,
  p_items jsonb
)
returns jsonb
language sql
security invoker
set search_path = public, pg_temp
as $$
  select public.staff_create_guest_order(
    p_customer_name, p_payment_method, p_items, false
  );
$$;

revoke all on function public.staff_create_sponsored_event(text, text, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.staff_end_sponsored_event(uuid) from public, anon, authenticated;
revoke all on function public.staff_list_sponsored_events() from public, anon, authenticated;
revoke all on function public.create_wallet_order(text, jsonb) from public, anon, authenticated;
revoke all on function public.staff_create_guest_order(text, text, jsonb, boolean) from public, anon, authenticated;
revoke all on function public.staff_create_guest_order(text, text, jsonb) from public, anon, authenticated;

grant execute on function public.staff_create_sponsored_event(text, text, timestamptz, timestamptz) to authenticated;
grant execute on function public.staff_end_sponsored_event(uuid) to authenticated;
grant execute on function public.staff_list_sponsored_events() to authenticated;
grant execute on function public.create_wallet_order(text, jsonb) to authenticated;
grant execute on function public.staff_create_guest_order(text, text, jsonb, boolean) to authenticated;
grant execute on function public.staff_create_guest_order(text, text, jsonb) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'sponsored_events'
  ) then
    alter publication supabase_realtime add table public.sponsored_events;
  end if;
end $$;

commit;
notify pgrst, 'reload schema';
