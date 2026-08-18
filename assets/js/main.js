/*
 * Edit these constants before going live.
 */
const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyAwM3fHs5gEh256ZM8-oOPltIQWrUZfUSFE88SPeF3o-XarUPNWEVIwfTbmfaoBL95/exec";
const RECAPTCHA_SITE_KEY = "6Lfvu4wtAAAAANdQaJgY0e6CGwogWHFYIP1BpI5B";
const USD_TO_BDT_RATE = 122; // placeholder exchange rate, update as needed

// Keep in sync with the denomination <option> values / product cards in index.html.
// Prices are face value discounted 17% (DISCOUNT_RATE below) — update both if the discount changes.
const DISCOUNT_RATE = 0.17;
const DENOMINATIONS = [
  { value: "5", face: 5.0, price: 4.15 },
  { value: "10", face: 10.0, price: 8.3 },
  { value: "20", face: 20.0, price: 16.6 },
  { value: "25", face: 25.0, price: 20.75 },
  { value: "50", face: 50.0, price: 41.5 },
  { value: "100", face: 100.0, price: 83.0 },
];

document.getElementById("year").textContent = new Date().getFullYear();

/* ---------- BDT price table ---------- */
(function renderBdtTable() {
  const tbody = document.getElementById("bdt-table-body");
  if (!tbody) return;
  tbody.innerHTML = DENOMINATIONS.map((d) => {
    const bdt = Math.round(d.price * USD_TO_BDT_RATE);
    return `<tr><td>$${d.value}</td><td>$${d.price.toFixed(2)}</td><td>৳${bdt.toLocaleString("en-US")}</td></tr>`;
  }).join("");
})();

/* ---------- Order price summary (updates with denomination + payment method) ---------- */
const denominationSelect = document.getElementById("denomination");
const priceSummary = document.getElementById("price-summary");

function updatePriceSummary() {
  if (!denominationSelect || !priceSummary) return;
  const denom = DENOMINATIONS.find((d) => d.value === denominationSelect.value);
  if (!denom) {
    priceSummary.hidden = true;
    priceSummary.innerHTML = "";
    return;
  }
  const paymentMethod = (
    document.querySelector('input[name="paymentMethod"]:checked') || {}
  ).value;

  let label, value;
  if (paymentMethod === "bKash") {
    const bdt = Math.round(denom.price * USD_TO_BDT_RATE);
    label = "You pay via bKash";
    value = `৳${bdt.toLocaleString("en-US")} BDT`;
  } else {
    label = "You pay via Binance Pay";
    value = `$${denom.price.toFixed(2)} USD`;
  }

  priceSummary.hidden = false;
  priceSummary.innerHTML = `<span class="price-label">${label}</span><span class="price-value">${value}</span>`;
}

if (denominationSelect) {
  denominationSelect.addEventListener("change", updatePriceSummary);
}
document.querySelectorAll('input[name="paymentMethod"]').forEach((radio) => {
  radio.addEventListener("change", updatePriceSummary);
});
updatePriceSummary();

/* ---------- Product card "Select" pre-fills the order form ---------- */
document.querySelectorAll(".select-denom").forEach((btn) => {
  btn.addEventListener("click", () => {
    const card = btn.closest(".product-card");
    const denom = card.getAttribute("data-denom");
    const select = document.getElementById("denomination");
    if (select) select.value = denom;
    updatePriceSummary();
    document
      .getElementById("order")
      .scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

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
