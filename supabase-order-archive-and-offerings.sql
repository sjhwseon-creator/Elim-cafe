-- Elim Cafe per-order archive and customer offering ledger.
-- Run after supabase-staff-dashboard-upgrade.sql and wallet phase 2.

begin;

alter table public.orders
  add column if not exists archived_at timestamptz;

create index if not exists orders_live_created_idx
  on public.orders (created_at desc)
  where archived_at is null;

create or replace function public.staff_archive_order(p_order_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
begin
  if not public.is_staff() then
    raise exception 'Staff access required.' using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_order_id, '')), '') is null then
    raise exception 'Order is required.';
  end if;

  select *
  into v_order
  from public.orders
  where id::text = p_order_id
  for update;

  if not found then
    raise exception 'Order not found.';
  end if;
  if v_order.archived_at is not null then
    return jsonb_build_object('archived', false, 'already_archived', true);
  end if;
  if v_order.status <> 'completed' then
    raise exception 'Only completed orders can be archived.';
  end if;
  if v_order.print_status <> 'printed' then
    raise exception 'Only successfully printed orders can be archived.';
  end if;

  update public.orders
  set archived_at = now()
  where id = v_order.id
  returning * into v_order;

  return jsonb_build_object(
    'archived', true,
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'archived_at', v_order.archived_at
  );
end;
$$;

revoke all on function public.staff_archive_order(text) from public, anon, authenticated;
grant execute on function public.staff_archive_order(text) to authenticated;

-- Offerings are ledger transactions, not orders and not wallet top-ups.
alter table public.wallet_transactions
  drop constraint if exists wallet_transactions_type_check;

alter table public.wallet_transactions
  add constraint wallet_transactions_type_check
  check (type in ('topup', 'purchase', 'refund', 'adjustment', 'offering'));

create or replace function public.staff_record_offering(
  p_customer_user_id uuid,
  p_amount numeric,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_amount numeric(10, 2);
  v_balance_before numeric(10, 2);
  v_balance_after numeric(10, 2);
  v_note text;
begin
  if not public.is_staff() then
    raise exception 'Staff access required.' using errcode = '42501';
  end if;

  v_amount := round(p_amount, 2);
  if p_customer_user_id is null then
    raise exception 'Customer is required.';
  end if;
  if v_amount is null or v_amount <= 0 or v_amount > 10000 then
    raise exception 'Offering amount must be greater than 0 and no more than 10000.';
  end if;
  if not exists (
    select 1 from public.customer_profiles
    where user_id = p_customer_user_id and active
  ) then
    raise exception 'Active customer account not found.';
  end if;

  insert into public.wallet_accounts (user_id)
  values (p_customer_user_id)
  on conflict (user_id) do nothing;

  select balance
  into v_balance_before
  from public.wallet_accounts
  where user_id = p_customer_user_id
  for update;

  if v_balance_before < v_amount then
    raise exception 'Offering amount exceeds the customer balance.';
  end if;

  update public.wallet_accounts
  set balance = balance - v_amount,
      updated_at = now()
  where user_id = p_customer_user_id
  returning balance into v_balance_after;

  v_note := left(
    'Offering'
    || case
      when nullif(btrim(coalesce(p_note, '')), '') is null then ''
      else ' · ' || btrim(p_note)
    end,
    500
  );

  insert into public.wallet_transactions (
    user_id, type, amount, balance_after, created_by, note
  ) values (
    p_customer_user_id,
    'offering',
    -v_amount,
    v_balance_after,
    auth.uid(),
    v_note
  );

  return jsonb_build_object(
    'user_id', p_customer_user_id,
    'amount', v_amount,
    'balance_before', v_balance_before,
    'balance', v_balance_after
  );
end;
$$;

revoke all on function public.staff_record_offering(uuid, numeric, text) from public, anon, authenticated;
grant execute on function public.staff_record_offering(uuid, numeric, text) to authenticated;

commit;

notify pgrst, 'reload schema';
