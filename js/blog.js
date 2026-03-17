(function () {
  const statusEl = document.getElementById("blogStatus");
  const featuredEl = document.getElementById("featuredPost");
  const gridEl = document.getElementById("blogGrid");

  if (!statusEl || !featuredEl || !gridEl || !window.FosterSanity) {
    return;
  }

  const { escapeHtml, fetchSanity, formatDate, hasValidConfig, setupMessage } =
    window.FosterSanity;

  const postsQuery = `
    *[_type == "post" && defined(slug.current)]
      | order(coalesce(publishedAt, _createdAt) desc) {
        _id,
        title,
        excerpt,
        estimatedReadingTime,
        "slug": slug.current,
        "publishedAt": coalesce(publishedAt, _createdAt),
        "authorName": author->name,
        "categories": categories[]->title,
        "mainImageUrl": mainImage.asset->url,
        "mainImageAlt": coalesce(mainImage.alt, title)
      }
  `;

  function renderCategories(categories) {
    return (categories || [])
      .slice(0, 3)
      .map(
        (category) =>
          `<span class="rounded-full border border-line bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-muted">${escapeHtml(
            category
          )}</span>`
      )
      .join("");
  }

  function renderPostCard(post) {
    const imageMarkup = post.mainImageUrl
      ? `<img class="blog-card-image" src="${escapeHtml(
          post.mainImageUrl
        )}" alt="${escapeHtml(post.mainImageAlt || post.title)}" loading="lazy" />`
      : `<div class="blog-card-image blog-card-image-fallback"></div>`;

    return `
      <article class="blog-card rounded-[24px] border border-line bg-white shadow-soft transition hover:-translate-y-1 hover:border-primary/30">
        <a class="block h-full" href="/blog-post?slug=${encodeURIComponent(
          post.slug
        )}">
          ${imageMarkup}
          <div class="p-5">
            <div class="flex flex-wrap gap-2">${renderCategories(post.categories)}</div>
            <h3 class="font-display mt-4 text-2xl leading-tight text-ink">${escapeHtml(
              post.title
            )}</h3>
            <p class="mt-3 text-base leading-7 text-muted">${escapeHtml(
              post.excerpt || ""
            )}</p>
            <div class="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm font-semibold text-[#47607a]">
              <span>${escapeHtml(post.authorName || "Foster Health")}</span>
              <span>${escapeHtml(formatDate(post.publishedAt))}</span>
              ${
                post.estimatedReadingTime
                  ? `<span>${escapeHtml(String(post.estimatedReadingTime))} min read</span>`
                  : ""
              }
            </div>
          </div>
        </a>
      </article>
    `;
  }

  function renderFeaturedPost(post) {
    if (!post) {
      featuredEl.innerHTML = "";
      return;
    }

    featuredEl.innerHTML = `
      <article class="overflow-hidden rounded-[28px] border border-line bg-white shadow-panel">
        <div class="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
          <div class="p-6 lg:p-8">
            <p class="text-xs font-bold uppercase tracking-[0.08em] text-primary">Featured article</p>
            <div class="mt-5 flex flex-wrap gap-2">${renderCategories(post.categories)}</div>
            <h2 class="font-display mt-5 text-[clamp(2rem,3vw,3.3rem)] leading-tight">${escapeHtml(
              post.title
            )}</h2>
            <p class="mt-4 max-w-2xl text-lg leading-8 text-muted">${escapeHtml(
              post.excerpt || ""
            )}</p>
            <div class="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-sm font-semibold text-[#47607a]">
              <span>${escapeHtml(post.authorName || "Foster Health")}</span>
              <span>${escapeHtml(formatDate(post.publishedAt))}</span>
              ${
                post.estimatedReadingTime
                  ? `<span>${escapeHtml(String(post.estimatedReadingTime))} min read</span>`
                  : ""
              }
            </div>
            <a class="font-display mt-8 inline-flex items-center rounded-2xl bg-[#112036] px-5 py-3 font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#081727]"
              href="/blog-post?slug=${encodeURIComponent(post.slug)}">
              Read article
            </a>
          </div>
          <div class="min-h-[280px] border-t border-line lg:border-l lg:border-t-0">
            ${
              post.mainImageUrl
                ? `<img class="h-full w-full object-cover" src="${escapeHtml(
                    post.mainImageUrl
                  )}" alt="${escapeHtml(post.mainImageAlt || post.title)}" loading="lazy" />`
                : '<div class="h-full w-full bg-[linear-gradient(140deg,#dff2fb_0%,#eef9f4_100%)]"></div>'
            }
          </div>
        </div>
      </article>
    `;
  }

  function showStatus(message, type) {
    statusEl.className = `rise-in rounded-[24px] border p-5 shadow-soft ${type}`;
    statusEl.innerHTML = message;
    statusEl.classList.remove("hidden");
  }

  async function initBlog() {
    if (!hasValidConfig()) {
      showStatus(setupMessage("Add your Sanity project ID to connect the blog."), "blog-status-warning");
      return;
    }

    try {
      const posts = await fetchSanity(postsQuery);

      if (!Array.isArray(posts) || posts.length === 0) {
        showStatus(
          `
            <p class="text-xs font-bold uppercase tracking-[0.08em] text-primary">No posts yet</p>
            <p class="mt-2 text-sm leading-6 text-muted">
              The Sanity connection is working. Publish your first post and it will appear here.
            </p>
          `,
          "blog-status-info"
        );
        return;
      }

      renderFeaturedPost(posts[0]);
      gridEl.innerHTML = posts.slice(1).map(renderPostCard).join("");
    } catch (error) {
      showStatus(
        `
          <p class="text-xs font-bold uppercase tracking-[0.08em] text-primary">Could not load posts</p>
          <p class="mt-2 text-sm leading-6 text-muted">${escapeHtml(error.message)}</p>
        `,
        "blog-status-warning"
      );
    }
  }

  initBlog();
})();
