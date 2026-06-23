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

    // Allow user to supply email or username in the "username" field or as separate fields
    const loginIdentifier = (username || email || "").trim();

    if (!loginIdentifier || !password) {
      return new Response(
        JSON.stringify({ error: "Username or email, and password are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Ensure database table exists in case signin is called first (unlikely but safe)
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE,
        email TEXT UNIQUE,
        password_hash TEXT,
        created_at TEXT
      )`
    ).run();

    // Query for the user by username or email
    const user: any = await env.DB.prepare(
      "SELECT id, username, email, password_hash, created_at FROM users WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE LIMIT 1"
    )
      .bind(loginIdentifier, loginIdentifier)
      .first();

    if (!user) {
      return new Response(
        JSON.stringify({ error: "Invalid username/email or password" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Hash the incoming password to compare
    const pwBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", pwBuffer);
    const hashHex = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    if (hashHex !== user.password_hash) {
      return new Response(
        JSON.stringify({ error: "Invalid username/email or password" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        id: user.id,
        username: user.username,
        email: user.email,
        createdAt: user.created_at,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(err.message || err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
