import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

const COINGECKO_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd';
const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const FALLBACK_PRICE_USD = 3000; // only used until the first successful fetch completes

@Injectable()
export class EthPriceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EthPriceService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private priceUsd = FALLBACK_PRICE_USD;

  onModuleInit() {
    this.refresh();
    this.timer = setInterval(() => this.refresh(), REFRESH_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Latest known ETH/USD price. Updated in the background every 5 minutes. */
  getUsdPrice(): number {
    return this.priceUsd;
  }

  private async refresh() {
    try {
      const res = await fetch(COINGECKO_URL);
      if (!res.ok) throw new Error(`CoinGecko responded with ${res.status}`);
      const data = await res.json();
      const price = data?.ethereum?.usd;
      if (typeof price !== 'number') throw new Error('Unexpected CoinGecko response shape');
      this.priceUsd = price;
    } catch (err) {
      this.logger.warn(
        `Failed to refresh ETH/USD price, keeping last known value ($${this.priceUsd}): ${(err as Error).message}`,
      );
    }
  }
}
