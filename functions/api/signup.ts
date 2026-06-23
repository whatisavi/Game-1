interface Env {
  DB: any; // D1Database
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

    if (username.trim().length < 3) {
      return new Response(
        JSON.stringify({ error: "Username must be at least 3 characters long" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 6 characters long" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Ensure database table exists
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE,
        email TEXT UNIQUE,
        password_hash TEXT,
        created_at TEXT
      )`
    ).run();

    // Check if user already exists
    const existingUser = await env.DB.prepare(
      "SELECT id FROM users WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE LIMIT 1"
    )
      .bind(username.trim(), email.trim())
      .first();

    if (existingUser) {
      return new Response(
        JSON.stringify({ error: "Username or email is already registered" }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }

    // Hash password using Web Crypto API (SHA-256)
    const pwBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", pwBuffer);
    const hashHex = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();

    await env.DB.prepare(
      `INSERT INTO users (id, username, email, password_hash, created_at)
       VALUES (?, ?, ?, ?, ?)`
    )
      .bind(id, cleanUsername, cleanEmail, hashHex, createdAt)
      .run();

    return new Response(
      JSON.stringify({
        id,
        username: cleanUsername,
        email: cleanEmail,
        createdAt,
      }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(err.message || err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
