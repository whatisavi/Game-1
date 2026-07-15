interface Env {
  DB: any;
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

async function ensurePasswordColumn(env: Env['DB']) {
  try {
    await env.prepare("SELECT password FROM users LIMIT 1").first();
  } catch (error: any) {
    const message = String(error?.message || error);
    if (message.includes("no such column: password") || message.includes("has no column named password")) {
      await env.prepare("ALTER TABLE users ADD COLUMN password TEXT").run();
    } else {
      throw error;
    }
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

    const loginIdentifier = String(username || email || "").trim();

    if (!loginIdentifier || !password) {
      return new Response(
        JSON.stringify({ error: "Username or email, and password are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    await ensurePasswordColumn(env.DB);

    const user: any = await env.DB.prepare(
      "SELECT id, username, email, password FROM users WHERE username = ?1 OR email = ?2 LIMIT 1"
    )
      .bind(loginIdentifier, loginIdentifier)
      .first();

    if (!user) {
      return new Response(
        JSON.stringify({ error: "Invalid username/email or password" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const submittedPasswordHash = await hashPassword(String(password));

    if (submittedPasswordHash !== user.password) {
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
