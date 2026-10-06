import { getAdminToken, verifyAdminToken } from "../../../src/lib/adminAuth";

interface Env {
  DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.DB) return Response.json({ error: "Database binding 'DB' is missing" }, { status: 500 });

  try {
    if (!(await verifyAdminToken(env.DB, getAdminToken(request)))) {
      return Response.json({ error: "Admin sign-in required" }, { status: 401 });
    }
    const result = await env.DB.prepare("SELECT * FROM users ORDER BY id ASC").all();
    return Response.json({ users: result.results ?? [] });
  } catch {
    return Response.json({ error: "Failed to load users" }, { status: 500 });
  }
};