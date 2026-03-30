import { getDiscordConfigState } from "../../../_lib/admin-backend.js";
import { getRuntimeConfig } from "../../../_lib/runtime-config.js";
import { createOauthState, writeOauthState } from "../../../_lib/session.js";

export const onRequestGet = async (context) => {
  const requestUrl = new URL(context.request.url);
  const redirectBase = `${requestUrl.origin}/admin.html`;
  const config = await getRuntimeConfig(context.env);
  const discordConfig = await getDiscordConfigState(context.env);

  if (!discordConfig.configured) {
    const missing = discordConfig.missing.join(" / ") || "ADMIN_SESSION_SECRET / DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET";
    return Response.redirect(
      `${redirectBase}?discord_error=${encodeURIComponent(`Discord認証の設定がまだ足りません: ${missing}`)}`,
      302,
    );
  }

  const redirectUri = config.DISCORD_REDIRECT_URI || `${requestUrl.origin}/api/admin/discord/callback`;
  const state = createOauthState();
  const authorizeUrl = new URL("https://discord.com/oauth2/authorize");
  authorizeUrl.search = new URLSearchParams({
    response_type: "code",
    client_id: config.DISCORD_CLIENT_ID,
    scope: "identify",
    redirect_uri: redirectUri,
    state,
    prompt: "consent",
  }).toString();

  const headers = new Headers({ Location: authorizeUrl.toString() });
  writeOauthState(headers, state);
  return new Response(null, { status: 302, headers });
};
