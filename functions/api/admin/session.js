import { getDiscordConfigState, isAdminApiConfigured, jsonResponse, publicSession, syncSessionReviewAccess } from "../../_lib/admin-backend.js";
import { readAdminSession } from "../../_lib/session.js";

export const onRequestGet = async (context) => {
  const configured = await isAdminApiConfigured(context.env);
  const discordConfig = await getDiscordConfigState(context.env);
  const rawSession = discordConfig.configured ? await readAdminSession(context.request, context.env).catch(() => null) : null;
  const session = rawSession?.discordUser ? await syncSessionReviewAccess(rawSession, context.env) : rawSession;
  return jsonResponse({
    ok: true,
    configured,
    discordConfigured: discordConfig.configured,
    missingDiscordEnv: discordConfig.missing,
    reviewRoleConfigured: discordConfig.reviewConfigured,
    missingReviewEnv: discordConfig.missingReview,
    session: publicSession(session),
  });
};
