import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import yaml from 'js-yaml';

export interface ShootConfig {
  shoot: {
    title: string;
    date: string;
    location: string;
    blurb: string;
    hero: string;
  };
  photographer: {
    name: string;
    location?: string;
    portrait?: string;
    portrait_credit?: string;
    bio?: string;
    kofi: string;
    threads?: string;
    vero?: string;
    instagram?: string;
    fotoapp?: string;
  };
  download: {
    size: 'original' | number;
    strip_exif: boolean;
  };
  site: {
    domain: string;
  };
}

export function loadShoot(): ShootConfig {
  const path = resolve(process.cwd(), 'shoot.config.yaml');
  const raw = readFileSync(path, 'utf8');
  const parsed = yaml.load(raw) as ShootConfig;

  if (!parsed?.shoot?.title) throw new Error('shoot.config.yaml: missing shoot.title');
  if (!parsed?.shoot?.hero) throw new Error('shoot.config.yaml: missing shoot.hero');
  if (!parsed?.photographer?.kofi) throw new Error('shoot.config.yaml: missing photographer.kofi');
  if (!parsed?.site?.domain) throw new Error('shoot.config.yaml: missing site.domain');

  parsed.download ??= { size: 'original', strip_exif: true };
  parsed.download.size ??= 'original';
  parsed.download.strip_exif ??= true;

  return parsed;
}

export interface Photo {
  filename: string;
  alt: string;
  caption: string;
  tags: string[];
}

export function slugify(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function stripExt(filename: string): string {
  return filename.replace(/\.[^.]+$/, '');
}

export const WEB_SIZES = [640, 1024, 1600, 2048] as const;
export const OG_DIMENSIONS = { width: 1200, height: 630 } as const;

export function webSrc(filename: string, size: (typeof WEB_SIZES)[number] = 1024): string {
  return `/photos/_web/${size}/${stripExt(filename)}.webp`;
}

export function webSrcSet(filename: string, sizes: readonly number[] = WEB_SIZES): string {
  const base = stripExt(filename);
  return sizes.map((s) => `/photos/_web/${s}/${base}.webp ${s}w`).join(', ');
}

export function ogSrc(filename: string): string {
  return `/photos/_og/${stripExt(filename)}.jpg`;
}
