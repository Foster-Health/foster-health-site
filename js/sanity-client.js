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
      if (value === undefined) {
        return;
      }

      // Sanity expects query parameters as GROQ literals, so strings must be quoted.
      searchParams.set(`$${key}`, JSON.stringify(value));
    });

    return `https://${config.projectId}.apicdn.sanity.io/v${config.apiVersion}/data/query/${config.dataset}?${searchParams.toString()}`;
  }

  async function fetchSanity(query, params) {
    if (!hasValidConfig()) {
      throw new Error(
        "Sanity is not configured yet. Add your project ID in /js/sanity-site-config.js."
      );
    }

    let response;

    try {
      response = await fetch(buildQueryUrl(query, params), {
        headers: {
          Accept: "application/json",
        },
      });
    } catch (error) {
      throw new Error(
        "Browser request to Sanity failed. Check Sanity CORS origins for this site URL and make sure the dataset is publicly readable."
      );
    }

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error(
          "Sanity blocked the request. Make sure the dataset is publicly readable and this site origin is allowed in Sanity API CORS settings."
        );
      }

      if (response.status === 404) {
        throw new Error(
          "Sanity project or dataset was not found. Recheck projectId and dataset in /js/sanity-site-config.js."
        );
      }

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
      if (block._type === "table" && Array.isArray(block.rows)) {
        flushList();

        const rows = block.rows.filter(
          (row) => row && Array.isArray(row.cells) && row.cells.length > 0
        );

        if (rows.length === 0) {
          return;
        }

        const [headerRow, ...bodyRows] = rows;
        const headerHtml = headerRow.cells
          .map((cell) => `<th>${escapeHtml(cell)}</th>`)
          .join("");
        const bodyHtml = bodyRows
          .map(
            (row) =>
              `<tr>${row.cells
                .map((cell) => `<td>${escapeHtml(cell)}</td>`)
                .join("")}</tr>`
          )
          .join("");

        html.push(`
          <div class="blog-table-wrap">
            <table class="blog-table">
              <thead>
                <tr>${headerHtml}</tr>
              </thead>
              <tbody>${bodyHtml}</tbody>
            </table>
          </div>
        `);
        return;
      }

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
      <p class="blog-status-eyebrow">Sanity setup needed</p>
      <p class="blog-status-body">${escapeHtml(message)}</p>
      <p class="blog-status-body">
        Use the setup steps in <code>/SANITY_SETUP.md</code>, then publish a post in Sanity Studio.
      </p>
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
