import {
  errorResponse,
  getCrewSnapshot,
  HttpError,
  jsonResponse,
  requireLinkedSession,
  saveCrewAssignment,
} from "../../_lib/admin-backend.js";

export const onRequestGet = async (context) => {
  try {
    const session = await requireLinkedSession(context.request, context.env);
    const snapshot = await getCrewSnapshot(context.env, session);
    return jsonResponse(snapshot);
  } catch (error) {
    if (error instanceof HttpError) {
      return errorResponse(error.message, error.status);
    }
    return errorResponse("Crew snapshot failed.", 500);
  }
};

export const onRequestPost = async (context) => {
  try {
    const session = await requireLinkedSession(context.request, context.env);
    const body = await context.request.json().catch(() => ({}));
    const result = await saveCrewAssignment(context.env, session, body);
    return jsonResponse(result);
  } catch (error) {
    if (error instanceof HttpError) {
      return errorResponse(error.message, error.status);
    }
    return errorResponse("Crew assignment save failed.", 500);
  }
};
