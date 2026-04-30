const defaultApiBaseUrl = "";
const defaultApiTimeoutMs = 15000;

function readApiTimeoutMs(): number {
  const rawValue = import.meta.env.VITE_API_TIMEOUT_MS;
  if (!rawValue) return defaultApiTimeoutMs;

  const parsedValue = Number(rawValue);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : defaultApiTimeoutMs;
}

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? defaultApiBaseUrl).replace(/\/$/, "");
export const API_TIMEOUT_MS = readApiTimeoutMs();
