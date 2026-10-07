// Local dev server that mirrors the Vercel setup in vercel.json:
// clean URLs, the /blog/:slug rewrite, and the /api serverless functions.
// Usage: node scripts/dev-server.js  (PORT defaults to 4173)
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.PORT) || 4173;

// Load KEY=value pairs from .env (e.g. RESEND_API_KEY) without overriding the shell.
const envFile = path.join(ROOT, ".env");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (match && !(match[1] in process.env)) {
      process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
    }
  }
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
};

function resolveFile(pathname) {
  if (pathname.startsWith("/blog/")) pathname = "/blog-post";
  if (pathname === "/") pathname = "/index";
  const candidate = path.normalize(path.join(ROOT, pathname));
  if (!candidate.startsWith(ROOT + path.sep)) return null;
  for (const file of [candidate, `${candidate}.html`]) {
    if (fs.existsSync(file) && fs.statSync(file).isFile()) return file;
  }
  return null;
}

async function handleApi(name, req, res) {
  const file = path.join(ROOT, "api", `${path.basename(name)}.js`);
  if (!fs.existsSync(file)) return send(res, 404, "Not found");

  let raw = "";
  for await (const chunk of req) raw += chunk;
  try {
    req.body = raw ? JSON.parse(raw) : {};
  } catch {
    req.body = raw;
  }
  res.status = (code) => ((res.statusCode = code), res);
  res.json = (data) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(data));
    return res;
  };

  delete require.cache[require.resolve(file)];
  await require(file)(req, res);
}

function send(res, code, body) {
  res.writeHead(code, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(body);
}

http
  .createServer(async (req, res) => {
    const { pathname } = new URL(req.url, "http://localhost");
    try {
      if (pathname.startsWith("/api/")) return await handleApi(pathname.slice(5), req, res);

      // Match Vercel cleanUrls: /about.html -> /about
      if (pathname.endsWith(".html")) {
        res.writeHead(308, { Location: pathname.replace(/(index)?\.html$/, "") || "/" });
        return res.end();
      }

      const file = resolveFile(decodeURIComponent(pathname));
      if (!file) return send(res, 404, "Not found");
      res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
      fs.createReadStream(file).pipe(res);
    } catch (error) {
      console.error(error);
      if (!res.headersSent) send(res, 500, "Internal server error");
    }
    console.log(`${req.method} ${req.url} ${res.statusCode}`);
  })
  .listen(PORT, () => console.log(`Foster Health site running at http://localhost:${PORT}`));
