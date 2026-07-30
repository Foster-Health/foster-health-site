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
  const slug =
    params.get("slug") ||
    decodeURIComponent(window.location.pathname.split("/").filter(Boolean)[1] || "");

  const postQuery = `
    *[_type == "post" && slug.current == $slug][0]{
      title,
      excerpt,
      estimatedReadingTime,
      "slug": slug.current,
      "publishedAt": coalesce(publishedAt, _createdAt),
      "modifiedAt": _updatedAt,
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

  function updateMetadata(post) {
    const title = `${post.title} — Foster Health`;
    const description =
      post.excerpt ||
      "Read the latest Foster Health article on reimbursement capture and recovery for skilled nursing.";
    const url = `https://www.fosterhealth.io/blog/${encodeURIComponent(post.slug)}`;
    const values = {
      metaDescription: description,
      ogTitle: title,
      ogDescription: description,
      ogUrl: url,
      ogImage: post.mainImageUrl || "",
      twitterTitle: title,
      twitterDescription: description,
      twitterImage: post.mainImageUrl || "",
      articlePublishedTime: post.publishedAt || "",
      articleModifiedTime: post.modifiedAt || "",
      articleAuthor: post.authorName || "Foster Health",
    };

    document.title = title;
    document.getElementById("canonicalUrl").href = url;
    Object.entries(values).forEach(([id, content]) => {
      document.getElementById(id).content = content;
    });

    const jsonLd = document.createElement("script");
    jsonLd.type = "application/ld+json";
    jsonLd.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Article",
      headline: post.title,
      description,
      image: post.mainImageUrl || undefined,
      datePublished: post.publishedAt,
      dateModified: post.modifiedAt,
      author: {
        "@type": "Person",
        name: post.authorName || "Foster Health",
      },
      publisher: {
        "@type": "Organization",
        name: "Foster Health",
        url: "https://www.fosterhealth.io/",
      },
      mainEntityOfPage: url,
    });
    document.head.appendChild(jsonLd);
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

      updateMetadata(post);
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
