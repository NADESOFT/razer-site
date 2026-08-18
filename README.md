# Keys.bd — Static Storefront

A single-page, no-backend site for selling Razer Gold PIN codes. Orders are collected
into a Google Sheet via a Google Apps Script Web App; payment (Binance crypto or bKash)
and code delivery are handled manually by you.

## What you must configure before launch

1. **Google Sheet**
   - Create a new Google Sheet, e.g. "Razer Gold Orders".
   - Rename the first tab to `Orders`.
   - Add this exact header row:
     `Order ID | Timestamp | Denomination (USD) | Buyer Email | Payment Method | Transaction ID | Sender Info | Notes | Order Status`
   - Optional but recommended: select the `Order Status` column → Data → Data validation →
     dropdown list with `Pending`, `Paid/Verified`, `Delivered`, `Rejected`.

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
   - Paste it into `assets/js/main.js` → `APPS_SCRIPT_URL`.

5. **Binance Pay**
   - Already configured: Pay ID `48416808` and the real QR code at `assets/img/binance.png` are wired into the payment section of `index.html`. Double-check these are correct before launch.

6. **bKash**
   - The personal number `01773371221` is already set in `index.html`. Double check it's correct and active for Send Money before launch.

7. **Pricing**
   - Prices are discounted 15-17% off face value, scaling up with the card size (e.g. $5 card = 15% off = $4.25; $100 card = 17% off = $83.00). Defined in two places that must be kept in sync: the product cards in `index.html`, and the `DENOMINATIONS` array in `assets/js/main.js`.
   - Update `USD_TO_BDT_RATE` in `assets/js/main.js` to a current exchange rate.

8. **Contact email**
   - Already set to `nadesoftwares@gmail.com` in `index.html` (footer and JSON-LD). Update it there if that changes.

9. **Domain / URLs**
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

1. A customer submits the order form → a row is appended to the `Orders` sheet with status `Pending`.
2. You check the sheet, verify the payment (Binance/bKash transaction matches), and manually email the buyer their Razer Gold PIN code.
3. You update the `Order Status` cell to `Paid/Verified` then `Delivered` (or `Rejected` if payment can't be verified).

## Testing before real customers use it

- Submit a real test order and confirm a row appears correctly in the sheet.
- Try submitting with a missing field, a mismatched confirm-email, and a transaction ID starting with `=` (formula-injection attempt) — the form and the Apps Script should both reject/neutralize these.
- Check the site on a phone-sized screen.
- Run a Lighthouse audit (Chrome DevTools) against the deployed URL.
