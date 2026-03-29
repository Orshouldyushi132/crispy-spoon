import { errorResponse, HttpError, jsonResponse, mutateEntry, requireUnlockedSession } from "../../_lib/admin-backend.js";

export const onRequestPost = async (context) => {
  try {
    await requireUnlockedSession(context.request, context.env);
    const body = await context.request.json().catch(() => ({}));
    const result = await mutateEntry(context.env, body);
    return jsonResponse(result);
  } catch (error) {
    if (error instanceof HttpError) {
      return errorResponse(error.message, error.status);
    }
    return errorResponse("参加登録の処理に失敗しました。", 500);
  }
};
