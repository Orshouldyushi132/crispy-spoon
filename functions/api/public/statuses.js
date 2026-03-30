import { errorResponse, getPublicEntryStatuses, HttpError, jsonResponse } from "../../_lib/admin-backend.js";

export const onRequestPost = async (context) => {
  try {
    const body = await context.request.json().catch(() => ({}));
    const result = await getPublicEntryStatuses(context.env, context.request, body?.ids || []);
    return jsonResponse(result);
  } catch (error) {
    if (error instanceof HttpError) {
      return errorResponse(error.message, error.status);
    }
    return errorResponse("Entry status lookup failed.", 500);
  }
};
