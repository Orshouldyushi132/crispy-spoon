import { errorResponse, getPublicSnapshot, HttpError, jsonResponse } from "../../_lib/admin-backend.js";

export const onRequestGet = async (context) => {
  try {
    const snapshot = await getPublicSnapshot(context.env);
    return jsonResponse(snapshot);
  } catch (error) {
    if (error instanceof HttpError) {
      return errorResponse(error.message, error.status);
    }
    return errorResponse("公開データの取得に失敗しました。", 500);
  }
};
