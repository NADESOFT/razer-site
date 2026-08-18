/*
 * Edit these constants before going live.
 */
const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyAwM3fHs5gEh256ZM8-oOPltIQWrUZfUSFE88SPeF3o-XarUPNWEVIwfTbmfaoBL95/exec";
const RECAPTCHA_SITE_KEY = "6Lfvu4wtAAAAANdQaJgY0e6CGwogWHFYIP1BpI5B";
const USD_TO_BDT_RATE = 122; // placeholder exchange rate, update as needed

// Keep in sync with the denomination <option> values / product cards in index.html.
// Discount tiers scale up with denomination — bigger cards get bigger savings, from 15% up to 17%.
const DENOMINATIONS = [
  { value: "5", face: 5.0, price: 4.25, discount: 0.15 },
  { value: "10", face: 10.0, price: 8.5, discount: 0.15 },
  { value: "20", face: 20.0, price: 16.8, discount: 0.16 },
  { value: "25", face: 25.0, price: 21.0, discount: 0.16 },
  { value: "50", face: 50.0, price: 41.5, discount: 0.17 },
  { value: "100", face: 100.0, price: 83.0, discount: 0.17 },
];

document.getElementById("year").textContent = new Date().getFullYear();

/* ---------- BDT price table ---------- */
(function renderBdtTable() {
  const tbody = document.getElementById("bdt-table-body");
  if (!tbody) return;
  tbody.innerHTML = DENOMINATIONS.map((d) => {
    const bdt = Math.round(d.price * USD_TO_BDT_RATE);
    const saveUsd = (d.face - d.price).toFixed(2);
    return `<tr><td>Razer Gold $${d.value}</td><td>$${d.price.toFixed(2)}</td><td class="save-cell">-${Math.round(d.discount * 100)}% ($${saveUsd})</td><td>৳${bdt.toLocaleString("en-US")}</td></tr>`;
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
  const saveUsd = (denom.face - denom.price).toFixed(2);
  const savePct = Math.round(denom.discount * 100);

  priceSummary.hidden = false;
  priceSummary.innerHTML = `
    <span class="price-label">${label}</span>
    <span class="price-value-group">
      <span class="price-value">${value}</span>
      <span class="price-savings">You save $${saveUsd} (${savePct}% off)</span>
    </span>`;
}

if (denominationSelect) {
  denominationSelect.addEventListener("change", updatePriceSummary);
}
document.querySelectorAll('input[name="paymentMethod"]').forEach((radio) => {
  radio.addEventListener("change", updatePriceSummary);
});
updatePriceSummary();

/* ---------- Product cards: whole card is clickable, selects the denomination ---------- */
(function setupProductCards() {
  const grid = document.querySelector(".product-grid");
  if (!grid) return;
  const cards = Array.from(grid.querySelectorAll(".product-card"));

  cards.forEach((card) => {
    const denom = DENOMINATIONS.find(
      (d) => d.value === card.getAttribute("data-denom"),
    );
    if (denom) {
      const saveUsd = (denom.face - denom.price).toFixed(2);
      card.setAttribute(
        "aria-label",
        `Select Razer Gold $${denom.value} — pay $${denom.price.toFixed(2)}, save $${saveUsd}`,
      );
    }
  });

  function chooseCard(card) {
    const denom = card.getAttribute("data-denom");
    if (denominationSelect) {
      denominationSelect.value = denom;
      denominationSelect.dispatchEvent(new Event("change", { bubbles: true }));
    }
    document
      .getElementById("order")
      .scrollIntoView({ behavior: "smooth", block: "start" });
  }

  grid.addEventListener("click", (e) => {
    const card = e.target.closest(".product-card");
    if (card) chooseCard(card);
  });
  grid.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const card = e.target.closest(".product-card");
    if (!card) return;
    e.preventDefault();
    chooseCard(card);
  });
})();

/* ---------- Custom dropdown for the Razer Gold Card field ---------- */
(function setupCustomSelect() {
  const trigger = document.getElementById("denomination-trigger");
  const valueEl = document.getElementById("denomination-value");
  const listbox = document.getElementById("denomination-listbox");
  if (!trigger || !valueEl || !listbox || !denominationSelect) return;

  listbox.innerHTML = DENOMINATIONS.map((d) => {
    const savePct = Math.round(d.discount * 100);
    return `
      <li role="option" class="custom-select-option" id="denom-opt-${d.value}" data-value="${d.value}" tabindex="-1" aria-selected="false">
        <span class="opt-name">Razer Gold $${d.value}</span>
        <span class="opt-price"><s>$${d.face.toFixed(2)}</s> $${d.price.toFixed(2)} <span class="opt-discount">-${savePct}%</span></span>
      </li>`;
  }).join("");

  const options = Array.from(
    listbox.querySelectorAll(".custom-select-option"),
  );

  function closeListbox() {
    listbox.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
  }

  function openListbox() {
    listbox.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    const current =
      options.find((o) => o.dataset.value === denominationSelect.value) ||
      options[0];
    if (current) current.focus();
  }

  function syncTriggerLabel() {
    const denom = DENOMINATIONS.find(
      (d) => d.value === denominationSelect.value,
    );
    valueEl.textContent = denom
      ? `Razer Gold $${denom.value}`
      : "Select a Razer Gold Card";
    valueEl.classList.toggle("is-placeholder", !denom);
    options.forEach((o) => {
      o.setAttribute(
        "aria-selected",
        String(o.dataset.value === denominationSelect.value),
      );
    });
  }

  function selectValue(value) {
    denominationSelect.value = value;
    denominationSelect.dispatchEvent(new Event("change", { bubbles: true }));
    closeListbox();
    trigger.focus();
  }

  trigger.addEventListener("click", () => {
    if (listbox.hidden) openListbox();
    else closeListbox();
  });

  trigger.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openListbox();
    }
  });

  options.forEach((option, index) => {
    option.addEventListener("click", () => selectValue(option.dataset.value));
    option.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        selectValue(option.dataset.value);
      } else if (e.key === "Escape") {
        closeListbox();
        trigger.focus();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        (options[index + 1] || options[0]).focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        (options[index - 1] || options[options.length - 1]).focus();
      } else if (e.key === "Tab") {
        closeListbox();
      }
    });
  });

  document.addEventListener("click", (e) => {
    if (!listbox.hidden && !e.target.closest(".custom-select")) {
      closeListbox();
    }
  });

  denominationSelect.addEventListener("change", syncTriggerLabel);
  syncTriggerLabel();
})();

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

  if (!denominationSelect.value) {
    showStatus("Please select a Razer Gold Card.", "error");
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
