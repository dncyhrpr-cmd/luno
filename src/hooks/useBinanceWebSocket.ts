import { useEffect, useRef, useState, useCallback } from 'react';

export interface PriceUpdate {
    symbol: string;
    price: number;
    change: number;
    volume: number;
    timestamp: number;
}

interface WebSocketMessage {
    e: string; // Event type
    E: number; // Event time
    s: string; // Symbol
    c: string; // Close price
    p: string; // Price change
    P: string; // Price change percent
    w: string; // Weighted average price
    x: string; // First trade(pre-close) price
    Q: string; // Last quantity
    v: string; // Total traded base asset volume
    q: string; // Total traded quote asset volume
    O: number; // Open time
    C: number; // Close time
    F: number; // First trade ID
    L: number; // Last trade ID
    n: number; // Total number of trades
}

export const useBinanceWebSocket = (symbols: string[]) => {
    const [prices, setPrices] = useState<Map<string, PriceUpdate>>(new Map());
    const [isConnected, setIsConnected] = useState(false);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isConnectingRef = useRef(false);
    const reconnectAttemptsRef = useRef(0);

    useEffect(() => {
        if (!symbols || symbols.length === 0) {
            return;
        }

        const connect = () => {
            if (isConnectingRef.current || reconnectAttemptsRef.current >= 3) {
                return; // Already connecting or max retries reached
            }
            isConnectingRef.current = true;
            // Construct the stream URL from the symbols - limit to first 4 to avoid overload
            const limitedSymbols = symbols.slice(0, 4);
            const symbolsList = limitedSymbols
                .map(s => s.toLowerCase().replace(/usdt$/i, ''))
                .map(s => `${s}usdt@ticker`)
                .join('/');

            const wsUrl = `wss://stream.binance.com:9443/stream?streams=${symbolsList}`;
            console.log('Connecting to Binance WebSocket (attempt', reconnectAttemptsRef.current + 1, '):', wsUrl);

            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('Binance WebSocket connected.');
                setIsConnected(true);
                isConnectingRef.current = false;
                reconnectAttemptsRef.current = 0; // Reset on successful connection
                // Clear any outstanding reconnect timeout
                if (reconnectTimeoutRef.current) {
                    clearTimeout(reconnectTimeoutRef.current);
                    reconnectTimeoutRef.current = null;
                }
            };

            ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    const data: WebSocketMessage = message.data || message;
                    
                    if (!data.s) return;
                    
                    const baseSymbol = data.s.replace(/USDT$/i, '');
                    
                    const update: PriceUpdate = {
                        symbol: baseSymbol,
                        price: parseFloat(data.c),
                        change: parseFloat(data.P),
                        volume: parseFloat(data.v),
                        timestamp: data.E
                    };

                    setPrices(prev => new Map(prev).set(baseSymbol, update));
                } catch (error: any) {
                    console.error('Error processing WebSocket message:', error);
                }
            };

            ws.onerror = (error) => {
                console.error('Binance WebSocket error:', error);
                console.error('WebSocket readyState:', ws.readyState);
                console.error('WebSocket URL:', ws.url);
                console.error('Error event details:', {
                    type: error.type,
                    target: error.target,
                    isTrusted: error.isTrusted,
                    eventPhase: error.eventPhase
                });
                setIsConnected(false);
                isConnectingRef.current = false;
                reconnectAttemptsRef.current++;
                // Attempt to reconnect on error if not already scheduled and under max attempts
                if (!reconnectTimeoutRef.current && reconnectAttemptsRef.current < 3) {
                    console.log('Attempting to reconnect due to WebSocket error (attempt', reconnectAttemptsRef.current, ')...');
                    reconnectTimeoutRef.current = setTimeout(() => {
                        reconnectTimeoutRef.current = null;
                        connect();
                    }, 3000);
                } else if (reconnectAttemptsRef.current >= 3) {
                    console.warn('Max WebSocket reconnection attempts reached. Giving up.');
                }
            };

            ws.onclose = (event) => {
                setIsConnected(false);
                isConnectingRef.current = false;
                console.log('Binance WebSocket disconnected. Code:', event.code, 'Reason:', event.reason);

                // Reconnect if the disconnection was not intentional (code 1000) and under max attempts
                if (event.code !== 1000 && !reconnectTimeoutRef.current && reconnectAttemptsRef.current < 3) {
                    reconnectAttemptsRef.current++;
                    console.log('Attempting to reconnect in 3 seconds (attempt', reconnectAttemptsRef.current, ')...');
                    reconnectTimeoutRef.current = setTimeout(() => {
                        reconnectTimeoutRef.current = null;
                        connect();
                    }, 3000);
                } else if (reconnectAttemptsRef.current >= 3) {
                    console.warn('Max WebSocket reconnection attempts reached. Giving up.');
                }
            };
        };

        connect();

        // Cleanup function to be called on component unmount or when symbols change
        return () => {
            console.log('Cleaning up WebSocket connection.');
            isConnectingRef.current = false;
            reconnectAttemptsRef.current = 0; // Reset on cleanup
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = null;
            }
            if (wsRef.current) {
                // Set code to 1000 for intentional closure
                wsRef.current.close(1000);
                wsRef.current = null;
            }
            setIsConnected(false);
        };
    }, [symbols]); // Effect dependency on symbols array

    return {
        prices,
        isConnected,
    };
};
