// Server-side reader for the public Sanity dataset that holds the blog.
// The project ID and dataset are the same public values that js/sanity-site-config.js exposes.

const SANITY = {
  projectId: "5igvstyu",
  dataset: "production",
  apiVersion: "2026-03-17",
};

const SITE_URL = "https://www.fosterhealth.io";
const FETCH_TIMEOUT_MS = 8000;

// Some slugs in Sanity were entered with stray slashes or a "/blog/" prefix; normalise them for URLs.
function cleanSlug(value) {
  return String(value || "")
    .trim()
    .replace(/^\/?blog\//, "")
    .replace(/^\/+|\/+$/g, "");
}

// Match the slug however it was entered in Sanity.
function slugVariants(slug) {
  return [
    slug,
    `${slug}/`,
    `/${slug}`,
    `/${slug}/`,
    `/blog/${slug}`,
    `/blog/${slug}/`,
    `blog/${slug}`,
    `blog/${slug}/`,
  ];
}

function postUrl(slug) {
  return `${SITE_URL}/blog/${encodeURIComponent(cleanSlug(slug))}`;
}

function buildQueryUrl(query, params) {
  const searchParams = new URLSearchParams();
  searchParams.set("query", query);
  searchParams.set("perspective", "published");
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined) searchParams.set(`$${key}`, JSON.stringify(value));
  });
  return `https://${SANITY.projectId}.apicdn.sanity.io/v${SANITY.apiVersion}/data/query/${SANITY.dataset}?${searchParams.toString()}`;
}

async function fetchSanity(query, params) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(buildQueryUrl(query, params), {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Sanity request failed with ${response.status}.`);
    const payload = await response.json();
    return payload.result;
  } finally {
    clearTimeout(timer);
  }
}

const POST_SUMMARY_FIELDS = `
  _id,
  title,
  excerpt,
  estimatedReadingTime,
  "slug": slug.current,
  "publishedAt": coalesce(publishedAt, _createdAt),
  "modifiedAt": _updatedAt,
  "authorName": author->name,
  "authorRole": author->role,
  "categories": categories[]->title
`;

const POST_BODY_FIELDS = `
  "mainImageUrl": mainImage.asset->url,
  "mainImageAlt": coalesce(mainImage.alt, title),
  body[]{
    ...,
    _type == "image" => {
      ...,
      "url": asset->url
    }
  }
`;

const ALL_POSTS = `*[_type == "post" && defined(slug.current)] | order(coalesce(publishedAt, _createdAt) desc)`;

function fetchPostSummaries() {
  return fetchSanity(`${ALL_POSTS}{${POST_SUMMARY_FIELDS}}`).then((posts) =>
    Array.isArray(posts) ? posts : []
  );
}

function fetchPostsWithBody() {
  return fetchSanity(`${ALL_POSTS}{${POST_SUMMARY_FIELDS}, ${POST_BODY_FIELDS}}`).then((posts) =>
    Array.isArray(posts) ? posts : []
  );
}

// One request returns the article and the list that feeds the "More articles" links.
async function fetchPostPage(slug) {
  const result = await fetchSanity(
    `{
      "post": *[_type == "post" && slug.current in $slugs][0]{${POST_SUMMARY_FIELDS}, ${POST_BODY_FIELDS}},
      "posts": ${ALL_POSTS}{${POST_SUMMARY_FIELDS}}
    }`,
    { slugs: slugVariants(slug) }
  );
  return {
    post: (result && result.post) || null,
    posts: (result && Array.isArray(result.posts) && result.posts) || [],
  };
}

module.exports = {
  SANITY,
  SITE_URL,
  cleanSlug,
  fetchPostPage,
  fetchPostSummaries,
  fetchPostsWithBody,
  postUrl,
  slugVariants,
};
