import fs from 'node:fs';
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
  '/usr/bin/chromium-browser',
].filter(Boolean);

export function findChrome() {
  for (const p of CANDIDATES) {
    try { if (fs.existsSync(p)) return p; } catch { /* ignore */ }
  }
  return null;
}

// Render an HTML string to an A4 PDF buffer using the system Chrome/Edge.
export async function htmlToPdf(html) {
  const executablePath = findChrome();
  if (!executablePath) {
    throw new Error('No Chrome/Edge found for PDF rendering. Set CHROME_PATH in server/.env');
  }
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', bottom: '10mm', left: '8mm', right: '8mm' },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
