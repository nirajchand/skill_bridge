const dns = require('dns').promises;
const net = require('net');

/**
 * SSRF protection (lecturer's checklist item 12: "do whitelisting").
 *
 * Server-Side Request Forgery is where an attacker supplies a URL that our
 * server (or an admin's browser) then requests, tricking us into reaching
 * somewhere we shouldn't — most damagingly the cloud metadata endpoint
 * (169.254.169.254), which on AWS/GCP hands out IAM credentials, or internal
 * services (Postgres on 127.0.0.1, an admin panel on 10.x) that are firewalled
 * from the internet but wide open to our own server.
 *
 * Two complementary strategies:
 *  1. ALLOW-LIST (strongest): for outbound calls WE initiate to known providers
 *     (e.g. Google's OAuth token endpoint) only an exact host match is accepted.
 *     Nothing user-controlled can redirect those.
 *  2. DENY-LIST + DNS resolution: for URLs users are allowed to supply
 *     (portfolio, company website) we cannot allow-list arbitrary hosts, so we
 *     reject anything that RESOLVES to a private/loopback/link-local address.
 *     Resolving matters: "evil.com" can have an A record of 127.0.0.1, so
 *     checking the string alone is not enough.
 */

// Exact hosts we are permitted to call. Deliberately tiny.
const OUTBOUND_ALLOWLIST = new Set(['oauth2.googleapis.com', 'www.googleapis.com', 'accounts.google.com', 'api.stripe.com']);

const ALLOWED_SCHEMES = new Set(['http:', 'https:']);

/**
 * Is this IP in a range that must never be reachable from a user-supplied URL?
 * Covers RFC1918 private space, loopback, link-local (incl. cloud metadata),
 * CGNAT, and IPv6 equivalents.
 */
function isPrivateAddress(ip) {
  const v = net.isIP(ip);
  if (v === 4) {
    const p = ip.split('.').map(Number);
    if (p[0] === 10) return true; // 10.0.0.0/8
    if (p[0] === 127) return true; // loopback
    if (p[0] === 0) return true; // 0.0.0.0/8 "this network"
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true; // 172.16.0.0/12
    if (p[0] === 192 && p[1] === 168) return true; // 192.168.0.0/16
    if (p[0] === 169 && p[1] === 254) return true; // link-local + CLOUD METADATA
    if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return true; // CGNAT 100.64/10
    if (p[0] >= 224) return true; // multicast / reserved
    return false;
  }
  if (v === 6) {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower === '::') return true; // loopback / unspecified
    if (lower.startsWith('fe80')) return true; // link-local
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique-local

    // IPv4-mapped addresses must be unwrapped and re-checked, otherwise
    // http://[::ffff:127.0.0.1]/ reaches loopback while looking like IPv6.
    // CRITICAL: Node's URL parser normalises the dotted form to HEX
    // (::ffff:127.0.0.1 -> ::ffff:7f00:1), so matching only the dotted form is a
    // real bypass. Both notations are handled here.
    const dotted = lower.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
    if (dotted) return isPrivateAddress(dotted[1]);

    const hex = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hex) {
      const high = parseInt(hex[1], 16);
      const low = parseInt(hex[2], 16);
      const v4 = `${(high >> 8) & 0xff}.${high & 0xff}.${(low >> 8) & 0xff}.${low & 0xff}`;
      return isPrivateAddress(v4);
    }
    return false;
  }
  return true; // not a valid IP => treat as unsafe
}

/** Strict allow-list check for outbound calls we initiate ourselves. */
function isAllowedOutboundUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return url.protocol === 'https:' && OUTBOUND_ALLOWLIST.has(url.hostname);
  } catch {
    return false;
  }
}

/**
 * Validate a URL supplied by a user. Returns { safe, reason }.
 * `resolveDns` is optional so callers can skip the network round-trip when they
 * only need the cheap structural checks.
 */
async function checkUserSuppliedUrl(rawUrl, { resolveDns = true } = {}) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return { safe: false, reason: 'Not a valid URL' };
  }

  // Blocks javascript:, data:, file:, gopher:, ftp: — several of which are
  // classic SSRF/XSS vectors.
  if (!ALLOWED_SCHEMES.has(url.protocol)) {
    return { safe: false, reason: 'Only http and https URLs are allowed' };
  }

  // Credentials in a URL (http://user:pass@host) are used to confuse parsers
  // and smuggle a different host past naive checks.
  if (url.username || url.password) {
    return { safe: false, reason: 'URLs must not contain credentials' };
  }

  const host = url.hostname.replace(/^\[|\]$/g, ''); // strip IPv6 brackets

  // Literal IP supplied directly.
  if (net.isIP(host)) {
    if (isPrivateAddress(host)) return { safe: false, reason: 'URL points to a private or internal address' };
    return { safe: true };
  }

  // Obvious internal names.
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) {
    return { safe: false, reason: 'URL points to an internal host' };
  }

  if (!resolveDns) return { safe: true };

  // Resolve: a public-looking domain can still point at 127.0.0.1.
  try {
    const records = await dns.lookup(host, { all: true });
    if (!records.length) return { safe: false, reason: 'Host could not be resolved' };
    for (const { address } of records) {
      if (isPrivateAddress(address)) {
        return { safe: false, reason: 'URL resolves to a private or internal address' };
      }
    }
    return { safe: true };
  } catch {
    // Unresolvable: reject. Fail closed.
    return { safe: false, reason: 'Host could not be resolved' };
  }
}

module.exports = { checkUserSuppliedUrl, isAllowedOutboundUrl, isPrivateAddress, OUTBOUND_ALLOWLIST };
