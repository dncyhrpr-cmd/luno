import { NextRequest, NextResponse } from 'next/server';
import { binanceAPI } from '../../../lib/binance-api';
import { coinGeckoAPI } from '../../../lib/coingecko-api';

// Simple in-memory cache
let cachedCoins: any = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function GET(request: NextRequest) {
  try {
    const now = Date.now();
    if (cachedCoins && (now - lastFetchTime < CACHE_DURATION)) {
      return NextResponse.json({ coins: cachedCoins, cached: true });
    }

    // Fetch all USDT symbols from Binance
    const binanceSymbols = await binanceAPI.getUSDTSymbols();
    if (binanceSymbols.length === 0) {
      if (cachedCoins) return NextResponse.json({ coins: cachedCoins, cached: true, stale: true });
      return NextResponse.json({ error: 'Failed to fetch Binance symbols' }, { status: 500 });
    }

    // Create set of Binance symbols (lowercase)
    const binanceSymbolsSet = new Set(binanceSymbols.map(s => s.toLowerCase()));

    // Fetch top 250 coins by market cap from CoinGecko
    const markets = await coinGeckoAPI.getCoinsMarkets([], 'usd', 250);

    // Filter to only coins available on Binance
    const filteredMarkets = markets.filter(market => binanceSymbolsSet.has(market.symbol.toLowerCase()));

    // Define additional coins to include
    const additionalCoinIds = ['bitshares'];

    // Fetch market data for additional coins
    const additionalMarkets = await coinGeckoAPI.getCoinsMarkets(additionalCoinIds, 'usd', additionalCoinIds.length);

    // Filter additional coins to only those available on Binance
    const filteredAdditional = additionalMarkets; // temporarily remove filter to test

    // Format additional coins the same way
    const formattedAdditional = filteredAdditional.map(market => ({
      id: market.id,
      symbol: market.symbol.toUpperCase(),
      name: market.name,
      image: market.image,
      current_price: market.current_price,
      market_cap: market.market_cap,
      price_change_percentage_24h: market.price_change_percentage_24h,
      total_volume: market.total_volume,
    }));

    // Take top 100 and format
    const topCoins = filteredMarkets.slice(0, 100).map(market => ({
      id: market.id,
      symbol: market.symbol.toUpperCase(),
      name: market.name,
      image: market.image,
      current_price: market.current_price,
      market_cap: market.market_cap,
      price_change_percentage_24h: market.price_change_percentage_24h,
      total_volume: market.total_volume,
    }));

    // Merge top coins with additional coins
    const allCoins = [...topCoins, ...formattedAdditional];

    cachedCoins = allCoins;
    lastFetchTime = now;

    return NextResponse.json({ coins: allCoins });
  } catch (error: any) {
    console.error('Error in /api/coins:', error);
    if (cachedCoins) {
      return NextResponse.json({ coins: cachedCoins, cached: true, error: 'Partial update failure' });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}