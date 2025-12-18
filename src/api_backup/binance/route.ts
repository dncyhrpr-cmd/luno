import { NextRequest, NextResponse } from 'next/server';
import { binanceAPI } from '../../../lib/binance-api';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const symbol = searchParams.get('symbol');
        const interval = searchParams.get('interval') || '1h';
        const limit = parseInt(searchParams.get('limit') || '100');

        if (symbol) {
            // Get kline data for specific symbol
            const klines = await binanceAPI.getKlines(symbol, interval, limit);
            return NextResponse.json(klines);
        } else {
            // Get all available symbols and their prices
            const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'ADAUSDT', 'DOGEUSDT', 'XRPUSDT', 'LTCUSDT', 'MATICUSDT', 'LINKUSDT'];
            const prices = await binanceAPI.getPrices(symbols);
            return NextResponse.json(prices);
        }
    } catch (error: any) {
        // Log the full error server-side for debugging
        console.error('Error in /api/binance route:', error);

        // Return a bit more detail to the client for easier debugging in development.
        // In production, you may want to avoid returning raw error messages.
        return NextResponse.json(
            { error: 'Failed to fetch data from Binance', details: String(error) },
            { status: 500 }
        );
    }
}
