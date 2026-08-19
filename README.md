# Keys.bd — Static Storefront

A single-page, no-backend site for selling digital keys and gift cards (Razer Gold, Google
Play, Steam, Apple, Windows, and anything else you add). The entire product catalog and a
few payment settings are read live from a Google Sheet, so you can add/edit/retire products
and update prices from your phone — no code changes or redeploys needed for routine updates.
Orders are collected into the same Sheet via a Google Apps Script Web App; payment (Binance
crypto or bKash) and code delivery are handled manually by you.

## How the live catalog works

- `assets/js/main.js` fetches `YOUR_APPS_SCRIPT_URL?action=catalog` on every page load.
- That endpoint reads three tabs — **Products**, **Settings**, and **Reviews** — and returns
  them as JSON.
- The product grid (paginated, 2 rows at a time), category filter pills, the order form's
  product dropdown, the BDT/USD price shown in the order summary, the Binance Pay ID / bKash
  number on the page, and the customer reviews slider are all rendered from that response.
- If the fetch fails for any reason (Apps Script not deployed yet, temporary outage), the
  site falls back to a small built-in example catalog and shows a banner saying so — the
  page is never blank, but you should treat that banner as a signal something needs checking.
- The **Orders** tab is never exposed through this endpoint — only Products/Settings/Reviews
  are public, since none of them contain customer data.

## What you must configure before launch

1. **Google Sheet — four tabs**

   **`Products`** — header row exactly:
   `Category | Name | Face Value (USD) | Price (USD) | Badge | Active | Sort Order`

   | Category    | Name           | Face Value (USD) | Price (USD) | Badge      | Active | Sort Order |
   | ----------- | -------------- | ---------------- | ----------- | ---------- | ------ | ---------- |
   | Razer Gold  | $5             | 5                | 4.25        |            | TRUE   | 1          |
   | Razer Gold  | $10            | 10               | 8.50        | Popular    | TRUE   | 2          |
   | Razer Gold  | $20            | 20               | 16.80       |            | TRUE   | 3          |
   | Google Play | $10            | 10               | 8.70        |            | TRUE   | 4          |
   | Google Play | $25            | 25               | 21.50       |            | TRUE   | 5          |
   | Steam       | $20            | 20               | 17.40       |            | TRUE   | 6          |
   | Steam       | $50            | 50               | 43.00       | Best Value | TRUE   | 7          |
   | Apple       | $25            | 25               | 21.75       |            | TRUE   | 8          |
   | Windows     | Windows 11 Pro | 199              | 149         |            | TRUE   | 9          |

   Notes:
   - `Face Value` = original price, `Price` = what the customer actually pays. If they're
     equal (or Face Value is left blank), the card just shows the price with no discount
     badge — useful for one-off license keys you don't want to discount.
   - `Badge` is optional free text (e.g. "Popular", "Best Value", "Limited"). Any product
     with a badge gets the gold-glow highlighted card treatment; leave it blank for a
     normal card.
   - `Active` — set to `FALSE` to hide a product without deleting the row.
   - `Sort Order` controls display order (also determines category tab order, by whichever
     category's first product has the lowest number).
   - This is example seed data, not your real catalog — replace/expand it with your actual
     products and prices. There's no limit on how many rows or categories you add.

   **`Settings`** — header row `Key | Value`, with these rows:

   | Key             | Value       |
   | --------------- | ----------- |
   | usd_to_bdt_rate | 122         |
   | binance_pay_id  | 48416808    |
   | bkash_number    | 01773371221 |

   Update `usd_to_bdt_rate` whenever the exchange rate moves — the order form's BDT amount
   recalculates automatically, no redeploy needed.

   **`Reviews`** — header row exactly: `Name | Rating | Text | Date | Active`

   | Name  | Rating | Text                          | Date       | Active |
   | ----- | ------ | ----------------------------- | ---------- | ------ |
   | Rafiq | 5      | Fast delivery, genuine code.  | 2026-08-01 | TRUE   |
   | Nusrat| 4      | Good price, quick reply.      | 2026-07-15 | TRUE   |

   This drives the review slider on the site. `Rating` is 1–5. `Date` can be any format
   `new Date()` understands (e.g. `2026-08-01`) — it's shown as "Month Year" and used to sort
   newest-first; leave it blank if you don't want a date shown. **Only add reviews you
   actually received** — see the note in the Reviews section below. Leave this tab empty
   (just the header row) if you don't have any real reviews yet; the site shows an honest
   "no reviews yet" state instead of an empty slider.

   **`Orders`** — header row exactly:
   `Order ID | Timestamp | Category | Product | Price (USD) | Buyer Email | Payment Method | Transaction ID | Sender Info | Notes | Order Status`

   New rows are appended automatically by the Apps Script when a customer submits an order
   — you don't fill this in yourself. Optional: add a dropdown data validation on
   `Order Status` (Pending / Paid-Verified / Delivered / Rejected).

2. **Apps Script**
   - In the Sheet: Extensions → Apps Script.
   - Delete the boilerplate `Code.gs` content and paste in this repo's [apps-script/Code.gs](apps-script/Code.gs).
   - Save the project.

3. **reCAPTCHA v3** (recommended before going live; the form still works without it, just less spam-protected)
   - Go to https://www.google.com/recaptcha/admin and register a new site, type **reCAPTCHA v3**, domain `keys.bd` (add the `www.keys.bd` and `*.github.io` variants too if you plan to test on the raw Pages URL).
   - Copy the **Site key** into two places in this repo:
     - `assets/js/main.js` → `RECAPTCHA_SITE_KEY`
     - `index.html` → the `<script src="https://www.google.com/recaptcha/api.js?render=...">` tag near the bottom of `<body>`
   - Copy the **Secret key** into the Apps Script project: Project Settings (gear icon) → Script Properties → add property `RECAPTCHA_SECRET`.

4. **Deploy the Apps Script as a Web App**
   - In the Apps Script editor: Deploy → New deployment → type **Web app**.
   - Execute as: **Me**. Who has access: **Anyone**.
   - Deploy, authorize the requested permissions, and copy the generated `.../exec` URL.
   - Paste it into `assets/js/main.js` → `APPS_SCRIPT_URL`. This one URL powers both the
     catalog fetch (`?action=catalog`) and order submissions.

5. **Binance Pay / bKash**
   - The Pay ID, bKash number, and BDT exchange rate now come from the **Settings** tab
     (see step 1) — that's the one place to update them going forward.
   - The Binance QR code image (`assets/img/binance.png`) is still a static file, since
     swapping it is rare — replace it directly if you ever need a new QR code.

6. **Contact email**
   - Already set to `nadesoftwares@gmail.com` in `index.html` (footer and JSON-LD). Update it there if that changes.

7. **Reviews**
   - Reviews now come from the **`Reviews`** Sheet tab (see step 1) and render as a slider — nothing to edit in `index.html`. Add a real review as a new row and it appears on the next page load; leave the tab empty and the site shows an honest "no reviews yet" state instead. Only add reviews you actually received — fake reviews/ratings are illegal to publish as genuine in most jurisdictions (FTC in the US, and Bangladesh's consumer protection rules) and Google can penalize sites for fake review structured data.

8. **Domain / URLs**
   - `index.html`, `sitemap.xml`, and `robots.txt` are already set to `https://keys.bd/`. If you decide to use `www.keys.bd` as the canonical instead, update those files accordingly.

## Publish to GitHub Pages with the keys.bd domain

1. Push this folder to a new **public** GitHub repository.
2. Repo Settings → Pages → Source: branch `main`, folder `/ (root)`.
3. In the same Pages settings page, under "Custom domain" enter `keys.bd` and save — this writes a `CNAME` file into the repo (this repo already has one committed with `keys.bd` in it, so GitHub should pick it up automatically; if the settings field is blank, just type `keys.bd` in and save).
4. At your domain registrar / DNS provider for keys.bd, add:
   - Four **A** records on the apex (`@`) pointing to GitHub Pages' IPs:
     `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - Optionally a **CNAME** record for `www` pointing to `<your-github-username>.github.io` if you also want `www.keys.bd` to work (GitHub will redirect it to the apex domain).
5. DNS changes can take a few minutes to a few hours to propagate. Once GitHub detects it, check "Enforce HTTPS" in the Pages settings (the option only appears after DNS is verified and GitHub has issued a certificate — this can take up to 24 hours).
6. Submit `https://keys.bd/` and `sitemap.xml` in [Google Search Console](https://search.google.com/search-console).

## How order fulfillment works

1. A customer picks a product (from any category), fills in the order form → a row is
   appended to the `Orders` sheet with status `Pending`. The price stored is looked up
   fresh from the `Products` sheet server-side at submit time — a customer's browser can
   never submit a price you didn't set.
2. You check the sheet, verify the payment (Binance/bKash transaction matches), and manually email the buyer their key/code.
3. You update the `Order Status` cell to `Paid/Verified` then `Delivered` (or `Rejected` if payment can't be verified).

## Adding or updating products day-to-day

Just edit the `Products` tab — add a row for a new product, change a `Price` cell, or flip
`Active` to `FALSE` to hide something. The site picks it up on the next page load; nothing
to redeploy. The same applies to the exchange rate and payment details in `Settings`.

## Testing before real customers use it

- Open the site and confirm products load from your actual Sheet (not the fallback example catalog — if you see the yellow "Showing example pricing" banner, something's misconfigured).
- Submit a real test order and confirm a row appears correctly in the `Orders` sheet with the right category/product/price.
- Try submitting with a missing field, a mismatched confirm-email, and a transaction ID starting with `=` (formula-injection attempt) — the form and the Apps Script should both reject/neutralize these.
- Try submitting with a `productId` that doesn't exist (e.g. after removing a row) — the Apps Script should reject it with "no longer available."
- Check the site on a phone-sized screen, including the category pills and custom product dropdown.
- Run a Lighthouse audit (Chrome DevTools) against the deployed URL.
