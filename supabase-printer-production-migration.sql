-- Elim Cafe production receipt printing migration.
-- Run this in Supabase SQL Editor before deploying the matching staff files.
-- Existing orders, order_items, preparation statuses, and RLS policies are preserved.

begin;

alter table public.orders
  add column if not exists print_status text,
  add column if not exists printed_at timestamptz,
  add column if not exists print_attempts integer,
  add column if not exists printing_started_at timestamptz;

update public.orders
-- Treat orders that predate this migration as already handled so deployment
-- does not print the entire order history. New orders use the pending default.
set print_status = coalesce(print_status, 'printed'),
    print_attempts = coalesce(print_attempts, 0);

alter table public.orders
  alter column print_status set default 'pending',
  alter column print_status set not null,
  alter column print_attempts set default 0,
  alter column print_attempts set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_print_status_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_print_status_check
      check (print_status in ('pending', 'printing', 'printed', 'failed'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_print_attempts_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_print_attempts_check
      check (print_attempts >= 0);
  end if;
end $$;

create index if not exists orders_print_queue_idx
  on public.orders (print_status, created_at);

create table if not exists public.receipt_settings (
  id smallint primary key default 1 check (id = 1),
  cafe_name text not null default 'ELIM CAFE' check (char_length(cafe_name) between 1 and 60),
  header_text text not null default '' check (char_length(header_text) <= 240),
  footer_text text not null default 'Thank you!' check (char_length(footer_text) <= 240),
  show_customer_name boolean not null default true,
  show_order_number boolean not null default true,
  show_payment_method boolean not null default true,
  show_order_time boolean not null default true,
  show_total boolean not null default true,
  separator_style text not null default 'dash'
    check (separator_style in ('dash', 'solid', 'double')),
  updated_at timestamptz not null default now()
);

insert into public.receipt_settings (id)
values (1)
on conflict (id) do nothing;

alter table public.receipt_settings enable row level security;

drop policy if exists "Staff can read receipt settings" on public.receipt_settings;
drop policy if exists "Staff can update receipt settings" on public.receipt_settings;

create policy "Staff can read receipt settings"
on public.receipt_settings
for select
to authenticated
using (public.is_staff());

create policy "Staff can update receipt settings"
on public.receipt_settings
for update
to authenticated
using (public.is_staff())
with check (public.is_staff() and id = 1);

revoke all on public.receipt_settings from anon, authenticated;
grant select on public.receipt_settings to authenticated;
grant update (
  cafe_name,
  header_text,
  footer_text,
  show_customer_name,
  show_order_number,
  show_payment_method,
  show_order_time,
  show_total,
  separator_style,
  updated_at
) on public.receipt_settings to authenticated;

create or replace function public.claim_order_print(
  p_order_id uuid,
  p_force boolean default false
)
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

  update public.orders
  set print_status = 'printing',
      printing_started_at = now()
  where id = p_order_id
    and (
      print_status = 'pending'
      or (
        p_force
        and (
          print_status in ('printed', 'failed')
          or (
            print_status = 'printing'
            and printing_started_at < now() - interval '2 minutes'
          )
        )
      )
    )
  returning * into v_order;

  if not found then
    return jsonb_build_object('claimed', false);
  end if;

  return jsonb_build_object(
    'claimed', true,
    'order_id', v_order.id,
    'print_status', v_order.print_status
  );
end;
$$;

create or replace function public.finish_order_print(
  p_order_id uuid,
  p_success boolean
)
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

  update public.orders
  set print_status = case when p_success then 'printed' else 'failed' end,
      printed_at = case when p_success then now() else printed_at end,
      print_attempts = print_attempts + 1,
      printing_started_at = null
  where id = p_order_id
    and print_status = 'printing'
  returning * into v_order;

  if not found then
    return jsonb_build_object('updated', false);
  end if;

  return jsonb_build_object(
    'updated', true,
    'print_status', v_order.print_status,
    'printed_at', v_order.printed_at,
    'print_attempts', v_order.print_attempts
  );
end;
$$;

revoke all on function public.claim_order_print(uuid, boolean) from public, anon, authenticated;
revoke all on function public.finish_order_print(uuid, boolean) from public, anon, authenticated;
grant execute on function public.claim_order_print(uuid, boolean) to authenticated;
grant execute on function public.finish_order_print(uuid, boolean) to authenticated;

commit;
