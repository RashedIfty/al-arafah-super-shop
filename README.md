# Al-Arafah Super Shop

Trilingual (বাংলা · English · 日本語) storefront and owner panel for
Al-Arafah Super Shop, Tsukuba, Japan. Products live in Supabase, so an
edit in the owner panel reaches every visitor within seconds.

## Run locally

ES modules need HTTP — opening the HTML files directly will not work.

```bash
python3 -m http.server 8080     # then open http://localhost:8080
```

## Structure

```
index.html  products.html  about.html  contact.html  admin.html

src/
├── shared/            used by both the storefront and the admin panel
│   ├── lib/           dom.js · format.js        (no app knowledge)
│   ├── ui/            icons.js                  (inline SVG set)
│   └── shop.js        shop name, phone, hours
│
├── features/          domain logic, independent of any one page
│   ├── catalog/       products and categories
│   ├── deals/         "Today's Deal & New Arrival"
│   └── i18n/          language state + en · bn · ja strings
│
├── backend/           everything that talks to the server
│   ├── client.js      Supabase reads, writes, uploads, realtime
│   ├── config.js      project URL and anon key
│   ├── schema/        table definitions and security rules
│   └── seed/          initial data
│
├── storefront/        the public site
│   ├── main.js        entry point
│   ├── components/    chrome · product-card · category-browser ·
│   │                  deals-bar · lightbox · search
│   └── styles/        main.css imports base/ layout/ components/
│
└── admin/             the owner panel
    ├── main.js        entry point
    ├── auth.js        sign in / out
    ├── local-store.js offline fallback
    └── styles/

images/                logo · cover · categories/ · products/
                       served straight from the site root as /images/...
```

**Dependency direction:** `storefront` and `admin` may import from
`features`, `backend` and `shared`. Nothing in `shared` imports from a
feature, and nothing in `features` imports from a page. That keeps the
domain logic reusable and the layers easy to reason about.

## Icons

No emoji anywhere — they render differently on every platform, cannot be
styled, and read poorly to screen readers. Use the SVG set instead:

```js
import { icon } from "../shared/ui/icons.js";
icon("phone", { size: 16 });            // decorative
icon("trash", { size: 14, label: "Delete" });   // meaningful
```

Add a new one by putting its path data in `src/shared/ui/icons.js`.

## Adding a product

Use the owner panel at `/admin.html` — it writes straight to Supabase and
the site updates live. `src/features/catalog/catalog.js` is only the
offline fallback used when the database is unreachable.

## Database

Run `src/backend/schema/schema.sql` once, then `src/backend/seed/seed.sql`
to load the starting data. Row Level Security allows public reads and
restricts writes to a signed-in owner.

Removing something sets `archived_at` rather than deleting the row; the
Archive tab in the panel restores it or deletes it permanently.

## Building and deploying

The site is static. After changing any script or stylesheet:

    npm install        # once, for the build tools
    node build.js      # writes assets/ and points every page at it

then commit everything and push to `main`. Cloudflare Workers deploys
each push to main (`npx wrangler deploy`, configured in `wrangler.jsonc`;
what is not published is listed in `.assetsignore`). `/api/shop` and
`/api/stamp` run in `worker/site.js`; everything else is a static file.

## Database backups

Every night at 03:00 Japan time, `.github/workflows/backup.yml` copies
the database (the shop's tables and the login accounts), encrypts it,
and stores it as `YYYY-MM-DD.sql.gz.enc` in the private Cloudflare R2
bucket `alarafah-backups`. The last 30 days are kept. A red run in the
repository's Actions tab means that night's copy failed.

To restore one (into a new Supabase project, or any Postgres 17):

1. Download it: Cloudflare → R2 → `alarafah-backups` → the day → Download,
   or `npx wrangler r2 object get alarafah-backups/2026-09-26.sql.gz.enc --remote --file b.enc`
2. Decrypt it with the backup passphrase (kept by the owner, and as the
   `BACKUP_PASS` secret on GitHub):

       openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in b.enc | gunzip > backup.sql

3. Load it (Supabase → Project Settings → Database gives the address):

       psql "postgresql://postgres:PASSWORD@HOST:5432/postgres" -f backup.sql

   The login accounts come first in the file, then the shop's tables.
   Into a project that already has data, restore into a fresh one
   instead and move across what is needed — never over the live shop.
