-- Elim Cafe customer order-ready notifications.
-- Run after the customer wallet Phase 2 migration.

begin;

alter table public.orders
  add column if not exists customer_user_id uuid
    references public.customer_profiles(user_id) on delete set null,
  add column if not exists ready_notified_at timestamptz;

create index if not exists orders_customer_user_id_idx
  on public.orders (customer_user_id, created_at desc);

-- Link every authenticated customer order, including PayPal/SEPA/Cash orders,
-- without changing the existing create_order RPC signature.
create or replace function public.set_authenticated_order_customer()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if new.customer_user_id is null
     and v_user_id is not null
     and exists (
       select 1
       from public.customer_profiles
       where user_id = v_user_id
         and active
     ) then
    new.customer_user_id := v_user_id;
  end if;

  return new;
end;
$$;

drop trigger if exists set_authenticated_order_customer_before_insert on public.orders;
create trigger set_authenticated_order_customer_before_insert
before insert on public.orders
for each row execute function public.set_authenticated_order_customer();

revoke all on function public.set_authenticated_order_customer() from public, anon, authenticated;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.customer_profiles(user_id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  language text not null default 'de' check (language in ('de', 'en', 'ko', 'zh')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

revoke all on public.push_subscriptions from anon, authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

drop policy if exists "Customers can read own push subscriptions" on public.push_subscriptions;
drop policy if exists "Customers can insert own push subscriptions" on public.push_subscriptions;
drop policy if exists "Customers can update own push subscriptions" on public.push_subscriptions;
drop policy if exists "Customers can delete own push subscriptions" on public.push_subscriptions;

create policy "Customers can read own push subscriptions"
on public.push_subscriptions
for select
to authenticated
using (user_id = auth.uid());

create policy "Customers can insert own push subscriptions"
on public.push_subscriptions
for insert
to authenticated
with check (user_id = auth.uid());

create policy "Customers can update own push subscriptions"
on public.push_subscriptions
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Customers can delete own push subscriptions"
on public.push_subscriptions
for delete
to authenticated
using (user_id = auth.uid());

-- Internal outbox. Clients cannot read or edit this table. The Edge Function
-- uses its server-side key, which bypasses RLS.
create table if not exists public.order_ready_notifications (
  id uuid primary key default gen_random_uuid(),
  -- The live Elim Cafe orders table uses bigint IDs.
  order_id bigint not null unique references public.orders(id) on delete cascade,
  user_id uuid not null references public.customer_profiles(user_id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'sending', 'sent', 'failed', 'no_subscription')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists order_ready_notifications_status_idx
  on public.order_ready_notifications (status, created_at);

alter table public.order_ready_notifications enable row level security;
revoke all on public.order_ready_notifications from public, anon, authenticated;

create or replace function public.queue_completed_order_notification()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'completed'
     and old.status is distinct from 'completed'
     and new.customer_user_id is not null then
    insert into public.order_ready_notifications (order_id, user_id)
    values (new.id, new.customer_user_id)
    on conflict (order_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists queue_completed_order_notification_after_update on public.orders;
create trigger queue_completed_order_notification_after_update
after update of status on public.orders
for each row execute function public.queue_completed_order_notification();

revoke all on function public.queue_completed_order_notification() from public, anon, authenticated;

-- Customers need SELECT permission and an own-row policy for filtered
-- Realtime status updates. Existing staff policies remain unchanged.
grant select on public.orders to authenticated;

drop policy if exists "Customers can read own orders" on public.orders;
create policy "Customers can read own orders"
on public.orders
for select
to authenticated
using (customer_user_id = auth.uid());

commit;

-- After deploying the send-order-ready Edge Function, create a Database
-- Webhook for INSERT events on public.order_ready_notifications. Add the
-- x-elim-webhook-secret header described in the deployment instructions.
