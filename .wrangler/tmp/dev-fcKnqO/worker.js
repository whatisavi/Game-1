var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/worker.ts
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(password));
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(hashPassword, "hashPassword");
async function ensurePasswordColumn(env) {
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
async function incrementUserWin(env, userId, username) {
  await ensureWinColumn(env);
  const target = String(userId || "").trim();
  const loginIdentifier = String(username || "").trim();
  if (target) {
    const result = await env.DB.prepare("UPDATE users SET win = win + 1 WHERE id = ?").bind(target).run();
    return Number(result?.meta?.changes ?? 0);
  }
  if (loginIdentifier) {
    const result = await env.DB.prepare("UPDATE users SET win = win + 1 WHERE username = ? OR email = ?").bind(loginIdentifier, loginIdentifier).run();
    return Number(result?.meta?.changes ?? 0);
  }
  return 0;
}
__name(incrementUserWin, "incrementUserWin");
async function insertUser(env, username, email, passwordHash) {
  await ensurePasswordColumn(env);
  await ensureWinColumn(env);
  try {
    const result = await env.DB.prepare(
      `INSERT INTO users (username, email, password, win)
       VALUES (?, ?, ?, 0)`
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
        `INSERT INTO users (username, email, password, win)
         VALUES (?, ?, ?, 0)`
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
    if (isSignupRoute) {
      try {
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
          "SELECT id, username, email, password, win FROM users WHERE username = ?1 OR email = ?2 LIMIT 1"
        ).bind(loginIdentifier, loginIdentifier).first();
        if (!user) {
          return new Response(JSON.stringify({ error: "Invalid username/email or password" }), { status: 401 });
        }
        const submittedPasswordHash = await hashPassword(String(password));
        if (submittedPasswordHash !== user.password) {
          return new Response(JSON.stringify({ error: "Invalid username/email or password" }), { status: 401 });
        }
        return new Response(JSON.stringify({ id: user.id, username: user.username, email: user.email, wins: user.win ?? 0 }), { status: 200 });
      } catch (err) {
        return new Response(JSON.stringify({ error: "Invalid request", details: String(err) }), { status: 400 });
      }
    }
    if (isWinRoute) {
      try {
        let body = {};
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400 });
        }
        const userId = String(body?.userId || "").trim();
        const username = String(body?.username || "").trim();
        const email = String(body?.email || "").trim();
        if (!userId && !username && !email) {
          return new Response(JSON.stringify({ error: "Missing user identifier" }), { status: 400 });
        }
        const changes = await incrementUserWin(env, userId || null, username || email || void 0);
        return new Response(JSON.stringify({ success: true, changed: changes > 0, wins: changes }), { status: 200 });
      } catch (err) {
        return new Response(JSON.stringify({ error: "Invalid request", details: String(err) }), { status: 400 });
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

// .wrangler/tmp/bundle-jazyaE/middleware-insertion-facade.js
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

// .wrangler/tmp/bundle-jazyaE/middleware-loader.entry.ts
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
