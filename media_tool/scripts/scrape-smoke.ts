import { scrapeGoogleImages } from "../src/lib/scrape/google-images";
import { scrapeYouTube } from "../src/lib/scrape/youtube";

async function main() {
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
