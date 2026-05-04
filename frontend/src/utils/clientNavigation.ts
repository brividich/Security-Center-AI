export function normalizeClientPath(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  let path = trimmed;
  if (/^https?:\/\//i.test(path)) {
    try {
      const url = new URL(path);
      if (url.origin !== window.location.origin) {
        return null;
      }
      path = `${url.pathname}${url.search}${url.hash}`;
    } catch {
      return null;
    }
  }

  if (!path.startsWith("/")) {
    path = `/${path}`;
  }

  const legacyAlertMatch = path.match(/^\/security\/alerts\/([^/?#]+)\/?([?#].*)?$/);
  if (legacyAlertMatch) {
    return `/alerts/${legacyAlertMatch[1]}${legacyAlertMatch[2] ?? ""}`;
  }

  if (path === "/security/alerts" || path === "/security/alerts/") {
    return "/alerts";
  }

  if (path.startsWith("/security/api/") || path.startsWith("/api/") || path.startsWith("/admin")) {
    return null;
  }

  return path;
}

export function navigateToClientPath(input: string): boolean {
  const path = normalizeClientPath(input);
  if (!path) {
    return false;
  }

  const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (currentPath !== path) {
    window.history.pushState(null, "", path);
  }
  window.dispatchEvent(new PopStateEvent("popstate"));
  return true;
}
