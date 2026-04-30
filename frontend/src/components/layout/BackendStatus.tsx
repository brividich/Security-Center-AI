import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE_URL, API_TIMEOUT_MS } from "../../services/config";

type BackendState = "checking" | "online" | "auth" | "offline" | "restarting";

function labelForState(state: BackendState) {
  if (state === "online") return "API live";
  if (state === "auth") return "Login richiesto";
  if (state === "restarting") return "Riavvio...";
  if (state === "checking") return "Controllo...";
  return "API offline";
}

function classForState(state: BackendState) {
  if (state === "online") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (state === "auth") return "border-amber-200 bg-amber-50 text-amber-800";
  if (state === "checking" || state === "restarting") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-red-200 bg-red-50 text-red-700";
}

export function BackendStatus() {
  const [state, setState] = useState<BackendState>("checking");
  const [message, setMessage] = useState<string>("");
  const checkingRef = useRef(false);

  const checkBackend = useCallback(async () => {
    if (checkingRef.current) return;
    checkingRef.current = true;
    setState((current) => (current === "restarting" ? "restarting" : "checking"));
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS);
    try {
      const response = await fetch(`${API_BASE_URL}/api/security/health/`, {
        credentials: "include",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      if (response.ok) {
        setState("online");
        setMessage("Le API backend rispondono.");
      } else if (response.status === 401 || response.status === 403) {
        setState("auth");
        setMessage("Il backend risponde, ma serve login o permesso.");
      } else {
        setState("offline");
        setMessage(`Risposta backend non valida: ${response.status}`);
      }
    } catch (error) {
      setState("offline");
      setMessage(error instanceof Error ? error.message : "Backend non raggiungibile.");
    } finally {
      window.clearTimeout(timeoutId);
      checkingRef.current = false;
    }
  }, []);

  const restartBackend = async () => {
    setState("restarting");
    setMessage("Avvio restart_server.bat tramite Vite locale...");
    try {
      const response = await fetch("/__security-center-dev/restart-backend", { method: "POST" });
      if (!response.ok) {
        throw new Error(`Endpoint dev non disponibile: ${response.status}`);
      }
      window.setTimeout(checkBackend, 3500);
      window.setTimeout(checkBackend, 8000);
    } catch (error) {
      setState("offline");
      setMessage(error instanceof Error ? error.message : "Riavvio backend non riuscito.");
    }
  };

  useEffect(() => {
    checkBackend();
    const intervalId = window.setInterval(checkBackend, 20000);
    return () => window.clearInterval(intervalId);
  }, [checkBackend]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={checkBackend}
        title={message || "Controlla stato backend"}
        className={`rounded-lg border px-2.5 py-2 text-sm font-bold shadow-sm ${classForState(state)}`}
      >
        {labelForState(state)}
      </button>
      {import.meta.env.DEV && state !== "online" && (
        <button
          type="button"
          onClick={restartBackend}
          disabled={state === "restarting"}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Riavvia backend
        </button>
      )}
    </div>
  );
}
