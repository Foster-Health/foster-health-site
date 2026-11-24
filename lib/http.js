// Small response helpers shared by the content endpoints.

// The CDN keeps a page for 5 minutes, then serves the stored copy while it fetches a new one.
// A new or edited Sanity article therefore appears in about 5 minutes without a deployment.
const CACHE_CONTENT = "public, max-age=0, s-maxage=300, stale-while-revalidate=86400";
const CACHE_NONE = "no-store";

function queryValue(req, key) {
  if (req.query && typeof req.query[key] === "string") return req.query[key];
  if (req.query && Array.isArray(req.query[key])) return String(req.query[key][0] || "");
  try {
    return new URL(req.url || "/", "http://localhost").searchParams.get(key) || "";
  } catch (error) {
    return "";
  }
}

function send(res, status, contentType, body, options) {
  const settings = options || {};
  res.statusCode = status;
  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", settings.cache || CACHE_CONTENT);
  res.setHeader("X-Content-Type-Options", "nosniff");
  Object.entries(settings.headers || {}).forEach(([name, value]) => res.setHeader(name, value));
  res.end(settings.head ? "" : body);
}

function redirect(res, location) {
  res.statusCode = 308;
  res.setHeader("Location", location);
  res.setHeader("Cache-Control", CACHE_CONTENT);
  res.end("");
}

// These endpoints only read. Return true when the method is not GET or HEAD and the reply is sent.
function rejectNonRead(req, res) {
  if (req.method === "GET" || req.method === "HEAD") return false;
  res.statusCode = 405;
  res.setHeader("Allow", "GET, HEAD");
  res.setHeader("Cache-Control", CACHE_NONE);
  res.end("");
  return true;
}

module.exports = { CACHE_CONTENT, CACHE_NONE, queryValue, redirect, rejectNonRead, send };
