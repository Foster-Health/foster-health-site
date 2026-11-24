// GET /blog/:slug — one article, rendered on the server with its own title, description,
// canonical address, and structured data. GET /blog/:slug.md returns the same article as Markdown.

const { cleanSlug, fetchPostPage, postUrl } = require("../lib/sanity");
const { renderClientFallback, renderNotFound, renderPost } = require("../lib/pages");
const { formatDate, renderPortableTextMarkdown } = require("../lib/render");
const { CACHE_NONE, queryValue, redirect, rejectNonRead, send } = require("../lib/http");

const HTML = "text/html; charset=utf-8";
const MARKDOWN = "text/markdown; charset=utf-8";

function requestedSlug(req) {
  let raw = queryValue(req, "slug");
  if (!raw) {
    try {
      const path = new URL(req.url || "/", "http://localhost").pathname;
      raw = path.split("/").filter(Boolean)[1] || "";
    } catch (error) {
      raw = "";
    }
  }
  try {
    raw = decodeURIComponent(raw);
  } catch (error) {
    // Use the value as sent if it does not decode.
  }
  return raw;
}

function postMarkdown(post) {
  const lines = [`# ${post.title}`, ""];
  const excerpt = String(post.excerpt || "").replace(/\s+/g, " ").trim();
  if (excerpt) lines.push(`> ${excerpt}`, "");
  const meta = [
    `Author: ${post.authorName || "Foster Health"}`,
    formatDate(post.publishedAt) ? `Published: ${formatDate(post.publishedAt)}` : "",
    `Source: ${postUrl(post.slug)}`,
  ].filter(Boolean);
  lines.push(meta.join("  \n"), "", renderPortableTextMarkdown(post.body), "");
  return lines.join("\n");
}

module.exports = async function handler(req, res) {
  if (rejectNonRead(req, res)) return;
  const head = req.method === "HEAD";
  const wantsMarkdown = queryValue(req, "format") === "md";
  const raw = requestedSlug(req);
  const slug = cleanSlug(raw);

  if (!slug) {
    redirect(res, "/blog");
    return;
  }

  let page;
  try {
    page = await fetchPostPage(slug);
  } catch (error) {
    console.error("Blog article render failed:", error);
    if (wantsMarkdown) {
      send(res, 503, "text/plain; charset=utf-8", "The article is temporarily unavailable.\n", {
        head,
        cache: CACHE_NONE,
      });
    } else {
      send(res, 200, HTML, renderClientFallback("post"), { head, cache: CACHE_NONE });
    }
    return;
  }

  if (!page.post) {
    send(res, 404, HTML, renderNotFound(), {
      head,
      headers: { "X-Robots-Tag": "noindex" },
    });
    return;
  }

  // One address per article: send every other spelling of the slug to the canonical one.
  const canonicalSlug = cleanSlug(page.post.slug);
  if (raw !== canonicalSlug) {
    redirect(res, `/blog/${encodeURIComponent(canonicalSlug)}${wantsMarkdown ? ".md" : ""}`);
    return;
  }

  if (wantsMarkdown) {
    // The Link header tells search engines that the HTML article is the canonical copy.
    send(res, 200, MARKDOWN, postMarkdown(page.post), {
      head,
      headers: { Link: `<${postUrl(page.post.slug)}>; rel="canonical"` },
    });
    return;
  }

  send(res, 200, HTML, renderPost(page.post, page.posts), { head });
};

module.exports.postMarkdown = postMarkdown;
