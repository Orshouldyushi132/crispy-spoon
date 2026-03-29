import { errorResponse, getAdminSnapshot, HttpError, jsonResponse, requireUnlockedSession } from "../../_lib/admin-backend.js";

export const onRequestGet = async (context) => {
  try {
    await requireUnlockedSession(context.request, context.env);
    const snapshot = await getAdminSnapshot(context.env);
    return jsonResponse(snapshot);
  } catch (error) {
    if (error instanceof HttpError) {
      return errorResponse(error.message, error.status);
    }
    return errorResponse("管理データの取得に失敗しました。", 500);
  }
};
