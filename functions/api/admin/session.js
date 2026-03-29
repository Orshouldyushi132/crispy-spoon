import { getDiscordConfigState, isAdminApiConfigured, jsonResponse, publicSession } from "../../_lib/admin-backend.js";
import { readAdminSession } from "../../_lib/session.js";

export const onRequestGet = async (context) => {
  const configured = isAdminApiConfigured(context.env);
  const discordConfig = getDiscordConfigState(context.env);
  const session = discordConfig.configured ? await readAdminSession(context.request, context.env).catch(() => null) : null;
  return jsonResponse({
    ok: true,
    configured,
    discordConfigured: discordConfig.configured,
    missingDiscordEnv: discordConfig.missing,
    session: publicSession(session),
  });
};
