import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolveChromeExecutable } from "./chrome-path";

describe("resolveChromeExecutable", () => {
  it("finds system Chrome on macOS when installed", () => {
    if (process.platform !== "darwin") return;
    const chrome =
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    if (!existsSync(chrome)) return;

    const prevScrape = process.env.SCRAPE_CHROME_PATH;
    const prevPuppeteer = process.env.PUPPETEER_EXECUTABLE_PATH;
    delete process.env.SCRAPE_CHROME_PATH;
    delete process.env.PUPPETEER_EXECUTABLE_PATH;

    expect(resolveChromeExecutable()).toBe(chrome);

    if (prevScrape) process.env.SCRAPE_CHROME_PATH = prevScrape;
    if (prevPuppeteer) process.env.PUPPETEER_EXECUTABLE_PATH = prevPuppeteer;
  });
});
