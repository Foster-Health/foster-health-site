const assert = require("node:assert");
const fs = require("node:fs");

const pages = ["index", "service", "copilot", "roi", "contact", "blog"];
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

const vercel = JSON.parse(fs.readFileSync("vercel.json", "utf8"));
assert.deepStrictEqual(vercel.rewrites[0], {
  source: "/blog/:slug",
  destination: "/blog-post?slug=:slug",
});

const blog = fs.readFileSync("js/blog.js", "utf8");
assert(blog.includes('href="/blog/${encodeURIComponent('));
assert(!blog.includes('href="/blog-post?slug='));

const post = fs.readFileSync("js/blog-post.js", "utf8");
assert(post.includes('"@type": "Article"'));
assert(post.includes("window.location.pathname"));
console.log("SEO checks passed.");
