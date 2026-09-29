alter table public.orders
add column if not exists payment_method text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_payment_method_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
    add constraint orders_payment_method_check
    check (
      payment_method is null
      or payment_method in ('paypal', 'sepa', 'cash')
    );
  end if;
end $$;
