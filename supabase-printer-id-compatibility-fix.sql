-- Fix printer RPC compatibility for projects whose existing orders.id is bigint/integer.
-- Safe for both numeric and UUID order IDs. Existing order data is unchanged.

begin;

drop function if exists public.claim_order_print(uuid, boolean);
drop function if exists public.claim_order_print(bigint, boolean);
drop function if exists public.claim_order_print(text, boolean);
drop function if exists public.finish_order_print(uuid, boolean);
drop function if exists public.finish_order_print(bigint, boolean);
drop function if exists public.finish_order_print(text, boolean);

create function public.claim_order_print(
  p_order_id text,
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
  where id::text = p_order_id
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

create function public.finish_order_print(
  p_order_id text,
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
  where id::text = p_order_id
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

revoke all on function public.claim_order_print(text, boolean) from public, anon, authenticated;
revoke all on function public.finish_order_print(text, boolean) from public, anon, authenticated;
grant execute on function public.claim_order_print(text, boolean) to authenticated;
grant execute on function public.finish_order_print(text, boolean) to authenticated;

commit;

notify pgrst, 'reload schema';
