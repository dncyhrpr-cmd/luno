
// Define interfaces for our data structures
export interface CryptoPrice {
  symbol: string;
  price: number;
  change: number;
  volume: number;
}

export interface KlineData {
    date: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

// A singleton class to interact with the Binance API using fetch
class BinanceAPI {

  /**
   * Get current prices, 24h change, and volume for multiple symbols.
   */
  async getPrices(symbols: string[]): Promise<CryptoPrice[]> {
    try {
      // If symbols are provided, we can fetch specific ones. 
      // However, Binance API 'ticker/24hr' with symbols parameter requires JSON string format ["BTCUSDT","ETHUSDT"]
      // Or we can fetch all and filter. Fetching all is lighter than many individual requests but heavier than one specific request.
      
      let url = 'https://api.binance.com/api/v3/ticker/24hr';
      
      // If we have a small number of symbols, we can try to optimize, but typically fetching all is robust enough
      // unless we need very specific ones.
      // For now, let's fetch all and filter client-side (server-side in this context) to keep it simple
      // as constructing the symbols query param can be tricky with length limits.

      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Failed to fetch prices: ${response.status}`);
      }

      const data = await response.json();
      
      // Map all data to CryptoPrice format
      const allPrices: CryptoPrice[] = data.map((item: any) => ({
        symbol: item.symbol,
        price: parseFloat(item.lastPrice),
        change: parseFloat(item.priceChangePercent),
        volume: parseFloat(item.quoteVolume), // quoteVolume is usually in USDT for USDT pairs
      }));

      // Filter if symbols are provided
      if (symbols && symbols.length > 0) {
        // Ensure symbols are in the format the caller expects (likely without USDT or need to check)
        // The caller usually passes "BTC", "ETH". But Binance returns "BTCUSDT".
        // Let's assume the caller might pass "BTC" or "BTCUSDT".
        
        return allPrices.filter(p => {
            const base = p.symbol.replace('USDT', '');
            return symbols.includes(p.symbol) || symbols.includes(base);
        });
      }
      
      return allPrices;

    } catch (error) {
      console.error('Error fetching prices from Binance:', error);
      return [];
    }
  }

  /**
   * Get kline (candlestick) data for a specific symbol.
   */
  async getKlines(symbol: string, interval: string = '1h', limit: number = 100): Promise<KlineData[]> {
    try {
      const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch klines: ${response.status}`);
      }
      const data = await response.json();

      return data.map((k: any) => ({
        date: new Date(k[0]),
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
      }));
    } catch (error: any) {
      console.error(`Error getting klines for ${symbol}:`, error);
      throw new Error(`Failed to get klines for ${symbol}.`);
    }
  }

  /**
   * Get all available USDT trading symbols.
   */
  async getUSDTSymbols(): Promise<string[]> {
    try {
      const response = await fetch('https://api.binance.com/api/v3/exchangeInfo', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Failed to fetch exchange info: ${response.status}`);
      }
      const data = await response.json();
      return data.symbols
        .filter((s: any) => s.quoteAsset === 'USDT' && s.status === 'TRADING')
        .map((s: any) => s.baseAsset);
    } catch (error: any) {
      console.error('Error fetching symbols from Binance:', error);
      return [];
    }
  }
}

// Export a singleton instance of the API client
export const binanceAPI = new BinanceAPI();
