import { errorResponse, jsonResponse } from "../../_lib/admin-backend.js";
import { getConfigValue } from "../../_lib/runtime-config.js";
import { readAdminGate, writeAdminGate } from "../../_lib/session.js";

export const onRequestGet = async (context) => {
  try {
    const gate = await readAdminGate(context.request, context.env).catch(() => null);
    return jsonResponse({
      ok: true,
      gateUnlocked: Boolean(gate?.unlockedAt),
      unlockedAt: gate?.unlockedAt || null,
    }, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return errorResponse(error.message || "管理ゲートの状態確認に失敗しました。", 500);
  }
};

export const onRequestPost = async (context) => {
  try {
    const body = await context.request.json().catch(() => ({}));
    const provided = String(body.password || "");
    const expected = await getConfigValue(context.env, "ADMIN_GATE_PASSWORD");

    if (!expected) {
      return errorResponse("Cloudflare Secrets Store に ADMIN_GATE_PASSWORD を設定してください。", 500);
    }
    if (!provided) {
      return errorResponse("パスワードを入力してください。", 400);
    }
    if (provided !== expected) {
      return errorResponse("パスワードが違います。", 401);
    }

    const headers = new Headers({
      "Cache-Control": "no-store",
    });
    const gate = {
      unlockedAt: new Date().toISOString(),
    };
    await writeAdminGate(headers, context.env, gate);
    return jsonResponse({ ok: true, gateUnlocked: true, unlockedAt: gate.unlockedAt }, { headers });
  } catch (error) {
    return errorResponse(error.message || "管理ゲートの解錠に失敗しました。", 500);
  }
};
