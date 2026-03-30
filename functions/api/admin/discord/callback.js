import { clearAdminSession, clearOauthState, readOauthState, writeAdminSession } from "../../../_lib/session.js";
import { getDiscordConfigState, syncSessionReviewAccess } from "../../../_lib/admin-backend.js";
import { getRuntimeConfig } from "../../../_lib/runtime-config.js";

function redirectResponse(location, headers = new Headers()) {
  headers.set("Location", location);
  return new Response(null, { status: 302, headers });
}

export const onRequestGet = async (context) => {
  const requestUrl = new URL(context.request.url);
  const redirectBase = `${requestUrl.origin}/admin.html`;
  const config = await getRuntimeConfig(context.env);
  const discordConfig = await getDiscordConfigState(context.env);

  if (!discordConfig.configured) {
    return redirectResponse(`${redirectBase}?discord_error=${encodeURIComponent("Discord認証の設定がまだ足りません。")}`);
  }

  const code = requestUrl.searchParams.get("code") || "";
  const state = requestUrl.searchParams.get("state") || "";
  const stateCookie = readOauthState(context.request);

  if (!code || !state || state !== stateCookie) {
    const headers = new Headers();
    clearOauthState(headers);
    clearAdminSession(headers);
    return redirectResponse(`${redirectBase}?discord_error=${encodeURIComponent("Discord認証の照合に失敗しました。もう一度お試しください。")}`, headers);
  }

  const redirectUri = config.DISCORD_REDIRECT_URI || `${requestUrl.origin}/api/admin/discord/callback`;

  try {
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: config.DISCORD_CLIENT_ID,
        client_secret: config.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error(await tokenResponse.text());
    }

    const tokenData = await tokenResponse.json();
    const userResponse = await fetch("https://discord.com/api/v10/users/@me", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!userResponse.ok) {
      throw new Error(await userResponse.text());
    }

    const user = await userResponse.json();
    const authorizedAt = new Date().toISOString();
    const session = await syncSessionReviewAccess({
      discordUser: {
        id: user.id,
        username: user.username,
        global_name: user.global_name || "",
        avatar: user.avatar || "",
      },
      discordAccessToken: tokenData.access_token,
      authorizedAt,
    }, context.env);

    const headers = new Headers();
    clearOauthState(headers);
    clearAdminSession(headers);
    await writeAdminSession(headers, context.env, session);

    return redirectResponse(`${redirectBase}?discord=connected`, headers);
  } catch {
    const headers = new Headers();
    clearOauthState(headers);
    clearAdminSession(headers);
    return redirectResponse(`${redirectBase}?discord_error=${encodeURIComponent("Discord認証に失敗しました。もう一度お試しください。")}`, headers);
  }
};
