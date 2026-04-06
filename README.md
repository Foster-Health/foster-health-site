# Foster Health Website

This repo contains:

- A static marketing website at the repo root
- A Sanity Studio for blog editing in `/studio`

## Run the website locally with Python

From the project root:

```bash
cd /Users/revanth/Desktop/Dev/Foster Health/Website
python3 -m http.server 4173
```

Then open:

- `http://127.0.0.1:4173`
- `http://localhost:4173`

Useful pages:

- Home: `http://127.0.0.1:4173/index.html`
- Blog list: `http://127.0.0.1:4173/blog.html`

Why port `4173`:

- The Sanity setup for this project expects local website CORS origins to include:
  - `http://localhost:4173`
  - `http://127.0.0.1:4173`

To stop the server, press `Ctrl+C`.

## Blog content is managed in Sanity

The public website reads published blog content from Sanity using the config in `/js/sanity-site-config.js`.

Current site config:

- `projectId`: `5igvstyu`
- `dataset`: `production`

## Run Sanity Studio for blog edits

From the `studio` folder:

```bash
cd /Users/revanth/Desktop/Dev/Foster Health/Website/studio
cp .env.example .env
npm install
npm run dev
```

Then open the local Studio URL shown in the terminal.

### Studio environment variables

Set these values in `/studio/.env`:

```env
SANITY_STUDIO_PROJECT_ID=5igvstyu
SANITY_STUDIO_DATASET=production
```

## Typical blog editing workflow

1. Start the website locally with Python from the repo root.
2. Start Sanity Studio from `/studio`.
3. In Sanity Studio, create or edit:
   - Authors
   - Categories
   - Posts
4. For each post, make sure these fields are filled in:
   - Title
   - Slug
   - Excerpt
   - Main image
   - Author
   - Published at
   - Body
5. Publish the post in Sanity.
6. Refresh the local website and check:
   - `/blog.html`
   - `/blog-post.html?slug=your-post-slug`

## If posts do not appear

Check the following:

- The post is published, not just saved as a draft.
- The dataset is publicly readable in Sanity.
- Sanity CORS includes:
  - `http://localhost:4173`
  - `http://127.0.0.1:4173`
- The slug is set on the post.

## Helpful project files

- `/js/sanity-site-config.js` - frontend Sanity connection settings
- `/js/blog.js` - blog listing page logic
- `/js/blog-post.js` - single post page logic
- `/studio/sanity.config.js` - Sanity schema and Studio config
- `/SANITY_SETUP.md` - more detailed Sanity setup notes
