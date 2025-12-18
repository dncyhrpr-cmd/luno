'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { ArrowUp, ArrowDown, Wallet, Clock, TrendingUp, TrendingDown, Layers, Target, AlertCircle, CheckCircle } from 'lucide-react';
import { useBinanceWebSocket, PriceUpdate } from '../../hooks/useBinanceWebSocket';
import { motion, AnimatePresence } from 'framer-motion';
import { safeFetch } from '../../lib/safeFetch';

// Import chart components
import { 
    Chart, 
    ChartCanvas, 
    CandlestickSeries, 
    BarSeries, 
    LineSeries, 
    CrossHairCursor, 
    MouseCoordinateX, 
    MouseCoordinateY, 
    discontinuousTimeScaleProviderBuilder, 
    OHLCTooltip, 
    ema, 
    rsi, 
    macd, 
    withSize, 
    XAxis, 
    YAxis, 
    ZoomButtons, 
    MovingAverageTooltip 
} from 'react-financial-charts';

const ResponsiveChartCanvas = withSize()(ChartCanvas);

// --- TYPES ---
interface CryptoCoin {
    id: string;
    name: string;
    symbol: string;
}

interface KlineData {
    date: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    ema50?: number;
    ema20?: number;
    rsi?: number;
    macd?: {
        macd: number;
        signal: number;
        histogram: number;
    };
}

interface CardProps {
    title?: string;
    children: React.ReactNode;
    className?: string;
}

interface OrderResponse {
    success: boolean;
    message?: string;
    error?: string;
}

// --- CONSTANTS ---
const cryptoCoins: CryptoCoin[] = [
    { id: 'btc', name: 'Bitcoin', symbol: 'BTC' },
    { id: 'eth', name: 'Ethereum', symbol: 'ETH' },
    { id: 'sol', name: 'Solana', symbol: 'SOL' },
    { id: 'bnb', name: 'Binance Coin', symbol: 'BNB' },
    { id: 'ada', name: 'Cardano', symbol: 'ADA' },
    { id: 'doge', name: 'Dogecoin', symbol: 'DOGE' },
    { id: 'xrp', name: 'Ripple', symbol: 'XRP' },
    { id: 'ltc', name: 'Litecoin', symbol: 'LTC' },
];

const coinSymbols = cryptoCoins.map(c => c.symbol);

// --- COMPONENTS ---
const Card: React.FC<CardProps> = React.memo(({ title, children, className = '' }) => (
    <div className={`bg-white dark:bg-gray-800 p-4 md:p-6 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 transition-colors duration-300 ${className}`}>
        {title && <h2 className="mb-4 text-lg font-semibold text-gray-800 md:text-xl dark:text-gray-100">{title}</h2>}
        {children}
    </div>
));

Card.displayName = 'Card';

// --- MAIN COMPONENT ---
const MarketPage: React.FC = () => {
    const [selectedCoin, setSelectedCoin] = useState<CryptoCoin>(cryptoCoins[0]);
    const [chartHistory, setChartHistory] = useState<KlineData[]>([]);
    const { prices, isConnected } = useBinanceWebSocket(coinSymbols);
    const [currentPrice, setCurrentPrice] = useState<number>(0);
    const [priceChange, setPriceChange] = useState<number>(0);
    const [tradeType, setTradeType] = useState<'BUY' | 'SELL'>('BUY');
    const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET');
    const [amount, setAmount] = useState<number>(0.01);
    const [limitPrice, setLimitPrice] = useState<number>(0);
    const [leverage, setLeverage] = useState<number>(1);
    const [timeframe, setTimeframe] = useState<string>('1h');
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [dataFetchError, setDataFetchError] = useState<string | null>(null);
    const [balance, setBalance] = useState<number>(0);
    const [orderStatus, setOrderStatus] = useState<{ show: boolean; success: boolean; message: string }>({
        show: false,
        success: false,
        message: ''
    });
    const [orderSubmitting, setOrderSubmitting] = useState<boolean>(false);

    // Update chart with real-time data
    useEffect(() => {
        const priceUpdate = prices.get(selectedCoin.symbol);
        if (priceUpdate && chartHistory.length > 0) {
            setCurrentPrice(priceUpdate.price);
            setPriceChange(priceUpdate.change);

            setChartHistory(prevHistory => {
                const newHistory = [...prevHistory];
                const lastCandle = newHistory[newHistory.length - 1];

                const newCandle = {
                    ...lastCandle,
                    close: priceUpdate.price,
                    high: Math.max(lastCandle.high, priceUpdate.price),
                    low: Math.min(lastCandle.low, priceUpdate.price),
                    volume: lastCandle.volume + priceUpdate.volume, // This is an approximation
                };

                newHistory[newHistory.length - 1] = newCandle;
                return newHistory;
            });
        }
    }, [prices, selectedCoin, chartHistory.length]);


    // Fetch user balance
    useEffect(() => {
        const fetchBalance = async () => {
            try {
                const token = localStorage.getItem('accessToken');
                if (!token) return;

                const response = await fetch('/api/portfolio', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (response.ok) {
                    const data = await response.json();
                    setBalance(data.balance || 0);
                }
            } catch (error: any) {
                console.error('Failed to fetch balance:', error);
            }
        };

        fetchBalance();
        const interval = setInterval(fetchBalance, 30000);
        return () => clearInterval(interval);
    }, []);

    // Initialize limit price when price changes
    useEffect(() => {
        if (currentPrice > 0) {
            setLimitPrice(parseFloat(currentPrice.toFixed(2)));
        }
    }, [currentPrice, selectedCoin]);

    // --- TECHNICAL INDICATORS ---
    const ema50 = useMemo(() => ema().options({ windowSize: 50 }).merge((d: any, c: any) => { d.ema50 = c; }).accessor((d: any) => d.ema50).stroke('#fa5252'), []);
    const ema20 = useMemo(() => ema().options({ windowSize: 20 }).merge((d: any, c: any) => { d.ema20 = c; }).accessor((d: any) => d.ema20).stroke('#82c91e'), []);
    const rsiCalculator = useMemo(() => rsi().options({ windowSize: 14 }).merge((d: any, c: any) => { d.rsi = c; }).accessor((d: any) => d.rsi), []);
    const macdCalculator = useMemo(() => macd().options({ fast: 12, slow: 26, signal: 9 }).merge((d: any, c: any) => { d.macd = c; }).accessor((d: any) => d.macd), []);

    const calculatedData = useMemo(() => {
        if (chartHistory.length === 0) return [];
        let data = [...chartHistory];
        data = ema50(data);
        data = ema20(data);
        data = rsiCalculator(data);
        data = macdCalculator(data);
        return data;
    }, [chartHistory, ema50, ema20, rsiCalculator, macdCalculator]);

    // --- CHART CONFIGURATION ---
    const margin = { left: 30, right: 40, top: 10, bottom: 30 };
    const chartHeight = 500;
    const xScaleProvider = useMemo(() => discontinuousTimeScaleProviderBuilder().inputDateAccessor((d: any) => d.date), []);
    const { data, xScale, xAccessor, displayXAccessor } = xScaleProvider(calculatedData);
    const xExtents = useMemo(() => {
        if (data.length === 0) return [0, 0];
        const last = xAccessor(data[data.length - 1]);
        const startIndex = Math.max(0, data.length - 50);
        const start = xAccessor(data[startIndex]);
        return [start, last];
    }, [data, xAccessor]);

    const priceDisplayFormat = useCallback((value: number) => `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, []);
    const volumeDisplayFormat = useCallback((value: number) => {
        if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
        if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
        return value.toFixed(0);
    }, []);



    // Fetch historical data
    useEffect(() => {
        const fetchHistoricalData = async () => {
            setIsLoading(true);
            setDataFetchError(null);
            
            const symbol = selectedCoin.symbol.toUpperCase() + 'USDT';

            // Normalize timeframe string and map to Binance interval + sensible limits.
            // Accept multiple common variants (e.g. '1D', '1day', '24h') to avoid mismatches.
            const rawTf = String(timeframe || '').trim().toLowerCase();
            const tfKey = rawTf.replace(/\s+/g, '');

            const timeframeMap: Record<string, { interval: string; limit: number }> = {
                '15m': { interval: '15m', limit: 200 },
                '15min': { interval: '15m', limit: 200 },
                '1h': { interval: '1h', limit: 200 },
                '1hour': { interval: '1h', limit: 200 },
                '4h': { interval: '4h', limit: 200 },
                '4hour': { interval: '4h', limit: 200 },
            };

            const { interval, limit } = timeframeMap[tfKey] || { interval: '1h', limit: 200 };

            const url = `/api/binance?symbol=${symbol}&interval=${interval}&limit=${limit}`;
            console.log('Fetching historical data:', url);

            try {
                    // Use safeFetch to handle transient network errors and provide normalized results
                    const res = await (await import('../../lib/safeFetch')).safeFetch(url, undefined, 2, 800);
                    if (!res.ok) {
                        console.error('Historical API error (safeFetch):', res.error, 'status:', res.status);
                        throw new Error(res.error || `API error ${res.status}`);
                    }

                    const klines = res.data;
                // If server returned an error object, klines may not be an array.
                if (!Array.isArray(klines) || klines.length === 0) {
                    // log the raw response for diagnostics
                    console.error('Historical klines not available or empty:', klines);
                    setDataFetchError(typeof klines === 'object' && klines?.details ? `No historical data: ${klines.details}` : 'No historical data available.');
                    setChartHistory([]);
                    setIsLoading(false);
                    return;
                }

                const parsed: KlineData[] = klines.map((k: any) => ({
                    date: new Date(k.date),
                    open: Number(k.open),
                    high: Number(k.high),
                    low: Number(k.low),
                    close: Number(k.close),
                    volume: Number(k.volume)
                }));

                setChartHistory(parsed);
                if (parsed.length > 0) {
                    const latestPrice = parsed[parsed.length - 1].close;
                    setCurrentPrice(latestPrice);
                    setLimitPrice(parseFloat(latestPrice.toFixed(2)));
                }
                
            } catch (error: any) {
                console.error('Error fetching historical data:', error);
                setDataFetchError('Failed to load historical chart data. Please try again.');
                setChartHistory([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchHistoricalData();
    }, [selectedCoin, timeframe]);

    const handlePlaceOrder = useCallback(async () => {
        // Basic validations
        // For BUY orders we require a positive balance; SELL orders depend on asset holdings (handled server-side or in a later client check)
        if (tradeType === 'BUY' && balance <= 0) {
            setOrderStatus({ show: true, success: false, message: 'Insufficient balance to place buy order.' });
            return;
        }

        if (Number.isNaN(amount) || amount <= 0) {
            setOrderStatus({ show: true, success: false, message: 'Enter a valid amount greater than 0.' });
            return;
        }

        if (orderType === 'LIMIT' && (Number.isNaN(limitPrice) || limitPrice <= 0)) {
            setOrderStatus({ show: true, success: false, message: 'Enter a valid limit price greater than 0 for limit orders.' });
            return;
        }

        const token = localStorage.getItem('accessToken');
        if (!token) {
            setOrderStatus({ show: true, success: false, message: 'You must be logged in to trade.' });
            return;
        }

        // Compute execution price and margin
        const execPrice = orderType === 'MARKET' ? currentPrice : limitPrice;
        if (!execPrice || execPrice <= 0) {
            setOrderStatus({ show: true, success: false, message: 'Execution price is invalid.' });
            return;
        }

        const estimatedMargin = (amount * execPrice) / Math.max(1, leverage);
        // Margin requirement applies to BUY orders. For SELL orders, margin comes from existing assets.
        if (tradeType === 'BUY' && estimatedMargin > balance) {
            setOrderStatus({ show: true, success: false, message: 'Insufficient balance to cover margin for this buy order.' });
            return;
        }

        const orderDetails = {
            symbol: selectedCoin.symbol + 'USDT',
            // Backend expects `type` to be 'BUY' or 'SELL'
            type: tradeType,
            // Preserve orderType (MARKET or LIMIT) as a separate field
            orderType: orderType,
            quantity: amount,
            // Backend requires a price even for market orders (execution price)
            price: execPrice,
            leverage: leverage,
        };

        setOrderSubmitting(true);

        try {
            const response = await fetch('/api/orders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(orderDetails),
            });

            let result: OrderResponse | any = null;
            try {
                result = await response.json();
            } catch (e) {
                result = null;
            }

            if (response.ok && result && result.success) {
                setOrderStatus({ show: true, success: true, message: result.message || 'Order placed successfully!' });
                // Optionally, refresh balance or order history here
                try {
                    // Notify other parts of the app (AssetsPage) to refresh portfolio data
                    if (typeof window !== 'undefined' && window.dispatchEvent) {
                        window.dispatchEvent(new CustomEvent('portfolio:updated'));
                    }
                } catch (e) {
                    // silent
                }
            } else {
                const details = result?.error || result?.message || JSON.stringify(result) || `Status ${response.status}`;
                setOrderStatus({ show: true, success: false, message: `Failed to place order: ${details}` });
            }
        } catch (error: any) {
            console.error('Error placing order:', error);
            setOrderStatus({ show: true, success: false, message: `An unexpected error occurred: ${String(error)}` });
        } finally {
            setOrderSubmitting(false);
            setTimeout(() => setOrderStatus(prev => ({ ...prev, show: false })), 5000);
        }
    }, [balance, selectedCoin.symbol, orderType, tradeType, amount, limitPrice, leverage, currentPrice]);

    const isPositive = priceChange >= 0;
    const executionPrice = orderType === 'MARKET' ? currentPrice : limitPrice;
    const notionalValue = amount * executionPrice;
    const marginUsed = notionalValue / leverage;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
                <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
                    <p className="text-xl font-semibold text-indigo-600 dark:text-indigo-400">Loading Market Data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen p-4 space-y-6 bg-gray-50 dark:bg-gray-900 md:p-8">
            {/* Status Messages */}
            {orderStatus.show && (
                <div className={`flex items-center p-4 rounded-lg shadow-lg ${orderStatus.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {orderStatus.success ? <CheckCircle className="w-5 h-5 mr-3" /> : <AlertCircle className="w-5 h-5 mr-3" />}
                    <p className="font-medium">{orderStatus.message}</p>
                </div>
            )}
            {dataFetchError && (
                <div className="flex items-center p-4 text-red-700 bg-red-100 border rounded-lg">
                    <AlertCircle className="w-5 h-5 mr-3" />
                    <p>{dataFetchError}</p>
                </div>
            )}
            {!isConnected && !dataFetchError && (
                 <div className="flex items-center p-4 text-yellow-700 bg-yellow-100 border rounded-lg">
                    <AlertCircle className="w-5 h-5 mr-3" />
                    <p>Connecting to real-time data feed...</p>
                </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-3 xl:grid-cols-4">
                <Card className="lg:col-span-2 xl:col-span-3">
                   <>
                    {/* Header */}
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                        <div className="flex flex-wrap items-center gap-4">
                            {cryptoCoins.map(coin => (
                                <button key={coin.id} onClick={() => setSelectedCoin(coin)} className={`px-3 py-2 text-base md:text-sm font-medium rounded-full ${selectedCoin.id === coin.id ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
                                    {coin.symbol}
                                </button>
                            ))}
                             <div className="flex items-center gap-2">
                                <Clock className="w-5 h-5 text-gray-500" />
                                {['15m', '1h', '4h'].map(tf => (
                                    <button key={tf} onClick={() => setTimeframe(tf)} className={`px-3 py-2 text-base md:text-sm font-medium rounded-full ${timeframe === tf ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
                                        {tf}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-3xl font-extrabold md:text-4xl dark:text-white">${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            <div className={`flex items-center justify-end text-sm font-medium ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                                {isPositive ? <ArrowUp className="w-4 h-4 mr-1" /> : <ArrowDown className="w-4 h-4 mr-1" />}
                                {priceChange.toFixed(2)}% (24h)
                            </div>
                        </div>
                    </div>
                    {/* Chart */}
                     <div className="w-full h-[300px] md:h-[400px] lg:h-[650px]">
                        {chartHistory.length > 0 ? (
                            <ResponsiveChartCanvas
                                margin={margin} data={data} xScale={xScale} xAccessor={xAccessor} displayXAccessor={displayXAccessor}
                                xExtents={xExtents} ratio={1} seriesName={selectedCoin.symbol}
                            >
                                <Chart id={1} yExtents={(d: any) => [d.high, d.low]} height={chartHeight}>
                                    <XAxis axisAt="bottom" orient="bottom" />
                                    <YAxis axisAt="right" orient="right" tickFormat={priceDisplayFormat} />
                                    <MouseCoordinateY at="right" orient="right" displayFormat={priceDisplayFormat} />
                                    <CandlestickSeries fill={(d: KlineData) => d.close >= d.open ? "#0ECB81" : "#F6465D"} stroke={(d: KlineData) => d.close >= d.open ? "#0ECB81" : "#F6465D"} wickStroke={(d: KlineData) => d.close >= d.open ? "#0ECB81" : "#F6465D"} />
                                    <LineSeries yAccessor={ema20.accessor()} strokeStyle={ema20.stroke()} />
                                    <LineSeries yAccessor={ema50.accessor()} strokeStyle={ema50.stroke()} />
                                    <OHLCTooltip origin={[5, 15]} />
                                    <MovingAverageTooltip options={[{ yAccessor: ema20.accessor(), type: "EMA", stroke: ema20.stroke(), windowSize: 20 }, { yAccessor: ema50.accessor(), type: "EMA", stroke: ema50.stroke(), windowSize: 50 }]} />
                                    <CrossHairCursor />
                                    <ZoomButtons />
                                </Chart>
                            </ResponsiveChartCanvas>
                        ) : (
                            <div className="flex items-center justify-center h-full"><p className="text-xl text-gray-400">{dataFetchError || 'No chart data available.'}</p></div>
                        )}
                    </div>
                    </>
                </Card>

                <Card className="lg:col-span-1 bg-white dark:bg-[#0B0E11] border border-gray-200 dark:border-[#2B2F36] rounded-xl shadow-2xl">
                  <div className="flex flex-col h-full">

                    {/* Header Section */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-[#2B2F36]">
                      <h2 className="text-base md:text-sm font-bold text-gray-900 dark:text-[#EAECEF] flex items-center gap-2">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        Trade {selectedCoin.symbol}
                      </h2>
                      <div className="flex gap-2">
                        <span className="text-[10px] font-medium text-gray-500 dark:text-[#848E9C] bg-gray-100 dark:bg-[#2B2F36] px-2 py-0.5 rounded uppercase">Isolated</span>
                        <span className="text-[10px] font-medium text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded uppercase">{leverage}x</span>
                      </div>
                    </div>

                    <div className="p-4 space-y-5">
                      {/* Trade Direction Toggle */}
                      <div className="flex bg-gray-100 dark:bg-[#1E2329] p-1 rounded-lg">
                        <button
                          onClick={() => setTradeType('BUY')}
                          className={`flex-1 py-2 text-xs font-bold rounded transition-all ${
                            tradeType === 'BUY' ? 'bg-[#02C076] text-white shadow-sm' : 'text-gray-500 dark:text-[#848E9C] hover:text-white'
                          }`}
                        >
                          Buy
                        </button>
                        <button
                          onClick={() => setTradeType('SELL')}
                          className={`flex-1 py-2 text-xs font-bold rounded transition-all ${
                            tradeType === 'SELL' ? 'bg-[#CF304A] text-white shadow-sm' : 'text-gray-500 dark:text-[#848E9C] hover:text-white'
                          }`}
                        >
                          Sell
                        </button>
                      </div>

                      {/* Execution Type */}
                      <div className="flex gap-4">
                        {['MARKET', 'LIMIT'].map((type) => (
                          <button
                            key={type}
                            onClick={() => setOrderType(type as 'MARKET' | 'LIMIT')}
                            className={`text-xs font-semibold pb-1 border-b-2 transition-all ${
                              orderType === type ? 'border-blue-500 text-white' : 'border-transparent text-gray-500 dark:text-[#848E9C] hover:text-gray-900 dark:hover:text-[#EAECEF]'
                            }`}
                          >
                            {type}
                          </button>
                        ))}
                      </div>

                      {/* Form Fields */}
                      <div className="space-y-3">
                        {/* Price Input (Only for Limit) */}
                        <AnimatePresence mode="wait">
                          {orderType === 'LIMIT' && (
                            <motion.div
                              initial={{ opacity: 0, y: -5 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -5 }}
                              className="space-y-1.5"
                            >
                              <label className="text-xs md:text-[11px] text-gray-500 dark:text-[#848E9C] font-medium">Price (USDT)</label>
                              <div className="relative group">
                                <input
                                  type="number"
                                  value={limitPrice}
                                  onChange={(e) => setLimitPrice(parseFloat(e.target.value) || 0)}
                                  className="w-full bg-gray-100 dark:bg-[#2B2F36] border border-transparent group-focus-within:border-blue-500 rounded p-3 md:p-2.5 text-base md:text-sm text-gray-900 dark:text-white outline-none transition-all font-mono"
                                />
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Amount Input */}
                        <div className="space-y-1.5">
                          <label className="text-xs md:text-[11px] text-gray-500 dark:text-[#848E9C] font-medium flex justify-between">
                            <span>Amount ({selectedCoin.symbol})</span>
                            <span className="text-blue-500 cursor-pointer hover:underline">Max Use</span>
                          </label>
                          <div className="relative group">
                            <input
                              type="number"
                              value={amount}
                              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                              className="w-full bg-gray-100 dark:bg-[#2B2F36] border border-transparent group-focus-within:border-blue-500 rounded p-3 md:p-2.5 text-base md:text-sm text-gray-900 dark:text-white outline-none transition-all font-mono placeholder:text-gray-400 dark:placeholder:text-[#474D57]"
                              placeholder="0.00"
                            />
                          </div>
                        </div>

                        {/* Percentage Selectors */}
                        <div className="flex justify-between gap-1">
                          {[25, 50, 75, 100].map((pct) => (
                            <button
                              key={pct}
                              className="flex-1 py-2 md:py-1 text-xs md:text-[10px] bg-gray-100 dark:bg-[#2B2F36] text-gray-500 dark:text-[#848E9C] rounded hover:bg-gray-200 dark:hover:bg-[#363A45] hover:text-gray-900 dark:hover:text-white transition-colors border border-gray-200 dark:border-[#363A45]"
                            >
                              {pct}%
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Leverage Slider */}
                      <div className="pt-2 space-y-3">
                        <div className="flex justify-between text-xs md:text-[11px] text-gray-500 dark:text-[#848E9C]">
                          <span>Leverage Range</span>
                          <span className="text-gray-900 dark:text-[#EAECEF] font-bold bg-gray-100 dark:bg-[#2B2F36] px-1.5 rounded">{leverage}x</span>
                        </div>
                        <input
                          type="range" min="1" max="100" step="1"
                          value={leverage}
                          onChange={(e) => setLeverage(parseInt(e.target.value))}
                          className="w-full h-1 bg-gray-200 dark:bg-[#2B2F36] rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                      </div>

                      {/* Info Summary Block */}
                      <div className="bg-gray-100 dark:bg-[#1E2329] rounded-lg p-3 space-y-2 border border-gray-200 dark:border-[#2B2F36]">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-gray-500 dark:text-[#848E9C]">Est. Margin</span>
                          <span className="text-gray-900 dark:text-[#EAECEF] font-mono">${marginUsed.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-gray-500 dark:text-[#848E9C]">Available</span>
                          <span className="font-mono font-semibold text-gray-900 dark:text-white">${balance.toLocaleString()}</span>
                        </div>
                      </div>

                      {/* Main Action */}
                      <motion.button
                        whileTap={{ scale: 0.98 }}
                        disabled={orderSubmitting || amount <= 0 || (orderType === 'LIMIT' && limitPrice <= 0) || marginUsed > balance}
                        className={`w-full py-3.5 rounded font-bold text-sm transition-all relative overflow-hidden ${
                          tradeType === 'BUY'
                            ? 'bg-[#02C076] hover:bg-[#03D885] text-white shadow-lg shadow-green-900/10'
                            : 'bg-[#CF304A] hover:bg-[#E03551] text-white shadow-lg shadow-red-900/10'
                        } disabled:opacity-30 disabled:cursor-not-allowed`}
                      >
                        {orderSubmitting ? 'Executing Order...' : `${tradeType === 'BUY' ? 'Buy Long' : 'Sell Short'} ${selectedCoin.symbol}`}
                      </motion.button>

                      {/* Error Message */}
                      <AnimatePresence>
                        {marginUsed > balance && (
                          <motion.p
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            className="text-center text-xs md:text-[11px] text-yellow-600 dark:text-[#F0B90B] font-medium"
                          >
                            Insufficient balance to open this position.
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </Card>
            </div>
        </div>
    );
};

export default MarketPage;
