# Elim Café order-ready notifications setup

The browser app contains only the VAPID public key. The VAPID private key and
webhook secret must stay in Supabase Edge Function secrets.

## 1. Generate VAPID keys and a webhook secret

```powershell
npx web-push generate-vapid-keys
```

Copy the generated public key into `js/notification-config.js`.

Generate a separate random webhook secret:

```powershell
$webhookBytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Fill($webhookBytes)
[Convert]::ToHexString($webhookBytes).ToLower()
```

Do not commit the private key or webhook secret.

## 2. Apply the database migration

Run all of `supabase-order-ready-notifications.sql` in the Supabase SQL Editor.

## 3. Link the Supabase CLI and set Edge Function secrets

```powershell
supabase init
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set VAPID_PUBLIC_KEY="YOUR_PUBLIC_KEY" VAPID_PRIVATE_KEY="YOUR_PRIVATE_KEY" VAPID_SUBJECT="mailto:YOUR_CONTACT_EMAIL" ORDER_READY_WEBHOOK_SECRET="YOUR_RANDOM_WEBHOOK_SECRET"
```

`SUPABASE_URL` and the Supabase server key are injected by Supabase and must not
be copied into frontend files.

## 4. Deploy the Edge Function

```powershell
supabase functions deploy send-order-ready --no-verify-jwt
```

JWT verification is disabled at the gateway because the function accepts both
Database Webhook calls and Staff app calls. The function itself validates either
the webhook secret or an authenticated user listed in `staff_profiles`.

## 5. Create the Database Webhook

In Supabase Dashboard, open **Database > Webhooks** and create:

- Name: `send-order-ready`
- Table: `public.order_ready_notifications`
- Event: `INSERT`
- Type: Supabase Edge Function
- Function: `send-order-ready`
- Method: `POST`
- Header: `Content-Type: application/json`
- Header: `x-elim-webhook-secret: YOUR_RANDOM_WEBHOOK_SECRET`

The webhook is a fallback for delivery. The Staff app also invokes the same Edge
Function immediately after completing an order. The database outbox claim makes
the two paths safe to run together without sending the same order twice.

## 6. Deploy the PWA

Commit and push the web files to GitHub Pages after replacing the VAPID public
key. No VAPID private key or Supabase server key may be committed.

## 7. End-to-end test

1. Sign in to the customer PWA on the test phone.
2. Press **Enable order notifications** and allow notifications.
3. Confirm a row for that user appears in `public.push_subscriptions`.
4. Place an order while signed in.
5. Keep the page visible and complete the order in Staff: the in-app ready dialog,
   vibration and sound should run.
6. Place a second order, background or close the installed PWA, then complete it:
   the device should receive a system notification.
7. Tap the notification: the Elim Café customer app should open or focus.
8. Confirm `orders.ready_notified_at` is set and the matching
   `order_ready_notifications.status` is `sent`.
9. Press Completed again: no second outbox row or push should be produced.
10. Repeat after selecting DE, EN, KO and 中文 to check the stored language.

Useful diagnostic query:

```sql
select
  o.order_number,
  o.status,
  o.customer_user_id,
  o.ready_notified_at,
  n.status as notification_status,
  n.attempts,
  n.last_error
from public.orders as o
left join public.order_ready_notifications as n on n.order_id = o.id
order by o.created_at desc
limit 20;
```
