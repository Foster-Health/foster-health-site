// Local preview server. It applies the redirects, rewrites, and clean URLs from vercel.json
// and runs the api/ handlers, so a page can be checked before a deployment.
//
//   node tests/dev-server.js [port]
//
// It covers the rule forms this repository uses. It is not a full copy of the Vercel router.

const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const PORT = Number(process.argv[2] || process.env.PORT || 4173);
const config = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".zip": "application/zip",
};

// Convert a vercel.json source such as "/blog/:slug([^/]+)\\.md" into a regular expression.
function compileSource(source) {
  const names = [];
  let pattern = "";
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    if (char === ":") {
      const name = source.slice(index + 1).match(/^[A-Za-z0-9_]+/)[0];
      index += 1 + name.length;
      names.push(name);
      if (source[index] === "(") {
        const end = source.indexOf(")", index);
        pattern += `(${source.slice(index + 1, end)})`;
        index = end + 1;
      } else {
        pattern += "([^/]+?)";
      }
    } else if (char === "\\") {
      pattern += source.slice(index, index + 2);
      index += 2;
    } else {
      pattern += char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      index += 1;
    }
  }
  return { regex: new RegExp(`^${pattern}$`), names };
}

function matchRule(rule, url) {
  const { regex, names } = compileSource(rule.source);
  const match = regex.exec(url.pathname);
  if (!match) return null;
  const params = {};
  names.forEach((name, position) => {
    params[name] = match[position + 1];
  });
  for (const condition of rule.has || []) {
    if (condition.type !== "query") return null;
    const value = url.searchParams.get(condition.key);
    if (value === null) return null;
    if (condition.value) {
      const hasMatch = new RegExp(`^${condition.value}$`).exec(value);
      if (!hasMatch) return null;
      Object.assign(params, hasMatch.groups || {});
    }
  }
  return params;
}

function fillDestination(destination, params) {
  return destination.replace(/:([A-Za-z0-9_]+)/g, (whole, name) =>
    name in params ? encodeURIComponent(params[name]) : whole
  );
}

function staticFile(pathname) {
  const safe = path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "");
  const candidates = [path.join(ROOT, safe)];
  if (config.cleanUrls && !path.extname(safe)) candidates.push(path.join(ROOT, `${safe}.html`));
  if (safe.endsWith(path.sep) || safe === path.sep) candidates.push(path.join(ROOT, safe, "index.html"));
  return candidates.find((file) => {
    if (!file.startsWith(ROOT) || file.startsWith(path.join(ROOT, "api"))) return false;
    return fs.existsSync(file) && fs.statSync(file).isFile();
  });
}

function runFunction(req, res, target) {
  const file = path.join(ROOT, `${target.pathname}.js`);
  if (!fs.existsSync(file)) return false;
  req.query = Object.fromEntries(target.searchParams.entries());
  Promise.resolve(require(file)(req, res)).catch((error) => {
    console.error(error);
    if (!res.headersSent) res.statusCode = 500;
    res.end("Function error");
  });
  return true;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  // Vercel redirects a trailing slash and a ".html" address to the clean address. This server
  // serves the clean address directly, so it never builds a redirect target from the request.
  let pathname = url.pathname;
  if (config.trailingSlash === false && pathname.length > 1) pathname = pathname.replace(/\/+$/, "") || "/";
  if (config.cleanUrls) pathname = pathname.replace(/(\/index)?\.html$/, "") || "/";
  url.pathname = pathname;

  for (const rule of config.redirects || []) {
    const params = matchRule(rule, url);
    if (params) {
      res.writeHead(rule.permanent ? 308 : 307, { Location: fillDestination(rule.destination, params) });
      res.end();
      return;
    }
  }

  const file = staticFile(url.pathname);
  if (file) {
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
    return;
  }

  let target = url;
  for (const rule of config.rewrites || []) {
    const params = matchRule(rule, url);
    if (params) {
      target = new URL(fillDestination(rule.destination, params), url);
      url.searchParams.forEach((value, key) => {
        if (!target.searchParams.has(key)) target.searchParams.set(key, value);
      });
      break;
    }
  }

  if (target.pathname.startsWith("/api/") && runFunction(req, res, target)) return;

  res.writeHead(404, { "Content-Type": TYPES[".html"] });
  fs.createReadStream(path.join(ROOT, "404.html")).pipe(res);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Preview: http://127.0.0.1:${PORT}`);
});
