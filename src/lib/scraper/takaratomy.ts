import { log } from 'crawlee';
import type { PrismaClient } from '../../generated/prisma/index.js';
import {
  PartType,
  ProductLine,
  ProductType,
} from '../../generated/prisma/index.js';
import { ScraperService } from './index.js';

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

    // Pattern from dashboard script
    const productPattern =
      /\[((?:BX|UX|CX)-\d{2,3})\s+(?:【([^】]+)】\s*)?([^\]¥]+?)\s+(スターター|ブースター|ランダムブースター|ダブルスターター|セット|ツール|カスタマイズセット)\s+¥([\d,]+)（税込）\s*(\d{4}\.\d{1,2}\.\d{1,2})発売[^\]]*\]\(([^)]+)\)/g;

    let match: RegExpExecArray | null;
    while (true) {
      match = productPattern.exec(html);
      if (match === null) break;
      const code = match[1];
      const limitedInfo = match[2];
      const name = (match[3] || '').trim();
      const productTypeStr = match[4];
      const priceStr = match[5];
      const releaseDate = match[6];
      const url = match[7];

      if (!code || !name) continue;

      const price = parseInt((priceStr || '0').replace(',', ''), 10);
      const isLimited = !!limitedInfo;
      const { blade, ratchet, bit } = this.parseBeyName(name);

      products.push({
        code,
        name,
        productType: productTypeStr || 'OTHER',
        price,
        releaseDate: releaseDate || '',
        url: url || '',
        isLimited,
        limitedType: limitedInfo || undefined,
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
