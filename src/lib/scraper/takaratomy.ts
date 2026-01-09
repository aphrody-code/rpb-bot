import { log } from 'crawlee';
import type { PrismaClient } from '../../generated/client/index.js';
import {
  PartType,
  ProductLine,
  ProductType,
} from '../../generated/client/index.js';

export interface OfficialProduct {
  code: string;
  name: string;
  productType: string;
  price: number;
  releaseDate: string;
  url: string;
  isLimited: boolean;
  limitedType?: string;
  bladeName?: string;
  ratchet?: string;
  bit?: string;
}

export class TakaraTomyScraper {
  private prisma: PrismaClient;
  private readonly LINEUP_URL =
    'https://beyblade.takaratomy.co.jp/beyblade-x/lineup/';

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Parse Beyblade name into components
   */
  public parseBeyName(name: string): {
    blade?: string;
    ratchet?: string;
    bit?: string;
  } {
    const cleanName = name
      .replace(/メタルコート:[^\s]+/g, '')
      .replace(/\s*(ブラックVer\.|レッドVer\.|クリアVer\.)/gi, '')
      .trim();

    const match = cleanName.match(/^(.+?)(\d-\d{2})([A-Z]{1,3})$/i);
    if (match?.[1] && match[2] && match[3]) {
      return {
        blade: match[1].trim(),
        ratchet: match[2],
        bit: match[3].toUpperCase(),
      };
    }
    return {};
  }

  /**
   * Scrape and sync the entire lineup
   */
  public async syncLineup() {
    log.info('📥 Fetching Takara Tomy lineup...');
    const response = await fetch(this.LINEUP_URL);
    const html = await response.text();

    const products: OfficialProduct[] = this.extractProductsFromHtml(html);
    log.info(`📊 Found ${products.length} products to sync.`);

    let updated = 0;
    for (const product of products) {
      try {
        await this.syncProduct(product);
        updated++;
      } catch (error) {
        log.error(
          `Failed to sync ${product.code}: ${(error as Error).message}`,
        );
      }
    }

    return { total: products.length, updated };
  }

  private extractProductsFromHtml(html: string): OfficialProduct[] {
    const products: OfficialProduct[] = [];

    // Pattern based on actual HTML structure (Jan 2026)
    // <a href="bx01.html"> ... <b>BX-01<span>Name</span></b> ... <p class="category"><span>Type</span></p> ... <i>¥1,980...</i> ... <i class="red">Date...</i>
    const productPattern =
      /<a href="([^"]+)">[\s\S]*?<b>((?:BX|UX|CX)-\d{2,3})<span>([^<]+)<\/span><\/b>[\s\S]*?<p class="category"><span>([^<]+)<\/span><\/p>[\s\S]*?<i>¥([\d,]+)[^<]*<\/i>[\s\S]*?<i class="red">([\d.]+)[^<]*<\/i>/g;

    let match: RegExpExecArray | null;
    while (true) {
      match = productPattern.exec(html);
      if (match === null) break;

      const url = match[1];
      const code = match[2];
      const name = match[3]?.trim();
      const productTypeStr = match[4]?.trim();
      const priceStr = match[5];
      const releaseDateStr = match[6];

      if (!code || !name || !productTypeStr || !releaseDateStr) continue;

      const price = parseInt((priceStr || '0').replace(',', ''), 10);
      const isLimited =
        name.includes('限定') || productTypeStr.includes('限定');
      const { blade, ratchet, bit } = this.parseBeyName(name);

      // Normalize date (2023.7.15 -> 2023-07-15)
      const releaseDate = releaseDateStr.replace(/\./g, '-');

      products.push({
        code,
        name,
        productType: productTypeStr || 'OTHER',
        price,
        releaseDate,
        url: url || '',
        isLimited,
        limitedType: isLimited ? 'Limited' : undefined,
        bladeName: blade,
        ratchet,
        bit,
      });
    }

    return products;
  }

  private async syncProduct(item: OfficialProduct) {
    // 1. Map product type
    const typeMapping: Record<string, ProductType> = {
      スターター: ProductType.STARTER,
      ブースター: ProductType.BOOSTER,
      ランダムブースター: ProductType.RANDOM_BOOSTER,
      セット: ProductType.SET,
      カスタマイズセット: ProductType.SET,
      ダブルスターター: ProductType.DOUBLE_STARTER,
      ツール: ProductType.TOOL,
    };

    const line = item.code.startsWith('BX')
      ? ProductLine.BX
      : item.code.startsWith('UX')
        ? ProductLine.UX
        : ProductLine.CX;

    // 2. Upsert Product
    await this.prisma.product.upsert({
      where: { code: item.code },
      update: {
        name: item.name,
        price: item.price,
        releaseDate: item.releaseDate ? new Date(item.releaseDate) : undefined,
        isLimited: item.isLimited,
        limitedNote: item.limitedType,
        productUrl: item.url.startsWith('http')
          ? item.url
          : `https://beyblade.takaratomy.co.jp${item.url}`,
      },
      create: {
        code: item.code,
        name: item.name,
        productType: typeMapping[item.productType] || ProductType.BOOSTER,
        productLine: line,
        price: item.price,
        releaseDate: item.releaseDate ? new Date(item.releaseDate) : undefined,
        isLimited: item.isLimited,
        limitedNote: item.limitedType,
        productUrl: item.url.startsWith('http')
          ? item.url
          : `https://beyblade.takaratomy.co.jp${item.url}`,
      },
    });

    // 3. Update related Part rarity if it's a blade
    if (item.bladeName) {
      await this.prisma.part.updateMany({
        where: {
          type: PartType.BLADE,
          name: { contains: item.bladeName, mode: 'insensitive' },
        },
        data: {
          rarity: item.isLimited ? item.limitedType || 'Limited' : 'Standard',
        },
      });
    }
  }
}
