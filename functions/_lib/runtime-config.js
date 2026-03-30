const RUNTIME_CACHE = new WeakMap();

const PLAIN_KEYS = [
  "SUPABASE_URL",
  "DISCORD_REDIRECT_URI",
];

const SECRET_KEYS = [
  "ADMIN_SESSION_SECRET",
  "ADMIN_GATE_PASSWORD",
  "ADMIN_REVIEW_PASSWORD",
  "DISCORD_CLIENT_ID",
  "DISCORD_CLIENT_SECRET",
  "SUPABASE_SERVICE_ROLE_KEY",
  "APPLICANT_LOOKUP_SECRET",
];

async function readBindingValue(binding) {
  if (binding == null) return "";
  if (typeof binding === "string") return binding.trim();
  if (typeof binding === "object" && typeof binding.get === "function") {
    const value = await binding.get();
    return typeof value === "string" ? value.trim() : String(value ?? "").trim();
  }
  return String(binding).trim();
}

export async function getRuntimeConfig(env) {
  if (RUNTIME_CACHE.has(env)) {
    return RUNTIME_CACHE.get(env);
  }

  const config = {};
  for (const key of [...PLAIN_KEYS, ...SECRET_KEYS]) {
    config[key] = await readBindingValue(env?.[key]);
  }

  RUNTIME_CACHE.set(env, config);
  return config;
}

export async function getConfigValue(env, key) {
  const config = await getRuntimeConfig(env);
  return String(config?.[key] || "").trim();
}
