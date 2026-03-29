import { errorResponse, jsonResponse, publicSession } from "../../_lib/admin-backend.js";
import { readAdminSession, writeAdminSession } from "../../_lib/session.js";

export const onRequestPost = async (context) => {
  const session = await readAdminSession(context.request, context.env).catch(() => null);
  if (!session?.discordUser) {
    return errorResponse("先に Discord 認証を完了してください。", 401);
  }
  const body = await context.request.json().catch(() => ({}));
  const provided = String(body.password || "");
  const expected = context.env.ADMIN_REVIEW_PASSWORD || "SBTkome818MYY";
  if (provided !== expected) {
    return errorResponse("パスワードが違います。", 401);
  }
  const nextSession = {
    ...session,
    reviewUnlocked: true,
    unlockedAt: new Date().toISOString(),
  };
  const headers = new Headers();
  await writeAdminSession(headers, context.env, nextSession);
  return jsonResponse({ ok: true, session: publicSession(nextSession) }, { headers });
};
