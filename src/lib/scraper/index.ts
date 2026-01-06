import {
  EnqueueStrategy,
  log,
  PuppeteerCrawler,
  type PuppeteerCrawlingContext,
} from 'crawlee';
import TurndownService from 'turndown';
import type { ScrapedPage, ScraperOptions } from './types.js';

// Placeholder for translation if no key is provided
class SimpleTranslator {
  async translate(text: string, _target: string): Promise<string> {
    return text; // Pass-through by default
  }
}

export class ScraperService {
  private options: ScraperOptions;
  private turndown: TurndownService;
  private translator: SimpleTranslator;

  constructor(options: ScraperOptions = {}) {
    this.options = {
      headless: true,
      executablePath: '/usr/bin/google-chrome',
      maxRequestsPerCrawl: 20, // Increased for mapping
      ...options,
    };

    // Configure Turndown for AI-ready Markdown
    this.turndown = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      hr: '---',
      bulletListMarker: '-',
    });

    // Remove noise elements
    this.turndown.remove([
      'script',
      'style',
      'noscript',
      'iframe',
      'nav',
      'footer',
    ] as any);
    this.turndown.remove('svg' as any);

    // Initialize Translator (Google Cloud or Placeholder)
    // In a real scenario, you'd check process.env.GOOGLE_APPLICATION_CREDENTIALS
    this.translator = new SimpleTranslator();
  }

  /**
   * Crawl a domain to discover all links using Katana (ProjectDiscovery).
   * robust URL discovery with JS parsing.
   */
  public async mapSite(baseUrl: string): Promise<string[]> {
    const { execSync } = await import('node:child_process');
    log.info(`Mapping site with Katana: ${baseUrl}...`);

    try {
      // Katana options:
      // -u: URL
      // -jc: JavaScript Crawling (finds links in JS files)
      // -headless: Use headless browser for dynamic content
      // -system-chrome: Use our installed Google Chrome
      // -no-sandbox: Required for root user
      // -d: Depth (recursion level)
      // -silent: Output only URLs
      const cmd = `katana -u ${baseUrl} -jc -headless -system-chrome -no-sandbox -d 3 -silent`;

      const output = execSync(cmd, {
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large sites
      });

      // Filter and dedup
      const urls = output
        .split('\n')
        .map((u) => u.trim())
        .filter(
          (u) => u.startsWith('http') && u.includes(new URL(baseUrl).hostname),
        );

      return [...new Set(urls)];
    } catch (error) {
      log.error(`Katana mapping failed: ${(error as Error).message}`);
      // Fallback to Puppeteer crawler if Katana fails
      return this.fallbackMapSite(baseUrl);
    }
  }

  /**
   * Fallback crawler using Puppeteer directly if Katana fails
   */
  private async fallbackMapSite(baseUrl: string): Promise<string[]> {
    const urls = new Set<string>();
    const crawler = new PuppeteerCrawler({
      launchContext: this.getLaunchContext(),
      maxRequestsPerCrawl: 50,
      requestHandler: async ({ request, enqueueLinks }) => {
        urls.add(request.url);
        await enqueueLinks({ strategy: EnqueueStrategy.SameDomain });
      },
    });
    await crawler.run([baseUrl]);
    return Array.from(urls);
  }

  /**
   * Scrape specific URLs, extract data, and translate.
   */
  public async scrape(
    urls: string[],
    targetLang = 'fr',
  ): Promise<ScrapedPage[]> {
    const results: ScrapedPage[] = [];

    const crawler = new PuppeteerCrawler({
      launchContext: this.getLaunchContext(),
      maxRequestsPerCrawl: this.options.maxRequestsPerCrawl,
      requestHandler: async (context) => {
        const result = await this.handlePage(context, targetLang);
        if (result) results.push(result);
      },
      failedRequestHandler: ({ request }) => {
        log.error(`Request failed: ${request.url}`);
      },
    });

    await crawler.run(urls);
    return results;
  }

  private getLaunchContext() {
    return {
      useChrome: true,
      launchOptions: {
        headless: this.options.headless,
        executablePath: this.options.executablePath,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--lang=ja-JP', // Emulate a Japanese browser for Takara Tomy
        ],
      },
    };
  }

  private async handlePage(
    { page, request, log }: PuppeteerCrawlingContext,
    targetLang: string,
  ): Promise<ScrapedPage | null> {
    log.info(`Processing: ${request.url}`);

    try {
      // 1. Wait for content
      await page.waitForSelector('body', { timeout: 30000 });

      // 2. Extract Data
      const data = await page.evaluate(() => {
        const getMeta = (name: string) =>
          document
            .querySelector(`meta[name="${name}"], meta[property="${name}"]`)
            ?.getAttribute('content') || '';

        // Extract clean links for navigation
        const links = Array.from(document.querySelectorAll('a'))
          .map((a) => a.href)
          .filter((href) => href.startsWith('http'));

        return {
          title: document.title,
          html: document.body.innerHTML,
          lang: document.documentElement.lang || 'ja',
          links: [...new Set(links)], // Deduplicate
          metadata: {
            description: getMeta('description') || getMeta('og:description'),
            image: getMeta('og:image'),
            siteName: getMeta('og:site_name'),
            type: getMeta('og:type'),
          },
        };
      });

      // 3. Convert to Markdown
      const markdown = this.turndown.turndown(data.html);

      // 4. Translate (Mocked for now, ready for API)
      let translatedMarkdown = markdown;
      if (targetLang !== data.lang) {
        // Here you would call: await this.translator.translate(markdown, targetLang);
        // For big pages, you'd split by paragraphs to avoid API limits
        translatedMarkdown = `[TRADUCTION AUTOMATIQUE]\n\n${markdown}`;
      }

      return {
        url: request.url,
        title: data.title,
        language: data.lang,
        markdown,
        translatedMarkdown,
        links: data.links,
        metadata: data.metadata,
      };
    } catch (error) {
      log.error(`Error processing ${request.url}: ${(error as Error).message}`);
      return null;
    }
  }
}
