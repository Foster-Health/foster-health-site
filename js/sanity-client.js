(function () {
  const config = window.FOSTER_SANITY_CONFIG || {};

  function hasValidConfig() {
    return Boolean(
      config.projectId &&
      config.dataset &&
      config.projectId !== "REPLACE_WITH_PROJECT_ID"
    );
  }

  function buildQueryUrl(query, params) {
    const searchParams = new URLSearchParams();
    searchParams.set("query", query);
    searchParams.set("perspective", "published");

    Object.entries(params || {}).forEach(([key, value]) => {
      searchParams.set(`$${key}`, value);
    });

    return `https://${config.projectId}.apicdn.sanity.io/v${config.apiVersion}/data/query/${config.dataset}?${searchParams.toString()}`;
  }

  async function fetchSanity(query, params) {
    if (!hasValidConfig()) {
      throw new Error(
        "Sanity is not configured yet. Add your project ID in /js/sanity-site-config.js."
      );
    }

    const response = await fetch(buildQueryUrl(query, params), {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Sanity request failed with ${response.status}.`);
    }

    const payload = await response.json();
    return payload.result;
  }

  function formatDate(value) {
    if (!value) {
      return "";
    }

    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(new Date(value));
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function buildLinkFromMarkDef(text, markDef) {
    const href = escapeHtml(markDef.href || "#");
    const rel = markDef.blank ? ' rel="noreferrer"' : "";
    const target = markDef.blank ? ' target="_blank"' : "";
    return `<a href="${href}"${target}${rel}>${text}</a>`;
  }

  function renderSpanText(span, markDefs) {
    let output = escapeHtml(span.text || "");
    const marks = Array.isArray(span.marks) ? span.marks : [];

    marks.forEach((mark) => {
      if (mark === "strong") {
        output = `<strong>${output}</strong>`;
      } else if (mark === "em") {
        output = `<em>${output}</em>`;
      } else if (mark === "code") {
        output = `<code>${output}</code>`;
      } else {
        const markDef = (markDefs || []).find((item) => item._key === mark);
        if (markDef && markDef._type === "link") {
          output = buildLinkFromMarkDef(output, markDef);
        }
      }
    });

    return output;
  }

  function renderBlockChildren(block) {
    return (block.children || [])
      .map((child) => renderSpanText(child, block.markDefs))
      .join("");
  }

  function renderPortableText(blocks) {
    if (!Array.isArray(blocks) || blocks.length === 0) {
      return "<p>This article does not have body content yet.</p>";
    }

    const html = [];
    let listBuffer = null;

    function flushList() {
      if (!listBuffer) {
        return;
      }

      const tag = listBuffer.type === "number" ? "ol" : "ul";
      html.push(
        `<${tag}>${listBuffer.items
          .map((item) => `<li>${item}</li>`)
          .join("")}</${tag}>`
      );
      listBuffer = null;
    }

    blocks.forEach((block) => {
      if (block._type === "image" && block.url) {
        flushList();
        html.push(
          `<figure><img src="${escapeHtml(block.url)}" alt="${escapeHtml(
            block.alt || ""
          )}" loading="lazy" /><figcaption>${escapeHtml(
            block.caption || ""
          )}</figcaption></figure>`
        );
        return;
      }

      if (block._type !== "block") {
        return;
      }

      const content = renderBlockChildren(block);

      if (block.listItem) {
        const listType = block.listItem === "number" ? "number" : "bullet";
        if (!listBuffer || listBuffer.type !== listType) {
          flushList();
          listBuffer = { type: listType, items: [] };
        }

        listBuffer.items.push(content);
        return;
      }

      flushList();

      const style = block.style || "normal";
      if (style === "h2") {
        html.push(`<h2>${content}</h2>`);
      } else if (style === "h3") {
        html.push(`<h3>${content}</h3>`);
      } else if (style === "h4") {
        html.push(`<h4>${content}</h4>`);
      } else if (style === "blockquote") {
        html.push(`<blockquote>${content}</blockquote>`);
      } else {
        html.push(`<p>${content}</p>`);
      }
    });

    flushList();
    return html.join("");
  }

  function setupMessage(message) {
    return `
      <div class="blog-status blog-status-warning">
        <p class="text-xs font-bold uppercase tracking-[0.08em] text-primary">Sanity setup needed</p>
        <p class="mt-2 text-sm leading-6 text-muted">${escapeHtml(message)}</p>
        <p class="mt-3 text-sm leading-6 text-muted">
          Use the setup steps in <code>/SANITY_SETUP.md</code>, then publish a post in Sanity Studio.
        </p>
      </div>
    `;
  }

  window.FosterSanity = {
    config,
    escapeHtml,
    fetchSanity,
    formatDate,
    hasValidConfig,
    renderPortableText,
    setupMessage,
  };
})();
