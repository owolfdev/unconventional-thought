import type { Browser, Page, PuppeteerLaunchOptions } from "puppeteer";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import {
  CHROME_SETUP_HINT,
  isMissingChromeError,
  resolveChromeExecutable,
} from "./chrome-path";

const SCRAPE_TIMEOUT_MS = 30_000;
const MIN_SCRAPE_INTERVAL_MS = 1_500;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

puppeteer.use(StealthPlugin());

let browserPromise: Promise<Browser> | null = null;
let lastScrapeAt = 0;

function launchOptions(): PuppeteerLaunchOptions {
  const executablePath = resolveChromeExecutable();

  return {
    headless: true,
    ...(executablePath ? { executablePath } : {}),
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
    ],
  };
}

async function launchBrowser(): Promise<Browser> {
  try {
    return await puppeteer.launch(launchOptions());
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (isMissingChromeError(message)) {
      throw new Error(`${CHROME_SETUP_HINT}\n\n(${message})`);
    }
    throw e;
  }
}

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = launchBrowser();
  }

  try {
    const browser = await browserPromise;
    if (!browser.connected) {
      browserPromise = launchBrowser();
      return browserPromise;
    }
    return browser;
  } catch (e) {
    browserPromise = null;
    throw e;
  }
}

async function throttleScrapes(): Promise<void> {
  const wait = MIN_SCRAPE_INTERVAL_MS - (Date.now() - lastScrapeAt);
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  lastScrapeAt = Date.now();
}

async function dismissConsent(page: Page): Promise<void> {
  const selectors = [
    "button#L2AGLb",
    'button[aria-label="Accept all"]',
    'button[aria-label*="Accept all"]',
    'button[aria-label*="Agree"]',
    "form[action*='consent'] button",
  ];

  for (const selector of selectors) {
    try {
      const button = await page.$(selector);
      if (!button) continue;
      await button.click();
      await new Promise((resolve) => setTimeout(resolve, 400));
      return;
    } catch {
      // try next selector
    }
  }
}

async function preparePage(page: Page): Promise<void> {
  await page.setUserAgent(USER_AGENT);
  await page.setViewport({ width: 1280, height: 900 });
  page.setDefaultNavigationTimeout(SCRAPE_TIMEOUT_MS);
  page.setDefaultTimeout(SCRAPE_TIMEOUT_MS);
}

export interface ScrapePageOptions {
  url: string;
  waitForIdleMs?: number;
}

/** Shared headless browser; one tab per scrape, closed after use. */
export async function withScrapePage<T>(
  options: ScrapePageOptions,
  run: (page: Page) => Promise<T>,
): Promise<T> {
  await throttleScrapes();
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await preparePage(page);
    await page.goto(options.url, {
      waitUntil: "networkidle2",
      timeout: SCRAPE_TIMEOUT_MS,
    });
    await dismissConsent(page);
    if (options.waitForIdleMs) {
      await new Promise((resolve) => setTimeout(resolve, options.waitForIdleMs));
    }
    return await run(page);
  } finally {
    await page.close().catch(() => undefined);
  }
}

export const SCRAPE_LIMIT_DEFAULT = 20;

/** True when Google shows CAPTCHA / unusual-traffic interstitial. */
export async function isGoogleBlockedPage(page: Page): Promise<boolean> {
  const text = await page.evaluate(() => document.body?.innerText ?? "");
  return /unusual traffic|not a robot|detected automated/i.test(text);
}

export { CHROME_SETUP_HINT, resolveChromeExecutable } from "./chrome-path";
