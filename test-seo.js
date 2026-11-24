const assert = require("node:assert");
const fs = require("node:fs");

// Static pages must carry the tags that search engines and link previews read.
const pages = ["index", "service", "copilot", "roi", "contact"];
for (const page of pages) {
  const html = fs.readFileSync(`${page}.html`, "utf8");
  for (const marker of [
    'rel="canonical"',
    'property="og:title"',
    'name="twitter:card"',
    'type="application/ld+json"',
  ]) {
    assert(html.includes(marker), `${page}.html is missing ${marker}`);
  }
}

// The home page structured data must be valid JSON and must name the organization.
const home = fs.readFileSync("index.html", "utf8");
const homeData = JSON.parse(home.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
const homeTypes = homeData["@graph"].map((node) => node["@type"]);
for (const type of ["Organization", "WebSite", "WebPage", "Service"]) {
  assert(homeTypes.includes(type), `index.html structured data is missing ${type}`);
}
assert(home.includes('property="og:image" content="https://www.fosterhealth.io/img/og-default.png"'));
assert(fs.existsSync("img/og-default.png"), "the social share image exists");

// The blog is rendered by api/ functions. A static blog.html or blog-post.html would take the
// address first and hide the articles from crawlers that do not run JavaScript.
assert(!fs.existsSync("blog.html"), "blog.html must not exist; /blog is served by api/blog.js");
assert(!fs.existsSync("blog-post.html"), "blog-post.html must not exist; articles are served by api/blog-post.js");

const vercel = JSON.parse(fs.readFileSync("vercel.json", "utf8"));
const rewrites = Object.fromEntries(vercel.rewrites.map((rule) => [rule.source, rule.destination]));
assert.strictEqual(rewrites["/blog"], "/api/blog");
assert.strictEqual(rewrites["/blog/:slug"], "/api/blog-post?slug=:slug");
assert.strictEqual(rewrites["/sitemap.xml"], "/api/sitemap");
assert.strictEqual(rewrites["/rss.xml"], "/api/rss");
assert.strictEqual(rewrites["/llms.txt"], "/api/llms");
const sources = vercel.rewrites.map((rule) => rule.source);
assert(
  sources.findIndex((source) => source.endsWith("\\.md")) < sources.indexOf("/blog/:slug"),
  "the Markdown article rule must come before the HTML article rule"
);
for (const rule of vercel.rewrites) {
  if (rule.destination.startsWith("/api/")) {
    const file = `${rule.destination.split("?")[0].slice(1)}.js`;
    assert(fs.existsSync(file), `${rule.source} points at ${file}, which does not exist`);
  }
}

const robots = fs.readFileSync("robots.txt", "utf8");
assert(robots.includes("Sitemap: https://www.fosterhealth.io/sitemap.xml"));
assert(/User-agent: \*\nAllow: \/\n/.test(robots), "robots.txt lets all crawlers read the site");
for (const bot of ["GPTBot", "OAI-SearchBot", "ClaudeBot", "PerplexityBot", "Google-Extended"]) {
  assert(robots.includes(`User-agent: ${bot}`), `robots.txt does not name ${bot}`);
}

// The browser scripts stay as the fallback when the server cannot reach Sanity.
const blog = fs.readFileSync("js/blog.js", "utf8");
assert(blog.includes('href="/blog/${encodeURIComponent('));
assert(!blog.includes('href="/blog-post?slug='));

const post = fs.readFileSync("js/blog-post.js", "utf8");
assert(post.includes('"@type": "Article"'));
assert(post.includes("window.location.pathname"));
console.log("SEO checks passed.");
