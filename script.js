const TEMPLATE_KEY = "rk-pole-aboniment-template";
const DOC = document.body?.dataset?.doc || "aboniment";
const IS_INVOICE = DOC === "invoice";
const MIN_VISITS = 1;
const MAX_VISITS = 32;

const FIELD_NAMES = [
  "client",
  "lessons",
  "price",
  "from",
  "until",
  "note",
  "equipment",
  "equipmentPrice",
  "number",
  "paidAt",
  "paymentMethod",
  "paymentStatus",
  "serviceLabel",
  "equipmentQty",
];

const defaults = {
  client: "Кристина Борисова",
  lessons: "8",
  price: "—",
  currency: "₺",
  from: "01.11.2026",
  until: "01.12.2026",
  note: "Pole / Stretch / Choreography",
  equipment: "—",
  equipmentPrice: "—",
  number: "024",
  paidAt: "28.10.2026",
  paymentMethod: "Наличные",
  paymentStatus: "Оплачено",
  serviceLabel: "Абонемент на занятия",
  equipmentQty: "8",
  visits: [],
};

function parseMoney(value) {
  const raw = String(value ?? "").trim();
  if (!raw || /^[—–−-]+$/.test(raw)) return 0;
  const normalized = raw.replace(/\s/g, "").replace(",", ".");
  const match = normalized.match(/\d+(?:\.\d+)?/);
  const num = match ? parseFloat(match[0]) : NaN;
  return Number.isFinite(num) ? num : 0;
}

function formatMoney(sum) {
  if (!sum) return "—";
  return Number.isInteger(sum) ? String(sum) : String(Math.round(sum * 100) / 100);
}

function fitMoneyInputs() {
  document.querySelectorAll(".money-value input").forEach((input) => {
    const len = Math.max(String(input.value || "").length, 1);
    input.style.width = `${len}ch`;
  });
}

function setNamedValue(name, value) {
  const el = document.querySelector(`[name="${name}"]`);
  if (!el || value == null) return;
  el.value = value;
}

function updateTotalPrice() {
  const lessons = parseMoney(document.querySelector('input[name="lessons"]')?.value);
  const price = parseMoney(document.querySelector('input[name="price"]')?.value);
  const equipmentPrice = parseMoney(
    document.querySelector('input[name="equipmentPrice"]')?.value
  );

  if (IS_INVOICE) {
    const equipmentQty = parseMoney(
      document.querySelector('input[name="equipmentQty"]')?.value
    );
    const lessonsSum = lessons * price;
    const equipmentSum = equipmentQty * equipmentPrice;
    setNamedValue("lessonsSum", formatMoney(lessonsSum));
    setNamedValue("equipmentSum", formatMoney(equipmentSum));
    setNamedValue("totalPrice", formatMoney(lessonsSum + equipmentSum));
  } else {
    setNamedValue("totalPrice", formatMoney(lessons * (price + equipmentPrice)));
  }

  fitMoneyInputs();
}

function getLessonCount() {
  const n = Math.round(parseMoney(document.querySelector('input[name="lessons"]')?.value));
  if (!Number.isFinite(n) || n < MIN_VISITS) return MIN_VISITS;
  return Math.min(n, MAX_VISITS);
}

function buildVisits(preserveMarks = true) {
  const root = document.getElementById("visits");
  if (!root) return;

  const count = getLessonCount();
  const prev = preserveMarks
    ? [...root.querySelectorAll(".visit")].map((cell) => cell.classList.contains("used"))
    : [];

  root.innerHTML = "";

  for (let i = 1; i <= count; i += 1) {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "visit";
    const used = Boolean(prev[i - 1]);
    cell.classList.toggle("used", used);
    cell.setAttribute("aria-pressed", String(used));
    cell.innerHTML = `
      <span class="visit-num">${String(i).padStart(2, "0")}</span>
      <span class="visit-mark">${used ? "✓" : ""}</span>
    `;

    cell.addEventListener("click", () => {
      const nowUsed = cell.classList.toggle("used");
      cell.setAttribute("aria-pressed", String(nowUsed));
      cell.querySelector(".visit-mark").textContent = nowUsed ? "✓" : "";
    });

    root.appendChild(cell);
  }
}

function readStoredTemplate() {
  try {
    return JSON.parse(localStorage.getItem(TEMPLATE_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function collectTemplate() {
  const data = { ...readStoredTemplate() };
  FIELD_NAMES.forEach((name) => {
    const input = document.querySelector(`[name="${name}"]`);
    if (input) data[name] = input.value;
  });
  const currency = document.querySelector('select[name="currency"]')?.value;
  if (currency) data.currency = currency;
  if (!IS_INVOICE) {
    data.visits = [...document.querySelectorAll(".visit")].map((cell) =>
      cell.classList.contains("used")
    );
  }
  return data;
}

function applyTemplate(data) {
  if (!data) return;
  FIELD_NAMES.forEach((name) => {
    const inputs = document.querySelectorAll(`[name="${name}"]`);
    inputs.forEach((input) => {
      if (data[name] != null) input.value = data[name];
    });
  });

  // На чеке qty аренды по умолчанию = числу занятий, если ещё не задано
  if (IS_INVOICE && data.equipmentQty == null && data.lessons != null) {
    setNamedValue("equipmentQty", data.lessons);
  }

  if (data.currency) {
    document.querySelectorAll("select.currency").forEach((el) => {
      el.value = data.currency;
    });
  }

  if (!IS_INVOICE) {
    buildVisits(false);
    const visits = Array.isArray(data.visits) ? data.visits : [];
    document.querySelectorAll(".visit").forEach((cell, index) => {
      const used = Boolean(visits[index]);
      cell.classList.toggle("used", used);
      cell.setAttribute("aria-pressed", String(used));
      cell.querySelector(".visit-mark").textContent = used ? "✓" : "";
    });
  }

  updateTotalPrice();
  syncCurrency();
  fitMoneyInputs();
}

function saveTemplate() {
  const data = collectTemplate();
  localStorage.setItem(TEMPLATE_KEY, JSON.stringify(data));
  const btn = document.getElementById("saveTemplateBtn");
  const prev = btn.textContent;
  btn.textContent = "Сохранено";
  setTimeout(() => {
    btn.textContent = prev;
  }, 1200);
}

function loadTemplate() {
  try {
    const raw = localStorage.getItem(TEMPLATE_KEY);
    if (!raw) return false;
    applyTemplate(JSON.parse(raw));
    return true;
  } catch {
    return false;
  }
}

function resetExample() {
  applyTemplate({ ...defaults, visits: [] });
}

function syncCurrency(source) {
  const value = source?.value || document.querySelector('select[name="currency"]')?.value;
  if (!value) return;
  document.querySelectorAll("select.currency").forEach((el) => {
    el.value = value;
  });
}

function syncNumber(source) {
  const value = source?.value ?? document.querySelector('input[name="number"]')?.value;
  if (value == null) return;
  document.querySelectorAll('input[name="number"]').forEach((el) => {
    if (el !== source) el.value = value;
  });
}

function fileName() {
  const client = document.querySelector('input[name="client"]')?.value?.trim() || "client";
  const number = document.querySelector('input[name="number"]')?.value?.trim() || "000";
  const safe = client.replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, "_");
  const kind = IS_INVOICE ? "Invoice" : "Aboniment";
  return `RK_POLE_${kind}_${number}_${safe}.pdf`;
}

function waitForImages(root) {
  const images = [...root.querySelectorAll("img")];
  return Promise.all(
    images.map(
      (img) =>
        img.complete
          ? Promise.resolve()
          : new Promise((resolve) => {
              img.addEventListener("load", resolve, { once: true });
              img.addEventListener("error", resolve, { once: true });
            })
    )
  );
}

function styleReplacedControl(text, input, computed) {
  const isCurrency = input.classList.contains("currency");
  const inMoney = Boolean(input.closest(".money-value"));
  const isStamp = input.classList.contains("stamp-num");
  const isTotal = input.name === "totalPrice" || input.name === "lessonsSum" || input.name === "equipmentSum";
  const isPaySelect = input.classList.contains("pay-select") || input.name === "paymentMethod";

  text.style.boxSizing = "border-box";
  text.style.border = "none";
  text.style.background = "transparent";
  text.style.margin = "0";
  text.style.whiteSpace = "pre";
  text.style.overflow = "visible";

  if (isStamp) {
    text.style.width = input.classList.contains("invoice-num") ? "3rem" : "2.6rem";
    text.style.padding = "0";
    text.style.font = "700 0.95rem/1 Manrope, sans-serif";
    text.style.letterSpacing = "0.08em";
    text.style.textAlign = "center";
    text.style.color = "#f4f1ea";
  } else if (isCurrency) {
    text.style.width = "1.1em";
    text.style.padding = "0.2rem 0 0.35rem";
    text.style.font = "600 0.95rem/1.35 Manrope, sans-serif";
    text.style.color = "#9fc292";
  } else if (inMoney) {
    const len = Math.max(String(input.value || "").length, 1);
    text.style.width = input.style.width || `${len}ch`;
    text.style.padding = "0.2rem 0 0.35rem";
    text.style.font = isTotal
      ? "600 1rem/1.35 'Cormorant Garamond', Georgia, serif"
      : "500 1rem/1.35 'Cormorant Garamond', Georgia, serif";
    if (input.name === "totalPrice" && IS_INVOICE) {
      text.style.font = "600 1.35rem/1.35 'Cormorant Garamond', Georgia, serif";
    }
    text.style.color = "#9fc292";
    text.style.borderBottom = "none";
  } else if (isPaySelect) {
    text.style.width = "100%";
    text.style.padding = "0.2rem 0 0.35rem";
    text.style.font = "500 1rem/1.35 'Cormorant Garamond', Georgia, serif";
    text.style.color = "#f4f1ea";
    text.style.borderBottom = "1px solid rgba(244,241,234,0.16)";
  } else {
    text.style.width = "100%";
    text.style.padding = "0.2rem 0 0.35rem";
    text.style.minHeight = "1.4em";
    text.style.font = "500 1rem/1.35 'Cormorant Garamond', Georgia, serif";
    text.style.color = "#f4f1ea";
    text.style.borderBottom = "1px solid rgba(244,241,234,0.16)";
  }

  if (input.style.width) text.style.width = input.style.width;
  if (computed && inMoney && !isCurrency) {
    text.style.lineHeight = computed.lineHeight;
  }
}

function prepareClone(clonedDoc) {
  clonedDoc.body.classList.add("pdf-exporting");

  clonedDoc.querySelectorAll("input, select").forEach((input) => {
    const computed = clonedDoc.defaultView.getComputedStyle(input);
    const text = clonedDoc.createElement("div");
    text.className = input.className;
    text.textContent = input.value || "";
    styleReplacedControl(text, input, computed);
    input.replaceWith(text);
  });

  clonedDoc.querySelectorAll(".toolbar").forEach((el) => {
    el.remove();
  });
}

function getExportScale() {
  return 2;
}

function snapshotInputs(root) {
  const backups = [];
  root.querySelectorAll("input, select").forEach((input) => {
    const text = document.createElement("div");
    text.className = input.className;
    text.textContent = input.value || "";
    styleReplacedControl(text, input, null);

    const parent = input.parentNode;
    parent.replaceChild(text, input);
    backups.push({ input, text, parent });
  });
  return backups;
}

function restoreInputs(backups) {
  backups.reverse().forEach(({ input, text, parent }) => {
    if (text.parentNode === parent) parent.replaceChild(input, text);
  });
}

async function renderRoot(root) {
  const scale = getExportScale();
  const api = window.modernScreenshot;

  if (api?.domToCanvas) {
    return api.domToCanvas(root, {
      scale,
      backgroundColor: "#ffffff",
      quality: 1,
      pixelRatio: scale,
    });
  }

  if (window.html2canvas) {
    return html2canvas(root, {
      scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
      foreignObjectRendering: true,
      onclone: (doc) => prepareClone(doc),
    });
  }

  throw new Error("Нет библиотеки для снимка");
}

async function savePdf() {
  const btn = document.getElementById("pdfBtn");
  const sheet = document.getElementById("sheet");
  const root = document.getElementById("exportRoot");
  const JsPDF = window.jspdf?.jsPDF;
  const captureTarget = sheet || root;

  if (!JsPDF || !captureTarget) {
    window.print();
    return;
  }

  btn.disabled = true;
  const prevText = btn.textContent;
  btn.textContent = "Сохранение…";
  const pdfName = fileName();
  document.body.classList.add("pdf-exporting");
  const backups = snapshotInputs(root || captureTarget);

  try {
    await document.fonts?.ready;
    await waitForImages(captureTarget);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const canvas = await renderRoot(captureTarget);
    const imgData = canvas.toDataURL("image/png");

    const A4_W = 210;
    const A4_H = 297;
    const PDF = new JsPDF({
      unit: "mm",
      format: "a4",
      orientation: "portrait",
      compress: false,
    });

    PDF.addImage(imgData, "PNG", 0, 0, A4_W, A4_H, undefined, "NONE");
    PDF.save(pdfName);
  } catch (err) {
    console.error(err);
    alert("Не удалось сохранить PDF. Попробуйте «Печать» → «Сохранить как PDF».");
  } finally {
    restoreInputs(backups);
    document.body.classList.remove("pdf-exporting");
    btn.disabled = false;
    btn.textContent = prevText;
  }
}

document.getElementById("pdfBtn")?.addEventListener("click", savePdf);
document.getElementById("saveTemplateBtn")?.addEventListener("click", saveTemplate);
document.getElementById("printBtn")?.addEventListener("click", () => window.print());
document.getElementById("resetBtn")?.addEventListener("click", resetExample);

const exportRoot = document.getElementById("exportRoot");
exportRoot?.addEventListener("input", (event) => {
  const t = event.target;
  if (!(t instanceof HTMLInputElement || t instanceof HTMLSelectElement)) return;

  if (t.matches('input[name="lessons"]')) {
    if (!IS_INVOICE) buildVisits(true);
    updateTotalPrice();
  } else if (
    t.matches(
      'input[name="price"], input[name="equipmentPrice"], input[name="equipmentQty"]'
    )
  ) {
    updateTotalPrice();
  } else if (t.matches('input[name="number"]')) {
    syncNumber(t);
  } else if (t.matches(".money-value input")) {
    fitMoneyInputs();
  }
});

exportRoot?.addEventListener("change", (event) => {
  const t = event.target;
  if (t instanceof HTMLSelectElement && t.classList.contains("currency")) {
    syncCurrency(t);
  }
  if (
    t instanceof HTMLInputElement &&
    t.matches(
      'input[name="lessons"], input[name="price"], input[name="equipmentPrice"], input[name="equipmentQty"]'
    )
  ) {
    if (!IS_INVOICE && t.matches('input[name="lessons"]')) buildVisits(true);
    updateTotalPrice();
  }
});

if (!IS_INVOICE) buildVisits(false);
if (!loadTemplate()) {
  updateTotalPrice();
  syncCurrency();
  fitMoneyInputs();
}
