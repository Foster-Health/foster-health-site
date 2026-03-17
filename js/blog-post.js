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

  function showStatus(message, type) {
    statusEl.className = `rise-in mt-6 rounded-[24px] border p-5 shadow-soft ${type}`;
    statusEl.innerHTML = message;
    statusEl.classList.remove("hidden");
  }

  async function initPost() {
    if (!hasValidConfig()) {
      showStatus(setupMessage("Add your Sanity project ID before loading article pages."), "blog-status-warning");
      return;
    }

    if (!slug) {
      showStatus(
        `
          <p class="text-xs font-bold uppercase tracking-[0.08em] text-primary">Missing article slug</p>
          <p class="mt-2 text-sm leading-6 text-muted">
            Open this page from the blog listing so the article slug is included in the URL.
          </p>
        `,
        "blog-status-warning"
      );
      return;
    }

    try {
      const post = await fetchSanity(postQuery, { slug });

      if (!post) {
        showStatus(
          `
            <p class="text-xs font-bold uppercase tracking-[0.08em] text-primary">Article not found</p>
            <p class="mt-2 text-sm leading-6 text-muted">
              This slug does not match a published Sanity post yet.
            </p>
          `,
          "blog-status-warning"
        );
        return;
      }

      document.title = `Foster Health | ${post.title}`;
      titleEl.textContent = post.title || "Untitled article";
      excerptEl.textContent = post.excerpt || "";
      chipsEl.innerHTML = (post.categories || [])
        .map(
          (category) =>
            `<span class="rounded-full border border-line bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-muted">${escapeHtml(
              category
            )}</span>`
        )
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
      if (!post.mainImageUrl) {
        heroWrapEl.classList.add("hidden");
      }

      bodyEl.innerHTML = renderPortableText(post.body);
      shellEl.classList.remove("hidden");
    } catch (error) {
      showStatus(
        `
          <p class="text-xs font-bold uppercase tracking-[0.08em] text-primary">Could not load article</p>
          <p class="mt-2 text-sm leading-6 text-muted">${escapeHtml(error.message)}</p>
        `,
        "blog-status-warning"
      );
    }
  }

  initPost();
})();
