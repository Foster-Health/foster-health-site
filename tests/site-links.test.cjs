const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const pages = ["index.html", "contact.html", "blog.html", "blog-post.html", "roi.html"];

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function idsIn(html) {
  return [...html.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1]);
}

function localTarget(url) {
  const pathname = url.split(/[?#]/, 1)[0];
  if (!pathname || pathname === "/") return "index.html";
  if (pathname.startsWith("/api/")) return `${pathname.slice(1)}.js`;
  if (path.extname(pathname)) return pathname.slice(1);
  return `${pathname.slice(1)}.html`;
}

test("canonical pages have unique IDs and valid local references", () => {
  for (const page of pages) {
    const html = read(page);
    const ids = idsIn(html);
    assert.equal(new Set(ids).size, ids.length, `${page} contains duplicate IDs`);

    for (const match of html.matchAll(/\b(?:href|src)=["']([^"']+)["']/g)) {
      const url = match[1];
      if (/^(?:https?:|mailto:|tel:|data:|#)/.test(url)) continue;
      assert.ok(url.startsWith("/"), `${page} has a non-root-relative local URL: ${url}`);
      assert.ok(!/\.html(?:[?#]|$)/.test(url), `${page} links to an .html URL: ${url}`);
      assert.ok(fs.existsSync(path.join(root, localTarget(url))), `${page} references missing ${url}`);

      const hash = url.includes("#") ? url.slice(url.indexOf("#") + 1) : "";
      if (hash) {
        const targetHtml = read(localTarget(url));
        assert.ok(idsIn(targetHtml).includes(hash), `${page} references missing fragment ${url}`);
      }
    }
  }
});

test("JavaScript uses extensionless site and API routes", () => {
  const scripts = fs.readdirSync(path.join(root, "js")).filter((file) => file.endsWith(".js"));
  for (const script of scripts) {
    assert.doesNotMatch(read(path.join("js", script)), /["'`]\/[^"'`\s]*\.html(?:[?#"'`]|$)/);
  }

  assert.match(read("js/blog.js"), /href="\/blog-post\?slug=\$\{encodeURIComponent\(/);
  assert.match(read("contact.html"), /fetch\('\/api\/contact-submit'/);
  assert.ok(fs.existsSync(path.join(root, "api/contact-submit.js")));
  assert.ok(fs.existsSync(path.join(root, "api/roi-submit.js")));
});

test("Vercel clean routes and retired-page redirects are valid", () => {
  const config = JSON.parse(read("vercel.json"));
  assert.equal(config.cleanUrls, true);
  assert.equal(config.trailingSlash, false);

  const redirects = new Map(config.redirects.map(({ source, destination }) => [source, destination]));
  assert.equal(redirects.get("/service"), "/contact");
  assert.equal(redirects.get("/copilot"), "/contact");
  assert.ok(config.redirects.every(({ permanent }) => permanent === true));
  assert.ok(config.redirects.every(({ source, destination }) => !source.endsWith(".html") && !destination.endsWith(".html")));

  assert.ok(!fs.existsSync(path.join(root, "service.html")));
  assert.ok(!fs.existsSync(path.join(root, "copilot.html")));
  for (const file of [...pages, ...fs.readdirSync(path.join(root, "js")).map((name) => `js/${name}`)]) {
    assert.doesNotMatch(read(file), /(?:href=|location(?:\.href)?\s*=)["'`]\/(?:service|copilot)(?:[?#"'`]|$)/);
  }
});
