const crypto = require("crypto");
const path = require("path");
const express = require("express");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");

dotenv.config();

const app = express();
const localPort = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === "production";

const SESSION_COOKIE = "vanaco_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ROW_LOAD_LIMIT = 2000;

const requiredEnv = ["SESSION_SECRET", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.warn(`[warn] Missing ${key}.`);
  }
}

const hasSupabase = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const supabase = hasSupabase
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

app.use(express.json({ limit: "5mb" }));
app.use(express.static(__dirname));

app.get("/", (_req, res) => {
  res.sendFile("index.html", { root: __dirname });
});

function ensureSupabaseConfigured() {
  if (!supabase) {
    const error = new Error("Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en variables de entorno.");
    error.status = 500;
    throw error;
  }
}

function getSigningSecret() {
  return process.env.SESSION_SECRET || "change-me";
}

function signValue(value) {
  return crypto.createHmac("sha256", getSigningSecret()).update(value).digest("base64url");
}

function parseCookies(header) {
  if (!header) return {};
  const result = {};
  for (const pair of header.split(";")) {
    const index = pair.indexOf("=");
    if (index < 0) continue;
    const key = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    result[key] = decodeURIComponent(value);
  }
  return result;
}

function appendSetCookie(res, cookieValue) {
  const current = res.getHeader("Set-Cookie");
  if (!current) {
    res.setHeader("Set-Cookie", [cookieValue]);
    return;
  }
  res.setHeader("Set-Cookie", Array.isArray(current) ? current.concat(cookieValue) : [String(current), cookieValue]);
}

function serializeCookie(name, value, options = {}) {
  const attributes = [`${name}=${encodeURIComponent(value)}`];
  if (options.maxAge !== undefined) attributes.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  attributes.push(`Path=${options.path || "/"}`);
  if (options.httpOnly !== false) attributes.push("HttpOnly");
  attributes.push(`SameSite=${options.sameSite || "Lax"}`);
  if (options.secure) attributes.push("Secure");
  return attributes.join("; ");
}

function createSignedPayload(payload) {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = signValue(encoded);
  return `${encoded}.${signature}`;
}

function verifySignedPayload(value) {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts;
  if (signValue(encoded) !== signature) return null;
  try {
    return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function setSessionCookie(res, userId) {
  const payload = { userId, exp: Date.now() + SESSION_TTL_MS };
  const value = createSignedPayload(payload);
  appendSetCookie(
    res,
    serializeCookie(SESSION_COOKIE, value, {
      maxAge: SESSION_TTL_MS / 1000,
      secure: isProduction,
    })
  );
}

function clearSessionCookie(res) {
  appendSetCookie(
    res,
    serializeCookie(SESSION_COOKIE, "", {
      maxAge: 0,
      secure: isProduction,
    })
  );
}

function readSession(req) {
  const cookies = parseCookies(req.headers.cookie);
  const payload = verifySignedPayload(cookies[SESSION_COOKIE]);
  if (!payload || payload.exp < Date.now() || !payload.userId) return null;
  return payload;
}

function asyncHandler(handler) {
  return function wrapped(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function normalizeUsername(username) {
  return String(username || "").trim().toLowerCase();
}

function isValidUsername(username) {
  return /^[a-zA-Z0-9_]{3,32}$/.test(username);
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, expectedHash] = String(stored || "").split(":");
  if (!salt || !expectedHash) return false;
  const currentHash = crypto.scryptSync(password, salt, 64).toString("hex");
  const a = Buffer.from(currentHash, "hex");
  const b = Buffer.from(expectedHash, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

async function usersCount() {
  ensureSupabaseConfigured();
  const { count, error } = await supabase.from("app_users").select("id", { head: true, count: "exact" });
  if (error) throw new Error(`Supabase users count failed: ${error.message}`);
  return Number(count || 0);
}

async function getUserById(userId) {
  ensureSupabaseConfigured();
  const { data, error } = await supabase
    .from("app_users")
    .select("id,username,password_hash,is_admin,is_active,created_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(`Supabase get user failed: ${error.message}`);
  return data || null;
}

async function getUserByUsername(username) {
  ensureSupabaseConfigured();
  const { data, error } = await supabase
    .from("app_users")
    .select("id,username,password_hash,is_admin,is_active,created_at")
    .eq("username", normalizeUsername(username))
    .maybeSingle();
  if (error) throw new Error(`Supabase get user by username failed: ${error.message}`);
  return data || null;
}

async function createUser({ username, password, isAdmin = false, isActive = true }) {
  ensureSupabaseConfigured();
  const normalized = normalizeUsername(username);
  const { data, error } = await supabase
    .from("app_users")
    .insert({
      username: normalized,
      password_hash: hashPassword(password),
      is_admin: Boolean(isAdmin),
      is_active: Boolean(isActive),
    })
    .select("id,username,is_admin,is_active,created_at")
    .single();

  if (error) throw new Error(`Supabase create user failed: ${error.message}`);
  return data;
}

async function listUsers() {
  ensureSupabaseConfigured();
  const { data, error } = await supabase
    .from("app_users")
    .select("id,username,is_admin,is_active,created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Supabase list users failed: ${error.message}`);
  return data || [];
}

async function updateUser(userId, patch) {
  ensureSupabaseConfigured();
  const payload = {};
  if (typeof patch.is_admin === "boolean") payload.is_admin = patch.is_admin;
  if (typeof patch.is_active === "boolean") payload.is_active = patch.is_active;
  if (patch.password && String(patch.password).trim()) payload.password_hash = hashPassword(String(patch.password));

  const { data, error } = await supabase
    .from("app_users")
    .update(payload)
    .eq("id", userId)
    .select("id,username,is_admin,is_active,created_at")
    .maybeSingle();

  if (error) throw new Error(`Supabase update user failed: ${error.message}`);
  return data;
}

async function listEntries(limit) {
  ensureSupabaseConfigured();
  const safeLimit = Math.max(1, Math.min(Number(limit) || 500, ROW_LOAD_LIMIT));
  let query = supabase
    .from("workforce_entries")
    .select("id,data,created_at,updated_at")
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  const { data, error } = await query.eq("is_deleted", false);
  if (error) {
    const fallback = await supabase
      .from("workforce_entries")
      .select("id,data,created_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(safeLimit);
    if (fallback.error) throw new Error(`Supabase list entries failed: ${fallback.error.message}`);
    return fallback.data || [];
  }

  return data || [];
}

async function createEntry(data) {
  ensureSupabaseConfigured();
  const { data: row, error } = await supabase
    .from("workforce_entries")
    .insert({ data: data || {}, is_deleted: false })
    .select("id,data,created_at,updated_at")
    .single();

  if (error) {
    const fallback = await supabase
      .from("workforce_entries")
      .insert({ data: data || {} })
      .select("id,data,created_at,updated_at")
      .single();
    if (fallback.error) throw new Error(`Supabase create entry failed: ${fallback.error.message}`);
    return fallback.data;
  }

  return row;
}

async function updateEntry(id, data) {
  ensureSupabaseConfigured();
  const { error } = await supabase.from("workforce_entries").update({ data: data || {} }).eq("id", id);
  if (error) throw new Error(`Supabase update entry failed: ${error.message}`);
}

async function deleteEntry(id) {
  ensureSupabaseConfigured();
  const soft = await supabase.from("workforce_entries").update({ is_deleted: true }).eq("id", id);
  if (!soft.error) return;
  const hard = await supabase.from("workforce_entries").delete().eq("id", id);
  if (hard.error) throw new Error(`Supabase delete entry failed: ${hard.error.message}`);
}

async function replaceEntries(rows) {
  ensureSupabaseConfigured();
  const mark = await supabase.from("workforce_entries").update({ is_deleted: true }).eq("is_deleted", false);
  if (mark.error) {
    const hardDelete = await supabase.from("workforce_entries").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (hardDelete.error) throw new Error(`Supabase replace delete failed: ${hardDelete.error.message}`);
  }

  if (!Array.isArray(rows) || rows.length === 0) return;

  const payload = rows.map((item) => ({ data: item || {}, is_deleted: false }));
  const insert = await supabase.from("workforce_entries").insert(payload);
  if (insert.error) {
    const fallback = await supabase.from("workforce_entries").insert(rows.map((item) => ({ data: item || {} })));
    if (fallback.error) throw new Error(`Supabase replace insert failed: ${fallback.error.message}`);
  }
}

function requireAuth(req, res, next) {
  const session = readSession(req);
  if (!session) return res.status(401).json({ error: "Debes iniciar sesión." });
  req.sessionUserId = session.userId;
  next();
}

const requireAdmin = asyncHandler(async (req, res, next) => {
  const user = await getUserById(req.sessionUserId);
  if (!user || !user.is_active || !user.is_admin) {
    return res.status(403).json({ error: "Solo admins pueden hacer esto." });
  }
  req.sessionUser = user;
  next();
});

app.post(
  "/auth/register",
  asyncHandler(async (req, res) => {
    const username = normalizeUsername(req.body.username);
    const password = String(req.body.password || "");

    if (!isValidUsername(username)) {
      return res.status(400).json({ error: "Usuario inválido (3-32, letras/números/_)." });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres." });
    }

    const existing = await getUserByUsername(username);
    if (existing) {
      return res.status(409).json({ error: "Ese usuario ya existe." });
    }

    const count = await usersCount();
    const isFirstUser = count === 0;

    const user = await createUser({
      username,
      password,
      isAdmin: isFirstUser,
      isActive: isFirstUser,
    });

    if (isFirstUser) {
      setSessionCookie(res, user.id);
      return res.status(201).json({
        message: "Primer admin creado y sesión iniciada.",
        user: {
          id: user.id,
          username: user.username,
          is_admin: user.is_admin,
          is_active: user.is_active,
        },
      });
    }

    return res.status(201).json({ message: "Usuario creado. Pendiente de activación por admin." });
  })
);

app.post(
  "/auth/login",
  asyncHandler(async (req, res) => {
    const username = normalizeUsername(req.body.username);
    const password = String(req.body.password || "");

    const user = await getUserByUsername(username);
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: "Usuario o contraseña incorrectos." });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: "Tu cuenta está pendiente de aprobación por un admin." });
    }

    setSessionCookie(res, user.id);
    res.json({
      message: "Sesión iniciada.",
      user: {
        id: user.id,
        username: user.username,
        is_admin: user.is_admin,
        is_active: user.is_active,
      },
    });
  })
);

app.get("/auth/logout", (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.get(
  "/api/session",
  asyncHandler(async (req, res) => {
    const session = readSession(req);
    if (!session) {
      return res.json({ loggedIn: false, user: null });
    }

    const user = await getUserById(session.userId);
    if (!user || !user.is_active) {
      clearSessionCookie(res);
      return res.json({ loggedIn: false, user: null });
    }

    res.json({
      loggedIn: true,
      user: {
        id: user.id,
        username: user.username,
        is_admin: user.is_admin,
        is_active: user.is_active,
      },
    });
  })
);

app.get(
  "/api/entries",
  requireAuth,
  asyncHandler(async (req, res) => {
    const rows = await listEntries(req.query.limit);
    res.json({ rows });
  })
);

app.post(
  "/api/entries",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const row = await createEntry(req.body.data || {});
    res.status(201).json({ ok: true, row });
  })
);

app.put(
  "/api/entries/:id",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    await updateEntry(req.params.id, req.body.data || {});
    res.json({ ok: true });
  })
);

app.delete(
  "/api/entries/:id",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    await deleteEntry(req.params.id);
    res.json({ ok: true });
  })
);

app.post(
  "/api/entries/replace",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    await replaceEntries(req.body.rows || []);
    res.json({ ok: true });
  })
);

app.get(
  "/api/admin/users",
  requireAuth,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const users = await listUsers();
    res.json({ users });
  })
);

app.post(
  "/api/admin/users",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const username = normalizeUsername(req.body.username);
    const password = String(req.body.password || "");
    const isAdmin = Boolean(req.body.is_admin);
    const isActive = req.body.is_active !== false;

    if (!isValidUsername(username)) {
      return res.status(400).json({ error: "Usuario inválido (3-32, letras/números/_)." });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres." });
    }

    const existing = await getUserByUsername(username);
    if (existing) return res.status(409).json({ error: "Ese usuario ya existe." });

    const user = await createUser({ username, password, isAdmin, isActive });
    res.status(201).json({ ok: true, user });
  })
);

app.patch(
  "/api/admin/users/:id",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const patch = {
      is_admin: req.body.is_admin,
      is_active: req.body.is_active,
      password: req.body.password,
    };
    const user = await updateUser(req.params.id, patch);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado." });
    res.json({ ok: true, user });
  })
);

app.use((error, _req, res, _next) => {
  console.error("[server-error]", error);
  const status = Number(error.status) || 500;
  const message = error.message || "Error interno del servidor";
  if (res.headersSent) return;
  res.status(status).json({ error: message });
});

if (process.env.VERCEL) {
  module.exports = app;
} else {
  app.listen(localPort, () => {
    console.log(`Vanaco server running on http://localhost:${localPort}`);
  });
}
