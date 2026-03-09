const APP_VERSION = "2026-03-09.7";
const ROW_LOAD_LIMIT = 500;
const ORIGINAL_CSV_FILE = "./Vanaco Working Force - Principal.csv";
const ORIGINAL_HTML_FILE = "./Vanaco Working Force/Principal.html";
const DEFAULT_HEADERS = ["NAME", "WORK", "STATUS", "PAYMENT STATUS", "PRICE PER UNIT", "QUANTITY", "SALARY", "DATE", "HOW TO"];

const state = {
  user: null,
  rows: [],
  headers: [...DEFAULT_HEADERS],
  search: "",
  statusFilter: "",
  paymentFilter: "",
  busy: false,
};

const el = {
  authGate: document.getElementById("authGate"),
  appShell: document.getElementById("appShell"),
  loginForm: document.getElementById("loginForm"),
  registerBtn: document.getElementById("registerBtn"),
  usernameInput: document.getElementById("usernameInput"),
  passwordInput: document.getElementById("passwordInput"),
  authMessage: document.getElementById("authMessage"),
  appVersion: document.getElementById("appVersion"),
  roleSummary: document.getElementById("roleSummary"),
  userBadge: document.getElementById("userBadge"),
  logoutBtn: document.getElementById("logoutBtn"),
  entryBar: document.getElementById("entryBar"),
  newEntryForm: document.getElementById("newEntryForm"),
  searchInput: document.getElementById("searchInput"),
  statusFilter: document.getElementById("statusFilter"),
  paymentFilter: document.getElementById("paymentFilter"),
  loadCsvBtn: document.getElementById("loadCsvBtn"),
  csvInput: document.getElementById("csvInput"),
  downloadBtn: document.getElementById("downloadBtn"),
  resetBtn: document.getElementById("resetBtn"),
  stats: document.getElementById("stats"),
  thead: document.querySelector("#dataTable thead"),
  tbody: document.querySelector("#dataTable tbody"),
  adminPanel: document.getElementById("adminPanel"),
  membersTbody: document.querySelector("#membersTable tbody"),
  newUserInput: document.getElementById("newUserInput"),
  newUserPassInput: document.getElementById("newUserPassInput"),
  newUserAdminInput: document.getElementById("newUserAdminInput"),
  createUserBtn: document.getElementById("createUserBtn"),
};

init().catch((e) => {
  setAuthMessage(`Error init: ${e.message || e}`, "error");
});

async function init() {
  el.appVersion.textContent = `Build ${APP_VERSION}`;
  bindEvents();
  setAuthMessage("Introduce usuario y contraseña.", "info");

  const session = await apiGet("/api/session");
  if (session?.loggedIn && session.user) {
    state.user = session.user;
    await enterDashboard();
    return;
  }

  showAuth();
}

function bindEvents() {
  el.loginForm.addEventListener("submit", onLogin);
  el.registerBtn.addEventListener("click", onRegister);
  el.logoutBtn.addEventListener("click", onLogout);

  el.searchInput.addEventListener("input", (e) => {
    state.search = String(e.target.value || "").toLowerCase().trim();
    renderTable();
    updateStats();
  });

  el.statusFilter.addEventListener("change", (e) => {
    state.statusFilter = e.target.value;
    renderTable();
    updateStats();
  });

  el.paymentFilter.addEventListener("change", (e) => {
    state.paymentFilter = e.target.value;
    renderTable();
    updateStats();
  });

  el.loadCsvBtn.addEventListener("click", () => el.csvInput.click());
  el.csvInput.addEventListener("change", onFileUpload);
  el.downloadBtn.addEventListener("click", downloadCsv);
  el.resetBtn.addEventListener("click", () => loadRows());

  el.createUserBtn.addEventListener("click", onCreateUser);
}

async function onLogin(event) {
  event.preventDefault();
  if (state.busy) return;

  await runBusy(async () => {
    const username = el.usernameInput.value.trim().toLowerCase();
    const password = el.passwordInput.value;
    if (!username || !password) {
      setAuthMessage("Rellena usuario y contraseña.", "error");
      return;
    }

    const data = await apiPost("/auth/login", { username, password });
    state.user = data.user;
    await enterDashboard();
  });
}

async function onRegister() {
  if (state.busy) return;

  await runBusy(async () => {
    const username = el.usernameInput.value.trim().toLowerCase();
    const password = el.passwordInput.value;
    if (!username || !password) {
      setAuthMessage("Rellena usuario y contraseña.", "error");
      return;
    }

    const data = await apiPost("/auth/register", { username, password });
    if (data.user) {
      state.user = data.user;
      await enterDashboard();
      return;
    }

    setAuthMessage(data.message || "Usuario registrado. Espera aprobación del admin.", "success");
  });
}

async function onLogout() {
  await runBusy(async () => {
    await apiGet("/auth/logout");
    state.user = null;
    showAuth();
    setAuthMessage("Sesión cerrada.", "info");
  });
}

async function enterDashboard() {
  hideAuth();
  el.userBadge.textContent = state.user.username;
  el.roleSummary.textContent = state.user.is_admin ? "Rol: Administrador" : "Rol: Usuario (solo lectura)";
  el.entryBar.classList.toggle("hidden", !state.user.is_admin);
  el.adminPanel.classList.toggle("hidden", !state.user.is_admin);

  await loadRows();
  if (state.user.is_admin) {
    await loadMembers();
  }
}

async function loadRows() {
  const payload = await apiGet(`/api/entries?limit=${ROW_LOAD_LIMIT}`);
  const rows = payload?.rows || [];
  state.rows = Array.isArray(rows) ? rows.map((r) => ({ id: r.id, data: r.data || {} })) : [];
  state.headers = inferHeaders(state.rows);

  if (state.user.is_admin && state.rows.length === 0) {
    const seed = await loadInitialDatasetRows();
    if (seed.length) {
      await apiPost("/api/entries/replace", { rows: seed });
      return loadRows();
    }
  }

  renderEntryForm();
  renderTable();
  updateStats();
}

function renderEntryForm() {
  el.newEntryForm.innerHTML = "";
  if (!state.user?.is_admin) return;

  state.headers.forEach((h) => {
    const label = document.createElement("label");
    label.className = "field";
    const span = document.createElement("span");
    span.textContent = h;
    const input = document.createElement("input");
    input.name = h;
    label.appendChild(span);
    label.appendChild(input);
    el.newEntryForm.appendChild(label);
  });

  const btn = document.createElement("button");
  btn.type = "submit";
  btn.className = "btn btn-primary";
  btn.textContent = "Guardar nueva entrada";
  el.newEntryForm.appendChild(btn);

  el.newEntryForm.onsubmit = async (event) => {
    event.preventDefault();
    await runBusy(async () => {
      const form = new FormData(el.newEntryForm);
      const row = {};
      state.headers.forEach((h) => (row[h] = String(form.get(h) || "").trim()));
      await apiPost("/api/entries", { data: row });
      await loadRows();
      el.newEntryForm.reset();
    });
  };
}

async function onFileUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!state.user?.is_admin) {
    alert("Solo admins pueden importar archivos.");
    return;
  }

  await runBusy(async () => {
    const text = await readTextFile(file);
    const rows = parseRowsFromText(text, file.name);
    if (!rows.length) throw new Error("Archivo sin filas válidas");
    const ok = confirm("Esto reemplazará todos los datos. ¿Continuar?");
    if (!ok) return;
    await apiPost("/api/entries/replace", { rows });
    await loadRows();
  });

  event.target.value = "";
}

function renderTable() {
  el.thead.innerHTML = "";
  el.tbody.innerHTML = "";

  updateFilterOptions();

  const isEditable = !!state.user?.is_admin;

  const hr = document.createElement("tr");
  state.headers.forEach((h) => {
    const th = document.createElement("th");
    th.textContent = h;
    hr.appendChild(th);
  });
  const thActions = document.createElement("th");
  thActions.textContent = isEditable ? "Acciones" : "";
  hr.appendChild(thActions);
  el.thead.appendChild(hr);

  getFilteredRows().forEach((rowObj) => {
    const tr = document.createElement("tr");

    state.headers.forEach((h) => {
      const td = document.createElement("td");
      if (isEditable) {
        const input = document.createElement("input");
        input.value = rowObj.data[h] ?? "";
        input.addEventListener("change", async (e) => {
          await runBusy(async () => {
            rowObj.data[h] = e.target.value;
            await apiPut(`/api/entries/${rowObj.id}`, { data: rowObj.data });
          });
        });
        td.appendChild(input);
      } else {
        td.textContent = rowObj.data[h] ?? "";
      }
      tr.appendChild(td);
    });

    const actionsTd = document.createElement("td");
    actionsTd.className = "actions-cell";
    if (isEditable) {
      const del = document.createElement("button");
      del.className = "icon-btn";
      del.textContent = "Eliminar";
      del.addEventListener("click", async () => {
        await runBusy(async () => {
          await apiDelete(`/api/entries/${rowObj.id}`);
          await loadRows();
        });
      });
      actionsTd.appendChild(del);
    }
    tr.appendChild(actionsTd);
    el.tbody.appendChild(tr);
  });
}

async function loadMembers() {
  const data = await apiGet("/api/admin/users");
  const users = data?.users || [];
  el.membersTbody.innerHTML = "";

  users.forEach((u) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(u.username)}</td>
      <td>${u.is_admin ? '<span class="role-pill role-admin">admin</span>' : '<span class="role-pill role-viewer">user</span>'}</td>
      <td>${u.is_active ? '<span class="badge-ok">Activo</span>' : '<span class="badge-pending">Bloqueado</span>'}</td>
      <td class="actions-cell"></td>
    `;

    const cell = tr.querySelector("td.actions-cell");

    const toggleRole = document.createElement("button");
    toggleRole.className = "btn";
    toggleRole.textContent = u.is_admin ? "Quitar admin" : "Hacer admin";
    toggleRole.addEventListener("click", async () => {
      await runBusy(async () => {
        await apiPatch(`/api/admin/users/${u.id}`, {
          is_admin: !u.is_admin,
          is_active: u.is_active,
        });
        await loadMembers();
      });
    });

    const toggleActive = document.createElement("button");
    toggleActive.className = "btn";
    toggleActive.textContent = u.is_active ? "Bloquear" : "Activar";
    toggleActive.addEventListener("click", async () => {
      await runBusy(async () => {
        await apiPatch(`/api/admin/users/${u.id}`, {
          is_admin: u.is_admin,
          is_active: !u.is_active,
        });
        await loadMembers();
      });
    });

    cell.appendChild(toggleRole);
    cell.appendChild(toggleActive);
    el.membersTbody.appendChild(tr);
  });
}

async function onCreateUser() {
  await runBusy(async () => {
    const username = el.newUserInput.value.trim().toLowerCase();
    const password = el.newUserPassInput.value;
    const isAdmin = !!el.newUserAdminInput.checked;

    if (!username || !password || password.length < 6) {
      throw new Error("Usuario obligatorio y contraseña >= 6");
    }

    await apiPost("/api/admin/users", {
      username,
      password,
      is_admin: isAdmin,
      is_active: true,
    });

    el.newUserInput.value = "";
    el.newUserPassInput.value = "";
    el.newUserAdminInput.checked = false;
    await loadMembers();
  });
}

function updateFilterOptions() {
  const statusHeader = getHeaderByKeyword("status", ["payment"]);
  const paymentHeader = getHeaderByKeyword("payment", []);
  fillSelect(el.statusFilter, statusHeader);
  fillSelect(el.paymentFilter, paymentHeader);
}

function fillSelect(select, headerName) {
  const prev = select.value;
  select.innerHTML = "<option value=''>Todos</option>";
  if (!headerName) return;

  [...new Set(state.rows.map((r) => r.data[headerName]).filter(Boolean))]
    .sort((a, b) => String(a).localeCompare(String(b)))
    .forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      select.appendChild(opt);
    });

  if ([...select.options].some((o) => o.value === prev)) select.value = prev;
}

function getFilteredRows() {
  const statusHeader = getHeaderByKeyword("status", ["payment"]);
  const paymentHeader = getHeaderByKeyword("payment", []);

  return state.rows.filter((row) => {
    const text = state.headers.map((h) => String(row.data[h] || "").toLowerCase()).join(" ");
    const a = !state.search || text.includes(state.search);
    const b = !state.statusFilter || !statusHeader || String(row.data[statusHeader] || "") === state.statusFilter;
    const c = !state.paymentFilter || !paymentHeader || String(row.data[paymentHeader] || "") === state.paymentFilter;
    return a && b && c;
  });
}

function updateStats() {
  const rows = getFilteredRows();
  const paymentHeader = getHeaderByKeyword("payment", []);
  const salaryHeader = getHeaderByKeyword("salary", []);

  const paid = paymentHeader ? rows.filter((r) => String(r.data[paymentHeader] || "").toUpperCase().includes("PAID")).length : 0;
  const unpaid = paymentHeader ? rows.filter((r) => String(r.data[paymentHeader] || "").toUpperCase().includes("UNPAID")).length : 0;
  const totalSalary = salaryHeader ? rows.reduce((acc, r) => acc + parseMoney(r.data[salaryHeader]), 0) : 0;

  el.stats.innerHTML = [
    { label: "Registros", value: rows.length },
    { label: "Pagados", value: paid },
    { label: "Pendientes", value: unpaid },
    { label: "Total salario", value: formatMoney(totalSalary) },
  ]
    .map((i) => `<article class="stat"><span>${escapeHtml(i.label)}</span><b>${escapeHtml(String(i.value))}</b></article>`)
    .join("");
}

function showAuth() {
  el.authGate.classList.remove("hidden");
  el.appShell.classList.add("hidden");
}

function hideAuth() {
  el.authGate.classList.add("hidden");
  el.appShell.classList.remove("hidden");
}

function setAuthMessage(message, tone = "info") {
  el.authMessage.textContent = message;
  if (tone === "error") el.authMessage.style.color = "var(--danger)";
  else if (tone === "success") el.authMessage.style.color = "var(--accent)";
  else el.authMessage.style.color = "var(--muted)";
}

async function runBusy(fn) {
  if (state.busy) return;
  state.busy = true;
  try {
    await fn();
  } catch (e) {
    const msg = e.message || String(e);
    if (el.authGate.classList.contains("hidden")) alert(msg);
    else setAuthMessage(msg, "error");
  } finally {
    state.busy = false;
  }
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });

  const isJson = (response.headers.get("content-type") || "").includes("application/json");
  const data = isJson ? await response.json() : null;
  if (!response.ok) {
    throw new Error((data && (data.error || data.message)) || `HTTP ${response.status}`);
  }
  return data;
}

function apiGet(path) {
  return api(path, { method: "GET" });
}

function apiPost(path, body) {
  return api(path, { method: "POST", body: JSON.stringify(body || {}) });
}

function apiPut(path, body) {
  return api(path, { method: "PUT", body: JSON.stringify(body || {}) });
}

function apiPatch(path, body) {
  return api(path, { method: "PATCH", body: JSON.stringify(body || {}) });
}

function apiDelete(path) {
  return api(path, { method: "DELETE" });
}

function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("No se pudo leer archivo"));
    reader.readAsText(file, "utf-8");
  });
}

function downloadCsv() {
  const lines = [state.headers, ...state.rows.map((r) => state.headers.map((h) => r.data[h] ?? ""))];
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
    const r = await fetch(ORIGINAL_HTML_FILE);
    if (r.ok) return parseRowsFromText(await r.text(), "Principal.html");
  } catch {}

  try {
    const r = await fetch(ORIGINAL_CSV_FILE);
    if (r.ok) return parseRowsFromText(await r.text(), "Principal.csv");
  } catch {}

  return [];
}

function parseRowsFromText(content, fileName = "") {
  const lower = fileName.toLowerCase();
  const html = lower.endsWith(".html") || lower.endsWith(".htm") || /<table/i.test(content);
  return html ? parseRowsFromHtml(content) : parseRowsFromCsv(content);
}

function parseRowsFromCsv(csvText) {
  const parsed = parseCsv(csvText);
  if (!parsed.length) return [];

  const headers = parsed[0].map((h, i) => {
    const v = String(h || "").trim();
    return v || (i === 0 ? "NAME" : `COLUMN_${i + 1}`);
  });

  return parsed
    .slice(1)
    .map((line) => {
      const row = {};
      headers.forEach((h, i) => (row[h] = String(line[i] || "").trim()));
      return row;
    })
    .filter((row) => isMeaningfulRow(row, headers));
}

function parseRowsFromHtml(htmlText) {
  const doc = new DOMParser().parseFromString(htmlText, "text/html");
  const table = doc.querySelector("table.waffle") || doc.querySelector("table");
  if (!table) return [];

  const bodyRows = [...table.querySelectorAll("tbody tr")];
  if (!bodyRows.length) return [];

  const headerCells = [...(bodyRows[0]?.querySelectorAll("td") || [])];
  const headers = headerCells.map((c, i) => cleanCellText(c.textContent || "") || (i === 0 ? "NAME" : `COLUMN_${i + 1}`));

  return bodyRows
    .slice(1)
    .map((tr) => {
      const cells = [...tr.querySelectorAll("td")];
      const row = {};
      headers.forEach((h, i) => (row[h] = cleanCellText(cells[i]?.textContent || "")));
      return row;
    })
    .filter((row) => isMeaningfulRow(row, headers));
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        value += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      row.push(value);
      value = "";
      continue;
    }

    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i += 1;
      row.push(value);
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
      value = "";
      continue;
    }

    value += ch;
  }

  if (value !== "" || row.length) {
    row.push(value);
    rows.push(row);
  }

  return rows;
}

function inferHeaders(rows) {
  if (!rows.length) return [...DEFAULT_HEADERS];
  const ordered = [];
  DEFAULT_HEADERS.forEach((h) => {
    if (rows.some((r) => Object.prototype.hasOwnProperty.call(r.data, h))) ordered.push(h);
  });
  rows.forEach((r) => Object.keys(r.data || {}).forEach((h) => { if (!ordered.includes(h)) ordered.push(h); }));
  return ordered;
}

function getHeaderByKeyword(keyword, excludes = []) {
  const n = String(keyword).toLowerCase();
  return state.headers.find((h) => {
    const low = h.toLowerCase();
    return low.includes(n) && excludes.every((x) => !low.includes(String(x).toLowerCase()));
  }) || null;
}

function parseMoney(value) {
  if (!value) return 0;
  const normalized = String(value).replace(/[^0-9,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const num = Number(normalized);
  return Number.isFinite(num) ? num : 0;
}

function formatMoney(v) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(v || 0);
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
  const hasAny = Object.values(row).some((v) => String(v || "").trim() !== "");
  if (!hasAny) return false;
  const important = ["name", "work", "status", "payment", "date", "how to"];
  return headers.some((h) => important.some((i) => h.toLowerCase().includes(i)) && String(row[h] || "").trim() !== "");
}

function cleanCellText(v) {
  return String(v || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function escapeHtml(v) {
  return String(v)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
