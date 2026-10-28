const TEMPLATE_KEY = "rk-pole-aboniment-template";
const INVOICE_THEME_KEY = "rk-pole-invoice-theme";
const CUSTOM_TEMPLATE_URL = "template.json";
const EMPTY_TEMPLATE_URL = "template-empty.json";
const MIN_VISITS = 1;
const MAX_VISITS = 32;

const SHARED_FIELDS = [
  "client",
  "lessons",
  "price",
  "from",
  "until",
  "note",
  "equipment",
  "equipmentPrice",
  "number",
];

const FIELD_NAMES = [
  ...SHARED_FIELDS,
  "paidAt",
  "paymentMethod",
  "paymentStatus",
  "serviceLabel",
  "equipmentQty",
];

const EMPTY_TEMPLATE = {
  client: "",
  lessons: "8",
  price: "—",
  currency: "₺",
  from: "",
  until: "",
  note: "",
  equipment: "—",
  equipmentPrice: "—",
  number: "",
  paidAt: "",
  paymentMethod: "Наличные",
  paymentStatus: "Оплачено",
  serviceLabel: "Абонемент на занятия",
  equipmentQty: "8",
  visits: [],
};

const META = {
  aboniment: {
    title: "Шаблон абонемента",
    hint: "Превью ниже — лист A4 1:1. Слева абонемент, справа отметки.",
    docTitle: "Абонемент — R&K POLE Alanya",
  },
  invoice: {
    title: "Чек / инвойс об оплате",
    hint: "Отдельный лист A4. Данные клиента и суммы синхронизируются с абонементом.",
    docTitle: "Чек об оплате — R&K POLE Alanya",
  },
  template: {
    title: "Шаблон",
    hint: "Общие данные для абонемента и чека: скачать, загрузить или очистить.",
    docTitle: "Шаблон — R&K POLE Alanya",
  },
};

const DOC_MODES = new Set(["aboniment", "invoice", "template"]);

function modeFromHash() {
  const hash = (location.hash || "").replace("#", "");
  return DOC_MODES.has(hash) ? hash : "aboniment";
}

let currentMode = modeFromHash();

function isInvoice() {
  return currentMode === "invoice";
}

function isTemplate() {
  return currentMode === "template";
}

function activeStage() {
  if (isTemplate()) return null;
  return document.getElementById(isInvoice() ? "stageInvoice" : "stageAboniment");
}

function activeSheet() {
  if (isTemplate()) return null;
  return document.getElementById(isInvoice() ? "sheetInvoice" : "sheetAboniment");
}

function activeExportRoot() {
  if (isTemplate()) return null;
  return document.getElementById(isInvoice() ? "exportInvoice" : "exportAboniment");
}

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

function fitMoneyInputs(root = document) {
  root.querySelectorAll(".money-value input").forEach((input) => {
    const len = Math.max(String(input.value || "").length, 1);
    input.style.width = `${len}ch`;
  });
}

function setNamedValue(name, value, root = document) {
  root.querySelectorAll(`[name="${name}"]`).forEach((el) => {
    if (value != null) el.value = value;
  });
}

function getNamedValue(name, root = activeStage() || document) {
  return root.querySelector(`[name="${name}"]`)?.value;
}

function updateTotalPrice(root = activeStage() || document) {
  if (!root) return;

  const lessons = parseMoney(getNamedValue("lessons", root));
  const price = parseMoney(getNamedValue("price", root));
  const equipmentPrice = parseMoney(getNamedValue("equipmentPrice", root));

  if (root.dataset.stage === "invoice" || root.id === "stageInvoice") {
    const equipmentQty = parseMoney(getNamedValue("equipmentQty", root));
    const lessonsSum = lessons * price;
    const equipmentSum = equipmentQty * equipmentPrice;
    setNamedValue("lessonsSum", formatMoney(lessonsSum), root);
    setNamedValue("equipmentSum", formatMoney(equipmentSum), root);
    setNamedValue("totalPrice", formatMoney(lessonsSum + equipmentSum), root);
  } else {
    setNamedValue("totalPrice", formatMoney(lessons * (price + equipmentPrice)), root);
  }

  fitMoneyInputs(root);
}

function getLessonCount() {
  const n = Math.round(parseMoney(getNamedValue("lessons", document.getElementById("stageAboniment"))));
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
  const stage = activeStage() || document;

  FIELD_NAMES.forEach((name) => {
    const input = stage.querySelector(`[name="${name}"]`);
    if (input) data[name] = input.value;
  });

  const currency = stage.querySelector('select[name="currency"]')?.value;
  if (currency) data.currency = currency;

  data.visits = [...document.querySelectorAll("#visits .visit")].map((cell) =>
    cell.classList.contains("used")
  );

  return data;
}

function applyTemplate(data) {
  if (!data) return;

  FIELD_NAMES.forEach((name) => {
    if (data[name] == null) return;
    document.querySelectorAll(`[name="${name}"]`).forEach((input) => {
      input.value = data[name];
    });
  });

  if (data.equipmentQty == null && data.lessons != null) {
    setNamedValue("equipmentQty", data.lessons, document.getElementById("stageInvoice"));
  }

  if (data.currency) {
    document.querySelectorAll("select.currency").forEach((el) => {
      el.value = data.currency;
    });
  }

  buildVisits(false);
  const visits = Array.isArray(data.visits) ? data.visits : [];
  document.querySelectorAll("#visits .visit").forEach((cell, index) => {
    const used = Boolean(visits[index]);
    cell.classList.toggle("used", used);
    cell.setAttribute("aria-pressed", String(used));
    const mark = cell.querySelector(".visit-mark");
    if (mark) mark.textContent = used ? "✓" : "";
  });

  updateTotalPrice(document.getElementById("stageAboniment"));
  updateTotalPrice(document.getElementById("stageInvoice"));
  syncCurrency();
  fitMoneyInputs(document);
}

function flashButton(btn, text, ms = 1400) {
  if (!btn) return;
  const prev = btn.textContent;
  btn.textContent = text;
  setTimeout(() => {
    btn.textContent = prev;
  }, ms);
}

function downloadTemplateFile(data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "template.json";
  a.click();
  URL.revokeObjectURL(url);
}

async function fetchJson(url) {
  const res = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function saveTemplate() {
  const data = collectTemplate();
  localStorage.setItem(TEMPLATE_KEY, JSON.stringify(data));
  downloadTemplateFile(data);
  flashButton(document.getElementById("saveTemplateBtn"), "Скачан");
}

function applyLoadedTemplate(data, btn, okText = "Загружен") {
  applyTemplate(data);
  localStorage.setItem(TEMPLATE_KEY, JSON.stringify(collectTemplate()));
  flashButton(btn, okText);
}

async function loadSiteTemplate() {
  const btn = document.getElementById("loadSiteTemplateBtn");
  try {
    const data = await fetchJson(CUSTOM_TEMPLATE_URL);
    applyLoadedTemplate(data, btn, "С сайта");
  } catch (err) {
    console.error(err);
    alert(
      "Не удалось загрузить template.json с сайта. Нужен push файла в репозиторий или открой через Live Server."
    );
  }
}

function loadTemplateFromFile() {
  document.getElementById("templateFileInput")?.click();
}

function onTemplateFileChosen(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;

  const btn = document.getElementById("loadTemplateBtn");
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result || ""));
      applyLoadedTemplate(data, btn, "Из файла");
    } catch (err) {
      console.error(err);
      alert("Не удалось прочитать JSON. Проверь, что это файл template.json.");
    }
  };
  reader.onerror = () => alert("Не удалось открыть файл.");
  reader.readAsText(file);
}

async function loadEmptyTemplate() {
  const btn = document.getElementById("emptyTemplateBtn");
  try {
    const data = await fetchJson(EMPTY_TEMPLATE_URL);
    applyTemplate(data);
  } catch {
    applyTemplate({ ...EMPTY_TEMPLATE, visits: [] });
  }
  localStorage.removeItem(TEMPLATE_KEY);
  flashButton(btn, "Очищено");
}

function loadStoredTemplate() {
  try {
    const raw = localStorage.getItem(TEMPLATE_KEY);
    if (!raw) return false;
    applyTemplate(JSON.parse(raw));
    return true;
  } catch {
    return false;
  }
}

async function initTemplate() {
  if (loadStoredTemplate()) return;

  try {
    const data = await fetchJson(CUSTOM_TEMPLATE_URL);
    applyTemplate(data);
    return;
  } catch {
    /* file:// или нет файла */
  }

  applyTemplate({ ...EMPTY_TEMPLATE, visits: [] });
  updateTotalPrice(document.getElementById("stageAboniment"));
  updateTotalPrice(document.getElementById("stageInvoice"));
  syncCurrency();
  fitMoneyInputs(document);
}

function syncCurrency(source) {
  const value =
    source?.value ||
    activeStage()?.querySelector('select[name="currency"]')?.value ||
    document.querySelector('select[name="currency"]')?.value;
  if (!value) return;
  document.querySelectorAll("select.currency").forEach((el) => {
    el.value = value;
  });
}

function syncNumber(source) {
  const value = source?.value ?? "";
  document.querySelectorAll('input[name="number"]').forEach((el) => {
    if (el !== source) el.value = value;
  });
}

function syncSharedFrom(fromStage) {
  if (!fromStage) return;
  SHARED_FIELDS.forEach((name) => {
    const src = fromStage.querySelector(`[name="${name}"]`);
    if (!src) return;
    document.querySelectorAll(`[name="${name}"]`).forEach((el) => {
      if (el !== src) el.value = src.value;
    });
  });

  const currency = fromStage.querySelector('select[name="currency"]')?.value;
  if (currency) {
    document.querySelectorAll("select.currency").forEach((el) => {
      el.value = currency;
    });
  }

  const inv = document.getElementById("stageInvoice");
  if (inv && !getNamedValue("equipmentQty", inv)) {
    setNamedValue("equipmentQty", getNamedValue("lessons", fromStage) || "8", inv);
  }

  updateTotalPrice(document.getElementById("stageAboniment"));
  updateTotalPrice(document.getElementById("stageInvoice"));
  fitMoneyInputs(document);
}

function setMode(mode, { sync = true, updateHash = true } = {}) {
  if (!DOC_MODES.has(mode)) return;

  const prevStage = activeStage();
  currentMode = mode;
  document.body.dataset.doc = mode;

  const stageA = document.getElementById("stageAboniment");
  const stageI = document.getElementById("stageInvoice");
  const stageT = document.getElementById("stageTemplate");
  if (stageA) stageA.hidden = mode !== "aboniment";
  if (stageI) stageI.hidden = mode !== "invoice";
  if (stageT) stageT.hidden = mode !== "template";

  document.querySelectorAll(".mode-btn").forEach((btn) => {
    const active = btn.dataset.mode === mode;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-selected", String(active));
  });

  const specsA = document.getElementById("specsAboniment");
  const specsI = document.getElementById("specsInvoice");
  const docActions = document.getElementById("docActions");
  const themeSwitch = document.getElementById("invoiceThemeSwitch");
  if (specsA) specsA.hidden = mode !== "aboniment";
  if (specsI) specsI.hidden = mode !== "invoice";
  if (themeSwitch) themeSwitch.hidden = mode !== "invoice";
  if (docActions) docActions.hidden = mode === "template";

  const meta = META[mode];
  const titleEl = document.getElementById("toolbarTitle");
  const hintEl = document.getElementById("toolbarHint");
  if (titleEl) titleEl.textContent = meta.title;
  if (hintEl) hintEl.textContent = meta.hint;
  document.title = meta.docTitle;

  if (mode !== "template") {
    if (sync && prevStage) syncSharedFrom(prevStage);
    else {
      updateTotalPrice(activeStage());
      fitMoneyInputs(activeStage() || document);
    }
  }

  if (updateHash) {
    const next = `#${mode}`;
    if (location.hash !== next) history.replaceState(null, "", next);
  }
}

function fileName() {
  const client = getNamedValue("client")?.trim() || "client";
  const number = getNamedValue("number")?.trim() || "000";
  const safe = client.replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, "_");
  const kind = isInvoice() ? "Payment_Receipt" : "Aboniment";
  return `RK_POLE_${kind}_${number}_${safe}.pdf`;
}

function printDocument() {
  if (isTemplate()) {
    setMode("aboniment");
    return;
  }

  const prevTitle = document.title;
  document.title = fileName().replace(/\.pdf$/i, "");

  const restoreTitle = () => {
    document.title = prevTitle;
    window.removeEventListener("afterprint", restoreTitle);
  };
  window.addEventListener("afterprint", restoreTitle);
  window.print();
  setTimeout(restoreTitle, 2000);
}

function getInvoiceTheme() {
  const saved = localStorage.getItem(INVOICE_THEME_KEY);
  return saved === "light" ? "light" : "dark";
}

function setInvoiceTheme(theme) {
  const next = theme === "light" ? "light" : "dark";
  const card = document.getElementById("invoiceCard");
  if (card) card.dataset.theme = next;
  localStorage.setItem(INVOICE_THEME_KEY, next);

  document.querySelectorAll("[data-invoice-theme]").forEach((btn) => {
    const active = btn.dataset.invoiceTheme === next;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-pressed", String(active));
  });
}

document.getElementById("saveTemplateBtn")?.addEventListener("click", saveTemplate);
document.getElementById("loadTemplateBtn")?.addEventListener("click", loadTemplateFromFile);
document.getElementById("loadSiteTemplateBtn")?.addEventListener("click", () => {
  loadSiteTemplate();
});
document.getElementById("templateFileInput")?.addEventListener("change", onTemplateFileChosen);
document.getElementById("emptyTemplateBtn")?.addEventListener("click", () => {
  loadEmptyTemplate();
});
document.getElementById("printBtn")?.addEventListener("click", printDocument);

document.querySelectorAll("[data-invoice-theme]").forEach((btn) => {
  btn.addEventListener("click", () => setInvoiceTheme(btn.dataset.invoiceTheme));
});

document.querySelectorAll(".mode-btn").forEach((btn) => {
  btn.addEventListener("click", (event) => {
    event.preventDefault();
    if (btn.dataset.mode) setMode(btn.dataset.mode);
  });
});

window.addEventListener("hashchange", () => {
  const mode = modeFromHash();
  if (mode !== currentMode) setMode(mode, { sync: true, updateHash: false });
});

document.querySelectorAll(".sheet-stage").forEach((stage) => {
  stage.addEventListener("input", (event) => {
    const t = event.target;
    if (!(t instanceof HTMLInputElement || t instanceof HTMLSelectElement)) return;

    if (t.matches('input[name="lessons"]')) {
      if (stage.id === "stageAboniment") buildVisits(true);
      const inv = document.getElementById("stageInvoice");
      if (inv && stage.id === "stageAboniment") {
        setNamedValue("equipmentQty", t.value, inv);
      }
      updateTotalPrice(stage);
    } else if (
      t.matches(
        'input[name="price"], input[name="equipmentPrice"], input[name="equipmentQty"]'
      )
    ) {
      updateTotalPrice(stage);
    } else if (t.matches('input[name="number"]')) {
      syncNumber(t);
    } else if (t.matches(".money-value input")) {
      fitMoneyInputs(stage);
    }
  });

  stage.addEventListener("change", (event) => {
    const t = event.target;
    if (t instanceof HTMLSelectElement && t.classList.contains("currency")) {
      syncCurrency(t);
    }
  });
});

buildVisits(false);
setInvoiceTheme(getInvoiceTheme());
initTemplate().finally(() => {
  setMode(currentMode, { sync: false, updateHash: true });
});
