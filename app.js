const SUPABASE_URL = "https://xjxscoqtnmlbxmetcpod.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqeHNjb3F0bm1sYnhtZXRjcG9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NzQ0MDAsImV4cCI6MjA4ODU1MDQwMH0.iAHhQriiuhp3gABsM27jI8pzMY7SP0bV8A5BrY0jWOk";

const TABLE_NAME = "workforce_entries";
const ORIGINAL_CSV_FILE = "./Vanaco Working Force - Principal.csv";
const ORIGINAL_HTML_FILE = "./Vanaco Working Force/Principal.html";
const DEFAULT_HEADERS = [
  "NAME",
  "WORK",
  "STATUS",
  "PAYMENT STATUS",
  "PRICE PER UNIT",
  "QUANTITY",
  "SALARY",
  "DATE",
  "HOW TO",
];

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const state = {
  headers: [...DEFAULT_HEADERS],
  rows: [],
  search: "",
  statusFilter: "",
  paymentFilter: "",
  session: null,
};

const elements = {
  authGate: document.getElementById("authGate"),
  appShell: document.getElementById("appShell"),
  loginForm: document.getElementById("loginForm"),
  registerBtn: document.getElementById("registerBtn"),
  emailInput: document.getElementById("emailInput"),
  passwordInput: document.getElementById("passwordInput"),
  authMessage: document.getElementById("authMessage"),
  userBadge: document.getElementById("userBadge"),
  logoutBtn: document.getElementById("logoutBtn"),
  searchInput: document.getElementById("searchInput"),
  statusFilter: document.getElementById("statusFilter"),
  paymentFilter: document.getElementById("paymentFilter"),
  loadCsvBtn: document.getElementById("loadCsvBtn"),
  csvInput: document.getElementById("csvInput"),
  addRowBtn: document.getElementById("addRowBtn"),
  downloadBtn: document.getElementById("downloadBtn"),
  resetBtn: document.getElementById("resetBtn"),
  stats: document.getElementById("stats"),
  thead: document.querySelector("#dataTable thead"),
  tbody: document.querySelector("#dataTable tbody"),
  newEntryForm: document.getElementById("newEntryForm"),
};

init();

async function init() {
  wireEvents();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  state.session = session;

  if (!session) {
    showAuth();
    return;
  }

  await showAppForSession(session);
}

function wireEvents() {
  elements.loginForm.addEventListener("submit", onLogin);
  elements.registerBtn.addEventListener("click", onRegister);

  elements.logoutBtn.addEventListener("click", async () => {
    await supabase.auth.signOut();
    state.session = null;
    showAuth();
  });

  supabase.auth.onAuthStateChange(async (_event, session) => {
    state.session = session;
    if (!session) {
      showAuth();
      return;
    }
    await showAppForSession(session);
  });

  elements.searchInput.addEventListener("input", (e) => {
    state.search = e.target.value.toLowerCase().trim();
    renderTable();
    updateStats();
  });

  elements.statusFilter.addEventListener("change", (e) => {
    state.statusFilter = e.target.value;
    renderTable();
    updateStats();
  });

  elements.paymentFilter.addEventListener("change", (e) => {
    state.paymentFilter = e.target.value;
    renderTable();
    updateStats();
  });

  elements.loadCsvBtn.addEventListener("click", () => elements.csvInput.click());
  elements.csvInput.addEventListener("change", onFileUpload);

  elements.addRowBtn.addEventListener("click", async () => {
    await createRow(Object.fromEntries(state.headers.map((h) => [h, ""])));
  });

  elements.downloadBtn.addEventListener("click", downloadCsv);

  elements.resetBtn.addEventListener("click", async () => {
    await loadRemoteRows();
  });
}

async function onLogin(event) {
  event.preventDefault();
  setAuthMessage("", "info");

  const email = elements.emailInput.value.trim();
  const password = elements.passwordInput.value;

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const msg = mapAuthError(error);
    setAuthMessage(msg, "error");
    return;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session) {
    setAuthMessage("Acceso correcto. Entrando...", "success");
    await showAppForSession(session);
    return;
  }

  setAuthMessage("Inicio correcto, pero no se pudo abrir sesión en este navegador.", "error");
}

async function onRegister() {
  setAuthMessage("", "info");
  const email = elements.emailInput.value.trim();
  const password = elements.passwordInput.value;

  if (!email || !password || password.length < 6) {
    setAuthMessage("Introduce email válido y contraseña de al menos 6 caracteres.", "error");
    return;
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    setAuthMessage(`No se pudo registrar: ${mapAuthError(error)}`, "error");
    return;
  }

  if (data.session) {
    setAuthMessage("Cuenta creada y sesión iniciada.", "success");
    await showAppForSession(data.session);
    return;
  }

  const loginAttempt = await supabase.auth.signInWithPassword({ email, password });
  if (!loginAttempt.error && loginAttempt.data.session) {
    setAuthMessage("Cuenta creada e inicio de sesión correcto.", "success");
    await showAppForSession(loginAttempt.data.session);
    return;
  }

  setAuthMessage(
    "Cuenta creada. Si no entra, confirma el email en Supabase o desactiva confirmación de email.",
    "info"
  );
}

function showAuth() {
  elements.appShell.classList.add("hidden");
  elements.authGate.classList.remove("hidden");
  elements.passwordInput.value = "";
  setAuthMessage("", "info");
}

async function showAppForSession(session) {
  elements.authGate.classList.add("hidden");
  elements.appShell.classList.remove("hidden");
  elements.userBadge.textContent = session.user.email || "Usuario";
  await loadRemoteRows();
}

async function loadRemoteRows() {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("id,data,created_at")
    .order("created_at", { ascending: false });

  if (error) {
    const details = error?.message || "Error desconocido";
    alert(`Error cargando datos de Supabase: ${details}`);
    console.error(error);
    return;
  }

  if (!data.length) {
    const seed = await loadInitialDatasetRows();
    if (seed.length) {
      await insertRows(seed);
      return await loadRemoteRows();
    }
  }

  state.rows = data.map((item) => ({ id: item.id, data: item.data || {} }));
  state.headers = inferHeaders(state.rows);
  refreshUI();
}

async function onFileUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const parsed = parseRowsFromText(String(reader.result || ""), file.name);
      const ok = confirm("Esto reemplazará todos los datos de la nube por el archivo cargado. ¿Continuar?");
      if (!ok) return;
      await replaceAllRows(parsed);
      await loadRemoteRows();
    } catch (error) {
      alert("Archivo inválido. Usa un .csv o .html exportado.");
      console.error(error);
    }
  };
  reader.readAsText(file, "utf-8");
  event.target.value = "";
}

async function replaceAllRows(rowsData) {
  const { error: deleteError } = await supabase.from(TABLE_NAME).delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (deleteError) throw deleteError;
  await insertRows(rowsData);
}

async function insertRows(rowsData) {
  if (!rowsData.length) return;
  const payload = rowsData.map((row) => ({ data: row }));

  const chunkSize = 200;
  for (let i = 0; i < payload.length; i += chunkSize) {
    const chunk = payload.slice(i, i + chunkSize);
    const { error } = await supabase.from(TABLE_NAME).insert(chunk);
    if (error) throw error;
  }
}

async function createRow(rowData) {
  const { data, error } = await supabase.from(TABLE_NAME).insert([{ data: rowData }]).select("id,data,created_at").single();
  if (error) {
    alert(`No se pudo crear la fila: ${error.message || "error desconocido"}`);
    console.error(error);
    return;
  }

  state.rows.unshift({ id: data.id, data: data.data || {} });
  state.headers = inferHeaders(state.rows);
  refreshUI();
}

async function updateRow(rowId, rowData) {
  const { error } = await supabase.from(TABLE_NAME).update({ data: rowData }).eq("id", rowId);
  if (error) {
    alert(`No se pudo guardar la edición: ${error.message || "error desconocido"}`);
    console.error(error);
  }
}

async function deleteRow(rowId) {
  const { error } = await supabase.from(TABLE_NAME).delete().eq("id", rowId);
  if (error) {
    alert(`No se pudo eliminar la fila: ${error.message || "error desconocido"}`);
    console.error(error);
    return;
  }
  state.rows = state.rows.filter((row) => row.id !== rowId);
  state.headers = inferHeaders(state.rows);
  refreshUI();
}

function renderTable() {
  elements.thead.innerHTML = "";
  elements.tbody.innerHTML = "";

  const headerRow = document.createElement("tr");
  state.headers.forEach((header) => {
    const th = document.createElement("th");
    th.textContent = header;
    headerRow.appendChild(th);
  });
  const actionsTh = document.createElement("th");
  actionsTh.textContent = "Acciones";
  headerRow.appendChild(actionsTh);
  elements.thead.appendChild(headerRow);

  const filteredRows = getFilteredRows();

  filteredRows.forEach((rowObj) => {
    const tr = document.createElement("tr");

    state.headers.forEach((header) => {
      const td = document.createElement("td");
      const input = document.createElement("input");
      input.value = rowObj.data[header] ?? "";
      input.addEventListener("change", async (e) => {
        rowObj.data[header] = e.target.value;
        await updateRow(rowObj.id, rowObj.data);
        updateStats();
      });
      td.appendChild(input);
      tr.appendChild(td);
    });

    const actionsTd = document.createElement("td");
    actionsTd.className = "actions-cell";

    const removeBtn = document.createElement("button");
    removeBtn.className = "icon-btn";
    removeBtn.type = "button";
    removeBtn.textContent = "Eliminar";
    removeBtn.addEventListener("click", async () => {
      await deleteRow(rowObj.id);
    });

    actionsTd.appendChild(removeBtn);
    tr.appendChild(actionsTd);
    elements.tbody.appendChild(tr);
  });
}

function buildForm() {
  elements.newEntryForm.innerHTML = "";
  state.headers.forEach((header) => {
    const wrap = document.createElement("label");
    wrap.className = "field";

    const span = document.createElement("span");
    span.textContent = header;

    const input = document.createElement("input");
    input.name = header;
    input.placeholder = `Escribe ${header}`;

    wrap.appendChild(span);
    wrap.appendChild(input);
    elements.newEntryForm.appendChild(wrap);
  });

  const submitBtn = document.createElement("button");
  submitBtn.type = "submit";
  submitBtn.className = "btn btn-primary";
  submitBtn.textContent = "Guardar nueva entrada";
  elements.newEntryForm.appendChild(submitBtn);

  elements.newEntryForm.onsubmit = async (event) => {
    event.preventDefault();
    const data = new FormData(elements.newEntryForm);
    const row = {};
    state.headers.forEach((header) => {
      row[header] = String(data.get(header) || "").trim();
    });
    await createRow(row);
    elements.newEntryForm.reset();
  };
}

function updateFilterOptions() {
  const statusHeader = getHeaderByKeyword("status", ["payment"]);
  const paymentHeader = getHeaderByKeyword("payment", []);

  fillSelect(elements.statusFilter, statusHeader);
  fillSelect(elements.paymentFilter, paymentHeader);
}

function fillSelect(select, headerName) {
  const previous = select.value;
  select.innerHTML = "<option value=''>Todos</option>";

  if (!headerName) return;
  const values = [...new Set(state.rows.map((row) => row.data[headerName]).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );

  values.forEach((value) => {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = value;
    select.appendChild(opt);
  });

  if (values.includes(previous)) {
    select.value = previous;
  }
}

function getFilteredRows() {
  const statusHeader = getHeaderByKeyword("status", ["payment"]);
  const paymentHeader = getHeaderByKeyword("payment", []);

  return state.rows.filter((row) => {
    const rowText = state.headers.map((h) => String(row.data[h] || "").toLowerCase()).join(" ");
    const matchesSearch = !state.search || rowText.includes(state.search);
    const matchesStatus = !state.statusFilter || !statusHeader || (row.data[statusHeader] || "") === state.statusFilter;
    const matchesPayment =
      !state.paymentFilter || !paymentHeader || (row.data[paymentHeader] || "") === state.paymentFilter;

    return matchesSearch && matchesStatus && matchesPayment;
  });
}

function updateStats() {
  const filteredRows = getFilteredRows();
  const paymentHeader = getHeaderByKeyword("payment", []);
  const salaryHeader = getHeaderByKeyword("salary", []);

  const paid = paymentHeader
    ? filteredRows.filter((row) => String(row.data[paymentHeader] || "").toUpperCase().includes("PAID")).length
    : 0;

  const unpaid = paymentHeader
    ? filteredRows.filter((row) => String(row.data[paymentHeader] || "").toUpperCase().includes("UNPAID")).length
    : 0;

  const totalSalary = salaryHeader
    ? filteredRows.reduce((acc, row) => acc + parseMoney(row.data[salaryHeader]), 0)
    : 0;

  elements.stats.innerHTML = [
    { label: "Registros (filtrados)", value: filteredRows.length },
    { label: "Pagados", value: paid },
    { label: "Pendientes", value: unpaid },
    { label: "Total salario", value: formatMoney(totalSalary) },
  ]
    .map((item) => `<article class="stat"><span>${escapeHtml(item.label)}</span><b>${escapeHtml(String(item.value))}</b></article>`)
    .join("");
}

function refreshUI() {
  updateFilterOptions();
  renderTable();
  buildForm();
  updateStats();
}

function downloadCsv() {
  const lines = [state.headers, ...state.rows.map((row) => state.headers.map((h) => row.data[h] ?? ""))];
  const csv = toCsv(lines);

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "Vanaco Working Force - Export.csv";
  a.click();
  URL.revokeObjectURL(url);
}

async function loadInitialDatasetRows() {
  try {
    const htmlResponse = await fetch(ORIGINAL_HTML_FILE);
    if (htmlResponse.ok) {
      const htmlText = await htmlResponse.text();
      return parseRowsFromText(htmlText, "Principal.html");
    }
  } catch {
    // Continue with CSV fallback.
  }

  const csvResponse = await fetch(ORIGINAL_CSV_FILE);
  if (!csvResponse.ok) return [];
  const csvText = await csvResponse.text();
  return parseRowsFromText(csvText, "Principal.csv");
}

function parseRowsFromText(content, fileName = "") {
  const lowerName = fileName.toLowerCase();
  const looksLikeHtml = lowerName.endsWith(".html") || lowerName.endsWith(".htm") || /<table/i.test(content);

  if (looksLikeHtml) {
    return parseRowsFromHtml(content);
  }
  return parseRowsFromCsv(content);
}

function parseRowsFromCsv(csvText) {
  const parsed = parseCsv(csvText);
  if (!parsed.length) throw new Error("CSV sin datos");

  const headers = parsed[0].map((h, index) => (h && h.trim() ? h.trim() : index === 0 ? "NAME" : `COLUMN_${index + 1}`));
  const rows = parsed
    .slice(1)
    .map((line) => {
      const row = {};
      headers.forEach((header, i) => {
        row[header] = line[i] ? line[i].trim() : "";
      });
      return row;
    })
    .filter((row) => isMeaningfulRow(row, headers));

  return rows;
}

function parseRowsFromHtml(htmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, "text/html");
  const table = doc.querySelector("table.waffle") || doc.querySelector("table");
  if (!table) throw new Error("No se encontró tabla en el HTML");

  const bodyRows = [...table.querySelectorAll("tbody tr")];
  if (!bodyRows.length) throw new Error("Tabla sin filas");

  const headerCells = [...(bodyRows[0]?.querySelectorAll("td") || [])];
  const headers = headerCells.map((cell, index) => {
    const label = cleanCellText(cell.textContent || "");
    return label || (index === 0 ? "NAME" : `COLUMN_${index + 1}`);
  });

  const rows = bodyRows
    .slice(1)
    .map((tr) => {
      const cells = [...tr.querySelectorAll("td")];
      const row = {};
      headers.forEach((header, index) => {
        const cell = cells[index];
        row[header] = cleanCellText(cell?.textContent || "");
      });
      return row;
    })
    .filter((row) => isMeaningfulRow(row, headers));

  return rows;
}

function inferHeaders(rows) {
  if (!rows.length) return [...DEFAULT_HEADERS];
  const ordered = [];

  DEFAULT_HEADERS.forEach((header) => {
    if (rows.some((row) => Object.prototype.hasOwnProperty.call(row.data, header))) {
      ordered.push(header);
    }
  });

  rows.forEach((row) => {
    Object.keys(row.data || {}).forEach((header) => {
      if (!ordered.includes(header)) ordered.push(header);
    });
  });

  return ordered.length ? ordered : [...DEFAULT_HEADERS];
}

function getHeaderByKeyword(keyword, excludes = []) {
  const normalizedKeyword = keyword.toLowerCase();
  return (
    state.headers.find((h) => {
      const lower = h.toLowerCase();
      return lower.includes(normalizedKeyword) && excludes.every((x) => !lower.includes(x.toLowerCase()));
    }) || null
  );
}

function parseMoney(value) {
  if (!value) return 0;
  const normalized = String(value)
    .replace(/[^0-9,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const num = Number(normalized);
  return Number.isFinite(num) ? num : 0;
}

function formatMoney(value) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        value += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(value);
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  if (value !== "" || row.length) {
    row.push(value);
    rows.push(row);
  }

  return rows;
}

function toCsv(matrix) {
  return matrix
    .map((line) =>
      line
        .map((cell) => {
          const raw = String(cell ?? "");
          if (/[",\n\r]/.test(raw)) {
            return `"${raw.replace(/"/g, '""')}"`;
          }
          return raw;
        })
        .join(",")
    )
    .join("\r\n");
}

function isMeaningfulRow(row, headers) {
  const hasAnyValue = Object.values(row).some((value) => value !== "");
  if (!hasAnyValue) return false;

  const importantHeaders = ["name", "work", "status", "payment", "date", "how to"];
  const hasImportantValue = headers.some((header) => {
    const lower = header.toLowerCase();
    return importantHeaders.some((token) => lower.includes(token)) && String(row[header] || "").trim() !== "";
  });
  return hasImportantValue;
}

function cleanCellText(value) {
  return String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function setAuthMessage(message, tone = "info") {
  elements.authMessage.textContent = message;
  if (tone === "error") {
    elements.authMessage.style.color = "var(--danger)";
    return;
  }
  if (tone === "success") {
    elements.authMessage.style.color = "var(--accent)";
    return;
  }
  elements.authMessage.style.color = "var(--muted)";
}

function mapAuthError(error) {
  const msg = String(error?.message || "").toLowerCase();
  const code = String(error?.code || error?.error_code || "").toLowerCase();
  if (code.includes("over_email_send_rate_limit") || msg.includes("email rate limit exceeded")) {
    return "Límite de emails de Supabase agotado. Desactiva confirmación por email o espera a que se reinicie el límite.";
  }
  if (code.includes("email_address_invalid") || msg.includes("email address")) {
    return "Email inválido para Supabase. Usa un email real (gmail/outlook) y revisa formato.";
  }
  if (msg.includes("email not confirmed")) {
    return "Tu email no está confirmado. Confirma el correo o desactiva confirmación en Supabase Auth.";
  }
  if (msg.includes("invalid login credentials")) {
    return "Credenciales inválidas. Revisa email y contraseña.";
  }
  if (msg.includes("signup is disabled")) {
    return "El registro está desactivado en Supabase. Actívalo en Authentication > Providers.";
  }
  return `No se pudo iniciar sesión: ${error?.message || "error desconocido"}`;
}
