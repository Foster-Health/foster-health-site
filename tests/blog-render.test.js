const assert = require("node:assert/strict");
const test = require("node:test");

const blogHandler = require("../api/blog");
const postHandler = require("../api/blog-post");
const sitemapHandler = require("../api/sitemap");
const rssHandler = require("../api/rss");
const llmsHandler = require("../api/llms");
const { normalizeHref, renderPortableTextHtml } = require("../lib/render");
const { pickRelated } = require("../lib/pages");

const span = (text, marks) => ({ _type: "span", text, marks: marks || [] });
const block = (style, text, extra) => ({
  _type: "block",
  style,
  children: [span(text)],
  markDefs: [],
  ...(extra || {}),
});

const BODY = [
  block("normal", "The ARD window sets the payment for the stay."),
  block("h2", "What is the ARD window?"),
  block("normal", "It is the period in which the assessment reference date can be set."),
  block("h2", "Why does timing matter?"),
  {
    _type: "block",
    style: "normal",
    markDefs: [
      { _key: "a1", _type: "link", href: "https://www.fosterhealth.io/blog-post?slug=%2Fblog%2Fsecond-post%2F" },
      { _key: "a2", _type: "link", href: "https://www.fosterhealth.io/book-a-demo#book-demo-form" },
    ],
    children: [span("Read "), span("the second post", ["a1"]), span(" or "), span("talk to us", ["a2", "strong"])],
  },
  block("normal", "First item", { listItem: "bullet", level: 1 }),
  block("normal", "Second item", { listItem: "bullet", level: 1 }),
  {
    _type: "table",
    rows: [
      { cells: ["Area", "Effect"] },
      { cells: ["NTA", "Points lost | per stay"] },
      { cells: ["Path", "C:\\notes"] },
    ],
  },
];

const POSTS = [
  {
    title: 'Third <script>alert("x")</script> post',
    slug: "third-post",
    excerpt: "  Newest post.  ",
    publishedAt: "2026-07-29T19:31:09.330Z",
    modifiedAt: "2026-07-30T10:00:00Z",
    authorName: "Avery Smith",
    authorRole: "CEO",
    estimatedReadingTime: 4,
    body: BODY,
  },
  {
    title: "Second post",
    slug: "/blog/second-post/",
    excerpt: "Middle post.",
    publishedAt: "2026-05-09T18:02:18.004Z",
    modifiedAt: "2026-05-09T18:02:31Z",
    authorName: "Avery Smith",
    body: BODY,
  },
  {
    title: "First post",
    slug: "first-post/",
    excerpt: "Oldest post.",
    publishedAt: "2026-02-05T17:13:00.000Z",
    modifiedAt: "2026-03-18T16:14:24Z",
    body: BODY,
  },
];

const strip = ({ body, ...summary }) => summary;

// Answer Sanity queries from the fixture, the way the hosted API would.
function stubSanity(options) {
  const settings = options || {};
  const original = global.fetch;
  global.fetch = async (url) => {
    if (settings.fail) throw new Error("network down");
    const params = new URL(url).searchParams;
    const query = params.get("query");
    let result;
    if (query.includes('"post":')) {
      const slugs = JSON.parse(params.get("$slugs"));
      result = {
        post: POSTS.find((post) => slugs.includes(post.slug)) || null,
        posts: POSTS.map(strip),
      };
    } else {
      result = query.includes("body[]") ? POSTS : POSTS.map(strip);
    }
    return { ok: true, status: 200, json: async () => ({ result }) };
  };
  return () => {
    global.fetch = original;
  };
}

async function call(handler, query, method) {
  const response = {
    statusCode: 200,
    headers: {},
    body: "",
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    end(value) {
      this.body = value || "";
    },
  };
  await handler({ method: method || "GET", query: query || {}, url: "/" }, response);
  return response;
}

function jsonLd(html) {
  const match = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
  assert(match, "page has structured data");
  return JSON.parse(match[1]);
}

test("legacy and encoded article links point at the current address", () => {
  assert.equal(
    normalizeHref("https://www.fosterhealth.io/blog-post?slug=%2Fblog%2Fard-window-pdpm-snf%2F"),
    "/blog/ard-window-pdpm-snf"
  );
  assert.equal(
    normalizeHref("https://www.fosterhealth.io/blog/%2Fblog%2Fard-window-pdpm-snf%2F"),
    "/blog/ard-window-pdpm-snf"
  );
  assert.equal(normalizeHref("https://www.fosterhealth.io/book-a-demo#book-demo-form"), "/#chat");
  assert.equal(normalizeHref("https://www.fosterhealth.io/contact"), "/#chat");
  assert.equal(normalizeHref("https://www.fosterhealth.io/"), "/");
  assert.equal(normalizeHref("https://calendly.com/example/30min"), "https://calendly.com/example/30min");
  assert.equal(normalizeHref("javascript:alert(1)"), "#");
});

test("article body renders lists, tables, headings with anchors, and escaped text", () => {
  const html = renderPortableTextHtml(BODY);
  assert(html.includes('<h2 id="what-is-the-ard-window">What is the ARD window?</h2>'));
  assert(html.includes("<ul><li>First item</li><li>Second item</li></ul>"));
  assert(html.includes('<th scope="col">Area</th>'));
  assert(html.includes('<a href="/blog/second-post">the second post</a>'));
  assert(html.includes('<strong><a href="/#chat">talk to us</a></strong>'));
});

test("an article is served as full HTML with its own metadata", async () => {
  const restore = stubSanity();
  try {
    const response = await call(postHandler, { slug: "third-post" });
    assert.equal(response.statusCode, 200);
    assert.match(response.headers["content-type"], /text\/html/);
    assert.match(response.headers["cache-control"], /s-maxage=300/);

    const html = response.body;
    assert(html.includes('<link rel="canonical" href="https://www.fosterhealth.io/blog/third-post">'));
    assert(html.includes('<meta name="description" content="Newest post.">'));
    assert(html.includes("The ARD window sets the payment for the stay."));
    assert(!html.includes("<script>alert"), "the title is escaped in HTML");
    assert(!/<script src=/.test(html), "the article does not need JavaScript");

    const graph = jsonLd(html)["@graph"];
    const article = graph.find((node) => node["@type"] === "BlogPosting");
    assert.equal(article.headline, 'Third <script>alert("x")</script> post');
    assert.equal(article.datePublished, "2026-07-29T19:31:09.330Z");
    assert.equal(article.author.name, "Avery Smith");
    assert.equal(article.author.jobTitle, "CEO");
    assert(article.wordCount > 20);
    assert(graph.some((node) => node["@type"] === "BreadcrumbList"));
    const faq = graph.find((node) => node["@type"] === "FAQPage");
    assert.equal(faq.mainEntity.length, 2);
    assert.equal(faq.mainEntity[0].name, "What is the ARD window?");

    assert(html.includes('href="/blog/second-post"'), "links to another article");
  } finally {
    restore();
  }
});

test("an unknown article returns a real 404 that search engines do not index", async () => {
  const restore = stubSanity();
  try {
    const response = await call(postHandler, { slug: "not-a-post" });
    assert.equal(response.statusCode, 404);
    assert(response.body.includes('content="noindex, follow"'));
    assert(response.body.includes("Article not found"));
  } finally {
    restore();
  }
});

test("another spelling of a slug redirects to the one canonical address", async () => {
  const restore = stubSanity();
  try {
    const response = await call(postHandler, { slug: "/blog/second-post/" });
    assert.equal(response.statusCode, 308);
    assert.equal(response.headers.location, "/blog/second-post");

    const canonical = await call(postHandler, { slug: "second-post" });
    assert.equal(canonical.statusCode, 200);
  } finally {
    restore();
  }
});

test("an article is also available as Markdown", async () => {
  const restore = stubSanity();
  try {
    const response = await call(postHandler, { slug: "first-post", format: "md" });
    assert.equal(response.statusCode, 200);
    assert.match(response.headers["content-type"], /text\/markdown/);
    assert.equal(response.headers.link, '<https://www.fosterhealth.io/blog/first-post>; rel="canonical"');
    assert(response.body.startsWith("# First post\n"));
    assert(response.body.includes("## What is the ARD window?"));
    assert(response.body.includes("[the second post](https://www.fosterhealth.io/blog/second-post)"));
    assert(response.body.includes("| NTA | Points lost \\| per stay |"));
    assert(response.body.includes("| Path | C:\\\\notes |"), "a backslash in a table cell is escaped");
    assert(response.body.includes("- First item\n- Second item"));
  } finally {
    restore();
  }
});

test("the blog index lists every article as a link in the HTML", async () => {
  const restore = stubSanity();
  try {
    const response = await call(blogHandler);
    assert.equal(response.statusCode, 200);
    for (const slug of ["third-post", "second-post", "first-post"]) {
      assert(response.body.includes(`href="/blog/${slug}"`), `links to ${slug}`);
    }
    const blog = jsonLd(response.body)["@graph"].find((node) => node["@type"] === "Blog");
    assert.equal(blog.blogPost.length, 3);
    assert.equal(blog.blogPost[1].url, "https://www.fosterhealth.io/blog/second-post");
  } finally {
    restore();
  }
});

test("if Sanity cannot be reached, readers get the browser-rendered page and the CDN does not keep it", async () => {
  const restore = stubSanity({ fail: true });
  const originalError = console.error;
  console.error = () => {};
  try {
    const index = await call(blogHandler);
    assert.equal(index.statusCode, 200);
    assert.equal(index.headers["cache-control"], "no-store");
    assert(index.body.includes('<script src="/js/blog.js"></script>'));

    const post = await call(postHandler, { slug: "third-post" });
    assert.equal(post.statusCode, 200);
    assert.equal(post.headers["cache-control"], "no-store");
    assert(post.body.includes('<script src="/js/blog-post.js"></script>'));
    assert(post.body.includes('id="canonicalUrl"'));
  } finally {
    console.error = originalError;
    restore();
  }
});

test("the sitemap lists the fixed pages and each article once, with clean addresses", async () => {
  const restore = stubSanity();
  try {
    const response = await call(sitemapHandler);
    assert.match(response.headers["content-type"], /application\/xml/);
    const locs = [...response.body.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
    assert.deepEqual(locs, [
      "https://www.fosterhealth.io/",
      "https://www.fosterhealth.io/blog",
      "https://www.fosterhealth.io/privacy",
      "https://www.fosterhealth.io/terms",
      "https://www.fosterhealth.io/sms-terms",
      "https://www.fosterhealth.io/blog/third-post",
      "https://www.fosterhealth.io/blog/second-post",
      "https://www.fosterhealth.io/blog/first-post",
    ]);
    assert(response.body.includes("<lastmod>2026-07-30T10:00:00.000Z</lastmod>"));
  } finally {
    restore();
  }
});

test("the feed carries the full article text with absolute links", async () => {
  const restore = stubSanity();
  try {
    const response = await call(rssHandler);
    assert.match(response.headers["content-type"], /application\/rss\+xml/);
    assert.equal((response.body.match(/<item>/g) || []).length, 3);
    assert(response.body.includes("<title>Third &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; post</title>"));
    assert(response.body.includes('href="https://www.fosterhealth.io/blog/second-post"'));
    assert(response.body.includes("<pubDate>Wed, 29 Jul 2026 19:31:09 GMT</pubDate>"));
  } finally {
    restore();
  }
});

test("llms.txt lists each article, and llms-full.txt adds the article text", async () => {
  const restore = stubSanity();
  try {
    const index = await call(llmsHandler);
    assert.match(index.headers["content-type"], /text\/plain/);
    assert(index.body.startsWith("# Foster Health\n\n> "));
    assert(index.body.includes("- [Second post](https://www.fosterhealth.io/blog/second-post.md): Middle post."));
    assert(!index.body.includes("## What is the ARD window?"));

    const full = await call(llmsHandler, { full: "1" });
    assert(full.body.includes("## What is the ARD window?"));
  } finally {
    restore();
  }
});

test("HEAD requests return headers without a body, and writes are refused", async () => {
  const restore = stubSanity();
  try {
    const head = await call(blogHandler, {}, "HEAD");
    assert.equal(head.statusCode, 200);
    assert.equal(head.body, "");

    const post = await call(blogHandler, {}, "POST");
    assert.equal(post.statusCode, 405);
    assert.equal(post.headers.allow, "GET, HEAD");
  } finally {
    restore();
  }
});

test("each article links to its nearest neighbours in date order", () => {
  const posts = ["a", "b", "c", "d", "e"].map((slug) => ({ slug }));
  assert.deepEqual(pickRelated(posts[2], posts, 3).map((post) => post.slug), ["b", "d", "a"]);
  assert.deepEqual(pickRelated(posts[0], posts, 3).map((post) => post.slug), ["b", "c", "d"]);
});
