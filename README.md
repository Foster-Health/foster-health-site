# Foster Health Website

This repo contains:

- A static marketing website at the repo root
- A Sanity Studio for blog editing in `/studio`

## Step-by-step: run the landing page locally

These instructions are written for a non-technical teammate using macOS.

If someone only needs to view the landing page on their computer, they do not need to install Node.js or run Sanity Studio.

## 1. Open Terminal

1. Press `Command + Space` to open Spotlight Search.
2. Type `Terminal`.
3. Press `Return`.

You will now see a Terminal window where you can paste commands.

## 2. Get the project onto the computer

If the project folder is already on the computer, skip to step 3.

If this is the first time setting it up, run:

```bash
cd ~/Desktop
git clone https://github.com/Foster-Health/foster-health-site.git
cd foster-health-site
```

If the project folder already exists, move into it:

```bash
cd /path/to/the/project-folder
```

Tip: type `cd `, then drag the project folder into Terminal to fill in the path automatically.

To make sure you are in the right folder, you can run:

```bash
ls
```

You should see files such as `index.html`, `blog.html`, and folders like `css`, `img`, and `js`.

## 3. Get the latest version from GitHub

If you just cloned the project a minute ago, you can skip this step.

First, check whether the folder has any local changes:

```bash
git status
```

If you see `nothing to commit, working tree clean`, run:

```bash
git pull origin main
```

Basic Git commands used in this project:

- `git clone https://github.com/Foster-Health/foster-health-site.git` - downloads the project the first time
- `git status` - checks whether anything changed locally
- `git pull origin main` - gets the latest version from GitHub

If `git status` shows modified files and the person did not intentionally edit code, stop there and ask for help before pulling.

## 4. Optional: create a Python virtual environment

This website does not require a virtual environment, but it is okay to use one if preferred.

First time only:

```bash
python3 -m venv .venv
```

Then activate it:

```bash
source .venv/bin/activate
```

If `python3` does not work, try:

```bash
python -m venv .venv
source .venv/bin/activate
```

When the virtual environment is active, Terminal may show `(.venv)` at the beginning of the line.

If it was already created before, you only need to run:

```bash
source .venv/bin/activate
```

To leave the virtual environment later, run:

```bash
deactivate
```

## 5. Start the local website server

From the project folder, run:

```bash
python3 -m http.server 4173
```

If `python3` does not work on that computer, try:

```bash
python -m http.server 4173
```

Then open one of these URLs in a browser:

- `http://127.0.0.1:4173`
- `http://localhost:4173`

Useful pages:

- Home: `http://127.0.0.1:4173/index.html`
- Blog list: `http://127.0.0.1:4173/blog.html`

Keep the Terminal window open while the website is running.

To stop the server later, press `Ctrl+C` in Terminal.

If a virtual environment is active and you are done, you can also run:

```bash
deactivate
```

## 6. Quick startup next time

After the first setup, the usual steps are:

1. Open Terminal.
2. Go to the project folder.
3. Run `git status`.
4. If the working tree is clean, run `git pull origin main`.
5. If using a virtual environment, run `source .venv/bin/activate`.
6. Run `python3 -m http.server 4173`.
7. Open `http://localhost:4173`.

Why use port `4173`:

- The Sanity setup for this project expects local website CORS origins to include:
  - `http://localhost:4173`
  - `http://127.0.0.1:4173`

Why use a local server instead of opening `index.html` directly:

- CSS, JavaScript, and blog requests work more reliably over `http://localhost`
- It matches the browser origin already allowed in Sanity

## Optional: run Sanity Studio for blog edits

Only follow this section if someone needs to create or edit blog posts.

Requirements:

- Node.js and npm installed on the computer

From the project root, run:

```bash
cd studio
cp .env.example .env
```

Set these values in `studio/.env`:

```env
SANITY_STUDIO_PROJECT_ID=5igvstyu
SANITY_STUDIO_DATASET=production
```

Then run:

```bash
npm install
npm run dev
```

Open the local Studio URL shown in the terminal.

## Blog content is managed in Sanity

The public website reads published blog content from Sanity using the config in `/js/sanity-site-config.js`.

Current site config:

- `projectId`: `5igvstyu`
- `dataset`: `production`

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

## If a command does not work

- If `git` says `command not found`, install Apple Command Line Tools by running `xcode-select --install`.
- If `python3` says `command not found`, install Python 3 from [python.org](https://www.python.org/downloads/).
- If `npm` says `command not found`, install Node.js LTS from [nodejs.org](https://nodejs.org/).

## Helpful notes for non-technical teammates

- The website folder must stay open in Terminal while the local site is running.
- If the page looks broken, make sure the site was opened from `http://localhost:4173` and not by double-clicking the HTML file.
- If they only need the landing page, the main command they need is `python3 -m http.server 4173`.
- If they are unsure whether they are in the right folder, run `ls` and confirm `index.html` is visible.

## Helpful project files

- `/js/sanity-site-config.js` - frontend Sanity connection settings
- `/js/blog.js` - blog listing page logic
- `/js/blog-post.js` - single post page logic
- `/studio/sanity.config.js` - Sanity schema and Studio config
- `/SANITY_SETUP.md` - more detailed Sanity setup notes
