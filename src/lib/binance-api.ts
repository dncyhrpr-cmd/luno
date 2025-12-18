
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
    // Temporary mock data for testing
    console.log('Using mock data for symbols:', symbols);
    const mockData: CryptoPrice[] = [
      { symbol: 'BTC', price: 95000, change: 2.5, volume: 1500000 },
      { symbol: 'ETH', price: 3200, change: -1.2, volume: 800000 },
      { symbol: 'SOL', price: 180, change: 5.8, volume: 200000 },
      { symbol: 'BNB', price: 650, change: 1.1, volume: 100000 },
      { symbol: 'ADA', price: 0.85, change: -0.5, volume: 50000 },
      { symbol: 'DOGE', price: 0.32, change: 3.2, volume: 30000 },
      { symbol: 'XRP', price: 1.15, change: 0.8, volume: 40000 },
      { symbol: 'LTC', price: 125, change: -2.1, volume: 20000 },
      { symbol: 'MATIC', price: 1.85, change: 4.5, volume: 25000 },
      { symbol: 'LINK', price: 18.5, change: 1.8, volume: 15000 },
    ];

    return mockData.filter(item => symbols.includes(item.symbol + 'USDT'));
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
      const response = await fetch('https://api.binance.com/api/v3/exchangeInfo');
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
