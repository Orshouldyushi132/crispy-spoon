import { errorResponse, HttpError, jsonResponse, requireUnlockedSession, saveSettings } from "../../_lib/admin-backend.js";

export const onRequestPost = async (context) => {
  try {
    await requireUnlockedSession(context.request, context.env);
    const body = await context.request.json().catch(() => ({}));
    const settings = await saveSettings(context.env, body);
    return jsonResponse({ ok: true, settings });
  } catch (error) {
    if (error instanceof HttpError) {
      return errorResponse(error.message, error.status);
    }
    return errorResponse("設定保存に失敗しました。", 500);
  }
};
