-- Customer order history + staff notification recovery for Elim Cafe.
-- Safe to run after supabase-order-ready-notifications.sql.
-- Existing orders, notification attempts, customers, wallets, and sessions are preserved.

begin;

-- Customers may read only item snapshots that belong to one of their own orders.
-- The existing Staff policy remains in place and continues to grant Staff access.
grant select on public.order_items to authenticated;
drop policy if exists "Customers can read own order items" on public.order_items;
create policy "Customers can read own order items"
on public.order_items
for select
to authenticated
using (
  exists (
    select 1
    from public.orders
    where orders.id = order_items.order_id
      and orders.customer_user_id = auth.uid()
  )
);

-- Staff need read-only visibility of the outbox state. No direct client writes
-- are granted; retry state changes go through the secured RPC below.
grant select on public.order_ready_notifications to authenticated;
drop policy if exists "Staff can read order notification status" on public.order_ready_notifications;
create policy "Staff can read order notification status"
on public.order_ready_notifications
for select
to authenticated
using (public.is_staff());

create index if not exists order_ready_notifications_order_status_idx
  on public.order_ready_notifications (order_id, status);

create or replace function public.staff_retry_order_ready_notification(p_order_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_notification public.order_ready_notifications%rowtype;
begin
  if not public.is_staff() then
    raise exception 'Staff access required.' using errcode = '42501';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then raise exception 'Order not found.'; end if;
  if v_order.status <> 'completed' then raise exception 'Only completed orders can retry notifications.'; end if;
  if v_order.customer_user_id is null then raise exception 'Guest orders do not have customer notifications.'; end if;

  select * into v_notification
  from public.order_ready_notifications
  where order_id = p_order_id
  for update;

  if not found then raise exception 'Notification event not found.'; end if;
  if v_notification.user_id <> v_order.customer_user_id then raise exception 'Notification customer does not match the order.'; end if;
  if v_notification.status not in ('failed', 'no_subscription') then
    raise exception 'Notification cannot be retried from status %.', v_notification.status;
  end if;

  update public.order_ready_notifications
  set status = 'pending',
      last_error = null,
      updated_at = now()
  where id = v_notification.id;

  return jsonb_build_object(
    'order_id', p_order_id,
    'notification_id', v_notification.id,
    'status', 'pending',
    'attempts', v_notification.attempts
  );
end;
$$;

revoke all on function public.staff_retry_order_ready_notification(bigint) from public, anon, authenticated;
grant execute on function public.staff_retry_order_ready_notification(bigint) to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'order_ready_notifications'
  ) then
    alter publication supabase_realtime add table public.order_ready_notifications;
  end if;
end $$;

commit;
notify pgrst, 'reload schema';
