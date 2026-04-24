#!/usr/bin/env node
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import yaml from 'js-yaml';
import Anthropic from '@anthropic-ai/sdk';

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');
const PHOTOS_DIR = resolve(ROOT, 'public', 'photos');
const DATA_FILE = resolve(ROOT, 'src', 'data', 'photos.json');
const CONFIG_FILE = resolve(ROOT, 'shoot.config.yaml');

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const MODEL = 'claude-haiku-4-5';

const SCHEMA = {
  type: 'object',
  properties: {
    alt: {
      type: 'string',
      description: 'One sentence, plainly descriptive, for screen-readers and SEO. No flourish.',
    },
    caption: {
      type: 'string',
      description: 'A short evocative caption, 3-8 words, suitable as a photo title.',
    },
    tags: {
      type: 'array',
      items: { type: 'string' },
      description: '3 to 6 lowercase one-word tags describing subject, scene, colour, or mood.',
    },
  },
  required: ['alt', 'caption', 'tags'],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `You write metadata for a photographer's gallery of car and event photography.

For each photo, return strict JSON with:
- alt: one plain descriptive sentence (for screen-readers and SEO; no flourish, no "a photo of")
- caption: 3-8 words, evocative, suitable as a photo title
- tags: 3-6 single-word lowercase tags (subject, scene, colour, or mood)

Keep language restrained and editorial. No exclamation marks. No hashtags. No brand speculation unless the badge is unambiguously visible.`;

function loadConfig() {
  const raw = readFileSync(CONFIG_FILE, 'utf8');
  return yaml.load(raw);
}

function loadExistingPhotos() {
  if (!existsSync(DATA_FILE)) return [];
  const raw = readFileSync(DATA_FILE, 'utf8');
  return JSON.parse(raw);
}

function listPhotoFiles() {
  return readdirSync(PHOTOS_DIR)
    .filter((f) => IMAGE_EXTS.has(extname(f).toLowerCase()))
    .filter((f) => !f.startsWith('.') && !f.startsWith('_'))
    .sort();
}

async function resizeForModel(filename) {
  const full = resolve(PHOTOS_DIR, filename);
  const buffer = await sharp(full)
    .rotate()
    .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();
  return buffer.toString('base64');
}

async function describeOne(client, filename) {
  const base64 = await resizeForModel(filename);

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        output_config: { format: { type: 'json_schema', schema: SCHEMA } },
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: 'image/jpeg', data: base64 },
              },
              { type: 'text', text: `Filename: ${filename}\nReturn metadata for this photo.` },
            ],
          },
        ],
      });

      const textBlock = response.content.find((b) => b.type === 'text');
      if (!textBlock?.text) throw new Error('no text block in response');
      const parsed = JSON.parse(textBlock.text);

      if (!parsed.alt || !parsed.caption || !Array.isArray(parsed.tags)) {
        throw new Error('response missing required fields');
      }
      return {
        filename,
        alt: String(parsed.alt).trim(),
        caption: String(parsed.caption).trim(),
        tags: parsed.tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean),
      };
    } catch (err) {
      if (attempt === 2) {
        console.warn(`  ✗ ${filename}: ${err.message} — skipping`);
        return null;
      }
      console.warn(`  … ${filename}: ${err.message}, retrying`);
    }
  }
  return null;
}

function sortPhotos(photos) {
  return [...photos].sort((a, b) => a.filename.localeCompare(b.filename));
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY is not set.');
    console.error('Copy .env.example to .env and fill in your API key, then run again:');
    console.error('  export $(cat .env | xargs) && npm run describe');
    process.exit(1);
  }

  const config = loadConfig();
  const existing = loadExistingPhotos();
  const existingFilenames = new Set(existing.map((p) => p.filename));
  const files = listPhotoFiles();
  const missing = files.filter((f) => !existingFilenames.has(f));

  const orphaned = existing.filter((p) => !files.includes(p.filename));
  if (orphaned.length > 0) {
    console.log(`${orphaned.length} photo(s) in photos.json no longer exist in public/photos — removing.`);
  }

  if (missing.length === 0 && orphaned.length === 0) {
    console.log(`All ${files.length} photos already described. Nothing to do.`);
    return;
  }

  if (missing.length > 0) {
    console.log(`Describing ${missing.length} new photo(s) with ${MODEL}…`);
    const client = new Anthropic();
    const results = [];
    for (const filename of missing) {
      process.stdout.write(`  · ${filename} `);
      const result = await describeOne(client, filename);
      if (result) {
        results.push(result);
        process.stdout.write(`→ "${result.caption}"\n`);
      }
    }
    existing.push(...results);
  }

  const kept = existing.filter((p) => files.includes(p.filename));
  const sorted = sortPhotos(kept);
  writeFileSync(DATA_FILE, JSON.stringify(sorted, null, 2) + '\n');
  console.log(`\nWrote ${sorted.length} photo(s) to src/data/photos.json`);

  if (config?.download?.strip_exif !== false) {
    console.log('Note: EXIF will be stripped from downloads during `npm run build`.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
