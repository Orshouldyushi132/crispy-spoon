import { errorResponse, HttpError, jsonResponse, mutateOfficial, requireUnlockedSession } from "../../_lib/admin-backend.js";

export const onRequestPost = async (context) => {
  try {
    await requireUnlockedSession(context.request, context.env);
    const body = await context.request.json().catch(() => ({}));
    const result = await mutateOfficial(context.env, body);
    return jsonResponse(result);
  } catch (error) {
    if (error instanceof HttpError) {
      return errorResponse(error.message, error.status);
    }
    return errorResponse("公式予定の処理に失敗しました。", 500);
  }
};
