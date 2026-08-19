/**
 * Keys.bd order intake + live catalog — Google Apps Script Web App.
 *
 * Setup (see README.md for full steps):
 * 1. Paste this file into Extensions > Apps Script on the target Google Sheet.
 * 2. Create four sheet tabs:
 *    - "Products" — header row: Category | Name | Face Value (USD) | Price (USD) | Badge | Active | Sort Order
 *    - "Settings" — header row: Key | Value  (rows: usd_to_bdt_rate, binance_pay_id, bkash_number)
 *    - "Reviews"  — header row: Name | Rating | Text | Date | Active
 *    - "Orders"   — header row: Order ID | Timestamp | Category | Product | Price (USD) |
 *                   Buyer Email | Payment Method | Transaction ID | Sender Info | Notes | Order Status
 * 3. Project Settings > Script Properties: add RECAPTCHA_SECRET with your
 *    reCAPTCHA v3 secret key. If left unset, reCAPTCHA verification is skipped
 *    (useful for initial testing) — set it before going live.
 * 4. Deploy > New deployment > Web app > Execute as "Me" > Access "Anyone".
 * 5. Copy the /exec URL into APPS_SCRIPT_URL in assets/js/main.js.
 *
 * The front end fetches the live catalog via GET ?action=catalog. The Orders
 * tab is NEVER exposed through doGet — only Products/Settings/Reviews are
 * public, since none of them contain customer data.
 */

const ORDERS_SHEET_NAME = "Orders";
const PRODUCTS_SHEET_NAME = "Products";
const SETTINGS_SHEET_NAME = "Settings";
const REVIEWS_SHEET_NAME = "Reviews";
const RECAPTCHA_MIN_SCORE = 0.5;
const ALLOWED_PAYMENT_METHODS = ["Binance", "bKash"];
const MAX_FIELD_LENGTH = { transactionId: 100, senderInfo: 100, notes: 500 };
const DUPLICATE_WINDOW_SECONDS = 300;

function doGet(e) {
  if (e.parameter && e.parameter.action === "catalog") {
    return jsonResponse({
      ok: true,
      products: getProducts_(),
      settings: getSettings_(),
      reviews: getReviews_(),
    });
  }
  return jsonResponse({ status: "ok" });
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents || "{}");

    // Honeypot: if filled, silently pretend success without writing a row.
    if (data.website) {
      return jsonResponse({ ok: true, orderId: "KB-0000-0000" });
    }

    const fieldError = validateFields_(data);
    if (fieldError) {
      return jsonResponse({ ok: false, error: fieldError });
    }

    // Never trust a client-submitted price — look the product up fresh so
    // an edited/removed Sheet row is always the source of truth.
    const product = getProducts_().find((p) => p.id === data.productId);
    if (!product) {
      return jsonResponse({
        ok: false,
        error:
          "That product is no longer available. Please refresh and choose again.",
      });
    }

    if (!verifyRecaptcha_(data.recaptchaToken)) {
      return jsonResponse({
        ok: false,
        error: "Verification failed. Please try again.",
      });
    }

    if (isDuplicate_(data.email, data.transactionId)) {
      return jsonResponse({
        ok: false,
        error:
          "This order looks like a duplicate submission. If this is a mistake, please contact us.",
      });
    }

    const orderId = generateOrderId_();
    const sheet =
      SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ORDERS_SHEET_NAME);
    sheet.appendRow([
      orderId,
      new Date(),
      product.category,
      product.name,
      product.price,
      sanitize_(data.email),
      data.paymentMethod,
      sanitize_(data.transactionId),
      sanitize_(data.senderInfo || ""),
      sanitize_(data.notes || ""),
      "Pending",
    ]);

    return jsonResponse({ ok: true, orderId: orderId });
  } catch (err) {
    return jsonResponse({
      ok: false,
      error: "Unexpected error. Please try again or contact us directly.",
    });
  }
}

function validateFields_(data) {
  if (
    !data.productId ||
    !data.email ||
    !data.paymentMethod ||
    !data.transactionId
  ) {
    return "Please fill in all required fields.";
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    return "Please enter a valid email address.";
  }
  if (ALLOWED_PAYMENT_METHODS.indexOf(data.paymentMethod) === -1) {
    return "Invalid payment method.";
  }
  for (const field in MAX_FIELD_LENGTH) {
    if (data[field] && String(data[field]).length > MAX_FIELD_LENGTH[field]) {
      return "One of your fields is too long.";
    }
  }
  return null;
}

/** Reads the Products tab into an array of catalog items. Inactive/blank rows are skipped. */
function getProducts_() {
  const sheet =
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PRODUCTS_SHEET_NAME);
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  const products = [];

  for (let i = 1; i < rows.length; i++) {
    const [category, name, face, price, badge, active, sortOrder] = rows[i];
    if (!category || !name) continue;
    if (active === false || String(active).toUpperCase() === "FALSE") continue;

    const faceNum = Number(face) || Number(price) || 0;
    const priceNum = Number(price) || faceNum;

    products.push({
      id: slugify_(category) + "--" + slugify_(name),
      category: String(category).trim(),
      name: String(name).trim(),
      face: faceNum,
      price: priceNum,
      badge: badge ? String(badge).trim() : "",
      sortOrder: Number(sortOrder) || i,
    });
  }

  products.sort((a, b) => a.sortOrder - b.sortOrder);
  return products;
}

/** Reads the Settings tab (Key | Value rows) into a plain object with camelCase keys. */
function getSettings_() {
  const sheet =
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SETTINGS_SHEET_NAME);
  const defaults = { usdToBdtRate: 122, binancePayId: "", bkashNumber: "" };
  if (!sheet) return defaults;

  const rows = sheet.getDataRange().getValues();
  const map = {
    usd_to_bdt_rate: "usdToBdtRate",
    binance_pay_id: "binancePayId",
    bkash_number: "bkashNumber",
  };
  const settings = Object.assign({}, defaults);

  for (let i = 1; i < rows.length; i++) {
    const [key, value] = rows[i];
    const camelKey = map[String(key).trim()];
    if (!camelKey || value === "" || value === null) continue;
    settings[camelKey] =
      camelKey === "usdToBdtRate"
        ? Number(value) || defaults.usdToBdtRate
        : String(value).trim();
  }

  return settings;
}

/** Reads the Reviews tab into an array of { name, rating, text, date }, newest first. */
function getReviews_() {
  const sheet =
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName(REVIEWS_SHEET_NAME);
  if (!sheet) return [];

  const rows = sheet.getDataRange().getValues();
  const tz = Session.getScriptTimeZone();
  const reviews = [];

  for (let i = 1; i < rows.length; i++) {
    const [name, rating, text, date, active] = rows[i];
    if (!name || !text) continue;
    if (active === false || String(active).toUpperCase() === "FALSE") continue;

    const dateObj = date ? new Date(date) : null;
    reviews.push({
      name: sanitize_(name),
      rating: Math.max(1, Math.min(5, Math.round(Number(rating)) || 5)),
      text: sanitize_(text),
      date: dateObj ? Utilities.formatDate(dateObj, tz, "MMMM yyyy") : "",
      sortKey: dateObj ? dateObj.getTime() : 0,
    });
  }

  reviews.sort((a, b) => b.sortKey - a.sortKey);
  reviews.forEach((r) => delete r.sortKey);
  return reviews;
}

function slugify_(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Neutralizes leading characters that Sheets could interpret as a formula. */
function sanitize_(value) {
  let v = String(value)
    .replace(/[\r\n\t]+/g, " ")
    .trim();
  if (/^[=+\-@]/.test(v)) {
    v = "'" + v;
  }
  return v;
}

function generateOrderId_() {
  const tz = Session.getScriptTimeZone();
  const datePart = Utilities.formatDate(new Date(), tz, "yyyyMMdd");
  const randomPart = Utilities.getUuid()
    .split("-")[0]
    .slice(0, 4)
    .toUpperCase();
  return `KB-${datePart}-${randomPart}`;
}

function verifyRecaptcha_(token) {
  const secret =
    PropertiesService.getScriptProperties().getProperty("RECAPTCHA_SECRET");
  if (!secret) {
    // Not configured yet — allow through so the owner can test the order flow
    // before setting up reCAPTCHA. Set RECAPTCHA_SECRET before going live.
    return true;
  }
  if (!token) return false;
  try {
    const response = UrlFetchApp.fetch(
      "https://www.google.com/recaptcha/api/siteverify",
      {
        method: "post",
        payload: { secret: secret, response: token },
        muteHttpExceptions: true,
      },
    );
    const result = JSON.parse(response.getContentText());
    return (
      !!result.success &&
      (typeof result.score !== "number" || result.score >= RECAPTCHA_MIN_SCORE)
    );
  } catch (err) {
    return false;
  }
}

function isDuplicate_(email, transactionId) {
  const cache = CacheService.getScriptCache();
  const key = "order_" + email + "_" + transactionId;
  if (cache.get(key)) return true;
  cache.put(key, "1", DUPLICATE_WINDOW_SECONDS);
  return false;
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
