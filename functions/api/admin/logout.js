import { jsonResponse } from "../../_lib/admin-backend.js";
import { clearAdminSession, clearOauthState } from "../../_lib/session.js";

export const onRequestPost = async () => {
  const headers = new Headers();
  clearAdminSession(headers);
  clearOauthState(headers);
  return jsonResponse({ ok: true }, { headers });
};
