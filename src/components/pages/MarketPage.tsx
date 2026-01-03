'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { ArrowUp, ArrowDown, Wallet, Clock, TrendingUp, TrendingDown, Layers, Target, AlertCircle, CheckCircle, X } from 'lucide-react';
import { useBinanceWebSocket, PriceUpdate } from '../../hooks/useBinanceWebSocket';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthFetch } from '../../lib/authFetch';
import { safeFetch } from '../../lib/safeFetch';
import { useBalance } from '@/hooks/useBalance';
import { useCoin } from '@/context/CoinContext';

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
    <div className={`bg-white dark:bg-gray-800 p-4 md:p-6 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 transition-colors duration-300 ${className}`}>
        {title && <h2 className="mb-4 text-lg font-semibold text-gray-800 md:text-xl dark:text-gray-100">{title}</h2>}
        {children}
    </div>
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
    const [showConfirm, setShowConfirm] = useState(false);
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
    async function submitOrderBinary() {
        if (!canSubmitBinary || !selectedCoin) return;

        setBinarySubmitting(true);
        setBinaryStatus(null);

        const res = await authFetch('/api/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                type: direction === 'UP' ? 'buy' : 'sell',
                symbol: `${selectedCoin.symbol}USDT`,
                quantity: binaryAmount,
                price: currentPrice,
                orderType: 'binary',
                leverage: 1, // or whatever
                // additional binary fields
                direction,
                period: orderPeriod,
                profitPercent,
                binaryAmount,
            }),
        });

        if (res.ok) {
            setBinaryStatus({ ok: true, msg: 'Order placed successfully' });
            setBinaryAmount(0);
            setDirection(null);
            setOrderPeriod(null);
            // Refresh balance immediately after order placement
            refreshBalance();
            setIsModalOpen(false);
            setShowConfirm(false);
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
        <div className="min-h-screen p-4 space-y-6 bg-gray-50 dark:bg-gray-900 md:p-8">
            {/* Status Messages */}

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
                        Trade {selectedCoin!.symbol}
                      </h2>

                    </div>

                    <div className="p-4 space-y-5">
                      {/* Coin Selection */}
                      <div className="space-y-2">
                        <label className="text-xs md:text-[11px] text-gray-500 dark:text-[#848E9C] font-medium">Select Asset</label>
                        <select
                            value={selectedCoin.id}
                            onChange={(e) => {
                                const coin = allCoins.find(c => c.id === e.target.value);
                                if (coin) setSelectedCoin(coin);
                            }}
                            className="w-full bg-gray-100 dark:bg-[#2B2F36] border border-transparent focus:border-blue-500 rounded p-3 md:p-2.5 text-base md:text-sm text-gray-900 dark:text-white outline-none transition-all"
                        >
                            {filteredCoins.map(coin => (
                                <option key={coin.id} value={coin.id}>{coin.name} ({coin.symbol})</option>
                            ))}
                        </select>
                      </div>

                      <div className="text-center">
                <h1 className="text-lg font-bold">{selectedCoin?.symbol}/USDT</h1>
                <p className="text-3xl font-extrabold">${currentPrice.toFixed(2)}</p>
            </div>

            <div className="flex gap-2">
                <button
                    onClick={() => { setDirection('UP'); setIsModalOpen(true); setShowConfirm(false); }}
                    className="flex-1 py-4 rounded font-bold bg-[#2B2F36] text-gray-400 hover:bg-green-500 hover:text-white transition-colors"
                >
                    Buy Up
                </button>
                <button
                    onClick={() => { setDirection('DOWN'); setIsModalOpen(true); setShowConfirm(false); }}
                    className="flex-1 py-4 rounded font-bold bg-[#2B2F36] text-gray-400 hover:bg-red-500 hover:text-white transition-colors"
                >
                    Buy Down
                </button>
            </div>

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
                                onClick={() => { setIsModalOpen(false); setDirection(null); setOrderPeriod(null); setBinaryAmount(0); setShowConfirm(false); setBinaryStatus(null); }}
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
                            onClick={() => setShowConfirm(true)}
                            className={`w-full py-3 rounded font-bold ${
                                direction === 'UP' ? 'bg-green-500' : 'bg-red-500'
                            } disabled:opacity-30`}
                        >
                            {binarySubmitting ? 'Processing...' : 'Submit Order'}
                        </button>

                        <AnimatePresence>
                            {showConfirm && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    className="p-3 bg-yellow-100 rounded dark:bg-yellow-800"
                                >
                                    <p className="text-sm">Confirm order: {direction} ${binaryAmount} USDT for {orderPeriod}s period? Expected profit: ${estimatedProfit.toFixed(2)}</p>
                                    <div className="flex gap-2 mt-2">
                                        <button onClick={async () => { await submitOrderBinary(); setShowConfirm(false); }} className="flex-1 py-2 text-sm font-bold bg-green-500 rounded">Confirm</button>
                                        <button onClick={() => setShowConfirm(false)} className="flex-1 py-2 text-sm font-bold bg-gray-500 rounded">Cancel</button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

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

                    </div>
                  </div>
                </Card>
            </div>
        </div>
    );
};

export default MarketPage;
