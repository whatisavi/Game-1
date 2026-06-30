interface Env {
  DB: D1Database; // Strong typing instead of any
}

// Utility helper to convert an ArrayBuffer to a Hex String
function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Securely hash a password using PBKDF2 (Native to Cloudflare Workers V8 engine)
async function hashPassword(password: string): Promise<{ hashHex: string; saltHex: string }> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16)); // Generate random 128-bit salt
  
  const baseKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );

  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000, // OWASP recommended minimum for SHA-256
      hash: "SHA-256",
    },
    baseKey,
    { name: "HMAC", hash: "SHA-256", length: 256 },
    true,
    ["sign"]
  );

  const exportedKey = await crypto.subtle.exportKey("raw", derivedKey);

  return {
    hashHex: bufferToHex(exportedKey),
    saltHex: bufferToHex(salt.buffer),
  };
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

    // 1. Sanitization & Validation
    if (!username || !email || !password) {
      return new Response(
        JSON.stringify({ error: "Username, email, and password are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (cleanUsername.length < 3) {
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

    // 2. Check existing user (Fixing the invalid COLLATE placement)
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

    // 3. Hash password using secure PBKDF2
    const { hashHex, saltHex } = await hashPassword(password);
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    // 4. Write back to database (Make sure your schema has a salt column!)
    await env.DB.prepare(
      `INSERT INTO users (id, username, email, password_hash, salt, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(id, cleanUsername, cleanEmail, hashHex, saltHex, createdAt)
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