/*
 * Edit these constants before going live.
 */
const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbxvfRm7lM7U7AU6v1MBvOVnMEj8M0XsqSgES4NL5bXd9wmo7Tb37CR5neB9BiCnpgU4/exec";
const RECAPTCHA_SITE_KEY = "6Lfvu4wtAAAAANdQaJgY0e6CGwogWHFYIP1BpI5B";

// Used only if the live catalog can't be fetched (e.g. Apps Script not
// configured yet, or a temporary network/Google outage) so the page never
// shows a blank product section. Once the Sheet is set up, real data from
// it always takes priority over this.
const FALLBACK_PRODUCTS = [
  {
    id: "razer-gold--5",
    category: "Razer Gold",
    name: "$5",
    face: 5,
    price: 4.25,
    badge: "",
  },
  {
    id: "razer-gold--10",
    category: "Razer Gold",
    name: "$10",
    face: 10,
    price: 8.5,
    badge: "Popular",
  },
  {
    id: "google-play--10",
    category: "Google Play",
    name: "$10",
    face: 10,
    price: 8.7,
    badge: "",
  },
  {
    id: "steam--20",
    category: "Steam",
    name: "$20",
    face: 20,
    price: 17.4,
    badge: "",
  },
  {
    id: "apple--25",
    category: "Apple",
    name: "$25",
    face: 25,
    price: 21.75,
    badge: "",
  },
  {
    id: "windows--windows-11-pro",
    category: "Windows",
    name: "Windows 11 Pro",
    face: 199,
    price: 149,
    badge: "",
  },
];
const FALLBACK_SETTINGS = {
  usdToBdtRate: 122,
  binancePayId: "48416808",
  bkashNumber: "01773371221",
};

let PRODUCTS = [];
let REVIEWS = [];
let SETTINGS = Object.assign({}, FALLBACK_SETTINGS);
let activeCategory = "All";
let currentPage = 1;
const ROWS_PER_PAGE = 2;

document.getElementById("year").textContent = new Date().getFullYear();

/* ---------- Helpers ---------- */
function usd(n) {
  return `$${Number(n).toFixed(2)}`;
}
function savings(product) {
  const save = product.face - product.price;
  if (save <= 0.004) return null;
  return {
    saveUsd: save.toFixed(2),
    savePct: Math.round((save / product.face) * 100),
  };
}
function bdt(usdAmount) {
  return `৳${Math.round(usdAmount * SETTINGS.usdToBdtRate).toLocaleString("en-US")}`;
}
function categoriesInOrder(products) {
  const seen = [];
  products.forEach((p) => {
    if (!seen.includes(p.category)) seen.push(p.category);
  });
  return seen;
}
const ESCAPE_MAP = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch]);
}

/* ---------- Catalog fetch ---------- */
async function loadCatalog() {
  const grid = document.getElementById("product-grid");
  try {
    if (APPS_SCRIPT_URL.includes("PASTE_DEPLOYED"))
      throw new Error("not configured");
    const response = await fetch(`${APPS_SCRIPT_URL}?action=catalog`);
    const result = await response.json();
    if (
      !result.ok ||
      !Array.isArray(result.products) ||
      result.products.length === 0
    ) {
      throw new Error("empty catalog");
    }
    PRODUCTS = result.products;
    SETTINGS = Object.assign({}, FALLBACK_SETTINGS, result.settings || {});
    REVIEWS = Array.isArray(result.reviews) ? result.reviews : [];
  } catch (err) {
    PRODUCTS = FALLBACK_PRODUCTS;
    SETTINGS = FALLBACK_SETTINGS;
    REVIEWS = [];
    const notice = document.getElementById("catalog-notice");
    if (notice) {
      notice.hidden = false;
      notice.textContent =
        "Showing example pricing — live catalog is temporarily unavailable. Refresh to try again.";
    }
  }
  if (grid) grid.classList.remove("is-loading");
  renderPaymentSettings();
  renderCategoryPills();
  renderProductGrid();
  renderProductListbox();
  renderCatalogStructuredData();
  renderReviews();
  updatePriceSummary();
}

/* ---------- Payment settings (Binance Pay ID / bKash number) ---------- */
function renderPaymentSettings() {
  const payId = document.getElementById("binance-pay-id");
  const bkashNum = document.getElementById("bkash-number");
  if (payId) payId.textContent = SETTINGS.binancePayId;
  if (bkashNum) bkashNum.textContent = SETTINGS.bkashNumber;
}

/* ---------- Category pills ---------- */
function renderCategoryPills() {
  const wrap = document.getElementById("category-pills");
  if (!wrap) return;
  const categories = ["All", ...categoriesInOrder(PRODUCTS)];
  wrap.innerHTML = categories
    .map(
      (cat) =>
        `<button type="button" class="pill${cat === activeCategory ? " is-active" : ""}" data-category="${cat}">${cat}</button>`,
    )
    .join("");

  wrap.querySelectorAll(".pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      activeCategory = pill.dataset.category;
      currentPage = 1;
      wrap
        .querySelectorAll(".pill")
        .forEach((p) => p.classList.toggle("is-active", p === pill));
      renderProductGrid();
    });
  });
}

/* ---------- Product grid ---------- */
function productCardHTML(product) {
  const save = savings(product);
  const category = escapeHtml(product.category);
  const name = escapeHtml(product.name);
  const badge = escapeHtml(product.badge);
  const featuredClass = product.badge ? " product-card-featured" : "";
  const ribbon = product.badge
    ? `<span class="featured-ribbon">${badge}</span>`
    : save
      ? `<span class="discount-badge">-${save.savePct}%</span>`
      : "";
  const caption = save
    ? `${name} &middot; <span class="save-amount">Save $${save.saveUsd}</span>`
    : name;

  return `
    <article class="product-card${featuredClass}" data-id="${product.id}" role="button" tabindex="0" aria-label="Select ${category} ${name} — pay ${usd(product.price)}${save ? `, save $${save.saveUsd}` : ""}">
      ${ribbon}
      <span class="card-brand">${category}</span>
      <span class="product-face">${usd(product.price)}</span>
      <span class="card-caption">${caption}</span>
      <span class="select-cta">Select</span>
    </article>`;
}

/** Reads the grid's actual current column count (responsive, via auto-fill) so pagination always shows exactly ROWS_PER_PAGE rows regardless of viewport. */
function getColumnsPerRow() {
  const grid = document.getElementById("product-grid");
  if (!grid) return 1;
  const tracks = getComputedStyle(grid)
    .gridTemplateColumns.split(" ")
    .filter(Boolean);
  return Math.max(tracks.length, 1);
}

function renderProductGrid() {
  const grid = document.getElementById("product-grid");
  if (!grid) return;
  const filtered =
    activeCategory === "All"
      ? PRODUCTS
      : PRODUCTS.filter((p) => p.category === activeCategory);

  const pageSize = getColumnsPerRow() * ROWS_PER_PAGE;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  currentPage = Math.min(Math.max(currentPage, 1), totalPages);
  const start = (currentPage - 1) * pageSize;
  const visible = filtered.slice(start, start + pageSize);

  grid.innerHTML =
    visible.map(productCardHTML).join("") ||
    `<p class="section-sub">No products in this category yet.</p>`;
  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  const wrap = document.getElementById("product-pagination");
  if (!wrap) return;
  if (totalPages <= 1) {
    wrap.innerHTML = "";
    return;
  }
  wrap.innerHTML = `
    <button type="button" class="page-btn" id="page-prev" ${currentPage === 1 ? "disabled" : ""}>&larr; Prev</button>
    <span class="page-status">Page ${currentPage} of ${totalPages}</span>
    <button type="button" class="page-btn" id="page-next" ${currentPage === totalPages ? "disabled" : ""}>Next &rarr;</button>
  `;
  const goTo = (page) => {
    currentPage = page;
    renderProductGrid();
    document
      .getElementById("products")
      .scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const prevBtn = document.getElementById("page-prev");
  const nextBtn = document.getElementById("page-next");
  if (prevBtn) prevBtn.addEventListener("click", () => goTo(currentPage - 1));
  if (nextBtn) nextBtn.addEventListener("click", () => goTo(currentPage + 1));
}

let productGridResizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(productGridResizeTimer);
  productGridResizeTimer = setTimeout(() => {
    currentPage = 1;
    renderProductGrid();
  }, 200);
});

function chooseProduct(id) {
  const select = document.getElementById("product");
  if (!select) return;
  select.value = id;
  select.dispatchEvent(new Event("change", { bubbles: true }));
  document
    .getElementById("order")
    .scrollIntoView({ behavior: "smooth", block: "start" });
}

(function setupProductGridEvents() {
  const grid = document.getElementById("product-grid");
  if (!grid) return;
  grid.addEventListener("click", (e) => {
    const card = e.target.closest(".product-card");
    if (card) chooseProduct(card.dataset.id);
  });
  grid.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const card = e.target.closest(".product-card");
    if (!card) return;
    e.preventDefault();
    chooseProduct(card.dataset.id);
  });
})();

/* ---------- Order price summary ---------- */
const productSelect = document.getElementById("product");
const priceSummary = document.getElementById("price-summary");

function updatePriceSummary() {
  if (!productSelect || !priceSummary) return;
  const product = PRODUCTS.find((p) => p.id === productSelect.value);
  if (!product) {
    priceSummary.hidden = true;
    priceSummary.innerHTML = "";
    return;
  }
  const paymentMethod = (
    document.querySelector('input[name="paymentMethod"]:checked') || {}
  ).value;

  let label, value;
  if (paymentMethod === "bKash") {
    label = "You pay via bKash";
    value = `${bdt(product.price)} BDT`;
  } else {
    label = "You pay via Binance Pay";
    value = `${usd(product.price)} USD`;
  }
  const save = savings(product);

  priceSummary.hidden = false;
  priceSummary.innerHTML = `
    <span class="price-label">${label}</span>
    <span class="price-value-group">
      <span class="price-value">${value}</span>
      ${save ? `<span class="price-savings">You save $${save.saveUsd} (${save.savePct}% off)</span>` : ""}
    </span>`;
}

if (productSelect) {
  productSelect.addEventListener("change", updatePriceSummary);
}
document.querySelectorAll('input[name="paymentMethod"]').forEach((radio) => {
  radio.addEventListener("change", updatePriceSummary);
});

/* ---------- Custom dropdown for the Product field ---------- */
const customSelectTrigger = document.getElementById("product-trigger");
const customSelectValue = document.getElementById("product-value");
const customSelectListbox = document.getElementById("product-listbox");

function closeProductListbox() {
  if (!customSelectListbox) return;
  customSelectListbox.hidden = true;
  customSelectTrigger.setAttribute("aria-expanded", "false");
}

function openProductListbox() {
  if (!customSelectListbox) return;
  customSelectListbox.hidden = false;
  customSelectTrigger.setAttribute("aria-expanded", "true");
  const current =
    customSelectListbox.querySelector(
      `[data-value="${productSelect.value}"]`,
    ) || customSelectListbox.querySelector(".custom-select-option");
  if (current) current.focus();
}

function syncProductTriggerLabel() {
  if (!customSelectValue) return;
  const product = PRODUCTS.find((p) => p.id === productSelect.value);
  customSelectValue.textContent = product
    ? `${product.category} ${product.name}`
    : "Select a product";
  customSelectValue.classList.toggle("is-placeholder", !product);
  customSelectListbox.querySelectorAll(".custom-select-option").forEach((o) => {
    o.setAttribute(
      "aria-selected",
      String(o.dataset.value === productSelect.value),
    );
  });
}

function selectProduct(value) {
  productSelect.value = value;
  productSelect.dispatchEvent(new Event("change", { bubbles: true }));
  closeProductListbox();
  customSelectTrigger.focus();
}

function renderProductListbox() {
  if (!productSelect) return;
  const previousValue = productSelect.value;
  productSelect.innerHTML =
    '<option value="">Select a product</option>' +
    PRODUCTS.map(
      (p) =>
        `<option value="${p.id}">${escapeHtml(p.category)} ${escapeHtml(p.name)}</option>`,
    ).join("");
  if (PRODUCTS.some((p) => p.id === previousValue)) {
    productSelect.value = previousValue;
  }

  if (!customSelectListbox) return;
  customSelectListbox.innerHTML = PRODUCTS.map((p) => {
    const save = savings(p);
    return `
      <li role="option" class="custom-select-option" data-value="${p.id}" tabindex="-1" aria-selected="false">
        <span class="opt-name">${escapeHtml(p.category)} ${escapeHtml(p.name)}</span>
        <span class="opt-price">${save ? `<s>${usd(p.face)}</s> ` : ""}${usd(p.price)}${save ? ` <span class="opt-discount">-${save.savePct}%</span>` : ""}</span>
      </li>`;
  }).join("");

  const options = Array.from(
    customSelectListbox.querySelectorAll(".custom-select-option"),
  );
  options.forEach((option, index) => {
    option.addEventListener("click", () => selectProduct(option.dataset.value));
    option.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        selectProduct(option.dataset.value);
      } else if (e.key === "Escape") {
        closeProductListbox();
        customSelectTrigger.focus();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        (options[index + 1] || options[0]).focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        (options[index - 1] || options[options.length - 1]).focus();
      } else if (e.key === "Tab") {
        closeProductListbox();
      }
    });
  });

  syncProductTriggerLabel();
}

if (customSelectTrigger && customSelectListbox && productSelect) {
  customSelectTrigger.addEventListener("click", () => {
    if (customSelectListbox.hidden) openProductListbox();
    else closeProductListbox();
  });
  customSelectTrigger.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openProductListbox();
    }
  });
  document.addEventListener("click", (e) => {
    if (!customSelectListbox.hidden && !e.target.closest(".custom-select")) {
      closeProductListbox();
    }
  });
  productSelect.addEventListener("change", syncProductTriggerLabel);
}

/* ---------- Structured data (built from the real live catalog) ---------- */
function renderCatalogStructuredData() {
  const existing = document.getElementById("catalog-jsonld");
  if (existing) existing.remove();
  if (PRODUCTS.length === 0) return;

  const itemListElement = PRODUCTS.slice(0, 30).map((p, i) => ({
    "@type": "ListItem",
    position: i + 1,
    item: {
      "@type": "Product",
      name: `${p.category} ${p.name}`,
      brand: { "@type": "Brand", name: p.category },
      offers: {
        "@type": "Offer",
        priceCurrency: "USD",
        price: p.price.toFixed(2),
        availability: "https://schema.org/InStock",
      },
    },
  }));

  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.id = "catalog-jsonld";
  script.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement,
  });
  document.head.appendChild(script);
}

/* ---------- Reviews slider (sourced from the Reviews sheet tab) ---------- */
function reviewCardHTML(review) {
  const stars = "★".repeat(review.rating) + "☆".repeat(5 - review.rating);
  const name = escapeHtml(review.name);
  const text = escapeHtml(review.text);
  const date = escapeHtml(review.date);
  return `
    <article class="review-card">
      <div class="review-stars" aria-label="${review.rating} out of 5 stars">${stars}</div>
      <p class="review-text">"${text}"</p>
      <p class="review-author">&mdash; ${name}${date ? `, ${date}` : ""}</p>
    </article>`;
}

function renderReviews() {
  const emptyState = document.getElementById("reviews-empty");
  const sliderWrap = document.getElementById("reviews-slider-wrap");
  const slider = document.getElementById("reviews-slider");
  if (!emptyState || !sliderWrap || !slider) return;

  if (REVIEWS.length === 0) {
    emptyState.hidden = false;
    sliderWrap.hidden = true;
    slider.innerHTML = "";
    return;
  }

  emptyState.hidden = true;
  sliderWrap.hidden = false;
  slider.innerHTML = REVIEWS.map(reviewCardHTML).join("");

  const prevBtn = document.getElementById("reviews-prev");
  const nextBtn = document.getElementById("reviews-next");
  const scrollByCard = (direction) => {
    const card = slider.querySelector(".review-card");
    const step = card
      ? card.getBoundingClientRect().width + 16
      : slider.clientWidth * 0.8;
    slider.scrollBy({ left: direction * step, behavior: "smooth" });
  };
  if (prevBtn) prevBtn.onclick = () => scrollByCard(-1);
  if (nextBtn) nextBtn.onclick = () => scrollByCard(1);
}

loadCatalog();

/* ---------- Copy-to-clipboard ---------- */
document.querySelectorAll(".copy-btn").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const targetId = btn.getAttribute("data-copy-target");
    const el = document.getElementById(targetId);
    if (!el) return;
    try {
      await navigator.clipboard.writeText(el.textContent.trim());
      const original = btn.textContent;
      btn.textContent = "Copied!";
      setTimeout(() => {
        btn.textContent = original;
      }, 1500);
    } catch (err) {
      /* clipboard API unavailable; user can select and copy manually */
    }
  });
});

/* ---------- Scroll reveal ---------- */
(function scrollReveal() {
  const targets = document.querySelectorAll(".section, .hero");
  targets.forEach((el) => el.setAttribute("data-reveal", ""));
  if (!("IntersectionObserver" in window)) {
    targets.forEach((el) => el.classList.add("is-visible"));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1 },
  );
  targets.forEach((el) => observer.observe(el));
})();

/* ---------- Order form submission ---------- */
const form = document.getElementById("order-form");
const submitBtn = document.getElementById("submit-btn");
const statusEl = document.getElementById("form-status");

function setSubmitting(isSubmitting) {
  submitBtn.disabled = isSubmitting;
  submitBtn.querySelector(".btn-label").textContent = isSubmitting
    ? "Submitting..."
    : "Submit Order";
  submitBtn.querySelector(".btn-spinner").hidden = !isSubmitting;
}

function showStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = "form-status" + (type ? " is-" + type : "");
}

async function getRecaptchaToken() {
  if (
    typeof grecaptcha === "undefined" ||
    RECAPTCHA_SITE_KEY.includes("PLACEHOLDER")
  ) {
    return "";
  }
  try {
    return await new Promise((resolve) => {
      grecaptcha.ready(() => {
        grecaptcha
          .execute(RECAPTCHA_SITE_KEY, { action: "submit_order" })
          .then(resolve)
          .catch(() => resolve(""));
      });
    });
  } catch (err) {
    return "";
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  showStatus("", "");

  if (!productSelect.value) {
    showStatus("Please select a product.", "error");
    return;
  }

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const email = document.getElementById("email").value.trim();
  const confirmEmail = document.getElementById("confirmEmail").value.trim();
  if (email.toLowerCase() !== confirmEmail.toLowerCase()) {
    showStatus("Email addresses do not match.", "error");
    return;
  }

  if (APPS_SCRIPT_URL.includes("PASTE_DEPLOYED")) {
    showStatus(
      "Ordering is not configured yet. Please contact us directly.",
      "error",
    );
    return;
  }

  setSubmitting(true);

  const token = await getRecaptchaToken();
  document.getElementById("recaptchaToken").value = token;

  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());
  payload.productId = productSelect.value;

  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();

    if (result.ok) {
      showStatus(
        `Order received! Your order ID is ${result.orderId}. We'll email your code after verifying your payment.`,
        "success",
      );
      form.reset();
      updatePriceSummary();
    } else {
      showStatus(
        result.error || "Something went wrong. Please try again or contact us.",
        "error",
      );
    }
  } catch (err) {
    showStatus(
      "Could not submit your order. Please check your connection and try again.",
      "error",
    );
  } finally {
    setSubmitting(false);
  }
});
