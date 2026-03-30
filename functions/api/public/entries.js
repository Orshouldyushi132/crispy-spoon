import {
  createPublicEntry,
  errorResponse,
  HttpError,
  jsonResponse,
  updatePublicEntry,
} from "../../_lib/admin-backend.js";

export const onRequestPost = async (context) => {
  try {
    const body = await context.request.json().catch(() => ({}));
    const isUpdate = String(body?.action || "").trim() === "update";
    const result = isUpdate
      ? await updatePublicEntry(context.env, context.request, body)
      : await createPublicEntry(context.env, context.request, body);
    return jsonResponse(result, { status: isUpdate ? 200 : 201 });
  } catch (error) {
    if (error instanceof HttpError) {
      return errorResponse(error.message, error.status);
    }
    return errorResponse("参加登録の送信に失敗しました。", 500);
  }
};
