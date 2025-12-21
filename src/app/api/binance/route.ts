import { NextRequest, NextResponse } from 'next/server';

function generateSyntheticKlines(symbol: string, interval: string, limit: number, anchorPrice: number = 0): any[] {
    const now = Date.now();
    const intervalMs: Record<string, number> = {
        '15m': 15 * 60 * 1000,
        '1h': 60 * 60 * 1000,
        '4h': 4 * 60 * 60 * 1000,
        '1d': 24 * 60 * 60 * 1000,
    };
    
    const ms = intervalMs[interval] || 60 * 60 * 1000;
    const klines = [];
    
    let basePrice = 97000; // Updated approx prices Dec 2025
    if (symbol.includes('ETH')) basePrice = 2700;
    if (symbol.includes('SOL')) basePrice = 150;
    if (symbol.includes('BNB')) basePrice = 630;
    if (symbol.includes('ADA')) basePrice = 0.75;
    if (symbol.includes('DOGE')) basePrice = 0.25;
    if (symbol.includes('XRP')) basePrice = 1.50;
    if (symbol.includes('LTC')) basePrice = 85;
    if (symbol.includes('MATIC')) basePrice = 0.40;
    if (symbol.includes('LINK')) basePrice = 15.0;

    // If anchorPrice is provided, use it as the starting point for the LATEST candle
    // and generate backwards.
    let currentSimPrice = anchorPrice > 0 ? anchorPrice : basePrice;
    
    for (let i = 0; i < limit; i++) {
        const time = now - i * ms;
        const volatility = 0.015;
        
        // We are going backwards in time.
        // currentSimPrice is the CLOSE of the current candle (time i).
        // We need to generate OPEN, HIGH, LOW.
        // And determine the CLOSE of the PREVIOUS candle (time i+1), which is roughly the OPEN of this candle.
        
        const change = (Math.random() - 0.5) * volatility;
        const close = currentSimPrice;
        // open = close / (1 + change) approx
        const open = parseFloat((close / (1 + change)).toFixed(8));
        
        const high = parseFloat((Math.max(open, close) * (1 + Math.random() * 0.005)).toFixed(8));
        const low = parseFloat((Math.min(open, close) * (1 - Math.random() * 0.005)).toFixed(8));
        const volume = parseFloat((Math.random() * 500000).toFixed(2));
        
        // Unshift to add to the beginning of the array (oldest first)
        klines.unshift({
            date: time,
            open,
            high,
            low,
            close,
            volume
        });
        
        // The OPEN of this candle becomes the CLOSE of the previous candle (in time)
        // So for the next iteration (i+1, which is older), currentSimPrice = open
        currentSimPrice = open;
    }
    
    return klines;
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const interval = searchParams.get('interval') || '1h';
    const limit = parseInt(searchParams.get('limit') || '200');

    if (symbol) {
        // Fetch historical klines for the symbol
        try {
            const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
            console.log(`[Binance API] Fetching klines from: ${url}`);
            
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);
            
            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; LunoApp/1.0)',
                }
            });
            clearTimeout(timeout);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[Binance API] Failed with status ${response.status}: ${errorText}`);
                throw new Error(`Binance API error: ${response.status} - ${errorText}`);
            }
            
            const klines = await response.json();
            
            if (!Array.isArray(klines) || klines.length === 0) {
                console.warn(`[Binance API] Empty response for symbol: ${symbol}`);
                return NextResponse.json({ error: 'No data available from Binance' }, { status: 404 });
            }
            
            const formattedKlines = klines.map((k: any) => {
                const date = typeof k[0] === 'number' ? k[0] : parseInt(k[0]);
                const open = typeof k[1] === 'number' ? k[1] : parseFloat(k[1]);
                const high = typeof k[2] === 'number' ? k[2] : parseFloat(k[2]);
                const low = typeof k[3] === 'number' ? k[3] : parseFloat(k[3]);
                const close = typeof k[4] === 'number' ? k[4] : parseFloat(k[4]);
                const volume = typeof k[5] === 'number' ? k[5] : parseFloat(k[5]);
                
                return {
                    date,
                    open,
                    high,
                    low,
                    close,
                    volume
                };
            });
            console.log(`[Binance API] Successfully fetched ${formattedKlines.length} klines for ${symbol}`);
            return NextResponse.json(formattedKlines);
        } catch (error: any) {
            const errorMessage = error?.message || String(error);
            console.error(`[Binance API] Error fetching klines for ${symbol}:`, errorMessage);
            
            console.log(`[Binance API] Falling back to synthetic data for ${symbol}`);
            
            // Try to fetch current price to anchor synthetic data
            let currentPrice = 0;
            try {
                const priceController = new AbortController();
                const priceTimeout = setTimeout(() => priceController.abort(), 2000);
                const priceRes = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`, {
                    signal: priceController.signal
                });
                clearTimeout(priceTimeout);
                if (priceRes.ok) {
                    const priceData = await priceRes.json();
                    currentPrice = parseFloat(priceData.price);
                    console.log(`[Binance API] Fetched current price for synthetic anchor: ${currentPrice}`);
                }
            } catch (e) {
                console.log('[Binance API] Could not fetch current price for anchor, using defaults');
            }

            const syntheticKlines = generateSyntheticKlines(symbol, interval, limit, currentPrice);
            console.log(`[Binance API] Generated ${syntheticKlines.length} synthetic klines for ${symbol}`);
            
            return NextResponse.json(syntheticKlines, {
                headers: {
                    'X-Luno-Data-Source': 'synthetic'
                }
            });
        }
    }

    console.log('[Binance API] Fetching current prices (no symbol specified)');
    
    try {
        const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'ADAUSDT', 'DOGEUSDT', 'XRPUSDT', 'LTCUSDT', 'MATICUSDT', 'LINKUSDT'];
        const results = [];

        for (const sym of symbols) {
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 5000);
                
                const [statsRes, priceRes] = await Promise.all([
                    fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${sym}`, { signal: controller.signal }),
                    fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${sym}`, { signal: controller.signal })
                ]);
                clearTimeout(timeout);

                if (statsRes.ok && priceRes.ok) {
                    const [stats, price] = await Promise.all([statsRes.json(), priceRes.json()]);
                    results.push({
                        symbol: stats.symbol.replace('USDT', ''),
                        price: parseFloat(price.price),
                        change: parseFloat(stats.priceChangePercent),
                        volume: parseFloat(stats.volume)
                    });
                }
            } catch (err: any) {
                console.warn(`[Binance API] Error fetching ${sym}:`, err?.message || err);
            }
        }

        if (results.length > 0) {
            return NextResponse.json(results);
        } else {
            throw new Error('No price data retrieved from Binance');
        }
    } catch (error: any) {
        console.error('[Binance API] Error fetching prices, using fallback:', error?.message || error);
        const prices = [
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
        return NextResponse.json(prices);
    }
}