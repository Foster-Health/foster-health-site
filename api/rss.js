// GET /rss.xml — a full-text feed of the blog for feed readers and content indexes.

const { SITE_URL, fetchPostsWithBody, postUrl } = require("../lib/sanity");
const { BLOG_DESCRIPTION } = require("../lib/pages");
const { escapeXml, renderPortableTextHtml } = require("../lib/render");
const { CACHE_NONE, rejectNonRead, send } = require("../lib/http");

const RSS = "application/rss+xml; charset=utf-8";

function rfc822(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toUTCString();
}

// Feed readers show the HTML outside the site, so site-relative links need the full address.
function absoluteLinks(html) {
  return html.replace(/href="\//g, `href="${SITE_URL}/`);
}

function cdata(value) {
  return `<![CDATA[${String(value).replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}

function buildFeed(posts) {
  const items = posts
    .map((post) => {
      const url = postUrl(post.slug);
      const excerpt = String(post.excerpt || "").replace(/\s+/g, " ").trim();
      return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      <pubDate>${rfc822(post.publishedAt)}</pubDate>
      <dc:creator>${escapeXml(post.authorName || "Foster Health")}</dc:creator>
      <description>${escapeXml(excerpt)}</description>
      <content:encoded>${cdata(absoluteLinks(renderPortableTextHtml(post.body)))}</content:encoded>
    </item>`;
    })
    .join("\n");

  const lastBuild = posts.length ? rfc822(posts[0].modifiedAt || posts[0].publishedAt) : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Foster Health Insights</title>
    <link>${SITE_URL}/blog</link>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml"/>
    <description>${escapeXml(BLOG_DESCRIPTION)}</description>
    <language>en-us</language>${lastBuild ? `\n    <lastBuildDate>${lastBuild}</lastBuildDate>` : ""}
${items}
  </channel>
</rss>
`;
}

module.exports = async function handler(req, res) {
  if (rejectNonRead(req, res)) return;
  const head = req.method === "HEAD";

  try {
    send(res, 200, RSS, buildFeed(await fetchPostsWithBody()), { head });
  } catch (error) {
    console.error("Feed render failed:", error);
    send(res, 503, "text/plain; charset=utf-8", "The feed is temporarily unavailable.\n", {
      head,
      cache: CACHE_NONE,
      headers: { "Retry-After": "300" },
    });
  }
};

module.exports.buildFeed = buildFeed;
