import { ScraperService } from '../src/lib/scraper/index.js';

async function main() {
  console.log('Testing ScraperService for News...');
  
  // Initialize service
  // ScraperService uses google-chrome from /usr/bin/google-chrome by default, which we verified exists.
  const scraper = new ScraperService({ 
    maxRequestsPerCrawl: 5,
    headless: true 
  });
  
  const newsUrl = 'https://beyblade.takaratomy.co.jp/beyblade-x/news/';
  console.log(`Mapping site: ${newsUrl}`);
  
  try {
    const start = Date.now();
    const urls = await scraper.mapSite(newsUrl);
    console.log(`MapSite took ${(Date.now() - start) / 1000}s`);
    console.log(`Found ${urls.length} URLs`);
    
    // Filter like the command does
    const targets = urls.filter((u) => u.includes('/news/')).slice(0, 3);
    console.log(`Targeting ${targets.length} URLs for scraping:`, targets);
    
    if (targets.length === 0) {
        console.warn('No news URLs found!');
        if (urls.length > 0) {
            console.log('First 10 URLs found:', urls.slice(0, 10));
        }
        return;
    }

    const results = await scraper.scrape(targets, 'fr');
    console.log(`Scraped ${results.length} pages.`);
    
    for (const page of results) {
        console.log(`
--- Page: ${page.title} ---`);
        console.log(`URL: ${page.url}`);
        console.log(`Content Length: ${page.markdown?.length}`);
        console.log(`Translated Length: ${page.translatedMarkdown?.length}`);
    }

  } catch (e) {
    console.error('Test failed:', e);
  }
}

main();
