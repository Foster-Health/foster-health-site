# Sanity Setup

This repo now supports a Sanity-powered blog while keeping the marketing site as plain static HTML.

## Recommended shape

- Keep this repo as the public website.
- Deploy the Sanity Studio from `/studio` as a separate Vercel project.
- Use the Sanity hosted content API to power `/blog` and `/blog/:slug`.

This is the simplest path for your current stack because the site does not use Next.js or another framework yet.

## 1. Create your Sanity project

1. Sign in at [sanity.io](https://www.sanity.io/).
2. Create a project.
3. Use the `production` dataset.
4. In project settings, make sure the dataset can be read publicly by the website.
5. In `API` settings, add CORS origins for:
   - your production website domain
   - `http://localhost:4173`
   - `http://127.0.0.1:4173`

## 2. Connect the website

Update [js/sanity-site-config.js](js/sanity-site-config.js) with your real Sanity values:

```js
window.FOSTER_SANITY_CONFIG = {
  projectId: "your_project_id",
  dataset: "production",
  apiVersion: "2026-03-17",
};
```

The website only reads published content, so `projectId` and `dataset` are safe to expose publicly.

If the blog page shows `Could not load posts` with `Failed to fetch`, that usually means Sanity is blocking the browser request because:

- the dataset is not publicly readable, or
- the current site origin is missing from Sanity CORS settings.

## 3. Run the Sanity Studio locally

1. From the repo root, run `cd studio`
2. `cp .env.example .env`
3. Fill in:
   - `SANITY_STUDIO_PROJECT_ID`
   - `SANITY_STUDIO_DATASET`
4. `npm install`
5. `npm run dev`

Your partner will use the Studio to create posts, authors, and categories.

## 4. Deploy the Studio

Recommended: create a second Vercel project pointed at `/studio`.

- Framework preset: Vite
- Root directory: `studio`
- Build command: `npm run build`
- Output directory: `dist`

Add these environment variables to that Vercel project:

- `SANITY_STUDIO_PROJECT_ID`
- `SANITY_STUDIO_DATASET`

Suggested URL: `cms.fosterhealth.com` or `foster-health-cms.vercel.app`

## 5. Publish your first article

Create:

- an Author
- optional Categories
- a Post with:
  - title
  - slug
  - excerpt
  - main image
  - body
  - publish date

Once the post is published in Sanity, it will appear on:

- `/blog`
- `/blog/your-post-slug`

## How the blog reaches search engines and AI assistants

The server renders the blog. A crawler that does not run JavaScript gets the full article text.

- `api/blog.js` serves `/blog`, and `api/blog-post.js` serves `/blog/:slug`. Each article has its own title, description, canonical address, and structured data.
- `/blog/:slug.md` is the same article as Markdown. `/llms.txt` and `/llms-full.txt` list the articles for AI assistants.
- `/sitemap.xml` and `/rss.xml` come from the published posts. `robots.txt` points to the sitemap.
- The shared code is in `lib/`. The rules that connect an address to a function are in `vercel.json`.
- Do not add a `blog.html` or `blog-post.html` file at the root. A static file takes the address before the function does.
- The CDN keeps a page for 5 minutes. A new or edited post appears in about 5 minutes. No deployment is necessary.
- A slug that was entered with slashes or a `/blog/` prefix still works. The site shows the clean form and redirects other forms to it.
- If the server cannot reach Sanity, the reader gets the earlier browser-rendered page (`js/blog.js`, `js/blog-post.js`).

To preview the site with these rules, run `node tests/dev-server.js` and open `http://127.0.0.1:4173`. To run the checks, run `npm ci` and then `npm test`.

## Notes

- This setup avoids a full site migration.
- Draft previews are not wired yet; the public site only shows published posts.
