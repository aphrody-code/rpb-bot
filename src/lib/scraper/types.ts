export interface ScraperOptions {
  /**
   * Whether to run the browser in headless mode.
   * Default: true
   */
  headless?: boolean;

  /**
   * Path to the Google Chrome executable.
   * Default: /usr/bin/google-chrome
   */
  executablePath?: string;

  /**
   * Maximum number of pages to crawl.
   * Default: 1 (single page mode)
   */
  maxRequestsPerCrawl?: number;

  /**
   * Whether to use Cheerio instead of Puppeteer for faster scraping (no JS).
   * Default: false
   */
  useCheerio?: boolean;
}

export interface ScrapedPage {
  /**
   * The URL of the scraped page.
   */
  url: string;

  /**
   * The title of the page.
   */
  title: string;

  /**
   * The content of the page converted to Markdown.
   * optimized for AI context windows.
   */
  markdown: string;

  /**
   * The raw HTML content (optional).
   */
  html?: string;

  /**
   * The language of the content (e.g., 'ja', 'en', 'fr').
   */
  language: string;

  /**
   * Translated content (if translation was requested).
   */
  translatedMarkdown?: string;

  /**
   * List of all valid links found on the page (for mapping).
   */
  links: string[];

  /**
   * Product data if extracted from the page.
   */
  product?: {
    code: string;
    name: string;
    type: string;
    price?: number;
    releaseDate?: string;
    isLimited: boolean;
  };

  /**
   * Metadata extracted from the page (meta tags, open graph).
   */
  metadata: Record<string, string>;
}
