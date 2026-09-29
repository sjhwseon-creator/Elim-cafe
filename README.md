# Elim Café

Version 1 is a simple static PWA for church café ordering. Customers order from `index.html`, and staff see incoming orders in real time on `staff.html`.

Payment and printer functionality are intentionally not included in this version.

## Files

- `index.html` - customer menu, cart, customer name, review, and order confirmation screen.
- `staff.html` - tablet-friendly staff dashboard for live orders and status changes.
- `css/styles.css` - shared mobile-first café styling.
- `js/menu.js` - editable menu data for Version 1.
- `js/supabase-config.js` - Supabase URL and anon key placeholder.
- `js/customer.js` - cart behavior and order submission.
- `js/staff.js` - staff order loading, realtime subscription, and status updates.
- `manifest.json` - PWA install metadata.
- `service-worker.js` - caches the app shell for repeat visits.
- `icons/` - placeholder PWA icons.
- `supabase-schema.sql` - SQL for the Supabase tables, policies, sequence, and realtime publication.

## Supabase setup

1. Create a Supabase project.
2. Open the Supabase SQL editor.
3. Run the SQL in `supabase-schema.sql`.
4. Open `js/supabase-config.js`.
5. Replace `https://YOUR-PROJECT-REF.supabase.co` with your Supabase project URL.
6. Replace `YOUR-SUPABASE-ANON-KEY` with your public anon key.

## Local testing

For PWA and service-worker testing, serve the folder over HTTP:

```bash
python -m http.server 4173
```

Then open:

- Customer app: `http://127.0.0.1:4173/index.html`
- Staff dashboard: `http://127.0.0.1:4173/staff.html`

## Hosting

This project can be hosted as static files on GitHub Pages, Netlify, Cloudflare Pages, or any similar static host.
