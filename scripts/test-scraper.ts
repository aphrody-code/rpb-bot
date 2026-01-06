import { ScraperService } from '../src/lib/scraper/index.js';

async function main() {
  const scraper = new ScraperService({
    headless: true,
    maxRequestsPerCrawl: 5,
    useCheerio: true, // Let's try fast mode!
  });

  console.log('--- Testing mapSite (Katana Optimized) ---');
  const startMap = Date.now();
  try {
    const urls = await scraper.mapSite('https://beyblade.takaratomy.co.jp/beyblade-x/news/');
    console.log(`Found ${urls.length} URLs in ${Date.now() - startMap}ms`);
    console.log('Sample URLs:', urls.slice(0, 3));

    if (urls.length > 0) {
      console.log('\n--- Testing scrape (Cheerio Fast Mode) ---');
      const startScrape = Date.now();
      const results = await scraper.scrape(urls.slice(0, 3), 'fr');
      console.log(`Scraped ${results.length} pages in ${Date.now() - startScrape}ms`);
      
      results.forEach((page) => {
        console.log(`\nURL: ${page.url}`);
        console.log(`Title: ${page.title}`);
        console.log(`Markdown size: ${page.markdown.length} chars`);
      });
    }
  } catch (error) {
    console.error('Testing failed:', error);
  }
}

main();
