// GET /llms.txt — a short Markdown guide to the site for AI assistants (llmstxt.org format).
// GET /llms-full.txt — the same guide followed by the full text of every article.

const { SITE_URL, fetchPostsWithBody, postUrl } = require("../lib/sanity");
const { CACHE_NONE, queryValue, rejectNonRead, send } = require("../lib/http");
const { postMarkdown } = require("./blog-post");

const TEXT = "text/plain; charset=utf-8";

// These statements repeat the copy on the home page. Change them when the home page copy changes.
const SUMMARY =
  "Foster Health is the clinical intelligence behind skilled nursing facility (SNF) reimbursement. Foster uncovers missed reimbursement, helps Minimum Data Set (MDS) teams code accurately and work more efficiently, and gives facilities an extra set of hands from real-time chart review to denial management.";

function oneLine(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function buildIndex(posts, full) {
  const lines = [
    "# Foster Health",
    "",
    `> ${SUMMARY}`,
    "",
    "Foster Health Technologies, Inc. is an MDS firm for skilled nursing. Its team combines long term care operators, clinicians, researchers, and revenue cycle management experts. The blog explains the Patient-Driven Payment Model (PDPM), the MDS assessment process, Assessment Reference Date (ARD) timing, Non-Therapy Ancillary (NTA) points, MDS audits, and CMS rule changes for SNF operators and MDS coordinators.",
    "",
    "## Company",
    "",
    `- [Foster Health home page](${SITE_URL}/): What Foster does for SNF reimbursement and MDS teams.`,
    `- [Contact Foster Health](${SITE_URL}/#chat): Form to talk with the Foster team.`,
    `- [Blog](${SITE_URL}/blog): All articles. An RSS feed is at ${SITE_URL}/rss.xml.`,
    "",
    "## Articles",
    "",
  ];

  posts.forEach((post) => {
    const excerpt = oneLine(post.excerpt);
    lines.push(`- [${oneLine(post.title)}](${postUrl(post.slug)}.md)${excerpt ? `: ${excerpt}` : ""}`);
  });

  lines.push(
    "",
    "## Optional",
    "",
    `- [Privacy policy](${SITE_URL}/privacy)`,
    `- [Terms of service](${SITE_URL}/terms)`,
    `- [Full text of all articles](${SITE_URL}/llms-full.txt)`,
    ""
  );

  if (full) {
    posts.forEach((post) => {
      lines.push("---", "", postMarkdown(post));
    });
  }

  return lines.join("\n");
}

module.exports = async function handler(req, res) {
  if (rejectNonRead(req, res)) return;
  const head = req.method === "HEAD";
  const full = queryValue(req, "full") === "1";

  try {
    send(res, 200, TEXT, buildIndex(await fetchPostsWithBody(), full), { head });
  } catch (error) {
    console.error("llms.txt render failed:", error);
    send(res, 200, TEXT, buildIndex([], false), { head, cache: CACHE_NONE });
  }
};

module.exports.buildIndex = buildIndex;
