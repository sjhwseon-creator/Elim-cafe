-- Elim Cafe staff dashboard upgrade.
-- Adds safe order archiving, receipt section visibility, and wallet bonuses.
-- Run once in the Supabase SQL Editor before deploying the matching web files.

begin;

-- Keep historical orders for wallet, notification, and print audits while
-- allowing staff to clear finished days from the live dashboard.
alter table public.orders
  add column if not exists archived_at timestamptz;

create index if not exists orders_live_created_idx
  on public.orders (created_at desc)
  where archived_at is null;

create or replace function public.staff_archive_completed_orders(
  p_order_date date,
  p_timezone text default 'Europe/Berlin'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_start timestamptz;
  v_end timestamptz;
  v_archived integer := 0;
  v_remaining integer := 0;
begin
  if not public.is_staff() then
    raise exception 'Staff access required.' using errcode = '42501';
  end if;
  if p_order_date is null then
    raise exception 'Order date is required.';
  end if;
  if not exists (select 1 from pg_timezone_names where name = p_timezone) then
    raise exception 'Unknown timezone.';
  end if;

  v_start := p_order_date::timestamp at time zone p_timezone;
  v_end := (p_order_date + 1)::timestamp at time zone p_timezone;

  update public.orders
  set archived_at = now()
  where archived_at is null
    and created_at >= v_start
    and created_at < v_end
    and status = 'completed'
    and print_status = 'printed';
  get diagnostics v_archived = row_count;

  select count(*)::integer
  into v_remaining
  from public.orders
  where archived_at is null
    and created_at >= v_start
    and created_at < v_end;

  return jsonb_build_object(
    'order_date', p_order_date,
    'archived', v_archived,
    'remaining', v_remaining
  );
end;
$$;

revoke all on function public.staff_archive_completed_orders(date, text) from public, anon, authenticated;
grant execute on function public.staff_archive_completed_orders(date, text) to authenticated;

-- Every major receipt section can be hidden without deleting its content.
alter table public.receipt_settings
  add column if not exists show_cafe_name boolean not null default true,
  add column if not exists show_header_text boolean not null default true,
  add column if not exists show_order_details boolean not null default true,
  add column if not exists show_items boolean not null default true,
  add column if not exists show_summary boolean not null default true,
  add column if not exists show_custom_text boolean not null default true,
  add column if not exists show_footer_text boolean not null default true,
  add column if not exists header_size smallint not null default 1,
  add column if not exists header_align text not null default 'center';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'receipt_settings_header_size_check'
      and conrelid = 'public.receipt_settings'::regclass
  ) then
    alter table public.receipt_settings
      add constraint receipt_settings_header_size_check
      check (header_size between 1 and 2);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'receipt_settings_header_align_check'
      and conrelid = 'public.receipt_settings'::regclass
  ) then
    alter table public.receipt_settings
      add constraint receipt_settings_header_align_check
      check (header_align in ('left', 'center', 'right'));
  end if;
end $$;

grant update (
  show_cafe_name,
  show_header_text,
  show_order_details,
  show_items,
  show_summary,
  show_custom_text,
  show_footer_text,
  header_size,
  header_align
) on public.receipt_settings to authenticated;

-- Promotion codes make the welcome credit safely one-time per customer.
alter table public.wallet_transactions
  add column if not exists promotion_code text;

create unique index if not exists wallet_transactions_promotion_once_idx
  on public.wallet_transactions (user_id, promotion_code)
  where promotion_code is not null;

create or replace function public.staff_top_up_with_bonus(
  p_customer_user_id uuid,
  p_paid_amount numeric,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_paid numeric(10, 2);
  v_bonus numeric(10, 2);
  v_credit numeric(10, 2);
  v_balance numeric(10, 2);
  v_note text;
begin
  if not public.is_staff() then
    raise exception 'Staff access required.' using errcode = '42501';
  end if;

  v_paid := round(p_paid_amount, 2);
  if p_customer_user_id is null then
    raise exception 'Customer is required.';
  end if;
  if v_paid is null or v_paid <= 0 or v_paid > 10000 then
    raise exception 'Paid amount must be greater than 0 and no more than 10000.';
  end if;
  if not exists (
    select 1 from public.customer_profiles
    where user_id = p_customer_user_id and active
  ) then
    raise exception 'Active customer account not found.';
  end if;

  v_bonus := case
    when v_paid >= 10.00 then round(v_paid * 0.10, 2)
    else 0.00
  end;
  v_credit := v_paid + v_bonus;
  v_note := left(
    'Paid EUR ' || v_paid::text
    || case
      when v_bonus > 0 then ' + 10% bonus EUR ' || v_bonus::text
      else ' · No bonus (minimum paid amount EUR 10.00)'
    end
    || case
      when nullif(btrim(coalesce(p_note, '')), '') is null then ''
      else ' · ' || btrim(p_note)
    end,
    500
  );

  insert into public.wallet_accounts (user_id)
  values (p_customer_user_id)
  on conflict (user_id) do nothing;

  perform 1
  from public.wallet_accounts
  where user_id = p_customer_user_id
  for update;

  update public.wallet_accounts
  set balance = balance + v_credit,
      updated_at = now()
  where user_id = p_customer_user_id
  returning balance into v_balance;

  insert into public.wallet_transactions (
    user_id, type, amount, balance_after, created_by, note
  ) values (
    p_customer_user_id, 'topup', v_credit, v_balance, auth.uid(), v_note
  );

  return jsonb_build_object(
    'user_id', p_customer_user_id,
    'paid_amount', v_paid,
    'bonus_amount', v_bonus,
    'credited_amount', v_credit,
    'balance', v_balance
  );
end;
$$;

create or replace function public.staff_apply_welcome_bonus(
  p_customer_user_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_amount constant numeric(10, 2) := 3.00;
  v_balance numeric(10, 2);
  v_note text;
begin
  if not public.is_staff() then
    raise exception 'Staff access required.' using errcode = '42501';
  end if;
  if p_customer_user_id is null then
    raise exception 'Customer is required.';
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

  perform 1
  from public.wallet_accounts
  where user_id = p_customer_user_id
  for update;

  if exists (
    select 1 from public.wallet_transactions
    where user_id = p_customer_user_id
      and promotion_code = 'welcome_3_eur'
  ) then
    raise exception 'Welcome bonus has already been applied for this customer.';
  end if;

  update public.wallet_accounts
  set balance = balance + v_amount,
      updated_at = now()
  where user_id = p_customer_user_id
  returning balance into v_balance;

  v_note := left(
    'Willkommensrabatt EUR 3.00'
    || case
      when nullif(btrim(coalesce(p_note, '')), '') is null then ''
      else ' · ' || btrim(p_note)
    end,
    500
  );

  insert into public.wallet_transactions (
    user_id, type, amount, balance_after, created_by, note, promotion_code
  ) values (
    p_customer_user_id, 'adjustment', v_amount, v_balance, auth.uid(), v_note, 'welcome_3_eur'
  );

  return jsonb_build_object(
    'user_id', p_customer_user_id,
    'credited_amount', v_amount,
    'balance', v_balance
  );
end;
$$;

revoke all on function public.staff_top_up_with_bonus(uuid, numeric, text) from public, anon, authenticated;
revoke all on function public.staff_apply_welcome_bonus(uuid, text) from public, anon, authenticated;
grant execute on function public.staff_top_up_with_bonus(uuid, numeric, text) to authenticated;
grant execute on function public.staff_apply_welcome_bonus(uuid, text) to authenticated;

commit;

notify pgrst, 'reload schema';
