import { createPublicEntry, errorResponse, HttpError, jsonResponse } from "../../_lib/admin-backend.js";

export const onRequestPost = async (context) => {
  try {
    const body = await context.request.json().catch(() => ({}));
    const result = await createPublicEntry(context.env, context.request, body);
    return jsonResponse(result, { status: 201 });
  } catch (error) {
    if (error instanceof HttpError) {
      return errorResponse(error.message, error.status);
    }
    return errorResponse("参加登録の送信に失敗しました。", 500);
  }
};
