-- Elim Cafe prepaid wallet ordering, Phase 2.
-- Run after supabase-customer-wallet-phase1.sql.
-- Wallet orders intentionally allow negative balances.

begin;

-- Remove Phase 1 non-negative balance checks, including equivalent checks
-- that may have been created with a different generated constraint name.
do $$
declare
  v_constraint record;
begin
  for v_constraint in
    select c.conname, c.conrelid::regclass as table_name
    from pg_constraint c
    where c.contype = 'c'
      and c.conrelid in (
        'public.wallet_accounts'::regclass,
        'public.wallet_transactions'::regclass
      )
      and pg_get_constraintdef(c.oid) ~* '(balance|balance_after).*>=.*0'
  loop
    execute format(
      'alter table %s drop constraint %I',
      v_constraint.table_name,
      v_constraint.conname
    );
  end loop;
end $$;

alter table public.orders
  add column if not exists customer_user_id uuid
    references public.customer_profiles(user_id) on delete set null;

create index if not exists orders_customer_user_id_idx
  on public.orders (customer_user_id, created_at desc);

-- Extend the existing payment-method constraint without changing old orders.
alter table public.orders
  drop constraint if exists orders_payment_method_check;

alter table public.orders
  add constraint orders_payment_method_check
  check (payment_method is null or payment_method in ('paypal', 'sepa', 'cash', 'wallet'));

create or replace function public.create_wallet_order(
  p_customer_name text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_order_id public.orders.id%type;
  v_order_number public.orders.order_number%type;
  v_total numeric(10, 2);
  v_new_balance numeric(10, 2);
begin
  if v_user_id is null then
    raise exception 'Customer sign-in required.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.customer_profiles
    where user_id = v_user_id
      and active
  ) then
    raise exception 'Active customer account not found.' using errcode = '42501';
  end if;

  if char_length(btrim(coalesce(p_customer_name, ''))) not between 1 and 100 then
    raise exception 'Customer name must be between 1 and 100 characters.';
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

  insert into public.wallet_accounts (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  -- Serialize wallet changes. There is intentionally no sufficient-balance check.
  perform 1
  from public.wallet_accounts
  where user_id = v_user_id
  for update;

  insert into public.orders (
    customer_name,
    customer_user_id,
    total_price,
    payment_method,
    status
  ) values (
    btrim(p_customer_name),
    v_user_id,
    v_total,
    'wallet',
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

  update public.wallet_accounts
  set balance = balance - v_total,
      updated_at = now()
  where user_id = v_user_id
  returning balance into v_new_balance;

  insert into public.wallet_transactions (
    user_id,
    type,
    amount,
    balance_after,
    order_id,
    created_by,
    note
  ) values (
    v_user_id,
    'purchase',
    -v_total,
    v_new_balance,
    v_order_id::text,
    v_user_id,
    'Order #' || v_order_number::text
  );

  return jsonb_build_object(
    'id', v_order_id,
    'order_number', v_order_number,
    'total_price', v_total,
    'balance', v_new_balance
  );
end;
$$;

create or replace function public.staff_refund_balance(
  p_customer_user_id uuid,
  p_amount numeric,
  p_note text default null,
  p_order_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_amount numeric(10, 2);
  v_note text;
  v_balance numeric(10, 2);
begin
  if not public.is_staff() then
    raise exception 'Staff access required.' using errcode = '42501';
  end if;

  v_amount := round(p_amount, 2);
  v_note := nullif(btrim(coalesce(p_note, '')), '');

  if p_customer_user_id is null then
    raise exception 'Customer is required.';
  end if;
  if v_amount is null or v_amount <= 0 or v_amount > 10000 then
    raise exception 'Refund amount must be greater than 0 and no more than 10000.';
  end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'Note must be 500 characters or fewer.';
  end if;
  if not exists (
    select 1
    from public.customer_profiles
    where user_id = p_customer_user_id
  ) then
    raise exception 'Customer account not found.';
  end if;

  insert into public.wallet_accounts (user_id)
  values (p_customer_user_id)
  on conflict (user_id) do nothing;

  perform 1
  from public.wallet_accounts
  where user_id = p_customer_user_id
  for update;

  update public.wallet_accounts
  set balance = balance + v_amount,
      updated_at = now()
  where user_id = p_customer_user_id
  returning balance into v_balance;

  insert into public.wallet_transactions (
    user_id,
    type,
    amount,
    balance_after,
    order_id,
    created_by,
    note
  ) values (
    p_customer_user_id,
    'refund',
    v_amount,
    v_balance,
    nullif(btrim(coalesce(p_order_id, '')), ''),
    auth.uid(),
    v_note
  );

  return jsonb_build_object(
    'user_id', p_customer_user_id,
    'amount', v_amount,
    'balance', v_balance
  );
end;
$$;

revoke all on function public.create_wallet_order(text, jsonb) from public, anon, authenticated;
grant execute on function public.create_wallet_order(text, jsonb) to authenticated;

revoke all on function public.staff_refund_balance(uuid, numeric, text, text) from public, anon, authenticated;
grant execute on function public.staff_refund_balance(uuid, numeric, text, text) to authenticated;

commit;
