// Turns Sanity content into HTML, Markdown, and plain text on the server.
// The HTML output matches js/sanity-client.js so a server-rendered article looks the same as before.

const { SITE_URL, cleanSlug } = require("./sanity");

const SITE_HOSTS = new Set(["www.fosterhealth.io", "fosterhealth.io"]);
const CONTACT_PATHS = new Set(["/contact", "/book-a-demo"]);

function escapeHtml(value) {
  return String(value === null || value === undefined ? "" : value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeXml(value) {
  return escapeHtml(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

// JSON-LD sits inside a <script> element, so "<" must not be able to close the element.
function jsonLdScript(data) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return `<script type="application/ld+json">${json}</script>`;
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  }).format(date);
}

function isoDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

// Older articles link to retired addresses (/blog-post?slug=..., encoded "/blog/" slugs, /book-a-demo).
// Point those links at the current address so readers and crawlers do not follow a redirect or a dead link.
function normalizeHref(rawHref) {
  const raw = String(rawHref || "").trim();
  if (!/^(https?:|mailto:|\/)/i.test(raw)) return "#";
  if (/^mailto:/i.test(raw)) return raw;

  let url;
  try {
    url = new URL(raw, SITE_URL);
  } catch (error) {
    return "#";
  }
  if (!SITE_HOSTS.has(url.hostname)) return raw;

  let path = url.pathname;
  try {
    path = decodeURIComponent(path);
  } catch (error) {
    // Keep the encoded path if it does not decode.
  }
  path = path.replace(/\/{2,}/g, "/");

  if (path === "/blog-post" || path === "/blog-post.html") {
    const slug = cleanSlug(url.searchParams.get("slug"));
    return slug ? `/blog/${encodeURIComponent(slug)}` : "/blog";
  }
  if (path.startsWith("/blog/")) {
    const slug = cleanSlug(path.slice("/blog/".length));
    return slug ? `/blog/${encodeURIComponent(slug)}${url.hash}` : "/blog";
  }
  const trimmed = path.length > 1 ? path.replace(/\/+$/, "") : path;
  if (CONTACT_PATHS.has(trimmed)) return "/#chat";
  return `${trimmed}${url.search}${url.hash}`;
}

function absoluteHref(href) {
  return href.startsWith("/") ? `${SITE_URL}${href}` : href;
}

function blockText(block) {
  return (block.children || []).map((child) => child.text || "").join("");
}

function headingId(text, used) {
  const base =
    String(text || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "section";
  let id = base;
  let count = 2;
  while (used.has(id)) {
    id = `${base}-${count}`;
    count += 1;
  }
  used.add(id);
  return id;
}

function renderSpanHtml(span, markDefs) {
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
        const href = normalizeHref(markDef.href);
        const attrs = markDef.blank ? ' target="_blank" rel="noopener noreferrer"' : "";
        output = `<a href="${escapeHtml(href)}"${attrs}>${output}</a>`;
      }
    }
  });
  return output;
}

function renderBlockHtml(block) {
  return (block.children || []).map((child) => renderSpanHtml(child, block.markDefs)).join("");
}

function tableRows(block) {
  return (block.rows || []).filter(
    (row) => row && Array.isArray(row.cells) && row.cells.length > 0
  );
}

function renderPortableTextHtml(blocks) {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return "<p>This article does not have body content yet.</p>";
  }

  const html = [];
  const usedIds = new Set();
  let listBuffer = null;

  function flushList() {
    if (!listBuffer) return;
    const tag = listBuffer.type === "number" ? "ol" : "ul";
    html.push(`<${tag}>${listBuffer.items.map((item) => `<li>${item}</li>`).join("")}</${tag}>`);
    listBuffer = null;
  }

  blocks.forEach((block) => {
    if (block._type === "table" && Array.isArray(block.rows)) {
      flushList();
      const rows = tableRows(block);
      if (rows.length === 0) return;
      const [headerRow, ...bodyRows] = rows;
      const headerHtml = headerRow.cells
        .map((cell) => `<th scope="col">${escapeHtml(cell)}</th>`)
        .join("");
      const bodyHtml = bodyRows
        .map((row) => `<tr>${row.cells.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
        .join("");
      html.push(
        `<div class="blog-table-wrap"><table class="blog-table"><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></div>`
      );
      return;
    }

    if (block._type === "image" && block.url) {
      flushList();
      html.push(
        `<figure><img src="${escapeHtml(block.url)}" alt="${escapeHtml(
          block.alt || ""
        )}" loading="lazy" /><figcaption>${escapeHtml(block.caption || "")}</figcaption></figure>`
      );
      return;
    }

    if (block._type !== "block") return;
    const content = renderBlockHtml(block);

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
    if (style === "h2" || style === "h3" || style === "h4") {
      html.push(`<${style} id="${headingId(blockText(block), usedIds)}">${content}</${style}>`);
    } else if (style === "blockquote") {
      html.push(`<blockquote>${content}</blockquote>`);
    } else {
      html.push(`<p>${content}</p>`);
    }
  });

  flushList();
  return html.join("\n");
}

function renderSpanMarkdown(span, markDefs) {
  const text = String(span.text || "");
  if (!text.trim()) return text;
  const lead = text.match(/^\s*/)[0];
  const tail = text.match(/\s*$/)[0];
  let output = text.trim();
  const marks = Array.isArray(span.marks) ? span.marks : [];
  marks.forEach((mark) => {
    if (mark === "strong") {
      output = `**${output}**`;
    } else if (mark === "em") {
      output = `*${output}*`;
    } else if (mark === "code") {
      output = `\`${output}\``;
    } else {
      const markDef = (markDefs || []).find((item) => item._key === mark);
      if (markDef && markDef._type === "link") {
        const href = normalizeHref(markDef.href);
        if (href !== "#") output = `[${output}](${absoluteHref(href)})`;
      }
    }
  });
  return `${lead}${output}${tail}`;
}

function renderPortableTextMarkdown(blocks) {
  if (!Array.isArray(blocks)) return "";
  const out = [];
  let inList = false;

  blocks.forEach((block) => {
    if (block._type === "table" && Array.isArray(block.rows)) {
      const rows = tableRows(block);
      if (rows.length === 0) return;
      const cell = (value) =>
        String(value || "")
          .replace(/\\/g, "\\\\")
          .replace(/\|/g, "\\|")
          .replace(/\s+/g, " ")
          .trim();
      const [headerRow, ...bodyRows] = rows;
      const lines = [
        `| ${headerRow.cells.map(cell).join(" | ")} |`,
        `| ${headerRow.cells.map(() => "---").join(" | ")} |`,
        ...bodyRows.map((row) => `| ${row.cells.map(cell).join(" | ")} |`),
      ];
      out.push(lines.join("\n"));
      inList = false;
      return;
    }

    if (block._type === "image" && block.url) {
      out.push(`![${block.alt || ""}](${block.url})`);
      inList = false;
      return;
    }

    if (block._type !== "block") return;
    const content = (block.children || [])
      .map((child) => renderSpanMarkdown(child, block.markDefs))
      .join("")
      .trim();
    if (!content) return;

    if (block.listItem) {
      const indent = "  ".repeat(Math.max(0, (block.level || 1) - 1));
      const bullet = block.listItem === "number" ? "1." : "-";
      const line = `${indent}${bullet} ${content}`;
      if (inList) {
        out[out.length - 1] += `\n${line}`;
      } else {
        out.push(line);
      }
      inList = true;
      return;
    }

    inList = false;
    const style = block.style || "normal";
    if (style === "h2") out.push(`## ${content}`);
    else if (style === "h3") out.push(`### ${content}`);
    else if (style === "h4") out.push(`#### ${content}`);
    else if (style === "blockquote") out.push(`> ${content}`);
    else out.push(content);
  });

  return out.join("\n\n");
}

function countWords(blocks) {
  if (!Array.isArray(blocks)) return 0;
  return blocks.reduce((total, block) => {
    if (block._type === "block") {
      return total + blockText(block).split(/\s+/).filter(Boolean).length;
    }
    if (block._type === "table") {
      return (
        total +
        tableRows(block).reduce(
          (sum, row) => sum + row.cells.join(" ").split(/\s+/).filter(Boolean).length,
          0
        )
      );
    }
    return total;
  }, 0);
}

// A heading that is a question, followed by its paragraphs, is a question and answer that the page shows.
function extractQuestions(blocks) {
  if (!Array.isArray(blocks)) return [];
  const questions = [];
  let current = null;

  blocks.forEach((block) => {
    const isHeading = block._type === "block" && /^h[2-4]$/.test(block.style || "");
    if (isHeading) {
      if (current && current.answer.length) questions.push(current);
      const text = blockText(block).trim();
      current = /\?$/.test(text) ? { question: text, answer: [] } : null;
      return;
    }
    if (current && block._type === "block") {
      const text = blockText(block).trim();
      if (text) current.answer.push(text);
    }
  });
  if (current && current.answer.length) questions.push(current);

  return questions.map((item) => ({
    question: item.question,
    answer: item.answer.join(" ").slice(0, 1200),
  }));
}

module.exports = {
  absoluteHref,
  countWords,
  escapeHtml,
  escapeXml,
  extractQuestions,
  formatDate,
  isoDate,
  jsonLdScript,
  normalizeHref,
  renderPortableTextHtml,
  renderPortableTextMarkdown,
};
