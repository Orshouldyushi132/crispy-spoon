import { clearAdminSession, clearOauthState, readOauthState, writeAdminSession } from "../../../_lib/session.js";
import { isDiscordConfigured } from "../../../_lib/admin-backend.js";

function redirectResponse(location, headers = new Headers()) {
  headers.set("Location", location);
  return new Response(null, { status: 302, headers });
}

export const onRequestGet = async (context) => {
  const requestUrl = new URL(context.request.url);
  const redirectBase = `${requestUrl.origin}/admin.html`;
  if (!isDiscordConfigured(context.env)) {
    return redirectResponse(`${redirectBase}?discord_error=${encodeURIComponent("Discord認証の設定が未完了です")}`);
  }

  const code = requestUrl.searchParams.get("code") || "";
  const state = requestUrl.searchParams.get("state") || "";
  const stateCookie = readOauthState(context.request);
  if (!code || !state || state !== stateCookie) {
    const headers = new Headers();
    clearOauthState(headers);
    clearAdminSession(headers);
    return redirectResponse(`${redirectBase}?discord_error=${encodeURIComponent("Discord認証の確認に失敗しました")}`, headers);
  }

  const redirectUri = context.env.DISCORD_REDIRECT_URI || `${requestUrl.origin}/api/admin/discord/callback`;
  try {
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: context.env.DISCORD_CLIENT_ID,
        client_secret: context.env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });
    if (!tokenResponse.ok) {
      throw new Error(await tokenResponse.text());
    }
    const tokenData = await tokenResponse.json();
    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });
    if (!userResponse.ok) {
      throw new Error(await userResponse.text());
    }
    const user = await userResponse.json();
    const headers = new Headers();
    clearOauthState(headers);
    clearAdminSession(headers);
    await writeAdminSession(headers, context.env, {
      discordUser: {
        id: user.id,
        username: user.username,
        global_name: user.global_name || "",
        avatar: user.avatar || "",
      },
      reviewUnlocked: false,
      authorizedAt: new Date().toISOString(),
      unlockedAt: null,
    });
    return redirectResponse(`${redirectBase}?discord=connected`, headers);
  } catch {
    const headers = new Headers();
    clearOauthState(headers);
    clearAdminSession(headers);
    return redirectResponse(`${redirectBase}?discord_error=${encodeURIComponent("Discord認証に失敗しました")}`, headers);
  }
};
