// GET /sitemap.xml — every public page and every published article, with the article's last edit date.

const { SITE_URL, fetchPostSummaries, postUrl } = require("../lib/sanity");
const { escapeXml, isoDate } = require("../lib/render");
const { CACHE_NONE, rejectNonRead, send } = require("../lib/http");

const XML = "application/xml; charset=utf-8";
const STATIC_PATHS = ["/", "/blog", "/privacy", "/terms", "/sms-terms"];

function buildSitemap(posts) {
  const latestPostEdit = posts
    .map((post) => isoDate(post.modifiedAt || post.publishedAt))
    .filter(Boolean)
    .sort()
    .pop();

  const entries = STATIC_PATHS.map((path) => ({
    loc: `${SITE_URL}${path}`,
    lastmod: path === "/blog" ? latestPostEdit : "",
  })).concat(
    posts.map((post) => ({
      loc: postUrl(post.slug),
      lastmod: isoDate(post.modifiedAt || post.publishedAt),
    }))
  );

  const body = entries
    .map(
      (entry) =>
        `  <url>\n    <loc>${escapeXml(entry.loc)}</loc>${
          entry.lastmod ? `\n    <lastmod>${escapeXml(entry.lastmod)}</lastmod>` : ""
        }\n  </url>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

module.exports = async function handler(req, res) {
  if (rejectNonRead(req, res)) return;
  const head = req.method === "HEAD";

  try {
    send(res, 200, XML, buildSitemap(await fetchPostSummaries()), { head });
  } catch (error) {
    console.error("Sitemap render failed:", error);
    // Still list the fixed pages. Do not let the CDN keep this short version.
    send(res, 200, XML, buildSitemap([]), { head, cache: CACHE_NONE });
  }
};

module.exports.buildSitemap = buildSitemap;
