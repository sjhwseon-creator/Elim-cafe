-- Elim Cafe customer accounts and prepaid wallet, Phase 1.
-- Run once in the Supabase SQL Editor before deploying the matching web files.
-- This migration does not connect wallets to orders or payment processing.

begin;

create table if not exists public.customer_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 100),
  email text not null check (char_length(btrim(email)) between 3 and 320),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.wallet_accounts (
  user_id uuid primary key references public.customer_profiles(user_id) on delete cascade,
  balance numeric(10, 2) not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.customer_profiles(user_id) on delete cascade,
  type text not null check (type in ('topup', 'purchase', 'refund', 'adjustment')),
  amount numeric(10, 2) not null check (amount <> 0),
  balance_after numeric(10, 2) not null check (balance_after >= 0),
  order_id text,
  created_by uuid references auth.users(id) on delete set null,
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now()
);

create index if not exists customer_profiles_name_idx
  on public.customer_profiles (lower(display_name));
create index if not exists customer_profiles_email_idx
  on public.customer_profiles (lower(email));
create index if not exists wallet_transactions_user_created_idx
  on public.wallet_transactions (user_id, created_at desc);

-- Only sign-ups explicitly created by the customer frontend receive a customer
-- profile and wallet. Staff Auth users remain governed by staff_profiles.
create or replace function public.create_customer_account_rows()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_display_name text;
begin
  if coalesce(new.raw_user_meta_data ->> 'account_type', '') <> 'customer' then
    return new;
  end if;

  v_display_name := btrim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  if char_length(v_display_name) not between 1 and 100 then
    raise exception 'Customer display name must be between 1 and 100 characters.';
  end if;

  insert into public.customer_profiles (user_id, display_name, email)
  values (new.id, v_display_name, coalesce(new.email, ''))
  on conflict (user_id) do nothing;

  insert into public.wallet_accounts (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists create_customer_account_rows_after_signup on auth.users;
create trigger create_customer_account_rows_after_signup
after insert on auth.users
for each row execute function public.create_customer_account_rows();

alter table public.customer_profiles enable row level security;
alter table public.wallet_accounts enable row level security;
alter table public.wallet_transactions enable row level security;

drop policy if exists "Customers can read own profile" on public.customer_profiles;
drop policy if exists "Customers can update own profile" on public.customer_profiles;
drop policy if exists "Staff can read customer profiles" on public.customer_profiles;
drop policy if exists "Customers can read own wallet" on public.wallet_accounts;
drop policy if exists "Staff can read customer wallets" on public.wallet_accounts;
drop policy if exists "Customers can read own wallet transactions" on public.wallet_transactions;
drop policy if exists "Staff can read wallet transactions" on public.wallet_transactions;

create policy "Customers can read own profile"
on public.customer_profiles
for select
to authenticated
using (user_id = auth.uid());

create policy "Customers can update own profile"
on public.customer_profiles
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Staff can read customer profiles"
on public.customer_profiles
for select
to authenticated
using (public.is_staff());

create policy "Customers can read own wallet"
on public.wallet_accounts
for select
to authenticated
using (user_id = auth.uid());

create policy "Staff can read customer wallets"
on public.wallet_accounts
for select
to authenticated
using (public.is_staff());

create policy "Customers can read own wallet transactions"
on public.wallet_transactions
for select
to authenticated
using (user_id = auth.uid());

create policy "Staff can read wallet transactions"
on public.wallet_transactions
for select
to authenticated
using (public.is_staff());

revoke all on public.customer_profiles from anon, authenticated;
revoke all on public.wallet_accounts from anon, authenticated;
revoke all on public.wallet_transactions from anon, authenticated;

grant select on public.customer_profiles to authenticated;
grant update (display_name) on public.customer_profiles to authenticated;
grant select on public.wallet_accounts to authenticated;
grant select on public.wallet_transactions to authenticated;

create or replace function public.staff_add_balance(
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
  v_balance numeric(10, 2);
  v_amount numeric(10, 2);
  v_note text;
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
    raise exception 'Top-up amount must be greater than 0 and no more than 10000.';
  end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'Note must be 500 characters or fewer.';
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
    created_by,
    note
  ) values (
    p_customer_user_id,
    'topup',
    v_amount,
    v_balance,
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

revoke all on function public.create_customer_account_rows() from public, anon, authenticated;
revoke all on function public.staff_add_balance(uuid, numeric, text) from public, anon, authenticated;
grant execute on function public.staff_add_balance(uuid, numeric, text) to authenticated;

commit;
