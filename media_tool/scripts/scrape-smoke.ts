import { scrapeBingImages } from "../src/lib/scrape/bing-images";
import { scrapeGoogleImages } from "../src/lib/scrape/google-images";
import { scrapeYouTube } from "../src/lib/scrape/youtube";

async function main() {
  const b = await scrapeBingImages("steampunk guitar", 5);
  console.log(
    "bing",
    b.results.length,
    b.gallerySource,
    b.results[0]?.title?.slice(0, 40),
    b.results[0]?.url?.slice(0, 60),
    b.apiNote,
  );

  const g = await scrapeGoogleImages("steampunk guitar", 3);
  console.log(
    "google",
    g.results.length,
    g.gallerySource,
    g.results[0]?.title?.slice(0, 40),
    g.apiNote,
  );

  const y = await scrapeYouTube("acdc thunderstruck live", 3);
  console.log("youtube", y.length, y[0]?.title?.slice(0, 40), y[0]?.url);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
