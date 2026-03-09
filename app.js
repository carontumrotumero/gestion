const APP_VERSION = "2026-03-09.2";
const SUPABASE_URL = "https://xjxscoqtnmlbxmetcpod.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqeHNjb3F0bm1sYnhtZXRjcG9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NzQ0MDAsImV4cCI6MjA4ODU1MDQwMH0.iAHhQriiuhp3gABsM27jI8pzMY7SP0bV8A5BrY0jWOk";

const PRIMARY_ADMIN_EMAIL = "carontumrotumero@gmail.com";
const TEAM_TABLE = "team_members";
const DATA_TABLE = "workforce_entries";
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
  session: null,
  member: null,
  rows: [],
  headers: [...DEFAULT_HEADERS],
  search: "",
  statusFilter: "",
  paymentFilter: "",
  isBusy: false,
};

const elements = {
  authGate: document.getElementById("authGate"),
  appShell: document.getElementById("appShell"),
  loginForm: document.getElementById("loginForm"),
  emailInput: document.getElementById("emailInput"),
  passwordInput: document.getElementById("passwordInput"),
  registerBtn: document.getElementById("registerBtn"),
  authMessage: document.getElementById("authMessage"),
  appVersion: document.getElementById("appVersion"),
  roleSummary: document.getElementById("roleSummary"),
  userBadge: document.getElementById("userBadge"),
  logoutBtn: document.getElementById("logoutBtn"),
  approvalNotice: document.getElementById("approvalNotice"),
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
};

let sbClient = null;

boot().catch((error) => {
  console.error(error);
  setAuthMessage(`Error de arranque: ${formatError(error)}`, "error");
});

async function boot() {
  if (elements.appVersion) {
    elements.appVersion.textContent = `Build ${APP_VERSION}`;
  }

  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    throw new Error("No cargó supabase-js");
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

  bindEvents();

  const {
    data: { session },
    error,
  } = await withTimeout(sbClient.auth.getSession(), REQUEST_TIMEOUT_MS, "getSession");

  if (error) {
    setAuthMessage(mapAuthError(error), "error");
    return;
  }

  await handleSession(session);
}

function bindEvents() {
  elements.loginForm.addEventListener("submit", onLogin);
  elements.registerBtn.addEventListener("click", onRegister);

  elements.logoutBtn.addEventListener("click", async () => {
    await runBusy(async () => {
      const { error } = await withTimeout(sbClient.auth.signOut(), REQUEST_TIMEOUT_MS, "signOut");
      if (error) throw error;
      await handleSession(null);
      setAuthMessage("Sesión cerrada.", "info");
    });
  });

  sbClient.auth.onAuthStateChange(async (_event, session) => {
    await handleSession(session);
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

  elements.downloadBtn.addEventListener("click", downloadCsv);
  elements.resetBtn.addEventListener("click", () => loadDataForCurrentRole());
}

async function handleSession(session) {
  state.session = session;

  if (!session) {
    state.member = null;
    state.rows = [];
    showAuth();
    return;
  }

  elements.userBadge.textContent = session.user.email || "Usuario";
  hideAuth();
  await loadMemberContext();
  await loadDataForCurrentRole();
  await loadMembersPanelIfAdmin();
}

async function onLogin(event) {
  event.preventDefault();
  await runBusy(async () => {
    setAuthMessage("Iniciando sesión...", "info");

    const email = elements.emailInput.value.trim();
    const password = elements.passwordInput.value;
    if (!email || !password) {
      setAuthMessage("Rellena email y contraseña.", "error");
      return;
    }

    const { data, error } = await withTimeout(
      sbClient.auth.signInWithPassword({ email, password }),
      REQUEST_TIMEOUT_MS,
      "signIn"
    );

    if (error) {
      setAuthMessage(mapAuthError(error), "error");
      return;
    }

    if (!data.session) {
      setAuthMessage("Login aceptado pero sin sesión activa.", "error");
      return;
    }

    await handleSession(data.session);
  });
}

async function onRegister() {
  await runBusy(async () => {
    setAuthMessage("Solicitando acceso...", "info");

    const email = elements.emailInput.value.trim();
    const password = elements.passwordInput.value;

    if (!email || !password || password.length < 6) {
      setAuthMessage("Email válido y contraseña >= 6.", "error");
      return;
    }

    const { data, error } = await withTimeout(
      sbClient.auth.signUp({ email, password }),
      REQUEST_TIMEOUT_MS,
      "signUp"
    );

    if (error) {
      setAuthMessage(mapAuthError(error), "error");
      return;
    }

    if (data.session) {
      await handleSession(data.session);
      return;
    }

    setAuthMessage("Cuenta creada. Queda pendiente aprobación de un admin.", "info");
  });
}

async function loadMemberContext() {
  const user = state.session?.user;
  if (!user) return;

  let member = null;

  const { data, error } = await withTimeout(
    sbClient.from(TEAM_TABLE).select("id,user_id,email,role,approved").eq("user_id", user.id).maybeSingle(),
    REQUEST_TIMEOUT_MS,
    "loadOwnMember"
  );

  if (error) throw new Error(`No se pudo leer team_members: ${mapDbError(error)}`);

  member = data || null;

  if (!member) {
    const initialRole = user.email?.toLowerCase() === PRIMARY_ADMIN_EMAIL.toLowerCase() ? "admin" : "viewer";
    const initialApproved = initialRole === "admin";

    const insert = await withTimeout(
      sbClient
        .from(TEAM_TABLE)
        .insert([
          {
            user_id: user.id,
            email: user.email,
            role: initialRole,
            approved: initialApproved,
          },
        ])
        .select("id,user_id,email,role,approved")
        .single(),
      REQUEST_TIMEOUT_MS,
      "insertOwnMember"
    );

    if (insert.error) {
      throw new Error(`No se pudo crear team_member: ${mapDbError(insert.error)}`);
    }

    member = insert.data;
  }

  state.member = member;

  const roleTxt = member.role === "admin" ? "Administrador" : "Visualizador";
  elements.roleSummary.textContent = `Rol: ${roleTxt} | ${member.approved ? "Aprobado" : "Pendiente de aprobación"}`;

  if (!member.approved) {
    elements.approvalNotice.classList.remove("hidden");
    elements.approvalNotice.textContent =
      "Tu cuenta está pendiente de aprobación por un administrador. Aún no puedes ver datos.";
  } else {
    elements.approvalNotice.classList.add("hidden");
    elements.approvalNotice.textContent = "";
  }
}

async function loadDataForCurrentRole() {
  const member = state.member;
  if (!member || !member.approved) {
    state.rows = [];
    elements.entryBar.classList.add("hidden");
    renderTable();
    updateStats();
    return;
  }

  const isAdmin = member.role === "admin";
  if (isAdmin) {
    elements.entryBar.classList.remove("hidden");
  } else {
    elements.entryBar.classList.add("hidden");
  }

  const { data, error } = await withTimeout(
    sbClient
      .from(DATA_TABLE)
      .select("id,data,created_at")
      .order("created_at", { ascending: false })
      .limit(ROW_LOAD_LIMIT),
    REQUEST_TIMEOUT_MS,
    "loadRows"
  );

  if (error) throw new Error(`No se pudo cargar datos: ${mapDbError(error)}`);

  state.rows = (data || []).map((item) => ({ id: item.id, data: item.data || {} }));
  state.headers = inferHeaders(state.rows);

  if (isAdmin && !state.rows.length) {
    const seed = await loadInitialDatasetRows();
    if (seed.length) {
      await insertRows(seed);
      return await loadDataForCurrentRole();
    }
  }

  renderEntryForm();
  renderTable();
  updateStats();
}

function renderEntryForm() {
  elements.newEntryForm.innerHTML = "";

  if (!state.member || state.member.role !== "admin") return;

  state.headers.forEach((header) => {
    const label = document.createElement("label");
    label.className = "field";

    const span = document.createElement("span");
    span.textContent = header;

    const input = document.createElement("input");
    input.name = header;
    input.placeholder = `Escribe ${header}`;

    label.appendChild(span);
    label.appendChild(input);
    elements.newEntryForm.appendChild(label);
  });

  const btn = document.createElement("button");
  btn.type = "submit";
  btn.className = "btn btn-primary";
  btn.textContent = "Guardar nueva entrada";
  elements.newEntryForm.appendChild(btn);

  elements.newEntryForm.onsubmit = async (event) => {
    event.preventDefault();
    await runBusy(async () => {
      const form = new FormData(elements.newEntryForm);
      const row = {};
      state.headers.forEach((h) => {
        row[h] = String(form.get(h) || "").trim();
      });
      await createRow(row);
      elements.newEntryForm.reset();
    });
  };
}

async function onFileUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  if (!state.member || state.member.role !== "admin") {
    alert("Solo admins pueden importar archivos.");
    return;
  }

  await runBusy(async () => {
    const text = await readTextFile(file);
    const parsedRows = parseRowsFromText(text, file.name);

    if (!parsedRows.length) {
      alert("Archivo sin filas válidas.");
      return;
    }

    const ok = confirm("Esto reemplazará todos los registros actuales. ¿Continuar?");
    if (!ok) return;

    await replaceAllRows(parsedRows);
    await loadDataForCurrentRole();
  });

  event.target.value = "";
}

async function loadMembersPanelIfAdmin() {
  const isAdmin = state.member?.role === "admin" && state.member?.approved;
  if (!isAdmin) {
    elements.adminPanel.classList.add("hidden");
    elements.membersTbody.innerHTML = "";
    return;
  }

  elements.adminPanel.classList.remove("hidden");

  const { data, error } = await withTimeout(
    sbClient.from(TEAM_TABLE).select("id,user_id,email,role,approved").order("created_at", { ascending: false }),
    REQUEST_TIMEOUT_MS,
    "loadMembers"
  );

  if (error) {
    elements.membersTbody.innerHTML = `<tr><td colspan="4">Error cargando miembros: ${escapeHtml(mapDbError(error))}</td></tr>`;
    return;
  }

  elements.membersTbody.innerHTML = "";

  (data || []).forEach((member) => {
    const tr = document.createElement("tr");
    const isSelf = member.user_id === state.session.user.id;

    tr.innerHTML = `
      <td>${escapeHtml(member.email)}</td>
      <td><span class="role-pill ${member.role === "admin" ? "role-admin" : "role-viewer"}">${escapeHtml(
      member.role
    )}</span></td>
      <td><span class="${member.approved ? "badge-ok" : "badge-pending"}">${member.approved ? "Aprobado" : "Pendiente"}</span></td>
      <td class="actions-cell"></td>
    `;

    const actionsCell = tr.querySelector("td.actions-cell");

    const approveBtn = document.createElement("button");
    approveBtn.className = "btn";
    approveBtn.textContent = member.approved ? "Bloquear" : "Aprobar";
    approveBtn.disabled = isSelf;
    approveBtn.addEventListener("click", async () => {
      await updateMember(member.id, { approved: !member.approved });
      await loadMembersPanelIfAdmin();
    });

    const roleBtn = document.createElement("button");
    roleBtn.className = "btn";
    roleBtn.textContent = member.role === "admin" ? "Pasar a viewer" : "Hacer admin";
    roleBtn.disabled = isSelf;
    roleBtn.addEventListener("click", async () => {
      await updateMember(member.id, { role: member.role === "admin" ? "viewer" : "admin" });
      await loadMembersPanelIfAdmin();
    });

    actionsCell.appendChild(approveBtn);
    actionsCell.appendChild(roleBtn);
    elements.membersTbody.appendChild(tr);
  });
}

async function updateMember(memberId, patch) {
  await runBusy(async () => {
    const { error } = await withTimeout(
      sbClient.from(TEAM_TABLE).update(patch).eq("id", memberId),
      REQUEST_TIMEOUT_MS,
      "updateMember"
    );
    if (error) throw new Error(`No se pudo actualizar miembro: ${mapDbError(error)}`);
  });
}

async function replaceAllRows(rows) {
  const { error: delErr } = await withTimeout(
    sbClient.from(DATA_TABLE).delete().neq("id", "00000000-0000-0000-0000-000000000000"),
    REQUEST_TIMEOUT_MS,
    "deleteAllRows"
  );
  if (delErr) throw new Error(`No se pudo limpiar tabla: ${mapDbError(delErr)}`);

  await insertRows(rows);
}

async function insertRows(rows) {
  if (!rows.length) return;

  const payload = rows.map((row) => ({ data: row }));
  const chunkSize = 200;

  for (let i = 0; i < payload.length; i += chunkSize) {
    const chunk = payload.slice(i, i + chunkSize);
    const { error } = await withTimeout(sbClient.from(DATA_TABLE).insert(chunk), REQUEST_TIMEOUT_MS, `insert:${i}`);
    if (error) throw new Error(`Error insertando datos: ${mapDbError(error)}`);
  }
}

async function createRow(rowData) {
  if (!state.member || state.member.role !== "admin") return;

  const { data, error } = await withTimeout(
    sbClient.from(DATA_TABLE).insert([{ data: rowData }]).select("id,data").single(),
    REQUEST_TIMEOUT_MS,
    "createRow"
  );

  if (error) throw new Error(`No se pudo crear fila: ${mapDbError(error)}`);
  state.rows.unshift({ id: data.id, data: data.data || {} });
  renderTable();
  updateStats();
}

async function updateRow(rowId, rowData) {
  const { error } = await withTimeout(
    sbClient.from(DATA_TABLE).update({ data: rowData }).eq("id", rowId),
    REQUEST_TIMEOUT_MS,
    "updateRow"
  );
  if (error) throw new Error(`No se pudo editar fila: ${mapDbError(error)}`);
}

async function deleteRow(rowId) {
  const { error } = await withTimeout(sbClient.from(DATA_TABLE).delete().eq("id", rowId), REQUEST_TIMEOUT_MS, "deleteRow");
  if (error) throw new Error(`No se pudo eliminar fila: ${mapDbError(error)}`);

  state.rows = state.rows.filter((row) => row.id !== rowId);
  renderTable();
  updateStats();
}

function renderTable() {
  elements.thead.innerHTML = "";
  elements.tbody.innerHTML = "";

  const isEditable = state.member?.role === "admin" && state.member?.approved;

  updateFilterOptions();

  const tr = document.createElement("tr");
  state.headers.forEach((h) => {
    const th = document.createElement("th");
    th.textContent = h;
    tr.appendChild(th);
  });

  const actionsTh = document.createElement("th");
  actionsTh.textContent = isEditable ? "Acciones" : "";
  tr.appendChild(actionsTh);
  elements.thead.appendChild(tr);

  getFilteredRows().forEach((rowObj) => {
    const row = document.createElement("tr");

    state.headers.forEach((header) => {
      const td = document.createElement("td");

      if (isEditable) {
        const input = document.createElement("input");
        input.value = rowObj.data[header] ?? "";
        input.addEventListener("change", async (e) => {
          try {
            rowObj.data[header] = e.target.value;
            await updateRow(rowObj.id, rowObj.data);
          } catch (error) {
            alert(formatError(error));
          }
        });
        td.appendChild(input);
      } else {
        td.textContent = rowObj.data[header] ?? "";
      }

      row.appendChild(td);
    });

    const actionsTd = document.createElement("td");
    actionsTd.className = "actions-cell";

    if (isEditable) {
      const del = document.createElement("button");
      del.className = "icon-btn";
      del.textContent = "Eliminar";
      del.addEventListener("click", async () => {
        try {
          await deleteRow(rowObj.id);
        } catch (error) {
          alert(formatError(error));
        }
      });
      actionsTd.appendChild(del);
    }

    row.appendChild(actionsTd);
    elements.tbody.appendChild(row);
  });
}

function updateFilterOptions() {
  const statusHeader = getHeaderByKeyword("status", ["payment"]);
  const paymentHeader = getHeaderByKeyword("payment", []);

  fillSelect(elements.statusFilter, statusHeader);
  fillSelect(elements.paymentFilter, paymentHeader);
}

function fillSelect(select, headerName) {
  const prev = select.value;
  select.innerHTML = "<option value=''>Todos</option>";
  if (!headerName) return;

  [...new Set(state.rows.map((r) => r.data[headerName]).filter(Boolean))]
    .sort((a, b) => String(a).localeCompare(String(b)))
    .forEach((v) => {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = v;
      select.appendChild(o);
    });

  if ([...select.options].some((o) => o.value === prev)) select.value = prev;
}

function getFilteredRows() {
  const statusHeader = getHeaderByKeyword("status", ["payment"]);
  const paymentHeader = getHeaderByKeyword("payment", []);

  return state.rows.filter((row) => {
    const text = state.headers.map((h) => String(row.data[h] || "").toLowerCase()).join(" ");
    const searchOk = !state.search || text.includes(state.search);
    const statusOk = !state.statusFilter || !statusHeader || String(row.data[statusHeader] || "") === state.statusFilter;
    const payOk = !state.paymentFilter || !paymentHeader || String(row.data[paymentHeader] || "") === state.paymentFilter;
    return searchOk && statusOk && payOk;
  });
}

function updateStats() {
  const rows = getFilteredRows();
  const paymentHeader = getHeaderByKeyword("payment", []);
  const salaryHeader = getHeaderByKeyword("salary", []);

  const paid = paymentHeader
    ? rows.filter((r) => String(r.data[paymentHeader] || "").toUpperCase().includes("PAID")).length
    : 0;
  const unpaid = paymentHeader
    ? rows.filter((r) => String(r.data[paymentHeader] || "").toUpperCase().includes("UNPAID")).length
    : 0;
  const totalSalary = salaryHeader ? rows.reduce((acc, r) => acc + parseMoney(r.data[salaryHeader]), 0) : 0;

  elements.stats.innerHTML = [
    { label: "Registros", value: rows.length },
    { label: "Pagados", value: paid },
    { label: "Pendientes", value: unpaid },
    { label: "Total salario", value: formatMoney(totalSalary) },
  ]
    .map((item) => `<article class="stat"><span>${escapeHtml(item.label)}</span><b>${escapeHtml(String(item.value))}</b></article>`)
    .join("");
}

function showAuth() {
  elements.authGate.classList.remove("hidden");
  elements.appShell.classList.add("hidden");
}

function hideAuth() {
  elements.authGate.classList.add("hidden");
  elements.appShell.classList.remove("hidden");
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
    return "Límite de emails de Supabase alcanzado. Configura SMTP o desactiva confirmación de email.";
  }
  if (msg.includes("email not confirmed")) {
    return "Email no confirmado. Desactiva confirmación o confirma el correo.";
  }
  if (msg.includes("invalid login credentials")) {
    return "Credenciales inválidas.";
  }
  return error?.message || "Error de autenticación";
}

function mapDbError(error) {
  const msg = String(error?.message || "").toLowerCase();
  const code = String(error?.code || "");
  if (code === "42501" || msg.includes("row-level security")) return "Permisos insuficientes (RLS).";
  if (code === "42p01" || msg.includes("does not exist")) return "Falta tabla en Supabase.";
  return error?.message || "Error de base de datos";
}

function formatError(error) {
  if (!error) return "Error desconocido";
  if (typeof error === "string") return error;
  return error.message || JSON.stringify(error);
}

async function runBusy(fn) {
  if (state.isBusy) return;
  state.isBusy = true;
  toggleAuthBusy(true);
  try {
    await fn();
  } catch (error) {
    console.error(error);
    const text = formatError(error);
    if (elements.authGate.classList.contains("hidden")) {
      alert(text);
    } else {
      setAuthMessage(text, "error");
    }
  } finally {
    state.isBusy = false;
    toggleAuthBusy(false);
  }
}

function toggleAuthBusy(disabled) {
  const submit = elements.loginForm.querySelector("button[type='submit']");
  if (submit) submit.disabled = disabled;
  if (elements.registerBtn) elements.registerBtn.disabled = disabled;
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout en ${label}`)), ms)),
  ]);
}

function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(new Error("No se pudo leer archivo"));
    r.readAsText(file, "utf-8");
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
    const htmlResponse = await fetch(ORIGINAL_HTML_FILE);
    if (htmlResponse.ok) {
      const html = await htmlResponse.text();
      return parseRowsFromText(html, "Principal.html");
    }
  } catch {
    // fallback
  }

  try {
    const csvResponse = await fetch(ORIGINAL_CSV_FILE);
    if (!csvResponse.ok) return [];
    const csv = await csvResponse.text();
    return parseRowsFromText(csv, "Principal.csv");
  } catch {
    return [];
  }
}

function parseRowsFromText(content, fileName = "") {
  const lower = fileName.toLowerCase();
  const looksHtml = lower.endsWith(".html") || lower.endsWith(".htm") || /<table/i.test(content);
  return looksHtml ? parseRowsFromHtml(content) : parseRowsFromCsv(content);
}

function parseRowsFromCsv(csvText) {
  const parsed = parseCsv(csvText);
  if (!parsed.length) throw new Error("CSV vacío");

  const headers = parsed[0].map((h, index) => {
    const v = String(h || "").trim();
    return v || (index === 0 ? "NAME" : `COLUMN_${index + 1}`);
  });

  return parsed
    .slice(1)
    .map((line) => {
      const row = {};
      headers.forEach((header, i) => {
        row[header] = String(line[i] || "").trim();
      });
      return row;
    })
    .filter((row) => isMeaningfulRow(row, headers));
}

function parseRowsFromHtml(htmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, "text/html");
  const table = doc.querySelector("table.waffle") || doc.querySelector("table");
  if (!table) throw new Error("No se encontró tabla en HTML");

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
      headers.forEach((header, i) => {
        row[header] = cleanCellText(cells[i]?.textContent || "");
      });
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

function inferHeaders(rows) {
  if (!rows.length) return [...DEFAULT_HEADERS];
  const ordered = [];

  DEFAULT_HEADERS.forEach((header) => {
    if (rows.some((r) => Object.prototype.hasOwnProperty.call(r.data, header))) ordered.push(header);
  });

  rows.forEach((r) => {
    Object.keys(r.data || {}).forEach((h) => {
      if (!ordered.includes(h)) ordered.push(h);
    });
  });

  return ordered;
}

function getHeaderByKeyword(keyword, excludes = []) {
  const needle = String(keyword || "").toLowerCase();
  return (
    state.headers.find((h) => {
      const low = h.toLowerCase();
      return low.includes(needle) && excludes.every((x) => !low.includes(String(x).toLowerCase()));
    }) || null
  );
}

function parseMoney(value) {
  if (!value) return 0;
  const normalized = String(value).replace(/[^0-9,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(value) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value || 0);
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
