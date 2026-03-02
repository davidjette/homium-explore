/**
 * PDF Generator — Puppeteer HTML-to-PDF conversion
 *
 * Production (Render): uses @sparticuz/chromium (lightweight, Linux-only)
 * Local (Windows): uses Puppeteer's cached Chrome or system Chrome
 *
 * Uses custom page size matching the 1440×810 viewport (slide-deck format)
 * so content fills the full page with zero scaling artifacts.
 */

import puppeteer from 'puppeteer-core';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Content viewport — matches .page CSS dimensions
const PAGE_W = 1440;
const PAGE_H = 810;

async function getExecPath(): Promise<string> {
  if (IS_PRODUCTION) {
    const chromium = await import('@sparticuz/chromium');
    return chromium.default.executablePath();
  }
  // Local: use Puppeteer's cached Chrome
  const { executablePath } = await import('puppeteer');
  return executablePath();
}

async function getLaunchArgs(): Promise<string[]> {
  if (IS_PRODUCTION) {
    const chromium = await import('@sparticuz/chromium');
    return chromium.default.args;
  }
  return ['--no-sandbox', '--disable-setuid-sandbox'];
}

export async function htmlToPdfBuffer(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    args: await getLaunchArgs(),
    defaultViewport: { width: PAGE_W, height: PAGE_H },
    executablePath: await getExecPath(),
    headless: true,
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    // Wait for Google Fonts to load
    await page.evaluateHandle('document.fonts.ready');
    const pdf = await page.pdf({
      printBackground: true,
      width: `${PAGE_W}px`,
      height: `${PAGE_H}px`,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
