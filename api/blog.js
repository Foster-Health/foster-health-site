// GET /blog — the blog index, rendered on the server so crawlers that do not run JavaScript can read it.

const { fetchPostSummaries } = require("../lib/sanity");
const { renderBlogIndex, renderClientFallback } = require("../lib/pages");
const { CACHE_NONE, rejectNonRead, send } = require("../lib/http");

const HTML = "text/html; charset=utf-8";

module.exports = async function handler(req, res) {
  if (rejectNonRead(req, res)) return;
  const head = req.method === "HEAD";

  try {
    const posts = await fetchPostSummaries();
    send(res, 200, HTML, renderBlogIndex(posts), { head });
  } catch (error) {
    console.error("Blog index render failed:", error);
    send(res, 200, HTML, renderClientFallback("index"), { head, cache: CACHE_NONE });
  }
};
