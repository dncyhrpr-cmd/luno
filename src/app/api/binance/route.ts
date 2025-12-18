import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const interval = searchParams.get('interval') || '1h';
    const limit = parseInt(searchParams.get('limit') || '200');

    if (symbol) {
        // Fetch historical klines for the symbol
        try {
            const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
            if (!response.ok) {
                throw new Error(`Binance API error: ${response.status}`);
            }
            const klines = await response.json();
            const formattedKlines = klines.map((k: any) => ({
                date: k[0], // timestamp
                open: k[1],
                high: k[2],
                low: k[3],
                close: k[4],
                volume: k[5]
            }));
            return NextResponse.json(formattedKlines);
        } catch (error) {
            console.error('Error fetching klines:', error);
            return NextResponse.json({ error: 'Failed to fetch historical data' }, { status: 500 });
        }
    }

    // Fallback to current prices if no symbol specified
    try {
        const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'ADAUSDT', 'DOGEUSDT', 'XRPUSDT', 'LTCUSDT', 'MATICUSDT', 'LINKUSDT'];
        const results = [];

        for (const sym of symbols) {
            try {
                const [statsRes, priceRes] = await Promise.all([
                    fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${sym}`),
                    fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${sym}`)
                ]);

                if (statsRes.ok && priceRes.ok) {
                    const [stats, price] = await Promise.all([statsRes.json(), priceRes.json()]);
                    results.push({
                        symbol: stats.symbol.replace('USDT', ''),
                        price: parseFloat(price.price),
                        change: parseFloat(stats.priceChangePercent),
                        volume: parseFloat(stats.volume)
                    });
                }
            } catch (err) {
                console.warn(`Error fetching ${sym}:`, err);
            }
        }

        return NextResponse.json(results);
    } catch (error) {
        console.error('Error in binance API:', error);
        // Fallback to mock data
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