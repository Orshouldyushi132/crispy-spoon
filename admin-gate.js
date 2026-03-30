(function () {
  const GATE_KEY = "kome_admin_gate_v1";
  const GATE_PASSWORD = "SBCM818defolove";
  const gate = document.getElementById("adminGate");
  const shell = document.getElementById("adminShell");
  const form = document.getElementById("adminGateForm");
  const password = document.getElementById("adminGatePassword");
  const status = document.getElementById("adminGateStatus");
  const scripts = ["./pickers.js?v=5", "./motion.js?v=2", "./admin.js?v=19"];

  if (!gate || !shell || !form || !password || !status) return;

  const setStatus = (message, type = "") => {
    status.textContent = message;
    status.className = `status ${type}`.trim();
  };

  const loadScripts = async () => {
    for (const src of scripts) {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = src;
        script.onload = resolve;
        script.onerror = () => reject(new Error(`${src} の読み込みに失敗しました。`));
        document.body.appendChild(script);
      });
    }
  };

  const unlock = async () => {
    sessionStorage.setItem(GATE_KEY, "ok");
    gate.hidden = true;
    shell.hidden = false;
    try {
      await loadScripts();
    } catch (error) {
      gate.hidden = false;
      shell.hidden = true;
      setStatus(error.message || String(error), "err");
    }
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (String(password.value || "") !== GATE_PASSWORD) {
      setStatus("パスワードが違います。", "err");
      password.focus();
      password.select();
      return;
    }
    setStatus("");
    await unlock();
  });

  if (sessionStorage.getItem(GATE_KEY) === "ok") {
    unlock();
  } else {
    gate.hidden = false;
    shell.hidden = true;
    password.focus();
  }
}());
