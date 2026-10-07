# Foster Health Site

Marketing site for Foster Health, deployed on Vercel.

- **Static pages**: plain HTML in the repo root (`index.html`, `service.html`, `copilot.html`, `roi.html`, `contact.html`, `blog.html`, …), styles in `css/`, scripts in `js/`.
- **Serverless functions**: `api/contact-submit.js` and `api/roi-submit.js` send form submissions by email through [Resend](https://resend.com).
- **Blog**: `/blog` and `/blog/:slug` read published posts from Sanity (config in `js/sanity-site-config.js`).
- **CMS**: Sanity Studio in `studio/`, deployed as a separate Vercel project. See [SANITY_SETUP.md](SANITY_SETUP.md).

## Running locally

Requires Node.js 18+.

### Website

```bash
node scripts/dev-server.js
```

Open http://localhost:4173. The dev server mirrors `vercel.json`: clean URLs (`/roi` serves `roi.html`), the `/blog/:slug` rewrite, and the `/api/*` functions.

The contact and ROI forms need a Resend key to send email. Create a `.env` file in the repo root (it is gitignored):

```bash
cp .env.example .env   # then fill in RESEND_API_KEY
```

Without a key the forms still validate input, then return "Missing Resend configuration on the server."

Port 4173 is already in Sanity's CORS allowlist, so the blog loads published posts locally. To use a different port, run `PORT=8080 node scripts/dev-server.js` and add that origin to the Sanity CORS settings.

### Sanity Studio

```bash
cd studio
cp .env.example .env   # SANITY_STUDIO_PROJECT_ID=5igvstyu, SANITY_STUDIO_DATASET=production
npm install
npm run dev
```

Open http://localhost:3333 and sign in with your Sanity account.

## Checks

```bash
node test-seo.js
```

Verifies canonical, Open Graph, Twitter, and JSON-LD tags on the main pages and the blog URL format.

## Deploying

Vercel deploys the repo root as a static site with the `api/` functions. Set `RESEND_API_KEY` (or `RESEND_API`) in the Vercel project's environment variables.
