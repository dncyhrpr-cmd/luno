import { useEffect, useRef, useState, useMemo, useCallback } from 'react';

export interface PriceUpdate {
    symbol: string;
    price: number;
    change: number;
    volume: number;
    timestamp: number;
}

export const useBinanceWebSocket = (symbols: string[]) => {
    const [prices, setPrices] = useState<Map<string, PriceUpdate>>(new Map());
    const [isConnected, setIsConnected] = useState(false);
    const [connectionAttempts, setConnectionAttempts] = useState(0);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const lastSymbolsKeyRef = useRef<string>('');
    const isConnectingRef = useRef(false);

    // Create a stable key from symbols to prevent unnecessary reconnects
    const symbolsKey = useMemo(() => {
        return [...symbols].sort().join(',');
    }, [symbols]);

    // Connection function with retry logic
    const connectWebSocket = useCallback((attemptCount = 0) => {
        if (!symbolsKey) return;
        if (isConnectingRef.current) {
            console.log('WS connection already in progress, skipping');
            return;
        }

        const symbolList = symbolsKey.split(',');
        if (symbolList.length === 0 || (symbolList.length === 1 && symbolList[0] === '')) return;

        // Limit to first 10 symbols to avoid URL length limits and connection issues
        const limitedSymbols = symbolList.slice(0, 10);
        const streams = limitedSymbols.map(s => {
            let symbol = s.toLowerCase();
            if (!symbol.endsWith('usdt')) {
                symbol += 'usdt';
            }
            return `${symbol}@ticker`;
        });

        // Binance combined stream URL
        const wsUrl = `wss://stream.binance.com:9443/stream?streams=${streams.join('/')}`;

        console.log(`Connecting to Binance WS (attempt ${attemptCount + 1}):`, wsUrl);
        isConnectingRef.current = true;

        let ws: WebSocket;
        try {
            ws = new WebSocket(wsUrl);
        } catch (error) {
            console.error('Failed to create WebSocket (possibly due to browser extension interference):', error);
            setIsConnected(false);
            isConnectingRef.current = false;
            return;
        }

        wsRef.current = ws;

        ws.onopen = () => {
            console.log('Binance WS Connected');
            setIsConnected(true);
            setConnectionAttempts(0); // Reset on successful connection
            isConnectingRef.current = false;

            // Start heartbeat to keep connection alive
            heartbeatIntervalRef.current = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    // Send ping frame (opcode 0x9, no payload)
                    const pingFrame = new Uint8Array([0x89, 0x00]);
                    ws.send(pingFrame.buffer);
                    console.log('Sent ping to Binance WS to keep connection alive');
                }
            }, 5 * 60 * 1000); // Every 5 minutes
        };

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                // Message format: { stream: 'btcusdt@ticker', data: { ...ticker data... } }
                if (message.data) {
                    const ticker = message.data;
                    const symbol = ticker.s; // e.g. BTCUSDT

                    const priceUpdate: PriceUpdate = {
                        symbol: symbol,
                        price: parseFloat(ticker.c),
                        change: parseFloat(ticker.P),
                        volume: parseFloat(ticker.q), // Quote volume (USDT)
                        timestamp: ticker.E
                    };

                    setPrices(prev => {
                        const newMap = new Map(prev);
                        newMap.set(symbol, priceUpdate);
                        // Also set the short symbol version (e.g. BTC)
                        if (symbol.endsWith('USDT')) {
                            const shortSymbol = symbol.replace('USDT', '');
                            newMap.set(shortSymbol, priceUpdate);
                        }
                        return newMap;
                    });
                }
            } catch (err) {
                console.error('WS Message Parse Error:', err);
            }
        };

        ws.onclose = (event) => {
            console.log('Binance WS Closed:', 'Code:', event.code, 'Reason:', event.reason, 'WasClean:', event.wasClean);
            setIsConnected(false);
            isConnectingRef.current = false;

            // Clear heartbeat interval
            if (heartbeatIntervalRef.current) {
                clearInterval(heartbeatIntervalRef.current);
                heartbeatIntervalRef.current = null;
            }

            // Don't retry if it was a deliberate close (code 1000)
            if (event.code !== 1000 && attemptCount < 3) {
                const retryDelay = Math.min(1000 * Math.pow(2, attemptCount), 30000); // Exponential backoff, max 30s
                console.log(`Retrying WS connection in ${retryDelay}ms...`);
                reconnectTimeoutRef.current = setTimeout(() => {
                    setConnectionAttempts(prev => prev + 1);
                    connectWebSocket(attemptCount + 1);
                }, retryDelay);
            }
        };

        ws.onerror = (err) => {
            console.error('Binance WS Error:', err, 'ReadyState:', ws.readyState);
            setIsConnected(false);
            isConnectingRef.current = false;
            // Error handling is done in onclose
        };

    }, [symbolsKey]);

    useEffect(() => {
        if (lastSymbolsKeyRef.current !== symbolsKey) {
            console.log('Symbols changed, reconnecting WS. Old:', lastSymbolsKeyRef.current, 'New:', symbolsKey);
            lastSymbolsKeyRef.current = symbolsKey;

            // Cleanup previous connection and timeout
            if (wsRef.current) {
                wsRef.current.close();
            }
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }

            connectWebSocket();
        }

        return () => {
            if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
                wsRef.current.close();
            }
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            if (heartbeatIntervalRef.current) {
                clearInterval(heartbeatIntervalRef.current);
            }
        };
    }, [symbolsKey, connectWebSocket]);

    return {
        prices,
        isConnected,
        connectionAttempts,
        // Provide fallback prices if WebSocket fails
        getPrice: useCallback((symbol: string) => {
            const upperSymbol = symbol.toUpperCase();
            const usdtSymbol = upperSymbol + 'USDT';
            return prices.get(usdtSymbol) || prices.get(upperSymbol) || prices.get(symbol);
        }, [prices])
    };
};
