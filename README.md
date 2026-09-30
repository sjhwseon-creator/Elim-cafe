# Elim Café

Elim Café is a mobile-first static PWA for customer ordering and a tablet staff dashboard. It uses HTML, CSS, vanilla JavaScript, Supabase Auth, PostgreSQL/RLS, Realtime, and a database RPC for trusted order creation.

Payment is instruction-only. The app does not verify payments and does not use PayPal, banking, or printer APIs.

## Security model

- Customers use `index.html` without signing in.
- Anonymous customers cannot read, update, or delete order tables directly.
- Customers create orders only through the `create_order` database function.
- The database calculates prices and totals from `menu_items`; browser prices are not trusted.
- Staff use `staff.html` with a persisted Supabase Magic Link session.
- A signed-in user must also have `role = 'staff'` in `staff_profiles`.
- Staff can read orders and order items and update only `orders.status`.
- The frontend uses only the public Supabase publishable key. Never add a `service_role` key.

## Files

- `index.html` - customer menu, cart, payment selection, review, and confirmation.
- `staff.html` - authenticated tablet dashboard.
- `js/menu.js` - customer-facing menu data.
- `js/customer.js` - cart UI and secure `create_order` RPC call.
- `js/staff.js` - Magic Link authentication, role check, Realtime orders, and status changes.
- `js/supabase-config.js` - public Supabase URL and publishable key.
- `js/payment-config.js` - optional public payment display values.
- `supabase-security-migration.sql` - complete idempotent database, RPC, Auth-role, RLS, and Realtime setup.
- `supabase-schema.sql` - notice redirecting old setup instructions to the security migration.
- `service-worker.js` - app-shell cache only; it does not cache Supabase responses or payment configuration.

## Supabase database setup

Open the Supabase SQL editor and run all of `supabase-security-migration.sql`.

The migration preserves existing `orders` and `order_items`, creates missing objects, loads the trusted menu, replaces the old RLS policies, and installs `create_order`.

Do not run the retired Version 1 policies after the security migration.

## Shared staff account

1. In Supabase, open **Authentication > Users**.
2. Create or invite one shared café staff user and ensure its email is confirmed.
3. In the SQL editor, register that user's UUID as staff. Replace the example email before running:

```sql
insert into public.staff_profiles (user_id, role)
select id, 'staff'
from auth.users
where email = 'STAFF_EMAIL_HERE'
on conflict (user_id) do update set role = excluded.role;
```

The email address is used to receive the Magic Link. Authorization is based on the authenticated user UUID and `staff_profiles`, not on a hardcoded frontend email.

## Supabase Auth URL settings

In **Authentication > URL Configuration**, configure:

- Site URL: `https://sjhwseon-creator.github.io/Elim-cafe/`
- Redirect URL: `https://sjhwseon-creator.github.io/Elim-cafe/staff.html`
- Local redirect URL: `http://127.0.0.1:4173/staff.html`
- Optional local redirect URL: `http://localhost:4173/staff.html`

In **Authentication > Providers > Email**, keep Email enabled and ensure Magic Link/OTP email delivery is available. The app sets `shouldCreateUser: false`, so unknown email addresses cannot create accounts through the staff login form.

In **Authentication > Email Templates > Magic Link**, the sign-in button must use Supabase's confirmation URL, for example:

```html
<a href="{{ .ConfirmationURL }}">Sign in</a>
```

Do not link the button directly to `{{ .SiteURL }}`. If Supabase rejects an unlisted `redirect_to` value, it falls back to the Site URL and opens the customer page. Add the exact local or production `staff.html` address shown above to the Redirect URLs list.

As a fallback, `index.html` detects a valid Supabase Auth callback and forwards an authenticated staff session to `staff.html`.

The first time, open the emailed link on the café tablet. Supabase persists and refreshes the session in that browser. Use **Log out** on the dashboard to remove it.

## Frontend configuration

`js/supabase-config.js` must contain the project URL and public publishable/anon key. These values identify the public Supabase API and are expected to be visible in a static site. Security comes from RLS and the RPC, not from hiding this key.

Never place these values in frontend files:

- Supabase `service_role` or secret key
- database password or connection string
- PayPal password
- bank login, PIN, TAN, or other credentials

## Payment display configuration

`js/payment-config.js` contains the payment recipient details intentionally displayed to customers. Empty values leave only the physical counter QR instructions visible.

Any PayPal address, account holder, or IBAN placed in this file is inherently public because GitHub Pages sends the file to every browser. The configured recipient details are intentionally public; passwords, bank login credentials, PINs, TANs, and secret keys must never be added.

## Menu updates

The UI menu in `js/menu.js` and the trusted prices in `public.menu_items` must stay synchronized. A customer can change browser code, but `create_order` always saves the database price.

When changing a menu item, update both:

1. `js/menu.js` for the customer display.
2. The corresponding `menu_items` upsert in `supabase-security-migration.sql`, then run that upsert in Supabase.

Menu IDs must match exactly and remain unique.

## Local testing

From the repository folder:

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

- Customer app: `http://127.0.0.1:4173/`
- Staff dashboard: `http://127.0.0.1:4173/staff.html`

Magic Links will return to the local staff page only after the local redirect URL is added in Supabase.

## GitHub Pages

The intended production URL is:

`https://sjhwseon-creator.github.io/Elim-cafe/`

Do not make the repository public or enable Pages until the security migration has been run and staff login has been tested. Payment recipient details in `js/payment-config.js` are intentionally public application content.
