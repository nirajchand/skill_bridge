import axios, { AxiosError } from 'axios';
import { resolveApiUrl } from './api-url';

const API_URL = resolveApiUrl();

// withCredentials → the browser sends/receives the httpOnly auth cookies.
// Tokens are never stored in JS-accessible storage (localStorage), so an XSS
// payload cannot read them.
const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' }
});

/**
 * CSRF double-submit: read the (non-httpOnly) csrf_token cookie our server set
 * and echo it back in a header. An attacker's page can make the browser SEND our
 * cookies cross-site, but the same-origin policy prevents it from READING them —
 * so it cannot produce this header, and the request is rejected.
 */
function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[2]) : null;
}

apiClient.interceptors.request.use((config) => {
  const method = (config.method || 'get').toUpperCase();
  // Only state-changing verbs need the token (matches the server's rule).
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrf = readCookie('csrf_token');
    if (csrf) {
      config.headers = config.headers ?? {};
      config.headers['X-CSRF-Token'] = csrf;
    }
  }
  return config;
});

let refreshing: Promise<unknown> | null = null;

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as (typeof error.config & { _retry?: boolean }) | undefined;
    const url = originalRequest?.url ?? '';

    // Never try to refresh the refresh/login calls themselves.
    const isAuthCall = url.includes('/auth/refresh') || url.includes('/auth/login');

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !isAuthCall) {
      originalRequest._retry = true;
      try {
        // Single-flight refresh: concurrent 401s share one refresh call.
        refreshing = refreshing || axios.post(`${API_URL}/auth/refresh`, {}, { withCredentials: true });
        await refreshing;
        refreshing = null;
        return apiClient(originalRequest);
      } catch (refreshError) {
        refreshing = null;
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/auth')) {
          window.location.href = '/auth/login';
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
