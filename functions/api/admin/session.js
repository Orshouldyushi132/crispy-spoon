import { isAdminApiConfigured, isDiscordConfigured, jsonResponse, publicSession } from "../../_lib/admin-backend.js";
import { readAdminSession } from "../../_lib/session.js";

export const onRequestGet = async (context) => {
  const configured = isAdminApiConfigured(context.env);
  const discordConfigured = isDiscordConfigured(context.env);
  const session = discordConfigured ? await readAdminSession(context.request, context.env).catch(() => null) : null;
  return jsonResponse({
    ok: true,
    configured,
    discordConfigured,
    session: publicSession(session),
  });
};
