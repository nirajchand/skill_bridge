const ACCESS_COOKIE = 'access_token';
const REFRESH_COOKIE = 'refresh_token';

const isProd = () => process.env.NODE_ENV === 'production';

// httpOnly → not readable by JS (mitigates XSS token theft).
// secure → only sent over HTTPS in production.
// sameSite=strict → not sent on cross-site requests (mitigates CSRF).
function baseOptions() {
  return {
    httpOnly: true,
    secure: isProd(),
    sameSite: 'strict'
  };
}

function setAuthCookies(res, { accessToken, refreshToken }) {
  if (accessToken) {
    res.cookie(ACCESS_COOKIE, accessToken, {
      ...baseOptions(),
      path: '/',
      maxAge: 15 * 60 * 1000 // 15 minutes
    });
  }
  if (refreshToken) {
    // Refresh cookie is only ever sent to the auth endpoints that need it.
    res.cookie(REFRESH_COOKIE, refreshToken, {
      ...baseOptions(),
      path: '/api/auth',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
  }
}

function clearAuthCookies(res) {
  res.clearCookie(ACCESS_COOKIE, { ...baseOptions(), path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...baseOptions(), path: '/api/auth' });
}

module.exports = { ACCESS_COOKIE, REFRESH_COOKIE, setAuthCookies, clearAuthCookies };
