import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import puppeteer from 'puppeteer-core';
import { env } from '../config/env.js';

const CANDIDATES = [
  env.chromePath,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  process.env.LOCALAPPDATA ? `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe` : '',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/snap/bin/chromium',
  '/opt/google/chrome/chrome',
].filter(Boolean);

export function findChrome() {
  for (const p of CANDIDATES) {
    try { if (fs.existsSync(p)) return p; } catch { /* ignore */ }
  }
  return null;
}

/* ---------- image inlining with memory + disk cache ----------
   External images (Unsplash, hotel photos) dominated render time because a
   throwaway browser re-downloaded them on every request. We fetch them once
   in Node, cache to disk, and inline as data: URIs so Chrome hits no network. */

const IMG_CACHE_DIR = path.join(os.tmpdir(), 'tcrm-img-cache');
const memCache = new Map(); // url -> data URI

function cacheFile(url) {
  return path.join(IMG_CACHE_DIR, crypto.createHash('sha1').update(url).digest('hex'));
}

async function fetchAsDataUri(url) {
  if (memCache.has(url)) return memCache.get(url);
  const file = cacheFile(url);
  try {
    if (fs.existsSync(file)) {
      const cached = fs.readFileSync(file, 'utf8');
      memCache.set(url, cached);
      return cached;
    }
  } catch { /* fall through to network */ }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const type = res.headers.get('content-type') || 'image/jpeg';
    if (!/^image\//i.test(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 4 * 1024 * 1024) return null; // skip absurdly large files
    const uri = `data:${type};base64,${buf.toString('base64')}`;
    memCache.set(url, uri);
    try {
      fs.mkdirSync(IMG_CACHE_DIR, { recursive: true });
      fs.writeFileSync(file, uri, 'utf8');
    } catch { /* disk cache is best-effort */ }
    return uri;
  } catch {
    return null; // leave the original URL in place; Chrome will try it
  }
}

async function inlineImages(html) {
  const urls = [...new Set([...html.matchAll(/src="(https?:\/\/[^"]+)"/g)].map((m) => m[1]))];
  const pairs = await Promise.all(urls.map(async (u) => [u, await fetchAsDataUri(u)]));
  let out = html;
  for (const [u, uri] of pairs) {
    if (uri) out = out.split(`src="${u}"`).join(`src="${uri}"`);
  }
  return out;
}

/* Inline the Google Fonts stylesheet + woff2 files so the page needs no
   network at all — lets us skip the networkidle wait entirely. */
async function fetchCachedText(url, headers = {}) {
  if (memCache.has(url)) return memCache.get(url);
  const file = cacheFile(url);
  try {
    if (fs.existsSync(file)) {
      const cached = fs.readFileSync(file, 'utf8');
      memCache.set(url, cached);
      return cached;
    }
  } catch { /* fall through */ }
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    let out;
    if (/text\/css/i.test(res.headers.get('content-type') || '')) {
      out = await res.text();
    } else {
      const buf = Buffer.from(await res.arrayBuffer());
      out = `data:${res.headers.get('content-type') || 'font/woff2'};base64,${buf.toString('base64')}`;
    }
    memCache.set(url, out);
    try {
      fs.mkdirSync(IMG_CACHE_DIR, { recursive: true });
      fs.writeFileSync(file, out, 'utf8');
    } catch { /* best-effort */ }
    return out;
  } catch {
    return null;
  }
}

async function inlineFonts(html) {
  const m = html.match(/<link href="(https:\/\/fonts\.googleapis\.com\/css2[^"]+)" rel="stylesheet"\/?>/);
  if (!m) return html;
  // Chrome UA so Google serves woff2 @font-face rules.
  const css = await fetchCachedText(m[1], { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36' });
  if (!css) return html;
  const fontUrls = [...new Set([...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map((x) => x[1]))];
  const pairs = await Promise.all(fontUrls.map(async (u) => [u, await fetchCachedText(u)]));
  let inlinedCss = css;
  for (const [u, uri] of pairs) {
    if (uri) inlinedCss = inlinedCss.split(u).join(uri);
  }
  return html.replace(m[0], `<style>${inlinedCss}</style>`);
}

/* ---------- shared browser instance ----------
   Launching Chrome per request cost seconds; keep one alive and reuse it.
   A persistent profile dir lets fonts/stylesheets cache across renders. */

let browserPromise = null;

async function getBrowser() {
  if (browserPromise) {
    try {
      const b = await browserPromise;
      if (b.connected) return b;
    } catch { /* relaunch below */ }
    browserPromise = null;
  }
  const executablePath = findChrome();
  if (!executablePath) {
    throw new Error('No Chrome/Edge found for PDF rendering. Set CHROME_PATH in server/.env');
  }
  browserPromise = puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    userDataDir: path.join(os.tmpdir(), 'tcrm-pdf-profile'),
  });
  return browserPromise;
}

// Render an HTML string to an A4 PDF buffer using the system Chrome/Edge.
export async function htmlToPdf(html) {
  const inlined = await inlineFonts(await inlineImages(html));
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(inlined, { waitUntil: 'load', timeout: 30000 });
    await page.evaluate(() => document.fonts.ready);
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' },
    });
    return Buffer.from(pdf);
  } finally {
    await page.close().catch(() => {});
  }
}
