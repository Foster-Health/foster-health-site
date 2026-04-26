(function () {
  const statusEl = document.getElementById("blogStatus");
  const featuredEl = document.getElementById("featuredPost");
  const gridEl = document.getElementById("blogGrid");
  const recentSectionEl = document.getElementById("recentPostsSection");

  if (!statusEl || !featuredEl || !gridEl || !window.FosterSanity) {
    return;
  }

  const { escapeHtml, fetchSanity, formatDate, hasValidConfig, setupMessage } =
    window.FosterSanity;
  const showCardImages = false;

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
          `<span class="blog-chip">${escapeHtml(category)}</span>`
      )
      .join("");
  }

  function renderPostCard(post) {
    const hasImage = showCardImages && Boolean(post.mainImageUrl);
    const imageMarkup = hasImage
      ? `<img class="blog-card-image" src="${escapeHtml(
          post.mainImageUrl
        )}" alt="${escapeHtml(post.mainImageAlt || post.title)}" loading="lazy" />`
      : "";

    return `
      <article class="blog-card${hasImage ? " blog-card-has-image" : ""}">
        <a class="blog-card-link" href="/blog-post.html?slug=${encodeURIComponent(
          post.slug
        )}">
          ${imageMarkup}
          <div class="blog-card-body">
            <div class="blog-chip-row">${renderCategories(post.categories)}</div>
            <h3 class="blog-card-title">${escapeHtml(post.title)}</h3>
            <p class="blog-card-excerpt">${escapeHtml(post.excerpt || "")}</p>
            <div class="blog-post-meta blog-card-meta">
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

    const hasImage = showCardImages && Boolean(post.mainImageUrl);

    featuredEl.innerHTML = `
      <article class="blog-featured-card${hasImage ? " blog-featured-card-has-image" : ""}">
        <div class="blog-featured-copy">
          <p class="blog-section-kicker">Featured article</p>
          <div class="blog-chip-row">${renderCategories(post.categories)}</div>
          <h2 class="blog-featured-title">${escapeHtml(post.title)}</h2>
          <p class="blog-featured-excerpt">${escapeHtml(post.excerpt || "")}</p>
          <div class="blog-post-meta">
            <span>${escapeHtml(post.authorName || "Foster Health")}</span>
            <span>${escapeHtml(formatDate(post.publishedAt))}</span>
            ${
              post.estimatedReadingTime
                ? `<span>${escapeHtml(String(post.estimatedReadingTime))} min read</span>`
                : ""
            }
          </div>
          <a class="blog-featured-link" href="/blog-post.html?slug=${encodeURIComponent(
            post.slug
          )}">
            Read article
          </a>
        </div>
        ${
          hasImage
            ? `<div class="blog-featured-media">
                <img class="blog-featured-image" src="${escapeHtml(
                  post.mainImageUrl
                )}" alt="${escapeHtml(post.mainImageAlt || post.title)}" loading="lazy" />
              </div>`
            : ""
        }
      </article>
    `;
  }

  function statusMessage(eyebrow, body, extraBody) {
    return `
      <p class="blog-status-eyebrow">${escapeHtml(eyebrow)}</p>
      <p class="blog-status-body">${escapeHtml(body)}</p>
      ${
        extraBody
          ? `<p class="blog-status-body">${escapeHtml(extraBody)}</p>`
          : ""
      }
    `;
  }

  function showStatus(message, type) {
    statusEl.className = `blog-status rise-in ${type}`;
    statusEl.innerHTML = message;
    statusEl.classList.remove("hidden");
  }

  async function initBlog() {
    if (!hasValidConfig()) {
      showStatus(
        setupMessage("Add your Sanity project ID to connect the blog."),
        "blog-status-warning"
      );
      return;
    }

    try {
      const posts = await fetchSanity(postsQuery);

      if (!Array.isArray(posts) || posts.length === 0) {
        featuredEl.innerHTML = "";
        gridEl.innerHTML = "";
        if (recentSectionEl) {
          recentSectionEl.classList.add("hidden");
        }
        showStatus(
          statusMessage(
            "No posts yet",
            "The Sanity connection is working.",
            "Publish your first post and it will appear here automatically."
          ),
          "blog-status-info"
        );
        return;
      }

      const remainingPosts = posts.slice(1);
      renderFeaturedPost(posts[0]);
      gridEl.innerHTML = remainingPosts.map(renderPostCard).join("");

      if (recentSectionEl) {
        recentSectionEl.classList.toggle("hidden", remainingPosts.length === 0);
      }
    } catch (error) {
      showStatus(
        statusMessage("Could not load posts", error.message),
        "blog-status-warning"
      );
    }
  }

  initBlog();
})();
