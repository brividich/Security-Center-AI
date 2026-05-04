import { API_BASE_URL, API_TIMEOUT_MS } from "./config";
import type { MailboxIngestionRunResponse, MailboxIngestionServiceStatus } from "../types/serviceStatus";

export class ServiceStatusApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ServiceStatusApiError";
    this.status = status;
  }
}

async function fetchJson<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  const method = (options?.method || "GET").toUpperCase();

  try {
    // Ensure CSRF token is available for non-safe methods
    let csrfToken = getCsrfToken();
    if (!["GET", "HEAD", "OPTIONS", "TRACE"].includes(method) && !csrfToken) {
      await ensureCsrfToken();
      csrfToken = getCsrfToken();
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
        ...options?.headers,
      },
      signal: controller.signal,
    });

    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok) {
      const detail = contentType.includes("application/json") ? await readErrorDetail(response) : "";
      throw new ServiceStatusApiError(`Errore API servizio: ${response.status}${detail ? ` - ${detail}` : ""}`, response.status);
    }
    if (!contentType.includes("application/json")) {
      throw new ServiceStatusApiError("Risposta backend non JSON. Verifica login e URL API.", response.status);
    }
    return response.json();
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ServiceStatusApiError(`Timeout API dopo ${API_TIMEOUT_MS / 1000}s: ${endpoint}`);
    }
    throw error;
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
    throw new ServiceStatusApiError(`Impossibile ottenere token CSRF: ${response.status}`);
  }
}

function getCsrfToken(): string | null {
  const match = document.cookie.match(/(?:^|;)\s*csrftoken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function readErrorDetail(response: Response): Promise<string> {
  try {
    const data = await response.json();
    if (typeof data?.error === "string") return data.error;
    if (typeof data?.detail === "string") return data.detail;
  } catch {
    return "";
  }
  return "";
}

export function fetchMailboxIngestionServiceStatus(): Promise<MailboxIngestionServiceStatus> {
  return fetchJson<MailboxIngestionServiceStatus>("/security/api/services/mailbox-ingestion/status/");
}

export function runMailboxIngestionService(sourceCode?: string, limit?: number): Promise<MailboxIngestionRunResponse> {
  return fetchJson<MailboxIngestionRunResponse>("/security/api/services/mailbox-ingestion/run/", {
    method: "POST",
    body: JSON.stringify({
      ...(sourceCode ? { source_code: sourceCode } : {}),
      ...(limit ? { limit } : {}),
    }),
  });
}
