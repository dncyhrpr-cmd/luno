import NodeCache from 'node-cache';

// Define interfaces for CoinGecko data
export interface CoinGeckoCoin {
  id: string;
  symbol: string;
  name: string;
  image?: string; // Add if fetched
}

export interface CoinGeckoMarket {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  price_change_percentage_24h: number;
  total_volume: number;
}

// Singleton class for CoinGecko API
class CoinGeckoAPI {
  private cache = new NodeCache({ stdTTL: 60 }); // 1 minute cache
  private baseUrl = 'https://api.coingecko.com/api/v3';

  /**
   * Get list of all coins with id, symbol, name
   */
  async getCoinsList(): Promise<CoinGeckoCoin[]> {
    try {
      const response = await fetch(`${this.baseUrl}/coins/list`);
      if (!response.ok) {
        throw new Error(`Failed to fetch coins list: ${response.status}`);
      }
      const data: CoinGeckoCoin[] = await response.json();
      return data;
    } catch (error: any) {
      console.error('Error fetching CoinGecko coins list:', error);
      return [];
    }
  }

  /**
   * Get market data for specific coins or top coins
   */
  async getCoinsMarkets(ids: string[] = [], vsCurrency = 'usd', limit = 100): Promise<CoinGeckoMarket[]> {
    const cacheKey = `markets_${ids.sort().join(',')}_${vsCurrency}_${limit}`;
    const cached = this.cache.get<CoinGeckoMarket[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const params = new URLSearchParams();
      if (ids.length > 0) {
        params.set('ids', ids.join(','));
      }
      params.set('vs_currency', vsCurrency);
      params.set('order', 'market_cap_desc');
      params.set('per_page', limit.toString());
      params.set('page', '1');
      const url = `${this.baseUrl}/coins/markets?${params.toString()}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch markets: ${response.status}`);
      }
      const data: CoinGeckoMarket[] = await response.json();
      this.cache.set(cacheKey, data);
      return data;
    } catch (error: any) {
      console.error('Error fetching CoinGecko markets:', error);
      return [];
    }
  }

  /**
   * Get coin data by id to include image
   */
  async getCoinById(id: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/coins/${id}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch coin ${id}: ${response.status}`);
      }
      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error('Error fetching coin by id:', error);
      return null;
    }
  }

  /**
   * Get exchange rates (normalized to BTC as 1)
   */
  async getExchangeRates(): Promise<any> {
    const cacheKey = 'exchange_rates';
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(`${this.baseUrl}/exchange_rates`);
      if (!response.ok) {
        throw new Error(`Failed to fetch exchange rates: ${response.status}`);
      }
      const data = await response.json();
      this.cache.set(cacheKey, data);
      return data;
    } catch (error: any) {
      console.error('Error fetching exchange rates:', error);
      return null;
    }
  }

  /**
   * Get INR to USDT exchange rate (USDT approximated as USD)
   */
  async getInrToUsdtRate(): Promise<number | null> {
    const rates = await this.getExchangeRates();
    if (!rates || !rates.rates) return null;

    const inrRate = rates.rates.inr?.value;
    const usdRate = rates.rates.usd?.value;

    if (!inrRate || !usdRate) return null;

    // Since all rates are relative to BTC=1, INR/USD = inrRate / usdRate
    return inrRate / usdRate;
  }
}

// Export singleton instance
export const coinGeckoAPI = new CoinGeckoAPI();