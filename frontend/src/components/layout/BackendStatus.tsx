import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE_URL, API_TIMEOUT_MS } from "../../services/config";

type BackendState = "checking" | "online" | "auth" | "offline";

function labelForState(state: BackendState) {
  if (state === "online") return "API live";
  if (state === "auth") return "Login richiesto";
  if (state === "checking") return "Controllo...";
  return "API offline";
}

function classForState(state: BackendState) {
  if (state === "online") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (state === "auth") return "border-amber-200 bg-amber-50 text-amber-800";
  if (state === "checking") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-red-200 bg-red-50 text-red-700";
}

export function BackendStatus() {
  const [state, setState] = useState<BackendState>("checking");
  const [message, setMessage] = useState<string>("");
  const checkingRef = useRef(false);

  const checkBackend = useCallback(async () => {
    if (checkingRef.current) return;
    checkingRef.current = true;
    setState("checking");
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
        setMessage("Le API rispondono.");
      } else if (response.status === 401 || response.status === 403) {
        setState("auth");
        setMessage("Le API rispondono, ma serve login o permesso.");
      } else {
        setState("offline");
        setMessage(`Risposta API non valida: ${response.status}`);
      }
    } catch (error) {
      setState("offline");
      setMessage(error instanceof Error ? error.message : "API non raggiungibili.");
    } finally {
      window.clearTimeout(timeoutId);
      checkingRef.current = false;
    }
  }, []);

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
        title={message || "Controlla stato API"}
        className={`rounded-lg border px-2.5 py-2 text-sm font-bold shadow-sm ${classForState(state)}`}
      >
        {labelForState(state)}
      </button>
    </div>
  );
}
