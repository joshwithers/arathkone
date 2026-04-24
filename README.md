# Arathkone — single-shoot gallery template

One repo. One shoot. One site. Drop photos in, fill in the config, push — Cloudflare Pages deploys.

## The loop

```
public/photos/    ← drop JPEGs / PNGs here
shoot.config.yaml ← edit the shoot title, date, location, blurb, your Ko-fi
npm run describe  ← AI writes alt text, captions, tags for new photos (~1¢ each)
git push          ← Cloudflare Pages builds and deploys
```

That's it. You don't touch any code.

## First-time setup (once per machine)

1. Install Node 20+ and run `npm install`.
2. Copy `.env.example` to `.env` and paste in your Anthropic API key from [console.anthropic.com](https://console.anthropic.com).
3. Connect the GitHub repo to Cloudflare Pages. Build command: `npm run build`. Output directory: `dist`.

## Per-shoot workflow

1. **Drop photos** into `public/photos/`. Anything in `.jpg`, `.jpeg`, `.png`, or `.webp` works. Don't put them in sub-folders.
2. **Edit `shoot.config.yaml`** — title, date, location, a short blurb, and the filename of the photo you want as the hero.
3. **Run `npm run describe`.** This looks for photos it hasn't seen before, sends a 1024px preview to Claude, and writes alt text + captions + tags into `src/data/photos.json`. Existing entries are left alone.
4. **Commit and push.** `git add . && git commit -m "New shoot" && git push`. Cloudflare rebuilds.

## The config file

```yaml
shoot:
  title: "Highball Goes Country"
  date: "2026-04-19"
  location: "Black Spur Drive, Victoria"
  blurb: "Short paragraph shown under the title."
  hero: "IMG_6436_HQ.jpg"  # filename in public/photos/

photographer:
  name: "Dan Campbell"
  kofi: "https://ko-fi.com/arathkone"
  instagram: "https://www.instagram.com/Arathkone"
  threads: "https://www.threads.com/@arathkone"
  vero: "https://vero.co/arathkone"

download:
  size: "original"  # or a pixel value like 2048 to cap the long edge
  strip_exif: true  # set false to keep GPS/timestamps in downloaded files

site:
  domain: "highballgoescountry.pages.dev"
```

## What happens on build

`npm run build` runs Astro, then walks `dist/photos/` and — if `strip_exif: true` — removes EXIF metadata from every file. If you set `download.size` to a pixel value, the same pass resizes downloads to that long edge. The photos in `public/photos/` are not touched; originals stay put.

## Local preview

```bash
npm run dev       # local dev server at localhost:4321
npm run build     # production build (writes to dist/)
npm run preview   # preview the production build
```

## Costs

The describe step uses Claude Haiku 4.5. At current pricing and ~1024px previews, you'll spend well under $1 per shoot even with hundreds of photos. `photos.json` is committed, so you only pay once per image.
