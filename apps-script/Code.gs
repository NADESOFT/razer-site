/**
 * Razer Gold order intake — Google Apps Script Web App.
 *
 * Setup (see README.md for full steps):
 * 1. Paste this file into Extensions > Apps Script on the target Google Sheet.
 * 2. Create a sheet tab named "Orders" with header row:
 *    Order ID | Timestamp | Denomination (USD) | Buyer Email | Payment Method |
 *    Transaction ID | Sender Info | Notes | Order Status
 * 3. Project Settings > Script Properties: add RECAPTCHA_SECRET with your
 *    reCAPTCHA v3 secret key. If left unset, reCAPTCHA verification is skipped
 *    (useful for initial testing) — set it before going live.
 * 4. Deploy > New deployment > Web app > Execute as "Me" > Access "Anyone".
 * 5. Copy the /exec URL into APPS_SCRIPT_URL in assets/js/main.js.
 */

const SHEET_NAME = 'Orders';
const RECAPTCHA_MIN_SCORE = 0.5;
const ALLOWED_PAYMENT_METHODS = ['Binance', 'bKash'];
const ALLOWED_DENOMINATIONS = ['5', '10', '20', '25', '50', '100'];
const MAX_FIELD_LENGTH = { transactionId: 100, senderInfo: 100, notes: 500 };
const DUPLICATE_WINDOW_SECONDS = 300;

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ status: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents || '{}');

    // Honeypot: if filled, silently pretend success without writing a row.
    if (data.website) {
      return jsonResponse({ ok: true, orderId: 'RG-0000-0000' });
    }

    const validationError = validate_(data);
    if (validationError) {
      return jsonResponse({ ok: false, error: validationError });
    }

    if (!verifyRecaptcha_(data.recaptchaToken)) {
      return jsonResponse({ ok: false, error: 'Verification failed. Please try again.' });
    }

    if (isDuplicate_(data.email, data.transactionId)) {
      return jsonResponse({ ok: false, error: 'This order looks like a duplicate submission. If this is a mistake, please contact us.' });
    }

    const orderId = generateOrderId_();
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    sheet.appendRow([
      orderId,
      new Date(),
      '$' + data.denomination,
      sanitize_(data.email),
      data.paymentMethod,
      sanitize_(data.transactionId),
      sanitize_(data.senderInfo || ''),
      sanitize_(data.notes || ''),
      'Pending',
    ]);

    return jsonResponse({ ok: true, orderId: orderId });
  } catch (err) {
    return jsonResponse({ ok: false, error: 'Unexpected error. Please try again or contact us directly.' });
  }
}

function validate_(data) {
  if (!data.denomination || !data.email || !data.paymentMethod || !data.transactionId) {
    return 'Please fill in all required fields.';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    return 'Please enter a valid email address.';
  }
  if (ALLOWED_PAYMENT_METHODS.indexOf(data.paymentMethod) === -1) {
    return 'Invalid payment method.';
  }
  if (ALLOWED_DENOMINATIONS.indexOf(String(data.denomination)) === -1) {
    return 'Invalid denomination.';
  }
  for (const field in MAX_FIELD_LENGTH) {
    if (data[field] && String(data[field]).length > MAX_FIELD_LENGTH[field]) {
      return 'One of your fields is too long.';
    }
  }
  return null;
}

/** Neutralizes leading characters that Sheets could interpret as a formula. */
function sanitize_(value) {
  let v = String(value).replace(/[\r\n\t]+/g, ' ').trim();
  if (/^[=+\-@]/.test(v)) {
    v = "'" + v;
  }
  return v;
}

function generateOrderId_() {
  const tz = Session.getScriptTimeZone();
  const datePart = Utilities.formatDate(new Date(), tz, 'yyyyMMdd');
  const randomPart = Utilities.getUuid().split('-')[0].slice(0, 4).toUpperCase();
  return `RG-${datePart}-${randomPart}`;
}

function verifyRecaptcha_(token) {
  const secret = PropertiesService.getScriptProperties().getProperty('RECAPTCHA_SECRET');
  if (!secret) {
    // Not configured yet — allow through so the owner can test the order flow
    // before setting up reCAPTCHA. Set RECAPTCHA_SECRET before going live.
    return true;
  }
  if (!token) return false;
  try {
    const response = UrlFetchApp.fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'post',
      payload: { secret: secret, response: token },
      muteHttpExceptions: true,
    });
    const result = JSON.parse(response.getContentText());
    return !!result.success && (typeof result.score !== 'number' || result.score >= RECAPTCHA_MIN_SCORE);
  } catch (err) {
    return false;
  }
}

function isDuplicate_(email, transactionId) {
  const cache = CacheService.getScriptCache();
  const key = 'order_' + email + '_' + transactionId;
  if (cache.get(key)) return true;
  cache.put(key, '1', DUPLICATE_WINDOW_SECONDS);
  return false;
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
