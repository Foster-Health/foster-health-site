// Page templates for the server-rendered blog. The markup and class names match the
// former static blog.html and blog-post.html, so the design does not change.

const { SITE_URL, cleanSlug, postUrl } = require("./sanity");
const {
  countWords,
  escapeHtml,
  extractQuestions,
  formatDate,
  isoDate,
  jsonLdScript,
  renderPortableTextHtml,
} = require("./render");

const BLOG_TITLE = "Insights — Foster Health";
const BLOG_DESCRIPTION =
  "Practical insights from Foster Health on reimbursement capture, PDPM optimization, denial prevention, and revenue recovery for skilled nursing operators.";
const ARTICLE_FALLBACK_DESCRIPTION =
  "Read the latest Foster Health article on reimbursement capture and recovery for skilled nursing.";
const DEFAULT_SOCIAL_IMAGE = `${SITE_URL}/img/og-default.png`;
const FEED_URL = `${SITE_URL}/rss.xml`;

const ORGANIZATION = {
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: "Foster Health",
  legalName: "Foster Health Technologies, Inc.",
  url: `${SITE_URL}/`,
  logo: {
    "@type": "ImageObject",
    url: `${SITE_URL}/img/brand/foster-logo.png`,
  },
};

const FONT_LINKS = `<link rel="icon" type="image/svg+xml" href="/img/favicon.svg">
  <link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&amp;family=IBM+Plex+Mono:wght@400;500&amp;family=Inter:wght@400;500;600&amp;display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/blog.css">`;

const FOOTER = `<footer>
    <div class="wrap">
      <div>© 2026 Foster Health Technologies, Inc.</div>
      <nav aria-label="Legal">
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
        <a href="/sms-terms">SMS Terms</a>
      </nav>
    </div>
  </footer>`;

function siteHeader(blogIsCurrent) {
  return `<header class="site wrap">
    <a class="logo" href="/" aria-label="Foster home">Foster<span class="dot">.</span></a>
    <nav aria-label="Primary">
      <a class="navlink" href="/blog"${blogIsCurrent ? ' aria-current="page"' : ""}><i aria-hidden="true"></i>Blog</a>
      <a class="navlink" href="mailto:recruiting@fosterhealth.io?subject=Careers%20at%20Foster"><i aria-hidden="true"></i>Careers</a>
      <a class="navlink" href="/#contact"><i aria-hidden="true"></i>Contact</a>
    </nav>
  </header>`;
}

function postPath(post) {
  return `/blog/${encodeURIComponent(cleanSlug(post.slug))}`;
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function metaSpans(post) {
  const date = formatDate(post.publishedAt);
  return [
    `<span>${escapeHtml(post.authorName || "Foster Health")}</span>`,
    date ? `<span><time datetime="${escapeHtml(isoDate(post.publishedAt))}">${escapeHtml(date)}</time></span>` : "",
    post.estimatedReadingTime
      ? `<span>${escapeHtml(String(post.estimatedReadingTime))} min read</span>`
      : "",
  ]
    .filter(Boolean)
    .join("\n              ");
}

function chips(categories) {
  return (categories || [])
    .slice(0, 3)
    .map((category) => `<span class="blog-chip">${escapeHtml(category)}</span>`)
    .join("");
}

function postCard(post) {
  return `<article class="blog-card">
        <a class="blog-card-link" href="${postPath(post)}">
          <div class="blog-card-body">
            <div class="blog-chip-row">${chips(post.categories)}</div>
            <h3 class="blog-card-title">${escapeHtml(post.title)}</h3>
            <p class="blog-card-excerpt">${escapeHtml(cleanText(post.excerpt))}</p>
            <div class="blog-post-meta blog-card-meta">
              ${metaSpans(post)}
            </div>
          </div>
        </a>
      </article>`;
}

function featuredCard(post) {
  return `<article class="blog-featured-card">
        <div class="blog-featured-copy">
          <p class="blog-section-kicker">Featured article</p>
          <div class="blog-chip-row">${chips(post.categories)}</div>
          <h2 class="blog-featured-title">${escapeHtml(post.title)}</h2>
          <p class="blog-featured-excerpt">${escapeHtml(cleanText(post.excerpt))}</p>
          <div class="blog-post-meta">
              ${metaSpans(post)}
          </div>
          <a class="blog-featured-link" href="${postPath(post)}">
            Read article
          </a>
        </div>
      </article>`;
}

function breadcrumbs(items) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

function renderBlogIndex(posts) {
  const [featured, ...rest] = posts;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      ORGANIZATION,
      {
        "@type": "Blog",
        "@id": `${SITE_URL}/blog#blog`,
        name: "Foster Health Insights",
        description: BLOG_DESCRIPTION,
        url: `${SITE_URL}/blog`,
        inLanguage: "en-US",
        publisher: { "@id": ORGANIZATION["@id"] },
        blogPost: posts.map((post) => ({
          "@type": "BlogPosting",
          headline: post.title,
          url: postUrl(post.slug),
          datePublished: isoDate(post.publishedAt),
          dateModified: isoDate(post.modifiedAt || post.publishedAt),
        })),
      },
      breadcrumbs([
        { name: "Home", url: `${SITE_URL}/` },
        { name: "Blog", url: `${SITE_URL}/blog` },
      ]),
    ],
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(BLOG_TITLE)}</title>
  <meta name="description" content="${escapeHtml(BLOG_DESCRIPTION)}">
  <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">
  <link rel="canonical" href="${SITE_URL}/blog">
  <link rel="alternate" type="application/rss+xml" title="Foster Health Insights" href="${FEED_URL}">
  <meta property="og:title" content="${escapeHtml(BLOG_TITLE)}">
  <meta property="og:description" content="${escapeHtml(BLOG_DESCRIPTION)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${SITE_URL}/blog">
  <meta property="og:site_name" content="Foster Health">
  <meta property="og:image" content="${DEFAULT_SOCIAL_IMAGE}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(BLOG_TITLE)}">
  <meta name="twitter:description" content="${escapeHtml(BLOG_DESCRIPTION)}">
  <meta name="twitter:image" content="${DEFAULT_SOCIAL_IMAGE}">
  ${jsonLdScript(jsonLd)}
  ${FONT_LINKS}
</head>

<body class="blog-page">
  ${siteHeader(true)}

  <main class="wrap">
    <section class="blog-hero">
      <p class="blog-eyebrow">Foster Health insights</p>
      <h1>Ideas for a better-run <em>MDS.</em></h1>
      <p class="blog-hero-copy">Practical playbooks and field notes on reimbursement, claim accuracy, denials, and the work behind a reliable skilled nursing revenue cycle.</p>
    </section>
    <section aria-label="Articles">
      <div id="featuredPost" class="blog-featured-slot">
      ${featured ? featuredCard(featured) : ""}
      </div>
      <section id="recentPostsSection" class="blog-recent-section${rest.length ? "" : " hidden"}">
        <div class="blog-section-heading">
          <p class="blog-section-kicker">Latest from the team</p>
          <h2 class="blog-section-title">Recent articles</h2>
        </div>
        <div id="blogGrid" class="blog-grid">
      ${rest.map(postCard).join("\n      ")}
        </div>
      </section>
    </section>
  </main>

  ${FOOTER}
</body>
</html>
`;
}

// Link each article to its neighbours in date order, so every article has links from other articles.
function pickRelated(post, posts, limit) {
  const others = posts.filter((item) => cleanSlug(item.slug) !== cleanSlug(post.slug));
  const index = posts.findIndex((item) => cleanSlug(item.slug) === cleanSlug(post.slug));
  if (index < 0) return others.slice(0, limit);
  const ranked = others
    .map((item) => {
      const position = posts.indexOf(item);
      return { item, distance: Math.abs(position - index), position };
    })
    .sort((a, b) => a.distance - b.distance || a.position - b.position);
  return ranked.slice(0, limit).map((entry) => entry.item);
}

function relatedCard(post) {
  const date = formatDate(post.publishedAt);
  return `<article class="blog-card">
            <a class="blog-card-link" href="${postPath(post)}">
              <h3 class="blog-card-title">${escapeHtml(post.title)}</h3>
              <div class="blog-post-meta blog-card-meta">
                ${date ? `<span><time datetime="${escapeHtml(isoDate(post.publishedAt))}">${escapeHtml(date)}</time></span>` : ""}
              </div>
            </a>
          </article>`;
}

function renderPost(post, posts) {
  const url = postUrl(post.slug);
  // Search results cut long titles, so the brand suffix is added only when it fits.
  const title = String(post.title || "").length > 52 ? post.title : `${post.title} — Foster Health`;
  const description = cleanText(post.excerpt) || ARTICLE_FALLBACK_DESCRIPTION;
  const image = post.mainImageUrl || DEFAULT_SOCIAL_IMAGE;
  const published = isoDate(post.publishedAt);
  const modified = isoDate(post.modifiedAt || post.publishedAt);
  const authorName = post.authorName || "Foster Health";
  const related = pickRelated(post, posts || [], 3);
  const questions = extractQuestions(post.body);

  const author = post.authorName
    ? {
        "@type": "Person",
        name: post.authorName,
        ...(post.authorRole ? { jobTitle: post.authorRole } : {}),
        worksFor: { "@id": ORGANIZATION["@id"] },
      }
    : { "@id": ORGANIZATION["@id"] };

  const graph = [
    ORGANIZATION,
    {
      "@type": "BlogPosting",
      "@id": `${url}#article`,
      headline: post.title,
      description,
      image,
      datePublished: published,
      dateModified: modified,
      inLanguage: "en-US",
      wordCount: countWords(post.body),
      ...(post.categories && post.categories.length ? { articleSection: post.categories } : {}),
      author,
      publisher: { "@id": ORGANIZATION["@id"] },
      isPartOf: { "@type": "Blog", "@id": `${SITE_URL}/blog#blog`, name: "Foster Health Insights" },
      mainEntityOfPage: { "@type": "WebPage", "@id": url },
    },
    breadcrumbs([
      { name: "Home", url: `${SITE_URL}/` },
      { name: "Blog", url: `${SITE_URL}/blog` },
      { name: post.title, url },
    ]),
  ];
  if (questions.length >= 2) {
    graph.push({
      "@type": "FAQPage",
      "@id": `${url}#faq`,
      mainEntity: questions.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    });
  }

  const hero = post.mainImageUrl
    ? `<div id="postHeroWrap" class="blog-post-hero-wrap">
          <img class="blog-post-hero" src="${escapeHtml(post.mainImageUrl)}" alt="${escapeHtml(
            post.mainImageAlt || post.title
          )}" />
        </div>`
    : `<div id="postHeroWrap" class="blog-post-hero-wrap hidden"></div>`;

  const more = related.length
    ? `<section class="blog-more" aria-labelledby="moreArticles">
        <div class="blog-section-heading">
          <p class="blog-section-kicker">Keep reading</p>
          <h2 id="moreArticles" class="blog-section-title">More articles</h2>
        </div>
        <div class="blog-grid">
          ${related.map(relatedCard).join("\n          ")}
        </div>
      </section>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">
  <meta name="author" content="${escapeHtml(authorName)}">
  <link rel="canonical" href="${escapeHtml(url)}">
  <link rel="alternate" type="text/markdown" href="${escapeHtml(url)}.md">
  <link rel="alternate" type="application/rss+xml" title="Foster Health Insights" href="${FEED_URL}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${escapeHtml(url)}">
  <meta property="og:site_name" content="Foster Health">
  <meta property="og:image" content="${escapeHtml(image)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(image)}">
  <meta property="article:published_time" content="${escapeHtml(published)}">
  <meta property="article:modified_time" content="${escapeHtml(modified)}">
  <meta property="article:author" content="${escapeHtml(authorName)}">
  ${jsonLdScript({ "@context": "https://schema.org", "@graph": graph })}
  ${FONT_LINKS}
</head>

<body class="blog-page blog-article-page">
  ${siteHeader(false)}

  <main class="wrap">
    <div class="blog-article-wrap">
      <a href="/blog" class="blog-back-link">← All articles</a>
      <article id="articleShell" class="blog-post-shell">
        <header class="blog-post-header">
          <div id="postChips" class="blog-chip-row">${(post.categories || [])
            .map((category) => `<span class="blog-chip">${escapeHtml(category)}</span>`)
            .join("")}</div>
          <h1 id="postTitle" class="blog-post-title">${escapeHtml(post.title || "Untitled article")}</h1>
          <p id="postExcerpt" class="blog-post-excerpt">${escapeHtml(cleanText(post.excerpt))}</p>
          <div id="postMeta" class="blog-post-meta">
              ${metaSpans(post)}
          </div>
        </header>
        ${hero}
        <div id="postBody" class="blog-body">
${renderPortableTextHtml(post.body)}
        </div>
      </article>
      ${more}
    </div>
  </main>

  ${FOOTER}
</body>
</html>
`;
}

function renderNotFound() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Article not found — Foster Health</title>
  <meta name="robots" content="noindex, follow">
  ${FONT_LINKS}
</head>

<body class="blog-page blog-article-page">
  ${siteHeader(false)}

  <main class="wrap">
    <div class="blog-article-wrap">
      <a href="/blog" class="blog-back-link">← All articles</a>
      <div class="blog-status blog-status-warning">
        <p class="blog-status-eyebrow">Article not found</p>
        <p class="blog-status-body">This address does not match a published article. <a href="/blog">See all articles</a>.</p>
      </div>
    </div>
  </main>

  ${FOOTER}
</body>
</html>
`;
}

// If the server cannot reach Sanity, send the former browser-rendered page so readers still get the article.
function renderClientFallback(kind) {
  const isPost = kind === "post";
  const main = isPost
    ? `<div class="blog-article-wrap">
      <a href="/blog" class="blog-back-link">← All articles</a>
      <div id="postStatus" class="blog-status hidden" aria-live="polite"></div>
      <article id="articleShell" class="blog-post-shell hidden">
        <header class="blog-post-header">
          <div id="postChips" class="blog-chip-row"></div>
          <h1 id="postTitle" class="blog-post-title"></h1>
          <p id="postExcerpt" class="blog-post-excerpt"></p>
          <div id="postMeta" class="blog-post-meta"></div>
        </header>
        <div id="postHeroWrap" class="blog-post-hero-wrap"></div>
        <div id="postBody" class="blog-body"></div>
      </article>
    </div>`
    : `<section class="blog-hero">
      <p class="blog-eyebrow">Foster Health insights</p>
      <h1>Ideas for a better-run <em>MDS.</em></h1>
      <p class="blog-hero-copy">Practical playbooks and field notes on reimbursement, claim accuracy, denials, and the work behind a reliable skilled nursing revenue cycle.</p>
    </section>
    <section aria-label="Articles">
      <div id="blogStatus" class="blog-status hidden" aria-live="polite"></div>
      <div id="featuredPost" class="blog-featured-slot"></div>
      <section id="recentPostsSection" class="blog-recent-section">
        <div class="blog-section-heading">
          <p class="blog-section-kicker">Latest from the team</p>
          <h2 class="blog-section-title">Recent articles</h2>
        </div>
        <div id="blogGrid" class="blog-grid"></div>
      </section>
    </section>`;

  const head = isPost
    ? `<title>Article — Foster Health</title>
  <meta id="metaDescription" name="description" content="${escapeHtml(ARTICLE_FALLBACK_DESCRIPTION)}">
  <link id="canonicalUrl" rel="canonical" href="${SITE_URL}/blog">
  <meta id="ogTitle" property="og:title" content="Article — Foster Health">
  <meta id="ogDescription" property="og:description" content="${escapeHtml(ARTICLE_FALLBACK_DESCRIPTION)}">
  <meta property="og:type" content="article">
  <meta id="ogUrl" property="og:url" content="${SITE_URL}/blog">
  <meta property="og:site_name" content="Foster Health">
  <meta id="ogImage" property="og:image" content="">
  <meta name="twitter:card" content="summary_large_image">
  <meta id="twitterTitle" name="twitter:title" content="Article — Foster Health">
  <meta id="twitterDescription" name="twitter:description" content="${escapeHtml(ARTICLE_FALLBACK_DESCRIPTION)}">
  <meta id="twitterImage" name="twitter:image" content="">
  <meta id="articlePublishedTime" property="article:published_time" content="">
  <meta id="articleModifiedTime" property="article:modified_time" content="">
  <meta id="articleAuthor" property="article:author" content="">`
    : `<title>${escapeHtml(BLOG_TITLE)}</title>
  <meta name="description" content="${escapeHtml(BLOG_DESCRIPTION)}">
  <link rel="canonical" href="${SITE_URL}/blog">`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${head}
  ${FONT_LINKS}
</head>

<body class="blog-page${isPost ? " blog-article-page" : ""}">
  ${siteHeader(!isPost)}

  <main class="wrap">
    ${main}
  </main>

  ${FOOTER}

  <script src="/js/sanity-site-config.js"></script>
  <script src="/js/sanity-client.js"></script>
  <script src="/js/${isPost ? "blog-post" : "blog"}.js"></script>
</body>
</html>
`;
}

module.exports = {
  BLOG_DESCRIPTION,
  DEFAULT_SOCIAL_IMAGE,
  ORGANIZATION,
  pickRelated,
  renderBlogIndex,
  renderClientFallback,
  renderNotFound,
  renderPost,
};
