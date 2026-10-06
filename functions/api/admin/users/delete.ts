import { getAdminToken, verifyAdminToken } from "../../../../src/lib/adminAuth";

interface Env {
  DB: D1Database;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.DB) return Response.json({ error: "Database binding 'DB' is missing" }, { status: 500 });

  try {
    if (!(await verifyAdminToken(env.DB, getAdminToken(request)))) {
      return Response.json({ error: "Admin sign-in required" }, { status: 401 });
    }

    const body: any = await request.json();
    const userId = body?.id ?? body?.userId;
    if (!userId) return Response.json({ error: "Missing user id" }, { status: 400 });

    const update = body?.target === "score"
      ? "UPDATE users SET score = 0 WHERE id = ?"
      : body?.target === "gold"
        ? "UPDATE users SET gold = 0 WHERE id = ?"
        : "UPDATE users SET score = 0, gold = 0 WHERE id = ?";
    await env.DB.prepare(update).bind(userId).run();
    const user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first();
    return Response.json({ success: true, user });
  } catch {
    return Response.json({ error: "Failed to reset score or gold" }, { status: 500 });
  }
};