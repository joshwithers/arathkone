#!/usr/bin/env node
import { readdirSync, readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import yaml from 'js-yaml';

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');
const DIST_PHOTOS = resolve(ROOT, 'dist', 'photos');
const CONFIG_FILE = resolve(ROOT, 'shoot.config.yaml');

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

function loadConfig() {
  const raw = readFileSync(CONFIG_FILE, 'utf8');
  return yaml.load(raw);
}

async function processOne(path, { size }) {
  const original = readFileSync(path);
  let pipeline = sharp(original).rotate();

  if (typeof size === 'number' && size > 0) {
    pipeline = pipeline.resize({
      width: size,
      height: size,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  const ext = extname(path).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') {
    pipeline = pipeline.jpeg({ quality: 92, mozjpeg: true });
  } else if (ext === '.png') {
    pipeline = pipeline.png({ compressionLevel: 9 });
  } else if (ext === '.webp') {
    pipeline = pipeline.webp({ quality: 90 });
  }

  const out = await pipeline.toBuffer();
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, out);
  renameSync(tmp, path);
  return { before: original.length, after: out.length };
}

async function main() {
  if (!existsSync(DIST_PHOTOS)) {
    console.log('No dist/photos/ — skipping.');
    return;
  }

  const config = loadConfig();
  const stripExif = config?.download?.strip_exif !== false;
  const size = config?.download?.size;
  const sizeNumber = typeof size === 'number' ? size : null;

  if (!stripExif && !sizeNumber) {
    console.log('download.strip_exif=false and download.size="original" — nothing to do.');
    return;
  }

  const files = readdirSync(DIST_PHOTOS).filter((f) => IMAGE_EXTS.has(extname(f).toLowerCase()));
  const label = [
    stripExif ? 'stripping EXIF' : null,
    sizeNumber ? `resizing to ${sizeNumber}px long edge` : null,
  ].filter(Boolean).join(' + ');

  console.log(`Processing ${files.length} file(s) in dist/photos: ${label}`);
  let savedBytes = 0;
  for (const f of files) {
    const { before, after } = await processOne(resolve(DIST_PHOTOS, f), { size: sizeNumber });
    savedBytes += before - after;
  }
  const savedMb = (savedBytes / 1024 / 1024).toFixed(1);
  console.log(`Done. Saved ~${savedMb} MB across ${files.length} file(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
