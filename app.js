const SUPABASE_URL = "https://xjxscoqtnmlbxmetcpod.supabase.co";
const APP_VERSION = "2026-03-09.1";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqeHNjb3F0bm1sYnhtZXRjcG9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NzQ0MDAsImV4cCI6MjA4ODU1MDQwMH0.iAHhQriiuhp3gABsM27jI8pzMY7SP0bV8A5BrY0jWOk";

const TABLE_NAME = "workforce_entries";
const ROW_LOAD_LIMIT = 500;
const REQUEST_TIMEOUT_MS = 12000;
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

const state = {
  headers: [...DEFAULT_HEADERS],
  rows: [],
  search: "",
  statusFilter: "",
  paymentFilter: "",
  session: null,
  isBusy: false,
};

const elements = {
  authGate: document.getElementById("authGate"),
  appShell: document.getElementById("appShell"),
  loginForm: document.getElementById("loginForm"),
  registerBtn: document.getElementById("registerBtn"),
  emailInput: document.getElementById("emailInput"),
  passwordInput: document.getElementById("passwordInput"),
  authMessage: document.getElementById("authMessage"),
  appVersion: document.getElementById("appVersion"),
  debugLog: document.getElementById("debugLog"),
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

let sbClient = null;

boot().catch((error) => {
  console.error("Fallo de arranque", error);
  appLog(`Fallo de arranque: ${formatError(error)}`);
  showAuth();
  setAuthMessage(`Error de arranque: ${formatError(error)}`, "error");
});

async function boot() {
  if (elements.debugLog) elements.debugLog.textContent = "";
  appLog("Boot iniciado");
  if (elements.appVersion) {
    elements.appVersion.textContent = `Build ${APP_VERSION}`;
  }

  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    appLog("No está disponible window.supabase");
    throw new Error("No cargó supabase-js desde CDN");
  }

  sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: "pkce",
      storage: window.localStorage,
    },
  });

  wireEvents();
  appLog("Eventos conectados");
  await bootstrapSession();
}

async function bootstrapSession() {
  appLog("Comprobando sesión...");
  setAuthMessage("Comprobando sesión...", "info");

  const {
    data: { session },
    error: sessionError,
  } = await withTimeout(sbClient.auth.getSession(), REQUEST_TIMEOUT_MS, "getSession");

  if (sessionError) {
    appLog(`Error getSession: ${mapAuthError(sessionError)}`);
    showAuth();
    setAuthMessage(`Error leyendo sesión: ${mapAuthError(sessionError)}`, "error");
    return;
  }

  state.session = session;
  if (session) {
    appLog(`Sesión existente detectada: ${session.user?.email || "sin email"}`);
    await showAppForSession(session);
  } else {
    appLog("Sin sesión activa");
    showAuth();
    setAuthMessage("Listo para iniciar sesión.", "info");
  }
}

function wireEvents() {
  elements.loginForm.addEventListener("submit", onLogin);
  elements.registerBtn.addEventListener("click", onRegister);

  elements.logoutBtn.addEventListener("click", async () => {
    await runBusy(async () => {
      const { error } = await withTimeout(sbClient.auth.signOut(), REQUEST_TIMEOUT_MS, "signOut");
      if (error) throw error;
      state.session = null;
      showAuth();
      setAuthMessage("Sesión cerrada.", "info");
    });
  });

  sbClient.auth.onAuthStateChange(async (_event, session) => {
    state.session = session;
    if (!session) {
      showAuth();
      setAuthMessage("Listo para iniciar sesión.", "info");
      return;
    }

    try {
      await showAppForSession(session);
    } catch (error) {
      console.error(error);
      showAuth();
      setAuthMessage(`Sesión detectada, pero falló carga de datos: ${formatError(error)}`, "error");
    }
  });

  elements.searchInput.addEventListener("input", (e) => {
    state.search = String(e.target.value || "").toLowerCase().trim();
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
    await runBusy(async () => {
      await createRow(Object.fromEntries(state.headers.map((h) => [h, ""])));
    });
  });

  elements.downloadBtn.addEventListener("click", downloadCsv);

  elements.resetBtn.addEventListener("click", async () => {
    await runBusy(async () => {
      await loadRemoteRows();
    });
  });
}

async function onLogin(event) {
  event.preventDefault();
  await runBusy(async () => {
    appLog("Click Entrar");
    setAuthMessage("Iniciando sesión...", "info");

    const email = elements.emailInput.value.trim();
    const password = elements.passwordInput.value;

    if (!email || !password) {
      appLog("Login abortado: faltan campos");
      setAuthMessage("Debes rellenar email y contraseña.", "error");
      return;
    }

    const { data, error } = await withTimeout(
      sbClient.auth.signInWithPassword({ email, password }),
      REQUEST_TIMEOUT_MS,
      "signInWithPassword"
    );
    if (error) {
      appLog(`Login error: ${mapAuthError(error)}`);
      setAuthMessage(mapAuthError(error), "error");
      return;
    }

    if (!data.session) {
      appLog("Login sin sesión devuelta");
      setAuthMessage("Login aceptado pero no hay sesión. Reintenta en 2 segundos.", "error");
      return;
    }

    appLog(`Login correcto: ${data.session.user?.email || "sin email"}`);
    await showAppForSession(data.session);
    setAuthMessage("Sesión iniciada.", "success");
  });
}

async function onRegister() {
  await runBusy(async () => {
    if (state.session) {
      appLog("Registro cancelado: ya hay sesión activa");
      setAuthMessage("Ya hay una sesión activa. Usa Cerrar sesión para crear otra cuenta.", "info");
      return;
    }

    appLog("Click Registrarse");
    setAuthMessage("Creando cuenta...", "info");

    const email = elements.emailInput.value.trim();
    const password = elements.passwordInput.value;

    if (!email || !password || password.length < 6) {
      appLog("Registro abortado: datos inválidos");
      setAuthMessage("Usa email válido y contraseña de al menos 6 caracteres.", "error");
      return;
    }

    const { data, error } = await withTimeout(
      sbClient.auth.signUp({ email, password }),
      REQUEST_TIMEOUT_MS,
      "signUp"
    );
    if (error) {
      appLog(`Registro error: ${mapAuthError(error)}`);
      setAuthMessage(mapAuthError(error), "error");
      return;
    }

    if (data.session) {
      appLog(`Registro + sesión OK: ${data.session.user?.email || "sin email"}`);
      await showAppForSession(data.session);
      setAuthMessage("Cuenta creada y sesión iniciada.", "success");
      return;
    }

    const loginAttempt = await withTimeout(
      sbClient.auth.signInWithPassword({ email, password }),
      REQUEST_TIMEOUT_MS,
      "signInAfterSignUp"
    );
    if (!loginAttempt.error && loginAttempt.data.session) {
      appLog("Registro OK + login automático OK");
      await showAppForSession(loginAttempt.data.session);
      setAuthMessage("Cuenta creada e inicio automático correcto.", "success");
      return;
    }

    appLog("Registro creado pero requiere confirmación por email");
    setAuthMessage(
      "Cuenta creada pero requiere confirmación por email. Si no recibes correo, desactiva confirmación en Supabase Auth.",
      "info"
    );
  });
}

function showAuth() {
  elements.appShell.classList.add("hidden");
  elements.authGate.classList.remove("hidden");
}

async function showAppForSession(session) {
  appLog(`Entrando a dashboard: ${session?.user?.email || "sin email"}`);
  setAuthMessage("Abriendo dashboard...", "info");
  elements.authGate.classList.add("hidden");
  elements.appShell.classList.remove("hidden");
  elements.userBadge.textContent = session?.user?.email || "Usuario";
  await loadRemoteRows();
}

async function loadRemoteRows() {
  appLog("Cargando filas remotas...");
  const { data, error } = await withTimeout(
    sbClient.from(TABLE_NAME).select("id,data,created_at").order("created_at", { ascending: false }).limit(ROW_LOAD_LIMIT),
    REQUEST_TIMEOUT_MS,
    "loadRemoteRows"
  );

  if (error) {
    appLog(`Error leyendo filas: ${mapDbError(error)}`);
    throw new Error(`No se pudo leer la tabla: ${mapDbError(error)}`);
  }

  if (!Array.isArray(data) || data.length === 0) {
    const seedRows = await loadInitialDatasetRows();
    if (seedRows.length > 0) {
      appLog(`Tabla vacía, insertando semilla: ${seedRows.length} filas`);
      await insertRows(seedRows);
      const reload = await withTimeout(
        sbClient.from(TABLE_NAME).select("id,data,created_at").order("created_at", { ascending: false }).limit(ROW_LOAD_LIMIT),
        REQUEST_TIMEOUT_MS,
        "reloadAfterSeed"
      );
      if (reload.error) {
        appLog(`Error recarga tras semilla: ${mapDbError(reload.error)}`);
        throw new Error(`Insertó semilla pero no pudo recargar: ${mapDbError(reload.error)}`);
      }
      state.rows = (reload.data || []).map((item) => ({ id: item.id, data: item.data || {} }));
      state.headers = inferHeaders(state.rows);
      refreshUI();
      appLog(`Dashboard lista con ${state.rows.length} filas`);
      return;
    }
  }

  state.rows = (data || []).map((item) => ({ id: item.id, data: item.data || {} }));
  state.headers = inferHeaders(state.rows);
  refreshUI();
  appLog(`Dashboard lista con ${state.rows.length} filas (límite ${ROW_LOAD_LIMIT})`);
}

async function onFileUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  await runBusy(async () => {
    const fileText = await readTextFile(file);
    const parsedRows = parseRowsFromText(fileText, file.name);

    if (!parsedRows.length) {
      alert("El archivo no contiene filas válidas.");
      return;
    }

    const ok = confirm("Esto reemplazará TODOS los datos en la nube. ¿Continuar?");
    if (!ok) return;

    await replaceAllRows(parsedRows);
    await loadRemoteRows();
  });

  event.target.value = "";
}

async function replaceAllRows(rowsData) {
  const { error: deleteError } = await sbClient
    .from(TABLE_NAME)
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (deleteError) {
    throw new Error(`No se pudieron borrar filas previas: ${mapDbError(deleteError)}`);
  }

  await insertRows(rowsData);
}

async function insertRows(rowsData) {
  if (!rowsData.length) return;
  const payload = rowsData.map((row) => ({ data: row }));

  const chunkSize = 200;
  for (let i = 0; i < payload.length; i += chunkSize) {
    const chunk = payload.slice(i, i + chunkSize);
    const { error } = await withTimeout(sbClient.from(TABLE_NAME).insert(chunk), REQUEST_TIMEOUT_MS, `insertChunk:${i}`);
    if (error) {
      throw new Error(`Error insertando bloque ${i / chunkSize + 1}: ${mapDbError(error)}`);
    }
  }
}

async function createRow(rowData) {
  const { data, error } = await withTimeout(
    sbClient.from(TABLE_NAME).insert([{ data: rowData }]).select("id,data").single(),
    REQUEST_TIMEOUT_MS,
    "createRow"
  );
  if (error) {
    throw new Error(`No se pudo crear la fila: ${mapDbError(error)}`);
  }

  state.rows.unshift({ id: data.id, data: data.data || {} });
  state.headers = inferHeaders(state.rows);
  refreshUI();
}

async function updateRow(rowId, rowData) {
  const { error } = await withTimeout(
    sbClient.from(TABLE_NAME).update({ data: rowData }).eq("id", rowId),
    REQUEST_TIMEOUT_MS,
    "updateRow"
  );
  if (error) {
    throw new Error(`No se pudo guardar edición: ${mapDbError(error)}`);
  }
}

async function deleteRow(rowId) {
  const { error } = await withTimeout(
    sbClient.from(TABLE_NAME).delete().eq("id", rowId),
    REQUEST_TIMEOUT_MS,
    "deleteRow"
  );
  if (error) {
    throw new Error(`No se pudo eliminar fila: ${mapDbError(error)}`);
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
        try {
          rowObj.data[header] = e.target.value;
          await updateRow(rowObj.id, rowObj.data);
          updateStats();
        } catch (error) {
          alert(formatError(error));
        }
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
      try {
        await deleteRow(rowObj.id);
      } catch (error) {
        alert(formatError(error));
      }
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
    const formData = new FormData(elements.newEntryForm);
    const row = {};

    state.headers.forEach((header) => {
      row[header] = String(formData.get(header) || "").trim();
    });

    try {
      await runBusy(async () => {
        await createRow(row);
      });
      elements.newEntryForm.reset();
    } catch (error) {
      alert(formatError(error));
    }
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
    const matchesStatus = !state.statusFilter || !statusHeader || String(row.data[statusHeader] || "") === state.statusFilter;
    const matchesPayment =
      !state.paymentFilter || !paymentHeader || String(row.data[paymentHeader] || "") === state.paymentFilter;

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
    // fallback to CSV
  }

  try {
    const csvResponse = await fetch(ORIGINAL_CSV_FILE);
    if (!csvResponse.ok) return [];
    const csvText = await csvResponse.text();
    return parseRowsFromText(csvText, "Principal.csv");
  } catch {
    return [];
  }
}

function parseRowsFromText(content, fileName = "") {
  const lowerName = fileName.toLowerCase();
  const looksLikeHtml = lowerName.endsWith(".html") || lowerName.endsWith(".htm") || /<table/i.test(content);
  return looksLikeHtml ? parseRowsFromHtml(content) : parseRowsFromCsv(content);
}

function parseRowsFromCsv(csvText) {
  const parsed = parseCsv(csvText);
  if (!parsed.length) throw new Error("CSV sin datos");

  const headers = parsed[0].map((h, index) => {
    const v = String(h || "").trim();
    return v || (index === 0 ? "NAME" : `COLUMN_${index + 1}`);
  });

  return parsed
    .slice(1)
    .map((line) => {
      const row = {};
      headers.forEach((header, idx) => {
        row[header] = String(line[idx] || "").trim();
      });
      return row;
    })
    .filter((row) => isMeaningfulRow(row, headers));
}

function parseRowsFromHtml(htmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, "text/html");
  const table = doc.querySelector("table.waffle") || doc.querySelector("table");
  if (!table) throw new Error("No se encontró tabla en el HTML");

  const bodyRows = [...table.querySelectorAll("tbody tr")];
  if (!bodyRows.length) throw new Error("Tabla HTML sin filas");

  const headerCells = [...(bodyRows[0]?.querySelectorAll("td") || [])];
  const headers = headerCells.map((cell, index) => {
    const label = cleanCellText(cell.textContent || "");
    return label || (index === 0 ? "NAME" : `COLUMN_${index + 1}`);
  });

  return bodyRows
    .slice(1)
    .map((tr) => {
      const cells = [...tr.querySelectorAll("td")];
      const row = {};
      headers.forEach((header, index) => {
        row[header] = cleanCellText(cells[index]?.textContent || "");
      });
      return row;
    })
    .filter((row) => isMeaningfulRow(row, headers));
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
  const needle = String(keyword || "").toLowerCase();
  return (
    state.headers.find((header) => {
      const lower = header.toLowerCase();
      return lower.includes(needle) && excludes.every((x) => !lower.includes(String(x).toLowerCase()));
    }) || null
  );
}

function parseMoney(value) {
  if (!value) return 0;
  const normalized = String(value).replace(/[^0-9,.-]/g, "").replace(/\./g, "").replace(",", ".");
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
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(value);
      value = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(value);
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
      value = "";
      continue;
    }

    value += char;
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
          return /[",\n\r]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
        })
        .join(",")
    )
    .join("\r\n");
}

function isMeaningfulRow(row, headers) {
  const hasAnyValue = Object.values(row).some((value) => String(value || "").trim() !== "");
  if (!hasAnyValue) return false;

  const importantHeaders = ["name", "work", "status", "payment", "date", "how to"];
  return headers.some((header) => {
    const lower = header.toLowerCase();
    return importantHeaders.some((token) => lower.includes(token)) && String(row[header] || "").trim() !== "";
  });
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
    return "Registro bloqueado por límite de emails en Supabase. Desactiva confirmación por email o configura SMTP.";
  }

  if (code.includes("email_address_invalid") || msg.includes("email address")) {
    return "El email no es válido para Supabase. Usa un correo real (gmail/outlook).";
  }

  if (msg.includes("email not confirmed")) {
    return "Tu email no está confirmado. Confirma el correo o desactiva confirmación en Supabase Auth.";
  }

  if (msg.includes("invalid login credentials")) {
    return "Credenciales inválidas. Revisa email y contraseña.";
  }

  if (msg.includes("signup is disabled")) {
    return "El registro está desactivado. Actívalo en Authentication > Providers.";
  }

  return `Error de autenticación: ${error?.message || "desconocido"}`;
}

function mapDbError(error) {
  const msg = String(error?.message || "").toLowerCase();
  const code = String(error?.code || "");

  if (code === "42501" || msg.includes("row-level security")) {
    return "RLS bloqueando acceso. Debes estar autenticado y con políticas SQL aplicadas.";
  }

  if (code === "42p01" || msg.includes("relation") && msg.includes("does not exist")) {
    return "La tabla workforce_entries no existe en Supabase.";
  }

  return error?.message || "Error de base de datos desconocido";
}

function formatError(error) {
  if (!error) return "Error desconocido";
  if (typeof error === "string") return error;
  return error.message || JSON.stringify(error);
}

async function runBusy(fn) {
  if (state.isBusy) return;
  state.isBusy = true;
  toggleAuthButtons(true);

  try {
    return await fn();
  } catch (error) {
    console.error(error);
    const readable = formatError(error);
    appLog(`Error: ${readable}`);
    if (elements.appShell.classList.contains("hidden")) {
      setAuthMessage(readable, "error");
    } else {
      alert(readable);
    }
    throw error;
  } finally {
    state.isBusy = false;
    toggleAuthButtons(false);
  }
}

function toggleAuthButtons(disabled) {
  if (elements.registerBtn) elements.registerBtn.disabled = disabled;
  const submitBtn = elements.loginForm?.querySelector("button[type='submit']");
  if (submitBtn) submitBtn.disabled = disabled;
}

function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.readAsText(file, "utf-8");
  });
}

function appLog(message) {
  const line = `[${new Date().toLocaleTimeString("es-ES")}] ${message}`;
  if (elements.debugLog) {
    const prev = elements.debugLog.textContent || "";
    const next = prev ? `${prev}\n${line}` : line;
    elements.debugLog.textContent = next;
    elements.debugLog.scrollTop = elements.debugLog.scrollHeight;
  }
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout en ${label} tras ${ms / 1000}s`)), ms)
    ),
  ]);
}
