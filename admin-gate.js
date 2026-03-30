(function () {
  const gate = document.getElementById("adminGate");
  const shell = document.getElementById("adminShell");
  const form = document.getElementById("adminGateForm");
  const password = document.getElementById("adminGatePassword");
  const status = document.getElementById("adminGateStatus");
  const scripts = ["./pickers.js?v=6", "./motion.js?v=2", "./admin.js?v=20"];
  let scriptsLoaded = false;

  if (!gate || !shell || !form || !password || !status) return;

  const setStatus = (message, type = "") => {
    status.textContent = message;
    status.className = `status ${type}`.trim();
  };

  const loadScripts = async () => {
    if (scriptsLoaded) return;
    for (const src of scripts) {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = src;
        script.onload = resolve;
        script.onerror = () => reject(new Error(`${src} の読み込みに失敗しました。`));
        document.body.appendChild(script);
      });
    }
    scriptsLoaded = true;
  };

  const api = async (init = {}) => {
    const response = await fetch("/api/admin/gate", {
      credentials: "same-origin",
      ...init,
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers || {}),
      },
    });
    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json") ? await response.json() : await response.text();
    if (!response.ok) {
      throw new Error(typeof payload === "string" ? payload : payload?.error || payload?.message || `HTTP ${response.status}`);
    }
    return payload;
  };

  const showGate = () => {
    gate.hidden = false;
    shell.hidden = true;
  };

  const unlockShell = async () => {
    gate.hidden = true;
    shell.hidden = false;
    await loadScripts();
  };

  const syncGate = async () => {
    try {
      const payload = await api();
      if (payload?.gateUnlocked) {
        setStatus("");
        await unlockShell();
        return;
      }
      showGate();
      password.focus();
    } catch (error) {
      showGate();
      setStatus(error.message || String(error), "err");
    }
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await api({
        method: "POST",
        body: JSON.stringify({ password: String(password.value || "") }),
      });
      password.value = "";
      setStatus("");
      await unlockShell();
    } catch (error) {
      showGate();
      setStatus(error.message || String(error), "err");
      password.focus();
      password.select();
    }
  });

  syncGate();
}());
