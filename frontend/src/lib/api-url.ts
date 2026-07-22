/**
 * Resolves the API base URL.
 *
 * WHY THIS IS DERIVED RATHER THAN HARDCODED:
 * The app is reached on several addresses depending on where the browser runs —
 * localhost during normal development, and a VMware host address when it is
 * driven through Burp Suite from the Kali VM (192.168.154.1 on NAT/VMnet8,
 * 192.168.199.1 on host-only/VMnet1).
 *
 * A fixed value breaks in two ways whenever the browsed address is not the one
 * it was built with. CORS rejects the call because the Origin no longer matches
 * the server's allowlist, and — less obviously — the auth cookies are
 * SameSite=Strict, so a page on one host talking to an API on another is
 * cross-site and the session cookie is never sent. Both failures surface as a
 * generic "cannot reach the server", which points at the wrong problem.
 *
 * Deriving the host from window.location keeps the page and the API on the same
 * host automatically, so the cookies stay same-site and the Origin always
 * matches. NEXT_PUBLIC_API_URL still wins when set, for deployments where the
 * API lives on a different host.
 */

const API_PORT = process.env.NEXT_PUBLIC_API_PORT || '3001';

/**
 * Every route in this app lives under /api, so a configured value that omits it
 * sends requests to /auth/... instead of /api/auth/... — which 404s on every
 * call while looking exactly like the server being unreachable. Normalising here
 * means a missing suffix cannot silently break the app, and a trailing slash
 * cannot produce a double slash.
 */
function withApiPath(base: string): string {
  const trimmed = base.replace(/\/+$/, '');
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
}

export function resolveApiUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL;
  if (configured) return withApiPath(configured);

  // Server-side render: no window, and nothing is fetched here anyway.
  if (typeof window === 'undefined') return `http://localhost:${API_PORT}/api`;

  return `${window.location.protocol}//${window.location.hostname}:${API_PORT}/api`;
}
