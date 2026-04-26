(function () {
  const statusEl = document.getElementById("postStatus");
  const shellEl = document.getElementById("articleShell");
  const titleEl = document.getElementById("postTitle");
  const excerptEl = document.getElementById("postExcerpt");
  const metaEl = document.getElementById("postMeta");
  const chipsEl = document.getElementById("postChips");
  const heroWrapEl = document.getElementById("postHeroWrap");
  const bodyEl = document.getElementById("postBody");

  if (
    !statusEl ||
    !shellEl ||
    !titleEl ||
    !excerptEl ||
    !metaEl ||
    !chipsEl ||
    !heroWrapEl ||
    !bodyEl ||
    !window.FosterSanity
  ) {
    return;
  }

  const {
    escapeHtml,
    fetchSanity,
    formatDate,
    hasValidConfig,
    renderPortableText,
    setupMessage,
  } = window.FosterSanity;

  const params = new URLSearchParams(window.location.search);
  const slug = params.get("slug");

  const postQuery = `
    *[_type == "post" && slug.current == $slug][0]{
      title,
      excerpt,
      estimatedReadingTime,
      "slug": slug.current,
      "publishedAt": coalesce(publishedAt, _createdAt),
      "authorName": author->name,
      "categories": categories[]->title,
      "mainImageUrl": mainImage.asset->url,
      "mainImageAlt": coalesce(mainImage.alt, title),
      body[]{
        ...,
        _type == "image" => {
          ...,
          "url": asset->url
        }
      }
    }
  `;

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

  async function initPost() {
    if (!hasValidConfig()) {
      showStatus(
        setupMessage("Add your Sanity project ID before loading article pages."),
        "blog-status-warning"
      );
      return;
    }

    if (!slug) {
      showStatus(
        statusMessage(
          "Missing article slug",
          "Open this page from the blog listing so the article slug is included in the URL."
        ),
        "blog-status-warning"
      );
      return;
    }

    try {
      const post = await fetchSanity(postQuery, { slug });

      if (!post) {
        showStatus(
          statusMessage(
            "Article not found",
            "This slug does not match a published Sanity post yet."
          ),
          "blog-status-warning"
        );
        return;
      }

      document.title = `Foster Health | ${post.title}`;
      titleEl.textContent = post.title || "Untitled article";
      excerptEl.textContent = post.excerpt || "";
      chipsEl.innerHTML = (post.categories || [])
        .map((category) => `<span class="blog-chip">${escapeHtml(category)}</span>`)
        .join("");
      metaEl.innerHTML = `
        <span>${escapeHtml(post.authorName || "Foster Health")}</span>
        <span>${escapeHtml(formatDate(post.publishedAt))}</span>
        ${
          post.estimatedReadingTime
            ? `<span>${escapeHtml(String(post.estimatedReadingTime))} min read</span>`
            : ""
        }
      `;
      heroWrapEl.innerHTML = post.mainImageUrl
        ? `
          <img class="blog-post-hero" src="${escapeHtml(post.mainImageUrl)}" alt="${escapeHtml(
            post.mainImageAlt || post.title
          )}" loading="lazy" />
        `
        : "";
      heroWrapEl.classList.toggle("hidden", !post.mainImageUrl);

      bodyEl.innerHTML = renderPortableText(post.body);
      shellEl.classList.remove("hidden");
    } catch (error) {
      showStatus(
        statusMessage("Could not load article", error.message),
        "blog-status-warning"
      );
    }
  }

  initPost();
})();
