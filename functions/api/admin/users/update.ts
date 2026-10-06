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

    const updates: string[] = [];
    const values: number[] = [];
    for (const field of ["score", "gold"] as const) {
      if (body[field] !== undefined) {
        const value = Number(body[field]);
        if (!Number.isFinite(value)) return Response.json({ error: `${field} must be a number` }, { status: 400 });
        updates.push(`${field} = ?`);
        values.push(value);
      }
    }
    if (updates.length === 0) return Response.json({ error: "Only score and gold updates are supported" }, { status: 400 });

    await env.DB.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).bind(...values, userId).run();
    const user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first();
    return Response.json({ success: true, user });
  } catch {
    return Response.json({ error: "Failed to update user" }, { status: 500 });
  }
};