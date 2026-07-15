interface Env {
  DB: D1Database;
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(password));
  return bufferToHex(digest);
}

async function insertUser(env: Env['DB'], username: string, email: string, passwordHash: string) {
  try {
    const result = await env.prepare(
      `INSERT INTO users (username, email, password)
       VALUES (?, ?, ?)`
    ).bind(username, email, passwordHash).run();
    return Number(result?.meta?.last_row_id ?? result?.last_row_id ?? 0);
  } catch (error: any) {
    const message = String(error?.message || error);
    if (message.includes("no such column: password") || message.includes("has no column named password")) {
      await env.prepare("ALTER TABLE users ADD COLUMN password TEXT").run();
      const result = await env.prepare(
        `INSERT INTO users (username, email, password)
         VALUES (?, ?, ?)`
      ).bind(username, email, passwordHash).run();
      return Number(result?.meta?.last_row_id ?? result?.last_row_id ?? 0);
    }

    if (message.includes("UNIQUE") || message.includes("already exists") || message.includes("constraint failed")) {
      throw new Error("User already exists");
    }

    throw error;
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (!env.DB) {
    return new Response(
      JSON.stringify({ error: "Database binding 'DB' is missing" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const body: any = await request.json();
    const { username, email, password } = body || {};

    if (!username || !email || !password) {
      return new Response(
        JSON.stringify({ error: "Username, email, and password are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const cleanUsername = String(username).trim();
    const cleanEmail = String(email).trim().toLowerCase();

    if (cleanUsername.length < 3) {
      return new Response(
        JSON.stringify({ error: "Username must be at least 3 characters long" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (String(password).length < 6) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 6 characters long" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const existingUser = await env.DB.prepare(
      "SELECT id FROM users WHERE username = ?1 OR email = ?2 LIMIT 1"
    )
      .bind(cleanUsername, cleanEmail)
      .first<{ id: string } | null>();

    if (existingUser) {
      return new Response(
        JSON.stringify({ error: "Username or email is already registered" }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }

    const passwordHash = await hashPassword(String(password));

    try {
      const id = await insertUser(env.DB, cleanUsername, cleanEmail, passwordHash);
      return new Response(
        JSON.stringify({
          id,
          username: cleanUsername,
          email: cleanEmail,
        }),
        { status: 201, headers: { "Content-Type": "application/json" } }
      );
    } catch (err: any) {
      if (err?.message === "User already exists") {
        return new Response(
          JSON.stringify({ error: "Username or email is already registered" }),
          { status: 409, headers: { "Content-Type": "application/json" } }
        );
      }
      throw err;
    }

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(err.message || err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};