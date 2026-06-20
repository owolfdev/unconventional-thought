import { existsSync } from "node:fs";

const SYSTEM_CHROME_CANDIDATES: Record<string, string[]> = {
  darwin: [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
  ],
  linux: [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ],
  win32: [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ],
};

function fromEnv(): string | undefined {
  const path =
    process.env.SCRAPE_CHROME_PATH?.trim() ||
    process.env.PUPPETEER_EXECUTABLE_PATH?.trim();
  if (!path) return undefined;
  if (!existsSync(path)) {
    throw new Error(`SCRAPE_CHROME_PATH is set but not found: ${path}`);
  }
  return path;
}

function firstExisting(paths: string[]): string | undefined {
  return paths.find((p) => existsSync(p));
}

/** Resolve Chrome for Puppeteer: env → system install → bundled (via puppeteer). */
export function resolveChromeExecutable(): string | undefined {
  const envPath = fromEnv();
  if (envPath) return envPath;

  const platform = process.platform as keyof typeof SYSTEM_CHROME_CANDIDATES;
  const candidates = SYSTEM_CHROME_CANDIDATES[platform] ?? [];
  return firstExisting(candidates);
}

export const CHROME_SETUP_HINT =
  "Chrome not found for scraping. Either install Google Chrome, set SCRAPE_CHROME_PATH in media_tool/.env.local, or run: cd media_tool && npm run puppeteer:install";

export function isMissingChromeError(message: string): boolean {
  return /Could not find Chrome|Failed to launch the browser process/i.test(
    message,
  );
}
