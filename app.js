const APP_VERSION = "2026-03-14.1";
const ROW_LOAD_LIMIT = 500;
const ORIGINAL_CSV_FILE = "./Vanaco Working Force - Principal.csv";
const ORIGINAL_HTML_FILE = "./Vanaco Working Force/Principal.html";
const DEFAULT_HEADERS = ["NAME", "WORK", "STATUS", "PAYMENT STATUS", "PRICE PER UNIT", "QUANTITY", "SALARY", "DATE", "HOW TO"];
const LANG_KEY = "vanaco_lang_v1";
const CITY_KEY = "vanaco_city_list_v1";

const state = {
  user: null,
  rows: [],
  headers: [...DEFAULT_HEADERS],
  search: "",
  statusFilter: "",
  paymentFilter: "",
  busy: false,
  lang: localStorage.getItem(LANG_KEY) || "es",
};

const el = {
  authGate: document.getElementById("authGate"),
  appShell: document.getElementById("appShell"),
  loginForm: document.getElementById("loginForm"),
  registerBtn: document.getElementById("registerBtn"),
  langToggle: document.getElementById("langToggle"),
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
  manualForm: document.getElementById("manualForm"),
  manualCountry: document.getElementById("manualCountry"),
  manualCity: document.getElementById("manualCity"),
  manualX: document.getElementById("manualX"),
  manualZ: document.getElementById("manualZ"),
  fromCountry: document.getElementById("fromCountry"),
  fromCity: document.getElementById("fromCity"),
  toCountry: document.getElementById("toCountry"),
  toCity: document.getElementById("toCity"),
  pricePerBlock: document.getElementById("pricePerBlock"),
  distanceResult: document.getElementById("distanceResult"),
  costResult: document.getElementById("costResult"),
};

const I18N = {
  es: {
    "app.title": "Vanaco Working Force",
    "app.subtitle": "Panel de gestión",
    "auth.subtitle": "Acceso por usuario y contraseña",
    "auth.username": "Usuario",
    "auth.password": "Contraseña",
    "auth.username_placeholder": "admin",
    "auth.password_placeholder": "********",
    "auth.login": "Entrar",
    "auth.register": "Registrarse",
    "auth.logout": "Cerrar sesión",
    "auth.need_credentials": "Rellena usuario y contraseña.",
    "auth.logged_out": "Sesión cerrada.",
    "auth.login_prompt": "Introduce usuario y contraseña.",
    "auth.pending": "Usuario registrado. Espera aprobación del admin.",
    "role.admin": "Rol: Administrador",
    "role.viewer": "Rol: Usuario (solo lectura)",
    "entry.new_title": "Nueva entrada",
    "entry.save": "Guardar nueva entrada",
    "filters.search": "Buscar",
    "filters.search_placeholder": "Nombre, trabajo, estado...",
    "filters.status": "Filtro Estado",
    "filters.payment": "Filtro Pago",
    "filters.all": "Todos",
    "actions.import": "Importar archivo",
    "actions.export": "Exportar CSV",
    "actions.reload": "Recargar nube",
    "actions.delete": "Eliminar",
    "actions.confirm_replace": "Esto reemplazará todos los datos. ¿Continuar?",
    "actions.admin_only": "Solo admins pueden importar archivos.",
    "actions.invalid_file": "Archivo sin filas válidas",
    "admin.panel_title": "Panel Admin",
    "admin.new_user_placeholder": "nuevo_usuario",
    "admin.new_pass_placeholder": "contraseña",
    "admin.admin_label": "Admin",
    "admin.create_user": "Crear usuario",
    "admin.th_user": "Usuario",
    "admin.th_role": "Rol",
    "admin.th_active": "Activo",
    "admin.th_actions": "Acciones",
    "admin.role_admin": "admin",
    "admin.role_user": "user",
    "admin.active": "Activo",
    "admin.blocked": "Bloqueado",
    "admin.make_admin": "Hacer admin",
    "admin.remove_admin": "Quitar admin",
    "admin.block": "Bloquear",
    "admin.activate": "Activar",
    "admin.require_user": "Usuario obligatorio y contraseña >= 6",
    "stats.records": "Registros",
    "stats.paid": "Pagados",
    "stats.unpaid": "Pendientes",
    "stats.total": "Total salario",
    "table.actions": "Acciones",
    "lang.label": "Cambiar idioma",
    "manual.title": "Ciudades manuales",
    "manual.subtitle": "Añade países y ciudades con coordenadas X/Z para calcular distancias.",
    "manual.country": "País",
    "manual.city": "Ciudad",
    "manual.x": "X",
    "manual.z": "Z",
    "manual.add": "Añadir ciudad",
    "manual.country_placeholder": "España",
    "manual.city_placeholder": "Madrid",
    "manual.from_country": "País origen",
    "manual.from_city": "Ciudad origen",
    "manual.to_country": "País destino",
    "manual.to_city": "Ciudad destino",
    "manual.price_per_block": "Precio por bloque",
    "manual.distance": "Distancia",
    "manual.cost": "Coste",
  },
  en: {
    "app.title": "Vanaco Working Force",
    "app.subtitle": "Management dashboard",
    "auth.subtitle": "Access with username and password",
    "auth.username": "Username",
    "auth.password": "Password",
    "auth.username_placeholder": "admin",
    "auth.password_placeholder": "********",
    "auth.login": "Log in",
    "auth.register": "Register",
    "auth.logout": "Log out",
    "auth.need_credentials": "Enter username and password.",
    "auth.logged_out": "Session closed.",
    "auth.login_prompt": "Enter username and password.",
    "auth.pending": "User registered. Await admin approval.",
    "role.admin": "Role: Administrator",
    "role.viewer": "Role: Viewer (read only)",
    "entry.new_title": "New entry",
    "entry.save": "Save new entry",
    "filters.search": "Search",
    "filters.search_placeholder": "Name, job, status...",
    "filters.status": "Status filter",
    "filters.payment": "Payment filter",
    "filters.all": "All",
    "actions.import": "Import file",
    "actions.export": "Export CSV",
    "actions.reload": "Reload cloud",
    "actions.delete": "Delete",
    "actions.confirm_replace": "This will replace all data. Continue?",
    "actions.admin_only": "Only admins can import files.",
    "actions.invalid_file": "File has no valid rows",
    "admin.panel_title": "Admin Panel",
    "admin.new_user_placeholder": "new_user",
    "admin.new_pass_placeholder": "password",
    "admin.admin_label": "Admin",
    "admin.create_user": "Create user",
    "admin.th_user": "User",
    "admin.th_role": "Role",
    "admin.th_active": "Active",
    "admin.th_actions": "Actions",
    "admin.role_admin": "admin",
    "admin.role_user": "user",
    "admin.active": "Active",
    "admin.blocked": "Blocked",
    "admin.make_admin": "Make admin",
    "admin.remove_admin": "Remove admin",
    "admin.block": "Block",
    "admin.activate": "Activate",
    "admin.require_user": "Username required and password >= 6",
    "stats.records": "Records",
    "stats.paid": "Paid",
    "stats.unpaid": "Pending",
    "stats.total": "Total salary",
    "table.actions": "Actions",
    "lang.label": "Switch language",
    "manual.title": "Manual cities",
    "manual.subtitle": "Add countries and cities with X/Z coordinates to calculate distances.",
    "manual.country": "Country",
    "manual.city": "City",
    "manual.x": "X",
    "manual.z": "Z",
    "manual.add": "Add city",
    "manual.country_placeholder": "Spain",
    "manual.city_placeholder": "Madrid",
    "manual.from_country": "From country",
    "manual.from_city": "From city",
    "manual.to_country": "To country",
    "manual.to_city": "To city",
    "manual.price_per_block": "Price per block",
    "manual.distance": "Distance",
    "manual.cost": "Cost",
  },
};

init().catch((e) => {
  setAuthMessage(`Error init: ${e.message || e}`, "error");
});

async function init() {
  el.appVersion.textContent = `Build ${APP_VERSION}`;
  bindEvents();
  applyI18n();
  setAuthMessage(t("auth.login_prompt"), "info");
  loadCities();
  renderCitySelectors();

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
  el.langToggle.addEventListener("click", onToggleLang);
  el.manualForm.addEventListener("submit", onAddCity);
  el.fromCountry.addEventListener("change", () => {
    populateCitySelect(el.fromCountry, el.fromCity);
    updateDistance();
  });
  el.toCountry.addEventListener("change", () => {
    populateCitySelect(el.toCountry, el.toCity);
    updateDistance();
  });
  el.fromCity.addEventListener("change", updateDistance);
  el.toCity.addEventListener("change", updateDistance);
  el.pricePerBlock.addEventListener("input", updateDistance);

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
      setAuthMessage(t("auth.need_credentials"), "error");
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
      setAuthMessage(t("auth.need_credentials"), "error");
      return;
    }

    const data = await apiPost("/auth/register", { username, password });
    if (data.user) {
      state.user = data.user;
      await enterDashboard();
      return;
    }

    setAuthMessage(data.message || t("auth.pending"), "success");
  });
}

async function onLogout() {
  await runBusy(async () => {
    await apiGet("/auth/logout");
    state.user = null;
    showAuth();
    setAuthMessage(t("auth.logged_out"), "info");
  });
}

async function enterDashboard() {
  hideAuth();
  el.userBadge.textContent = state.user.username;
  el.roleSummary.textContent = state.user.is_admin ? t("role.admin") : t("role.viewer");
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
  btn.textContent = t("entry.save");
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
    alert(t("actions.admin_only"));
    return;
  }

  await runBusy(async () => {
    const text = await readTextFile(file);
    const rows = parseRowsFromText(text, file.name);
    if (!rows.length) throw new Error(t("actions.invalid_file"));
    const ok = confirm(t("actions.confirm_replace"));
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
  thActions.textContent = isEditable ? t("table.actions") : "";
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
      del.textContent = t("actions.delete");
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
      <td>${u.is_admin ? `<span class=\"role-pill role-admin\">${t("admin.role_admin")}</span>` : `<span class=\"role-pill role-viewer\">${t("admin.role_user")}</span>`}</td>
      <td>${u.is_active ? `<span class=\"badge-ok\">${t("admin.active")}</span>` : `<span class=\"badge-pending\">${t("admin.blocked")}</span>`}</td>
      <td class="actions-cell"></td>
    `;

    const cell = tr.querySelector("td.actions-cell");

    const toggleRole = document.createElement("button");
    toggleRole.className = "btn";
    toggleRole.textContent = u.is_admin ? t("admin.remove_admin") : t("admin.make_admin");
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
    toggleActive.textContent = u.is_active ? t("admin.block") : t("admin.activate");
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
      throw new Error(t("admin.require_user"));
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
  select.innerHTML = `<option value=''>${t("filters.all")}</option>`;
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
    { label: t("stats.records"), value: rows.length },
    { label: t("stats.paid"), value: paid },
    { label: t("stats.unpaid"), value: unpaid },
    { label: t("stats.total"), value: formatMoney(totalSalary) },
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

function t(key) {
  return (I18N[state.lang] && I18N[state.lang][key]) || I18N.es[key] || key;
}

function applyI18n() {
  document.documentElement.lang = state.lang;
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    const key = node.getAttribute("data-i18n");
    node.textContent = t(key);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    const key = node.getAttribute("data-i18n-placeholder");
    node.setAttribute("placeholder", t(key));
  });
  el.langToggle.textContent = state.lang === "es" ? "🇬🇧" : "🇪🇸";
  el.langToggle.setAttribute("aria-label", t("lang.label"));
  refreshDynamicLanguage();
}

function refreshDynamicLanguage() {
  if (state.user) {
    el.roleSummary.textContent = state.user.is_admin ? t("role.admin") : t("role.viewer");
  }
  renderCitySelectors();
  updateDistance();
  renderEntryForm();
  renderTable();
  updateStats();
  if (state.user?.is_admin) {
    loadMembers();
  }
}

function onToggleLang() {
  state.lang = state.lang === "es" ? "en" : "es";
  localStorage.setItem(LANG_KEY, state.lang);
  applyI18n();
}

function loadCities() {
  try {
    const raw = localStorage.getItem(CITY_KEY);
    state.cities = raw ? JSON.parse(raw) : [];
  } catch {
    state.cities = [];
  }
}

function saveCities() {
  localStorage.setItem(CITY_KEY, JSON.stringify(state.cities || []));
}

function onAddCity(event) {
  event.preventDefault();
  const country = String(el.manualCountry.value || "").trim();
  const city = String(el.manualCity.value || "").trim();
  const x = Number(el.manualX.value);
  const z = Number(el.manualZ.value);
  if (!country || !city || !Number.isFinite(x) || !Number.isFinite(z)) {
    setAuthMessage(t("actions.invalid_file"), "error");
    return;
  }
  state.cities.push({ country, city, x, z });
  saveCities();
  el.manualForm.reset();
  renderCitySelectors();
  updateDistance();
}

function uniqueCountries() {
  return [...new Set((state.cities || []).map((c) => c.country))].sort((a, b) => a.localeCompare(b));
}

function renderCitySelectors() {
  const countries = uniqueCountries();
  fillSelectOptions(el.fromCountry, countries);
  fillSelectOptions(el.toCountry, countries);
  populateCitySelect(el.fromCountry, el.fromCity);
  populateCitySelect(el.toCountry, el.toCity);
}

function fillSelectOptions(select, options) {
  const prev = select.value;
  select.innerHTML = "";
  options.forEach((opt) => {
    const o = document.createElement("option");
    o.value = opt;
    o.textContent = opt;
    select.appendChild(o);
  });
  if (options.includes(prev)) select.value = prev;
}

function populateCitySelect(countrySelect, citySelect) {
  const country = countrySelect.value;
  const cities = (state.cities || [])
    .filter((c) => c.country === country)
    .map((c) => c.city)
    .filter(Boolean);
  fillSelectOptions(citySelect, cities);
}

function findCity(country, city) {
  return (state.cities || []).find((c) => c.country === country && c.city === city) || null;
}

function updateDistance() {
  const fromCountry = el.fromCountry.value;
  const toCountry = el.toCountry.value;
  const fromCity = el.fromCity.value;
  const toCity = el.toCity.value;
  const from = findCity(fromCountry, fromCity);
  const to = findCity(toCountry, toCity);
  if (!from || !to) {
    el.distanceResult.textContent = "0";
    el.costResult.textContent = "0";
    return;
  }
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const distance = Math.round(Math.sqrt(dx * dx + dz * dz));
  const price = Number(el.pricePerBlock.value) || 0;
  const cost = Math.round(distance * price * 100) / 100;
  el.distanceResult.textContent = String(distance);
  el.costResult.textContent = String(cost);
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
