#!/usr/bin/env node
import { readdirSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { resolve, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');
const SRC = resolve(ROOT, 'public', 'photos');
const WEB_ROOT = resolve(SRC, '_web');
const OG_ROOT = resolve(SRC, '_og');

const WEB_SIZES = [640, 1024, 1600, 2048];
const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const CONCURRENCY = 6;

function stripExt(name) {
  return name.replace(/\.[^.]+$/, '');
}

async function ensureWebDerivative(srcPath, name, size) {
  const outDir = resolve(WEB_ROOT, String(size));
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, `${name}.webp`);
  if (isFresh(outPath, srcPath)) return false;
  await sharp(srcPath)
    .rotate()
    .resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 78, effort: 4 })
    .toFile(outPath);
  return true;
}

async function ensureOgDerivative(srcPath, name) {
  mkdirSync(OG_ROOT, { recursive: true });
  const outPath = resolve(OG_ROOT, `${name}.jpg`);
  if (isFresh(outPath, srcPath)) return false;
  await sharp(srcPath)
    .rotate()
    .resize({ width: OG_WIDTH, height: OG_HEIGHT, fit: 'cover', position: 'center' })
    .jpeg({ quality: 84, mozjpeg: true })
    .toFile(outPath);
  return true;
}

function isFresh(outPath, srcPath) {
  if (!existsSync(outPath)) return false;
  try {
    return statSync(outPath).mtimeMs >= statSync(srcPath).mtimeMs;
  } catch {
    return false;
  }
}

async function main() {
  if (!existsSync(SRC)) {
    console.log('No public/photos — nothing to prepare.');
    return;
  }

  const files = readdirSync(SRC)
    .filter((f) => !f.startsWith('.') && !f.startsWith('_'))
    .filter((f) => IMAGE_EXTS.has(extname(f).toLowerCase()))
    .sort();

  if (files.length === 0) {
    console.log('No photos found in public/photos.');
    return;
  }

  const totalOps = files.length * (WEB_SIZES.length + 1);
  let generated = 0;
  let skipped = 0;

  const start = Date.now();
  const queue = [...files];

  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length > 0) {
      const f = queue.shift();
      if (!f) break;
      const srcPath = resolve(SRC, f);
      const name = stripExt(f);
      const ops = await Promise.all([
        ensureOgDerivative(srcPath, name),
        ...WEB_SIZES.map((s) => ensureWebDerivative(srcPath, name, s)),
      ]);
      for (const wrote of ops) {
        if (wrote) generated++;
        else skipped++;
      }
    }
  });

  await Promise.all(workers);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(
    `Prepared ${files.length} photo(s) → ${generated} new + ${skipped} cached (${totalOps} total) in ${elapsed}s`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
