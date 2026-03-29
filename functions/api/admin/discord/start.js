import { errorResponse, isDiscordConfigured } from "../../../_lib/admin-backend.js";
import { createOauthState, writeOauthState } from "../../../_lib/session.js";

export const onRequestGet = async (context) => {
  if (!isDiscordConfigured(context.env)) {
    return errorResponse("Discord認証の環境変数が未設定です。", 500);
  }
  const requestUrl = new URL(context.request.url);
  const redirectUri = context.env.DISCORD_REDIRECT_URI || `${requestUrl.origin}/api/admin/discord/callback`;
  const state = createOauthState();
  const authorizeUrl = new URL("https://discord.com/oauth2/authorize");
  authorizeUrl.search = new URLSearchParams({
    response_type: "code",
    client_id: context.env.DISCORD_CLIENT_ID,
    scope: "identify",
    redirect_uri: redirectUri,
    state,
    prompt: "consent",
  }).toString();
  const headers = new Headers({ Location: authorizeUrl.toString() });
  writeOauthState(headers, state);
  return new Response(null, { status: 302, headers });
};
