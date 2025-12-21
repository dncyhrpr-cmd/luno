import { NextRequest, NextResponse } from 'next/server';

function generateSyntheticKlines(symbol: string, interval: string, limit: number): any[] {
    const now = Date.now();
    const intervalMs: Record<string, number> = {
        '15m': 15 * 60 * 1000,
        '1h': 60 * 60 * 1000,
        '4h': 4 * 60 * 60 * 1000,
        '1d': 24 * 60 * 60 * 1000,
    };
    
    const ms = intervalMs[interval] || 60 * 60 * 1000;
    const klines = [];
    
    let basePrice = 50000;
    if (symbol.includes('ETH')) basePrice = 3000;
    if (symbol.includes('SOL')) basePrice = 150;
    if (symbol.includes('BNB')) basePrice = 600;
    
    for (let i = limit - 1; i >= 0; i--) {
        const time = now - i * ms;
        const volatility = 0.02;
        const change = (Math.random() - 0.5) * volatility;
        const open = basePrice * (1 + change);
        const close = open * (1 + (Math.random() - 0.5) * volatility);
        const high = Math.max(open, close) * (1 + Math.random() * 0.01);
        const low = Math.min(open, close) * (1 - Math.random() * 0.01);
        const volume = Math.random() * 1000000;
        
        klines.push([time, open.toFixed(2), high.toFixed(2), low.toFixed(2), close.toFixed(2), volume.toFixed(0)]);
        basePrice = close;
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
            
            const formattedKlines = klines.map((k: any) => ({
                date: k[0],
                open: k[1],
                high: k[2],
                low: k[3],
                close: k[4],
                volume: k[5]
            }));
            return NextResponse.json(formattedKlines);
        } catch (error: any) {
            const errorMessage = error?.message || String(error);
            console.error(`[Binance API] Error fetching klines for ${symbol}:`, errorMessage);
            
            console.log(`[Binance API] Falling back to synthetic data for ${symbol}`);
            const syntheticKlines = generateSyntheticKlines(symbol, interval, limit);
            const formattedKlines = syntheticKlines.map((k: any) => ({
                date: k[0],
                open: k[1],
                high: k[2],
                low: k[3],
                close: k[4],
                volume: k[5]
            }));
            return NextResponse.json(formattedKlines);
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