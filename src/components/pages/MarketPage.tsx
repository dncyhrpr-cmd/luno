'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { ArrowUp, ArrowDown, Wallet, Clock, TrendingUp, TrendingDown, Layers, Target, AlertCircle, CheckCircle, X, Zap, DollarSign, Timer, TrendingUp as TrendingUpIcon, BarChart3 } from 'lucide-react';
import { useBinanceWebSocket, PriceUpdate } from '../../hooks/useBinanceWebSocket';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthFetch } from '../../lib/authFetch';
import { safeFetch } from '../../lib/safeFetch';
import { useBalance } from '@/hooks/useBalance';
import { useCoin } from '@/context/CoinContext';
import TradeComponent from '../TradeComponent';

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

const ResponsiveChartCanvas = withSize({ style: { width: '100%', height: '100%' } })(ChartCanvas);

// --- TYPES ---
interface CryptoCoin {
    id: string;
    name: string;
    symbol: string;
    image?: string;
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

type Direction = 'UP' | 'DOWN' | null;

// --- CONSTANTS ---
// Removed hardcoded coins

const PERIODS = [
  { time: 30, profit: 20 },
  { time: 60, profit: 30 },
  { time: 120, profit: 40 },
  { time: 180, profit: 50 },
  { time: 240, profit: 60 },
];

// --- COMPONENTS ---
const Card: React.FC<CardProps> = React.memo(({ title, children, className = '' }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className={`relative bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl p-6 md:p-8 rounded-2xl shadow-2xl shadow-black/5 dark:shadow-black/20 border border-gray-200/50 dark:border-gray-700/50 overflow-hidden ${className}`}
        style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(249,250,251,0.95) 100%)',
        }}
    >
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-white/20 via-transparent to-black/5 dark:from-white/5 dark:to-black/10" />

        <div className="relative z-10">
            {title && (
                <motion.h2
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1, duration: 0.3 }}
                    className="mb-6 text-xl font-bold tracking-tight text-gray-900 dark:text-white"
                >
                    {title}
                </motion.h2>
            )}
            {children}
        </div>
    </motion.div>
));

Card.displayName = 'Card';

// --- MAIN COMPONENT ---
const MarketPage: React.FC = () => {
    const { selectedCoin, setSelectedCoin } = useCoin();
    const authFetch = useAuthFetch();
    const { balance, isLoading: balanceLoading, isAuthenticated, refreshBalance } = useBalance();

    // SEO: Update page title and meta description
    useEffect(() => {
        document.title = selectedCoin ? `${selectedCoin.symbol}/USDT - Luno Crypto Trading` : 'Market - Luno Crypto Trading Platform';
        const metaDescription = document.querySelector('meta[name="description"]');
        if (metaDescription) {
            metaDescription.setAttribute('content', selectedCoin
                ? `Trade ${selectedCoin.name} (${selectedCoin.symbol}) with real-time charts and binary options on Luno.`
                : 'Access real-time cryptocurrency market data, live charts, and trading tools on Luno.'
            );
        }
    }, [selectedCoin]);
    const [chartHistory, setChartHistory] = useState<KlineData[]>([]);
    const coinSymbols = selectedCoin ? [selectedCoin.symbol] : [];
    const { prices, isConnected } = useBinanceWebSocket(coinSymbols);
    const [currentPrice, setCurrentPrice] = useState<number>(0);
    const [priceChange, setPriceChange] = useState<number>(0);
    const [currentVolume, setCurrentVolume] = useState<number>(0);
    const [timeframe, setTimeframe] = useState<string>('60s');
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [dataFetchError, setDataFetchError] = useState<string | null>(null);
    const [isSyntheticData, setIsSyntheticData] = useState<boolean>(false);
    const [allCoins, setAllCoins] = useState<CryptoCoin[]>([]);
    const [searchTerm, setSearchTerm] = useState<string>('');

    // Binary options states
    const [direction, setDirection] = useState<Direction>(null);
    const [orderPeriod, setOrderPeriod] = useState<number | null>(null);
    const [profitPercent, setProfitPercent] = useState(0);
    const [binaryAmount, setBinaryAmount] = useState(0);
    const [binarySubmitting, setBinarySubmitting] = useState(false);
    const [binaryStatus, setBinaryStatus] = useState<{ ok: boolean; msg: string } | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const [chartHeight, setChartHeight] = useState(650); // default to lg
    const [margin, setMargin] = useState({ left: 30, right: 40, top: 10, bottom: 30 });

    const filteredCoins = useMemo(() => allCoins.filter(coin =>
        coin.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        coin.symbol.toLowerCase().includes(searchTerm.toLowerCase())
    ), [allCoins, searchTerm]);

    // Update chart with real-time data
    useEffect(() => {
        if (!selectedCoin) return;
        const priceUpdate = prices.get(selectedCoin.symbol);
        if (priceUpdate && chartHistory.length > 0) {
            setCurrentPrice(priceUpdate.price);
            setPriceChange(priceUpdate.change);
            setCurrentVolume(priceUpdate.volume);

            setChartHistory(prevHistory => {
                let currentHistory = prevHistory;

                // If data is synthetic and misaligned, align it to the real price
                if (isSyntheticData) {
                    const lastCandle = currentHistory[currentHistory.length - 1];
                    // Avoid division by zero
                    if (lastCandle.close > 0) {
                        const ratio = priceUpdate.price / lastCandle.close;
                        // If difference is > 0.5%, align the entire history
                        if (Math.abs(1 - ratio) > 0.005) {
                            console.log(`[MarketPage] Aligning synthetic data to real price ${priceUpdate.price} (ratio: ${ratio})`);
                            currentHistory = currentHistory.map(c => ({
                                ...c,
                                open: c.open * ratio,
                                high: c.high * ratio,
                                low: c.low * ratio,
                                close: c.close * ratio
                            }));
                        }
                    }
                }

                const newHistory = [...currentHistory];
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

            if (isSyntheticData) {
                setIsSyntheticData(false);
            }
        }
    }, [prices, selectedCoin, chartHistory.length, isSyntheticData]);


    // Balance is now fetched by useBalance hook with real-time updates

    // Fetch all coins
    useEffect(() => {
        const fetchCoins = async () => {
            try {
                const response = await fetch('/api/coins');
                if (response.ok) {
                    const data = await response.json();
                    setAllCoins(data.coins);
                    // Set default selected coin if none is selected
                    if (!selectedCoin && data.coins.length > 0) {
                        setSelectedCoin(data.coins[0]);
                    }
                }
            } catch (error) {
                console.error('Failed to fetch coins:', error);
            }
        };
        fetchCoins();
    }, [selectedCoin]);

    // Responsive chart sizing
    useEffect(() => {
        const updateSizes = () => {
            if (typeof window !== 'undefined') {
                if (window.innerWidth < 768) {
                    setChartHeight(300);
                    setMargin({ left: 20, right: 20, top: 10, bottom: 20 });
                } else if (window.innerWidth < 1024) {
                    setChartHeight(400);
                    setMargin({ left: 25, right: 30, top: 10, bottom: 25 });
                } else {
                    setChartHeight(650);
                    setMargin({ left: 30, right: 40, top: 10, bottom: 30 });
                }
            }
        };

        updateSizes();
        window.addEventListener('resize', updateSizes);
        return () => window.removeEventListener('resize', updateSizes);
    }, []);



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
        if (!selectedCoin) return;
        const fetchHistoricalData = async () => {
            setIsLoading(true);
            setDataFetchError(null);

            const symbol = selectedCoin.symbol.toUpperCase() + 'USDT';

            // Normalize timeframe string and map to Binance interval + sensible limits.
            // Accept multiple common variants (e.g. '1D', '1day', '24h') to avoid mismatches.
            const rawTf = String(timeframe || '').trim().toLowerCase();
            const tfKey = rawTf.replace(/\s+/g, '');

            const timeframeMap: Record<string, { interval: string; limit: number }> = {
                '30s': { interval: '1m', limit: 200 },
                '60s': { interval: '1m', limit: 200 },
                '120s': { interval: '1m', limit: 200 },
                '180s': { interval: '1m', limit: 200 },
                '240s': { interval: '1m', limit: 200 },
            };

            const { interval, limit } = timeframeMap[tfKey] || { interval: '1h', limit: 200 };

            const url = `/api/binance?symbol=${symbol}&interval=${interval}&limit=${limit}`;
            console.log('Fetching historical data:', url);

            try {
                    // Use safeFetch to handle transient network errors and provide normalized results
                    const res = await safeFetch(url, undefined, 2, 800);
                    if (!res.ok) {
                        console.error('Historical API error (safeFetch):', res.error, 'status:', res.status);
                        throw new Error(res.error || `API error ${res.status}`);
                    }

                    // Check if data is synthetic
                    const isSynthetic = res.headers?.get('X-Luno-Data-Source') === 'synthetic';
                    setIsSyntheticData(isSynthetic);
                    if (isSynthetic) {
                        console.log('Using synthetic data for chart');
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

                const parsed: KlineData[] = klines.map((k: any) => {
                    const dateValue = typeof k.date === 'number' ? k.date : parseInt(k.date);
                    const parsed = {
                        date: new Date(dateValue),
                        open: Number(k.open),
                        high: Number(k.high),
                        low: Number(k.low),
                        close: Number(k.close),
                        volume: Number(k.volume)
                    };
                    
                    if (isNaN(parsed.date.getTime())) {
                        console.warn('Invalid date in kline data:', k);
                        return null; // Filter out invalid dates
                    }

                    if (isNaN(parsed.open) || isNaN(parsed.high) || isNaN(parsed.low) || isNaN(parsed.close)) {
                        console.warn('Invalid kline data:', k, 'parsed:', parsed);
                    }
                    
                    return parsed;
                }).filter((k): k is KlineData => k !== null);

                if (parsed.length === 0) {
                    setDataFetchError('No valid kline data received');
                    setChartHistory([]);
                    setIsLoading(false);
                    return;
                }

                console.log(`Parsed ${parsed.length} klines, first:`, parsed[0], 'last:', parsed[parsed.length - 1]);
                setChartHistory(parsed);
                if (parsed.length > 0) {
                    const latestPrice = parsed[parsed.length - 1].close;
                    if (!isNaN(latestPrice)) {
                        setCurrentPrice(latestPrice);
                    }
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





    // Binary order submission
    async function submitOrderBinary(direction: Direction, period: number = 30, amount: number = 10) {
        if (!selectedCoin || !isAuthenticated || amount > balance) return;

        setBinarySubmitting(true);
        setBinaryStatus(null);

        const profitPercent = PERIODS.find(p => p.time === period)?.profit || 20;

        const res = await authFetch('/api/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                orderType: 'binary',
                symbol: `${selectedCoin.symbol}USDT`,
                direction,
                period,
                binaryAmount: amount,
                profitPercent,
                price: currentPrice,
            }),
        });

        if (res.ok) {
            setBinaryStatus({ ok: true, msg: 'Order placed successfully' });
            // Refresh balance immediately after order placement
            refreshBalance();
        } else {
            setBinaryStatus({ ok: false, msg: res.error || 'Order failed' });
        }

        setBinarySubmitting(false);
    }



    // Binary calculations
    const estimatedProfit = useMemo(() => (binaryAmount > 0 ? (binaryAmount * profitPercent) / 100 : 0), [binaryAmount, profitPercent]);
    const canSubmitBinary = direction !== null && orderPeriod !== null && binaryAmount > 0 && binaryAmount <= balance;

    const isPositive = priceChange >= 0;

    if (!selectedCoin) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
                <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
                    <p className="text-xl font-semibold text-indigo-600 dark:text-indigo-400">Loading Coins...</p>
                </div>
            </div>
        );
    }

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
        <div className="min-h-screen p-4 space-y-8 md:p-8 bg-gray-50 dark:bg-gray-900">

            <div className="relative z-10 space-y-6">
                {/* Status Messages */}
                <AnimatePresence>
                    {dataFetchError && (
                        <motion.div
                            initial={{ opacity: 0, y: -20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -20, scale: 0.95 }}
                            className="flex items-center p-4 text-red-400 border shadow-xl bg-red-500/10 backdrop-blur-xl border-red-500/20 rounded-2xl"
                        >
                            <AlertCircle className="w-5 h-5 mr-3 text-red-400" />
                            <p className="font-medium">{dataFetchError}</p>
                        </motion.div>
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {!isConnected && !dataFetchError && (
                        <motion.div
                            initial={{ opacity: 0, y: -20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -20, scale: 0.95 }}
                            className="flex items-center p-4 text-yellow-400 border shadow-xl bg-yellow-500/10 backdrop-blur-xl border-yellow-500/20 rounded-2xl"
                        >
                            <div className="w-2 h-2 mr-3 bg-yellow-400 rounded-full animate-pulse" />
                            <p className="font-medium">Connecting to real-time data feed...</p>
                        </motion.div>
                    )}
                </AnimatePresence>

            <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-3 xl:grid-cols-4">
                <Card className="lg:col-span-2 xl:col-span-3">
                   <>
                    {/* Header */}
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                        <div className="flex flex-wrap items-center gap-4">
                            <input
                                type="text"
                                placeholder="Search coins..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
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
                                xExtents={xExtents} ratio={1} seriesName={selectedCoin!.symbol}
                            >
                                <Chart id={1} yExtents={(d: any) => [d.high, d.low]} height={chartHeight}>
                                    <XAxis axisAt="bottom" orient="bottom" />
                                    <YAxis axisAt="right" orient="right" tickFormat={priceDisplayFormat} />
                                    <MouseCoordinateY at="right" orient="right" displayFormat={priceDisplayFormat} />
                                    <CandlestickSeries />
                                    <LineSeries yAccessor={ema20.accessor()} strokeStyle={ema20.stroke()} />
                                    <LineSeries yAccessor={ema50.accessor()} strokeStyle={ema50.stroke()} />
                                    <OHLCTooltip origin={[5, 15]} />
                                    <MovingAverageTooltip options={[{ yAccessor: ema20.accessor(), type: "EMA", stroke: ema20.stroke(), windowSize: 20 }, { yAccessor: ema50.accessor(), type: "EMA", stroke: ema50.stroke(), windowSize: 50 }]} />
                                    <CrossHairCursor />
                                    <ZoomButtons />
                                </Chart>
                            </ResponsiveChartCanvas>
                        ) : (
                            <div className="flex items-center justify-center h-full"><p className="text-xl text-gray-800">{dataFetchError || 'No chart data available.'}</p></div>
                        )}
                    </div>
                    </>
                </Card>

                <Card className="lg:col-span-1">
                  <div className="flex flex-col h-full">

                    {/* Header Section */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3, duration: 0.4 }}
                        className="flex items-center justify-between p-6 border-b border-white/10"
                    >
                      <motion.h2
                          className="flex items-center gap-3 text-xl font-bold text-gray-900 dark:text-white"
                          whileHover={{ scale: 1.02 }}
                      >
                        <motion.div
                            animate={{ scale: [1, 1.1, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="w-3 h-3 bg-green-400 rounded-full shadow-lg shadow-green-400/50"
                        />

                      </motion.h2>


                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4, duration: 0.4 }}
                        className="p-6 space-y-6"
                    >
                      {/* Coin Selection */}
                      <motion.div
                          className="space-y-3"
                          whileHover={{ scale: 1.01 }}
                      >
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-white/80">
                          <Target className="w-4 h-4 text-blue-400" />
                          Select Asset
                        </label>
                        <motion.select
                            value={selectedCoin.id}
                            onChange={(e) => {
                                const coin = allCoins.find(c => c.id === e.target.value);
                                if (coin) setSelectedCoin(coin);
                            }}
                            className="w-full px-4 py-3 text-gray-900 placeholder-gray-500 transition-all duration-300 border border-gray-300 dark:text-white bg-white/90 dark:bg-gray-800 dark:border-gray-600 rounded-xl dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                            whileFocus={{ scale: 1.02 }}
                        >
                            {filteredCoins.map(coin => (
                                <option key={coin.id} value={coin.id} className="text-white bg-gray-800">
                                    {coin.name} ({coin.symbol})
                                </option>
                            ))}
                        </motion.select>
                      </motion.div>

                      {/* Current Price Display */}
                      <motion.div
                          className="p-6 text-center border bg-gradient-to-r from-white/5 to-white/10 backdrop-blur-sm rounded-2xl border-white/10"
                          initial={{ scale: 0.9, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ delay: 0.5, duration: 0.3 }}
                      >
                        <motion.h1
                            className="mb-2 text-lg font-bold text-gray-700 dark:text-white/80"
                            animate={{ opacity: [0.7, 1, 0.7] }}
                            transition={{ duration: 2, repeat: Infinity }}
                        >
                            {selectedCoin?.symbol}/USDT
                        </motion.h1>
                        <motion.p
                            className="text-4xl font-black tracking-tight text-gray-900 dark:text-white"
                            animate={{ scale: [1, 1.02, 1] }}
                            transition={{ duration: 3, repeat: Infinity }}
                        >
                            ${currentPrice.toFixed(2)}
                        </motion.p>
                        <motion.div
                            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium mt-3 ${
                                isPositive
                                    ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                                    : 'bg-red-500/20 text-red-300 border border-red-500/30'
                            }`}
                            initial={{ y: 10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.6 }}
                        >
                            {isPositive ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                            {Math.abs(priceChange).toFixed(2)}%
                        </motion.div>
                      </motion.div>

                      {/* Binary Options Buttons */}
                      <motion.div
                          className="grid grid-cols-2 gap-3"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.6, duration: 0.4 }}
                      >
                        <motion.button
                            onClick={() => { setDirection('UP'); setIsModalOpen(true); }}
                            className={`relative overflow-hidden px-6 py-4 rounded-2xl font-bold text-white transition-all duration-300 ${
                                direction === 'UP'
                                    ? 'bg-gradient-to-r from-green-500 to-emerald-600 shadow-lg shadow-green-500/30'
                                    : 'bg-gradient-to-r from-gray-200 to-gray-100 hover:from-green-500/20 hover:to-emerald-600/20 border border-gray-300 dark:from-white/10 dark:to-white/5 dark:border-white/20'
                            }`}
                            whileHover={{
                                scale: 1.05,
                                boxShadow: direction === 'UP'
                                    ? '0 10px 30px rgba(34, 197, 94, 0.3)'
                                    : '0 10px 30px rgba(255, 255, 255, 0.1)'
                            }}
                            whileTap={{ scale: 0.98 }}
                        >
                            <motion.div
                                className="flex flex-col items-center gap-2"
                                animate={direction === 'UP' ? { y: [0, -2, 0] } : {}}
                                transition={{ duration: 1, repeat: direction === 'UP' ? Infinity : 0 }}
                            >
                                <ArrowUp className="w-6 h-6" />
                                <span className="text-sm font-bold">Buy Up</span>
                            </motion.div>
                            {direction === 'UP' && (
                                <motion.div
                                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                                    animate={{ x: ['-100%', '100%'] }}
                                    transition={{ duration: 1.5, repeat: Infinity }}
                                />
                            )}
                        </motion.button>

                        <motion.button
                            onClick={() => { setDirection('DOWN'); setIsModalOpen(true); }}
                            className={`relative overflow-hidden px-6 py-4 rounded-2xl font-bold text-white transition-all duration-300 ${
                                direction === 'DOWN'
                                    ? 'bg-gradient-to-r from-red-500 to-rose-600 shadow-lg shadow-red-500/30'
                                    : 'bg-gradient-to-r from-gray-200 to-gray-100 dark:from-white/10 dark:to-white/5 hover:from-red-500/20 hover:to-rose-600/20 border border-gray-300 dark:border-white/20'
                            }`}
                            whileHover={{
                                scale: 1.05,
                                boxShadow: direction === 'DOWN'
                                    ? '0 10px 30px rgba(239, 68, 68, 0.3)'
                                    : '0 10px 30px rgba(255, 255, 255, 0.1)'
                            }}
                            whileTap={{ scale: 0.98 }}
                        >
                            <motion.div
                                className="flex flex-col items-center gap-2"
                                animate={direction === 'DOWN' ? { y: [0, 2, 0] } : {}}
                                transition={{ duration: 1, repeat: direction === 'DOWN' ? Infinity : 0 }}
                            >
                                <ArrowDown className="w-6 h-6" />
                                <span className="text-sm font-bold">Buy Down</span>
                            </motion.div>
                            {direction === 'DOWN' && (
                                <motion.div
                                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                                    animate={{ x: ['-100%', '100%'] }}
                                    transition={{ duration: 1.5, repeat: Infinity }}
                                />
                            )}
                        </motion.button>
                      </motion.div>

            <AnimatePresence>
                {isModalOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        className="mt-4 space-y-4"
                    >
                        <div className="flex justify-end">
                            <button
                                onClick={() => { setIsModalOpen(false); setDirection(null); setOrderPeriod(null); setBinaryAmount(0); setBinaryStatus(null); }}
                                className="p-1 text-gray-400 hover:text-white"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="bg-[#1E2329] p-3 rounded">
                            <div className="text-sm text-gray-400">Available Balance</div>
                            <div className="text-lg font-bold">${balance.toFixed(2)}</div>
                        </div>

                        <div>
                            <div className="flex items-center gap-2 mb-2 text-xs text-gray-400">
                                <Clock size={14} /> Select order period
                            </div>
                            <div className="grid grid-cols-5 gap-2">
                                {PERIODS.map(p => (
                                    <button
                                        key={p.time}
                                        onClick={() => {
                                            setOrderPeriod(p.time);
                                            setProfitPercent(p.profit);
                                        }}
                                        className={`py-2 text-xs rounded ${
                                            orderPeriod === p.time
                                                ? 'bg-blue-600'
                                                : 'bg-[#2B2F36] text-gray-400'
                                        }`}
                                    >
                                        {p.time}s
                                        <div className="text-green-400">{p.profit}%</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="text-xs text-gray-400">Order Amount (USDT)</label>
                            <input
                                type="number"
                                value={binaryAmount}
                                onChange={e => setBinaryAmount(+e.target.value)}
                                placeholder="Enter amount, e.g. 10 (min 1 USDT)"
                                min="1"
                                max={balance.toString()}
                                step="0.01"
                                className="w-full mt-1 bg-[#2B2F36] p-3 rounded outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        <div className="flex gap-1">
                            {[25, 50, 75, 100].map(p => (
                                <button
                                    key={p}
                                    onClick={() => setBinaryAmount((balance * p) / 100)}
                                    className="flex-1 bg-[#2B2F36] py-2 rounded text-xs"
                                >
                                    {p}%
                                </button>
                            ))}
                        </div>

                        <div className="bg-[#1E2329] p-3 rounded text-xs space-y-1">
                            <div className="flex justify-between">
                                <span>Available</span>
                                <span className={binaryAmount > balance ? 'text-red-500' : ''}>${balance.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Period</span>
                                <span>{orderPeriod ?? '--'}s</span>
                            </div>
                            <div className="flex justify-between text-green-400">
                                <span>Profit</span>
                                <span>${estimatedProfit.toFixed(2)}</span>
                            </div>
                            {!isAuthenticated && (
                                <div className="pt-2 mt-2 text-center border-t border-gray-600">
                                    <p className="text-xs text-yellow-400">Please log in to see your balance and trade</p>
                                </div>
                            )}
                            {binaryAmount > balance && (
                                <div className="pt-2 mt-2 text-center border-t border-gray-600">
                                    <p className="text-xs text-red-500">Insufficient balance for this amount</p>
                                </div>
                            )}
                        </div>

                        <button
                            disabled={!canSubmitBinary || binarySubmitting}
                            onClick={() => submitOrderBinary(direction, orderPeriod || 30, binaryAmount)}
                            className={`w-full py-3 rounded font-bold ${
                                direction === 'UP' ? 'bg-green-500' : 'bg-red-500'
                            } disabled:opacity-30`}
                        >
                            {binarySubmitting ? 'Processing...' : 'Submit Order'}
                        </button>

                        <AnimatePresence>
                            {binaryStatus && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className={`p-3 rounded text-center text-sm ${
                                        binaryStatus.ok ? 'bg-green-500' : 'bg-red-500'
                                    }`}
                                >
                                    {binaryStatus.msg}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                )}
                </AnimatePresence>
                    </motion.div>
                   </div>
                 </Card>
             </div>
         </div>
         </div>

            )}
export default MarketPage;
