import { TakaraTomyScraper } from '../src/lib/scraper/takaratomy.js';
import { prisma } from '../src/lib/prisma.js';

async function main() {
  console.log('Testing TakaraTomyScraper...');
  const scraper = new TakaraTomyScraper(prisma);
  
  try {
    // Manually fetch to see status
    console.log('Fetching URL...');
    const response = await fetch('https://beyblade.takaratomy.co.jp/beyblade-x/lineup/');
    console.log(`Status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
        console.error('Fetch failed!');
        return;
    }

    const html = await response.text();
    console.log(`HTML length: ${html.length}`);
    
    // New regex based on HTML structure
    // <a href="bx01.html"> ... <b>BX-01<span>Name</span></b> ... <p class="category"><span>Type</span></p> ... <i>¥1,980...</i> ... <i class="red">Date...</i>
    
    const productPattern = /<a href="([^"]+)">[\s\S]*?<b>((?:BX|UX|CX)-\d{2,3})<span>([^<]+)<\/span><\/b>[\s\S]*?<p class="category"><span>([^<]+)<\/span><\/p>[\s\S]*?<i>¥([\d,]+)[^<]*<\/i>[\s\S]*?<i class="red">([\d\.]+)[^<]*<\/i>/g;

    let match;
    let count = 0;
    while ((match = productPattern.exec(html)) !== null) {
      count++;
      console.log(`Found: ${match[2]} - ${match[3]}`);
      console.log(`Type: ${match[4]}, Price: ${match[5]}, Date: ${match[6]}`);
    }
    
    console.log(`Total found via Regex: ${count}`);



  } catch (e) {
    console.error(e);
  }
}

main();
