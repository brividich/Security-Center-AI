// frontend/src/services/securityApiClient.ts
// Shared fetch helper for Django/DRF APIs protected by CSRF.

const CSRF_ENDPOINT = "/security/api/configuration/test/";

function getCookie(name: string): string {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length !== 2) {
    return "";
  }
  return parts.pop()?.split(";").shift() ?? "";
}

async function ensureCsrfToken(): Promise<string> {
  let token = getCookie("csrftoken");
  if (token) {
    return token;
  }

  const response = await fetch(CSRF_ENDPOINT, {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Errore API CSRF: ${response.status} - ${text}`);
  }

  token = getCookie("csrftoken");
  if (!token) {
    throw new Error("Errore API CSRF: cookie csrftoken non disponibile dopo il bootstrap.");
  }

  return token;
}

export async function securityApiFetch<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers || {});

  if (!headers.has("Content-Type") && !["GET", "HEAD"].includes(method)) {
    headers.set("Content-Type", "application/json");
  }

  if (!["GET", "HEAD", "OPTIONS", "TRACE"].includes(method)) {
    headers.set("X-CSRFToken", await ensureCsrfToken());
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Errore API servizio: ${response.status} - ${text}`);
  }

  return response.json() as Promise<T>;
}

export async function testConfiguration<TPayload, TResult>(
  payload: TPayload,
): Promise<TResult> {
  return securityApiFetch<TResult>("/security/api/configuration/test/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
