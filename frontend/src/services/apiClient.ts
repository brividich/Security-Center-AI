import { API_BASE_URL, API_TIMEOUT_MS } from "./config";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function apiGet<T>(path: string, timeoutMs = API_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new ApiError(`Request failed with status ${response.status}`, response.status);
    }
    return (await response.json()) as T;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function apiPost<T>(path: string, body: unknown = {}, timeoutMs = API_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  // Ensure CSRF token is available
  let csrfToken = getCsrfToken();
  if (!csrfToken) {
    await ensureCsrfToken();
    csrfToken = getCsrfToken();
  }

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new ApiError(await apiErrorMessage(response), response.status);
    }
    return (await response.json()) as T;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function ensureCsrfToken(): Promise<void> {
  const csrfEndpoint = "/security/api/configuration/test/";
  const response = await fetch(csrfEndpoint, {
    method: "GET",
    credentials: "include",
  });
  if (!response.ok) {
    throw new ApiError(`Impossibile ottenere token CSRF: ${response.status}`, response.status);
  }
}

function getCsrfToken(): string | null {
  const match = document.cookie.match(/(?:^|;)\s*csrftoken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function apiErrorMessage(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const payload = await response.json();
      if (typeof payload?.error === "string") return payload.error;
      if (typeof payload?.detail === "string") return payload.detail;
    } catch {
      return `Request failed with status ${response.status}`;
    }
  }
  return `Request failed with status ${response.status}`;
}

export const apiClient = {
  baseUrl: API_BASE_URL,
  get: apiGet,
  post: apiPost,
};
