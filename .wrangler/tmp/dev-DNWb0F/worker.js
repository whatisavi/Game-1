var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/lib/adminAuth.ts
var encoder = new TextEncoder();
var tokenLifetimeSeconds = 8 * 60 * 60;
function toHex(buffer) {
  return Array.from(new Uint8Array(buffer)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
__name(toHex, "toHex");
async function signPayload(payload, passwordHash) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passwordHash),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
}
__name(signPayload, "signPayload");
async function createAdminToken(userId, passwordHash) {
  const expiresAt = Math.floor(Date.now() / 1e3) + tokenLifetimeSeconds;
  const payload = `${userId}.${expiresAt}`;
  return `${payload}.${await signPayload(payload, passwordHash)}`;
}
__name(createAdminToken, "createAdminToken");
async function verifyAdminToken(db, token) {
  if (!token) return false;
  const [userId, expiresAtValue, signature, extra] = token.split(".");
  const expiresAt = Number(expiresAtValue);
  if (!userId || !Number.isInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1e3) || !/^[a-f\d]{64}$/i.test(signature || "") || extra) {
    return false;
  }
  const user = await db.prepare("SELECT password, isAdmin FROM users WHERE id = ?").bind(userId).first();
  if (Number(user?.isAdmin) !== 1 || !user?.password) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(String(user.password)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const signatureBytes = Uint8Array.from(signature.match(/.{2}/g) || [], (byte) => Number.parseInt(byte, 16));
  return crypto.subtle.verify("HMAC", key, signatureBytes.buffer, encoder.encode(`${userId}.${expiresAt}`));
}
__name(verifyAdminToken, "verifyAdminToken");
function getAdminToken(request) {
  const authorization = request.headers.get("Authorization") || "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7) : null;
}
__name(getAdminToken, "getAdminToken");

// src/worker.ts
async function hashPassword(password) {
  const encoder2 = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder2.encode(password));
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(hashPassword, "hashPassword");
async function ensureUsersTable(env) {
  try {
    await env.DB.prepare("SELECT 1 FROM users LIMIT 1").first();
  } catch (error) {
    const message = String(error?.message || error);
    if (message.includes("no such table: users") || message.includes("has no table named users") || message.includes("no such table")) {
      await env.DB.prepare(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE,
          email TEXT NOT NULL UNIQUE,
          password TEXT,
          isAdmin INTEGER NOT NULL DEFAULT 0,
          score INTEGER DEFAULT 0,
          gold INTEGER DEFAULT 0,
          win INTEGER DEFAULT 0,
          win_1v1v1 INTEGER DEFAULT 0,
          wins_stealing INTEGER DEFAULT 0,
          wins_anti_connect_four INTEGER DEFAULT 0,
          games_classic INTEGER DEFAULT 0,
          games_triple INTEGER DEFAULT 0,
          games_stealing INTEGER DEFAULT 0,
          games_anti_connect_four INTEGER DEFAULT 0
        )
      `).run();
      return;
    }
    throw error;
  }
}
__name(ensureUsersTable, "ensureUsersTable");
async function ensureScoreColumn(env) {
  await ensureUsersTable(env);
  try {
    await env.DB.prepare("SELECT score FROM users LIMIT 1").first();
  } catch (error) {
    const message = String(error?.message || error);
    if (message.includes("no such column: score") || message.includes("has no column named score")) {
      await env.DB.prepare("ALTER TABLE users ADD COLUMN score INTEGER DEFAULT 0").run();
    } else {
      throw error;
    }
  }
}
__name(ensureScoreColumn, "ensureScoreColumn");
async function ensureGoldColumn(env) {
  await ensureUsersTable(env);
  try {
    await env.DB.prepare("SELECT gold FROM users LIMIT 1").first();
  } catch (error) {
    const message = String(error?.message || error);
    if (message.includes("no such column: gold") || message.includes("has no column named gold")) {
      await env.DB.prepare("ALTER TABLE users ADD COLUMN gold INTEGER DEFAULT 0").run();
    } else {
      throw error;
    }
  }
}
__name(ensureGoldColumn, "ensureGoldColumn");
async function ensurePasswordColumn(env) {
  await ensureUsersTable(env);
  try {
    await env.DB.prepare("SELECT password FROM users LIMIT 1").first();
  } catch (error) {
    const message = String(error?.message || error);
    if (message.includes("no such column: password") || message.includes("has no column named password")) {
      await env.DB.prepare("ALTER TABLE users ADD COLUMN password TEXT").run();
    } else {
      throw error;
    }
  }
}
__name(ensurePasswordColumn, "ensurePasswordColumn");
async function ensureWinColumn(env) {
  await ensureUsersTable(env);
  try {
    await env.DB.prepare("SELECT win FROM users LIMIT 1").first();
  } catch (error) {
    const message = String(error?.message || error);
    if (message.includes("no such column: win") || message.includes("has no column named win")) {
      await env.DB.prepare("ALTER TABLE users ADD COLUMN win INTEGER DEFAULT 0").run();
    } else {
      throw error;
    }
  }
}
__name(ensureWinColumn, "ensureWinColumn");
async function ensureTripleWinColumn(env) {
  await ensureUsersTable(env);
  try {
    await env.DB.prepare("SELECT win_1v1v1 FROM users LIMIT 1").first();
  } catch (error) {
    const message = String(error?.message || error);
    if (message.includes("no such column: win_1v1v1") || message.includes("has no column named win_1v1v1")) {
      await env.DB.prepare("ALTER TABLE users ADD COLUMN win_1v1v1 INTEGER DEFAULT 0").run();
    } else {
      throw error;
    }
  }
}
__name(ensureTripleWinColumn, "ensureTripleWinColumn");
async function ensureModeWinColumn(env, column) {
  await ensureUsersTable(env);
  try {
    await env.DB.prepare(`SELECT ${column} FROM users LIMIT 1`).first();
  } catch (error) {
    const message = String(error?.message || error);
    if (message.includes(`no such column: ${column}`) || message.includes(`has no column named ${column}`)) {
      await env.DB.prepare(`ALTER TABLE users ADD COLUMN ${column} INTEGER DEFAULT 0`).run();
    } else {
      throw error;
    }
  }
}
__name(ensureModeWinColumn, "ensureModeWinColumn");
function getWinColumn(mode) {
  if (mode === "triple") return "win_1v1v1";
  if (mode === "stealing") return "wins_stealing";
  if (mode === "anti-connect") return "wins_anti_connect_four";
  return "win";
}
__name(getWinColumn, "getWinColumn");
function getGamesColumn(mode) {
  if (mode === "triple") return "games_triple";
  if (mode === "stealing") return "games_stealing";
  if (mode === "anti-connect") return "games_anti_connect_four";
  return "games_classic";
}
__name(getGamesColumn, "getGamesColumn");
async function ensureGamesColumn(env, column) {
  await ensureUsersTable(env);
  try {
    await env.DB.prepare(`SELECT ${column} FROM users LIMIT 1`).first();
  } catch (error) {
    const message = String(error?.message || error);
    if (message.includes(`no such column: ${column}`) || message.includes(`has no column named ${column}`)) {
      await env.DB.prepare(`ALTER TABLE users ADD COLUMN ${column} INTEGER DEFAULT 0`).run();
    } else {
      throw error;
    }
  }
}
__name(ensureGamesColumn, "ensureGamesColumn");
async function ensureWinModeColumn(env, mode) {
  const column = getWinColumn(mode);
  if (column === "win") await ensureWinColumn(env);
  else if (column === "win_1v1v1") await ensureTripleWinColumn(env);
  else await ensureModeWinColumn(env, column);
  await ensureGamesColumn(env, getGamesColumn(mode));
}
__name(ensureWinModeColumn, "ensureWinModeColumn");
async function recordGameResult(env, userId, username, mode, result) {
  await ensureUsersTable(env);
  const column = getWinColumn(mode);
  const gamesColumn = getGamesColumn(mode);
  await ensureWinModeColumn(env, mode);
  const target = String(userId || "").trim();
  const loginIdentifier = String(username || "").trim();
  const where = target ? "id = ?" : "username = ? OR email = ?";
  const values = target ? [target] : [loginIdentifier, loginIdentifier];
  if (!target && !loginIdentifier) return 0;
  const gameResult = await env.DB.prepare(`UPDATE users SET ${gamesColumn} = ${gamesColumn} + 1${result === "win" ? `, ${column} = ${column} + 1` : ""} WHERE ${where}`).bind(...values).run();
  return Number(gameResult?.meta?.changes ?? 0);
}
__name(recordGameResult, "recordGameResult");
async function insertUser(env, username, email, passwordHash) {
  await ensureUsersTable(env);
  await ensurePasswordColumn(env);
  await ensureWinColumn(env);
  await ensureTripleWinColumn(env);
  await ensureModeWinColumn(env, "wins_stealing");
  await ensureModeWinColumn(env, "wins_anti_connect_four");
  await ensureGamesColumn(env, "games_classic");
  await ensureGamesColumn(env, "games_triple");
  await ensureGamesColumn(env, "games_stealing");
  await ensureGamesColumn(env, "games_anti_connect_four");
  try {
    const result = await env.DB.prepare(
      `INSERT INTO users (username, email, password, win, win_1v1v1, wins_stealing, wins_anti_connect_four, games_classic, games_triple, games_stealing, games_anti_connect_four)
       VALUES (?, ?, ?, 0, 0, 0, 0, 0, 0, 0, 0)`
    ).bind(username, email, passwordHash).run();
    return Number(result?.meta?.last_row_id ?? result?.last_row_id ?? 0);
  } catch (error) {
    const message = String(error?.message || error);
    if (message.includes("no such column: password") || message.includes("has no column named password")) {
      await env.DB.prepare("ALTER TABLE users ADD COLUMN password TEXT").run();
      try {
        await env.DB.prepare("ALTER TABLE users ADD COLUMN win INTEGER DEFAULT 0").run();
      } catch {
      }
      const result = await env.DB.prepare(
        `INSERT INTO users (username, email, password, win, win_1v1v1, wins_stealing, wins_anti_connect_four, games_classic, games_triple, games_stealing, games_anti_connect_four)
         VALUES (?, ?, ?, 0, 0, 0, 0, 0, 0, 0, 0)`
      ).bind(username, email, passwordHash).run();
      return Number(result?.meta?.last_row_id ?? result?.last_row_id ?? 0);
    }
    if (message.includes("UNIQUE") || message.includes("already exists") || message.includes("constraint failed")) {
      throw new Error("User already exists");
    }
    throw error;
  }
}
__name(insertUser, "insertUser");
var worker_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const isSignupRoute = (url.pathname === "/signup" || url.pathname === "/api/signup") && request.method === "POST";
    const isSigninRoute = (url.pathname === "/signin" || url.pathname === "/api/signin") && request.method === "POST";
    const isWinRoute = (url.pathname === "/game/win" || url.pathname === "/api/game/win") && request.method === "POST";
    const isLeaderboardRoute = (url.pathname === "/game/leaderboard" || url.pathname === "/api/game/leaderboard") && request.method === "GET";
    const isAdminUsersRoute = (url.pathname === "/admin/users" || url.pathname === "/api/admin/users") && request.method === "GET";
    const isAdminUpdateRoute = (url.pathname === "/admin/users/update" || url.pathname === "/api/admin/users/update") && request.method === "POST" || url.pathname.match(/^\/(api\/)?admin\/users\/\d+$/) && (request.method === "PUT" || request.method === "PATCH" || request.method === "POST");
    const isAdminDeleteRoute = (url.pathname === "/admin/users/delete" || url.pathname === "/api/admin/users/delete") && (request.method === "POST" || request.method === "DELETE") || url.pathname.match(/^\/(api\/)?admin\/users\/\d+(\/(score|gold|score-gold))?$/) && request.method === "DELETE";
    const isAdminApiRoute = isAdminUsersRoute || isAdminUpdateRoute || isAdminDeleteRoute;
    if (isAdminApiRoute) {
      try {
        await ensureUsersTable(env);
        if (!await verifyAdminToken(env.DB, getAdminToken(request))) {
          return new Response(JSON.stringify({ error: "Admin sign-in required" }), { status: 401 });
        }
      } catch {
        return new Response(JSON.stringify({ error: "Could not verify admin access" }), { status: 500 });
      }
    }
    if (isSignupRoute) {
      try {
        await ensureUsersTable(env);
        let body = {};
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400 });
        }
        const { username, email, password } = body || {};
        const cleanUsername = String(username || "").trim();
        const cleanEmail = String(email || "").trim().toLowerCase();
        if (!cleanUsername || !cleanEmail || !password) {
          return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400 });
        }
        const passwordHash = await hashPassword(String(password));
        try {
          const id = await insertUser(env, cleanUsername, cleanEmail, passwordHash);
          return new Response(JSON.stringify({ id, username: cleanUsername, email: cleanEmail }), { status: 201 });
        } catch (e) {
          if (e?.message === "User already exists") {
            return new Response(JSON.stringify({ error: "User already exists" }), { status: 409 });
          }
          throw e;
        }
      } catch (err) {
        return new Response(JSON.stringify({ error: "Invalid request", details: String(err) }), { status: 400 });
      }
    }
    if (isSigninRoute) {
      try {
        await ensureUsersTable(env);
        let body = {};
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400 });
        }
        const { username, email, password } = body || {};
        const loginIdentifier = String(username || email || "").trim();
        if (!loginIdentifier || !password) {
          return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400 });
        }
        await ensurePasswordColumn(env);
        await ensureWinColumn(env);
        const user = await env.DB.prepare(
          "SELECT id, username, email, password, win, isAdmin FROM users WHERE username = ?1 OR email = ?2 LIMIT 1"
        ).bind(loginIdentifier, loginIdentifier).first();
        if (!user) {
          return new Response(JSON.stringify({ error: "Invalid username/email or password" }), { status: 401 });
        }
        const submittedPasswordHash = await hashPassword(String(password));
        if (submittedPasswordHash !== user.password) {
          return new Response(JSON.stringify({ error: "Invalid username/email or password" }), { status: 401 });
        }
        const isAdmin = Number(user.isAdmin) === 1;
        const adminToken = isAdmin ? await createAdminToken(user.id, user.password) : void 0;
        return new Response(JSON.stringify({ id: user.id, username: user.username, email: user.email, wins: user.win ?? 0, isAdmin, adminToken }), { status: 200 });
      } catch (err) {
        return new Response(JSON.stringify({ error: "Invalid request", details: String(err) }), { status: 400 });
      }
    }
    if (isWinRoute) {
      try {
        await ensureUsersTable(env);
        let body = {};
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400 });
        }
        const userId = String(body?.userId || "").trim();
        const username = String(body?.username || "").trim();
        const email = String(body?.email || "").trim();
        const mode = body?.mode === "triple" || body?.mode === "stealing" || body?.mode === "anti-connect" ? body.mode : "classic";
        if (!userId && !username && !email) {
          return new Response(JSON.stringify({ error: "Missing user identifier" }), { status: 400 });
        }
        const result = body?.result === "loss" || body?.result === "draw" ? body.result : "win";
        const changes = await recordGameResult(env, userId || null, username || email || void 0, mode, result);
        return new Response(JSON.stringify({ success: true, changed: changes > 0, wins: changes }), { status: 200 });
      } catch (err) {
        return new Response(JSON.stringify({ error: "Invalid request", details: String(err) }), { status: 400 });
      }
    }
    if (isLeaderboardRoute) {
      try {
        await ensureUsersTable(env);
        const requestedMode = url.searchParams.get("mode");
        const mode = requestedMode === "triple" || requestedMode === "stealing" || requestedMode === "anti-connect" ? requestedMode : "classic";
        const column = getWinColumn(mode);
        const gamesColumn = getGamesColumn(mode);
        await ensureWinModeColumn(env, mode);
        const result = await env.DB.prepare(`SELECT id, username, email, ${column}, ${gamesColumn} FROM users ORDER BY ${column} DESC`).all();
        const rows = Array.isArray(result) ? result : Array.isArray(result?.results) ? result.results : [];
        const entries = (Array.isArray(rows) ? rows : []).map((row) => ({
          id: String(row.id ?? ""),
          username: String(row.username ?? ""),
          win: Number(row[column] ?? 0),
          games: Number(row[gamesColumn] ?? 0)
        }));
        return new Response(JSON.stringify({ entries }), { status: 200, headers: { "Content-Type": "application/json" } });
      } catch (err) {
        return new Response(JSON.stringify({ error: "Failed to load leaderboard", details: String(err) }), { status: 500, headers: { "Content-Type": "application/json" } });
      }
    }
    if (isAdminUsersRoute) {
      try {
        await ensureUsersTable(env);
        await ensurePasswordColumn(env);
        await ensureWinColumn(env);
        await ensureTripleWinColumn(env);
        await ensureModeWinColumn(env, "wins_stealing");
        await ensureModeWinColumn(env, "wins_anti_connect_four");
        await ensureGamesColumn(env, "games_classic");
        await ensureGamesColumn(env, "games_triple");
        await ensureGamesColumn(env, "games_stealing");
        await ensureGamesColumn(env, "games_anti_connect_four");
        await ensureScoreColumn(env);
        await ensureGoldColumn(env);
        const result = await env.DB.prepare("SELECT * FROM users ORDER BY id ASC").all();
        const rows = Array.isArray(result) ? result : Array.isArray(result?.results) ? result.results : [];
        return new Response(JSON.stringify({ users: rows }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: "Failed to load users", details: String(err) }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
    }
    if (isAdminUpdateRoute) {
      try {
        await ensureUsersTable(env);
        await ensureScoreColumn(env);
        await ensureGoldColumn(env);
        let body = {};
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400 });
        }
        const pathParts = url.pathname.split("/").filter(Boolean);
        const lastPart = pathParts[pathParts.length - 1];
        const idFromPath = lastPart !== "update" && lastPart !== "users" ? lastPart : null;
        const userId = idFromPath || body?.id || body?.userId;
        if (!userId) {
          return new Response(JSON.stringify({ error: "Missing user id" }), { status: 400 });
        }
        const updates = [];
        const values = [];
        if (body.score !== void 0) {
          const numScore = Number(body.score);
          if (isNaN(numScore)) {
            return new Response(JSON.stringify({ error: "Score must be a number" }), { status: 400 });
          }
          updates.push("score = ?");
          values.push(numScore);
        }
        if (body.gold !== void 0) {
          const numGold = Number(body.gold);
          if (isNaN(numGold)) {
            return new Response(JSON.stringify({ error: "Gold must be a number" }), { status: 400 });
          }
          updates.push("gold = ?");
          values.push(numGold);
        }
        if (updates.length === 0) {
          return new Response(JSON.stringify({ error: "Only score and gold column updates are supported" }), { status: 400 });
        }
        values.push(userId);
        await env.DB.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).bind(...values).run();
        const updatedUser = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first();
        return new Response(JSON.stringify({ success: true, user: updatedUser }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: "Failed to update user", details: String(err) }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
    }
    if (isAdminDeleteRoute) {
      try {
        await ensureUsersTable(env);
        await ensureScoreColumn(env);
        await ensureGoldColumn(env);
        let body = {};
        try {
          body = await request.json();
        } catch {
          body = {};
        }
        const pathParts = url.pathname.split("/").filter(Boolean);
        const lastPart = pathParts[pathParts.length - 1];
        const secondToLast = pathParts[pathParts.length - 2];
        const targetFromPath = lastPart === "score" || lastPart === "gold" || lastPart === "score-gold" ? lastPart : null;
        const idFromPath = targetFromPath && secondToLast ? secondToLast : lastPart !== "delete" ? lastPart : null;
        const userId = idFromPath || body?.id || body?.userId;
        if (!userId) {
          return new Response(JSON.stringify({ error: "Missing user id" }), { status: 400 });
        }
        const target = targetFromPath || body?.target || "both";
        if (target === "score") {
          await env.DB.prepare("UPDATE users SET score = 0 WHERE id = ?").bind(userId).run();
        } else if (target === "gold") {
          await env.DB.prepare("UPDATE users SET gold = 0 WHERE id = ?").bind(userId).run();
        } else {
          await env.DB.prepare("UPDATE users SET score = 0, gold = 0 WHERE id = ?").bind(userId).run();
        }
        const updatedUser = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first();
        return new Response(JSON.stringify({ success: true, user: updatedUser }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: "Failed to reset score/gold", details: String(err) }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
    }
    return new Response("Not found", { status: 404 });
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// .wrangler/tmp/bundle-EWX2pS/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default
];
var middleware_insertion_facade_default = worker_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-EWX2pS/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=worker.js.map
