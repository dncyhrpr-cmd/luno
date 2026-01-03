import { NextRequest, NextResponse } from 'next/server';
import { coinGeckoAPI } from '@/lib/coingecko-api';
import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 30 }); // 30 seconds cache

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbols = searchParams.get('symbols')?.split(',') || [];

    const cacheKey = symbols.length > 0 ? symbols.sort().join(',') : 'all';
    const cached = cache.get(cacheKey);
    if (cached) {
      return NextResponse.json({ prices: cached, cached: true });
    }

    let markets;
    if (symbols.length > 0) {
      // Fetch specific symbols
      const ids = symbols.map(s => s.toLowerCase());
      markets = await coinGeckoAPI.getCoinsMarkets(ids, 'usd', 100);
    } else {
      // Fetch top 100
      markets = await coinGeckoAPI.getCoinsMarkets([], 'usd', 100);
    }

    const prices = markets.map(market => ({
      symbol: market.symbol.toUpperCase(),
      price: market.current_price,
      change24h: market.price_change_percentage_24h,
      volume: market.total_volume,
      marketCap: market.market_cap
    }));

    cache.set(cacheKey, prices);

    return NextResponse.json({ prices });
  } catch (error: any) {
    console.error('Error fetching prices:', error);
    return NextResponse.json({ error: 'Failed to fetch prices' }, { status: 500 });
  }
}
