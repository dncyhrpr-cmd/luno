'use client';

import React, { useMemo, useCallback, useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
    ArrowUp, ArrowDown, DollarSign, TrendingUp, TrendingDown, Activity, Users,
    Globe, Search, Sun, Moon, Filter, ChevronDown, ChevronUp, type LucideIcon
} from 'lucide-react';
import { CoinIcon } from '../CoinIcons';
import { useAuth } from '../../context/AuthContext';
import { useBinanceWebSocket } from '../../hooks/useBinanceWebSocket';
import { safeFetch } from '../../lib/safeFetch';

// --- UTILITY HOOK --- 
function usePrevious<T>(value: T) {
    const ref = useRef<T>();
    useEffect(() => {
        ref.current = value;
    });
    return ref.current;
}

// --- REAL CRYPTO DATA TYPES ---
interface CryptoCoin {
    id: string;
    name: string;
    symbol: string;
    price: number;
    change: number;
    volume: number;
}

// --- TYPES ---
interface CardProps {
    title?: string;
    children: React.ReactNode;
    className?: string;
    icon?: LucideIcon;
}

interface SparklineProps {
    history: number[];
}

interface CoinRowProps {
    coin: CryptoCoin;
    sparklineHistory?: number[];
    isUpdating?: boolean;
}

interface TimeFrameSelectorProps {
    currentTimeFrame: string;
    setTimeFrame: (frame: string) => void;
}

interface SortButtonProps {
    column: string;
    label: string;
    currentSort: { key: string; order: string };
    handleSort: (key: string) => void;
}

// --- CRYPTO COIN MAPPING ---
const coinMapping: Record<string, { id: string; name: string }> = {
    'BTC': { id: 'btc', name: 'Bitcoin' },
    'ETH': { id: 'eth', name: 'Ethereum' },
    'SOL': { id: 'sol', name: 'Solana' },
    'BNB': { id: 'bnb', name: 'Binance Coin' },
    'ADA': { id: 'ada', name: 'Cardano' },
    'DOGE': { id: 'doge', name: 'Dogecoin' },
    'XRP': { id: 'xrp', name: 'Ripple' },
    'LTC': { id: 'ltc', name: 'Litecoin' },
    'MATIC': { id: 'matic', name: 'Polygon' },
    'LINK': { id: 'link', name: 'Chainlink' }
};

// --- COMPONENTS ---

const Card: React.FC<CardProps> = React.memo(({ title, children, className = '', icon: Icon }) => (
    <div className={`bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 transition-colors duration-300 ${className}`}>
        {title && (
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">{title}</h2>
                {Icon && <Icon className="w-6 h-6 text-indigo-500 dark:text-indigo-400" />}
            </div>
        )}
        {children}
    </div>
));

Card.displayName = 'Card';

const Sparkline: React.FC<SparklineProps> = React.memo(({ history }) => {
    const max = Math.max(...history);
    const min = Math.min(...history);
    const range = max - min;
    const width = 100;
    const height = 40;

    const points = history.map((value: number, index: number) => {
        const x = (index / (history.length - 1)) * width;
        const normalized = (value - min) / (range || 1);
        const y = Math.max(0, Math.min(height, height - normalized * height));
        return `${x},${y}`;
    }).join(' ');

    const isPositiveTrend = history[history.length - 1] > history[0];
    const color = isPositiveTrend ? '#10B981' : '#EF4444';

    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-10 -my-2">
            <polyline
                fill="none"
                stroke={color}
                strokeWidth="2"
                points={points}
            />
        </svg>
    );
});

Sparkline.displayName = 'Sparkline';

const CoinRow: React.FC<CoinRowProps> = React.memo(({ coin, sparklineHistory = [], isUpdating = false }) => {
    const isPositive = coin.change >= 0;
    const ChangeIcon = isPositive ? ArrowUp : ArrowDown;
    const history = sparklineHistory.length > 0 ? sparklineHistory : [coin.price * 0.98, coin.price * 0.99, coin.price, coin.price * 1.01, coin.price * 1.02, coin.price * 1.01, coin.price];

    return (
        <div className={`grid items-center grid-cols-1 p-4 md:grid-cols-12 md:p-4 py-4 transition-all duration-300 border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/50 last:border-b-0 ${
            isUpdating ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''
        }`}>
            <div className="flex items-center md:col-span-3">
                <div className="mr-2 text-sm text-gray-500 md:hidden dark:text-gray-400">Asset:</div>
                <div className="flex items-center space-x-4">
                    <CoinIcon symbol={coin.symbol} size={40} className="shrink-0" />
                    <div>
                        <p className="text-lg font-semibold text-gray-900 dark:text-white">{coin.symbol}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{coin.name}</p>
                    </div>
                </div>
            </div>

            <div className="mt-2 md:mt-0 md:col-span-3">
                <div className="text-sm text-gray-500 md:hidden dark:text-gray-400">Price:</div>
                <p className="text-lg font-medium text-gray-900 dark:text-white">${coin.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>

            <div className="mt-2 md:mt-0 md:col-span-2">
                <div className="text-sm text-gray-500 md:hidden dark:text-gray-400">24h Change:</div>
                <div className={`inline-flex items-center text-sm font-semibold p-1 px-2 rounded-full ${isPositive ? 'bg-green-100 text-green-700 dark:bg-green-700 dark:text-green-100' : 'bg-red-100 text-red-700 dark:bg-red-700 dark:text-red-100'}`}>
                    <ChangeIcon className="w-3 h-3 mr-1" />
                    {Math.abs(coin.change).toFixed(2)}%
                </div>
            </div>

            <div className="hidden text-right text-gray-600 md:block md:col-span-2 dark:text-gray-300">
                ${coin.volume.toFixed(1)}B
            </div>

            <div className="hidden lg:block md:col-span-2">
                <Sparkline history={history} />
            </div>
        </div>
    );
});

CoinRow.displayName = 'CoinRow';

const TimeFrameSelector: React.FC<TimeFrameSelectorProps> = React.memo(({ currentTimeFrame, setTimeFrame }) => {
    const timeframes = ['24h', '7d', '30d', 'All'];
    return (
        <div className="flex p-1 space-x-2 bg-gray-100 rounded-full dark:bg-gray-700">
            {timeframes.map(frame => (
                <button
                    key={frame}
                    onClick={() => setTimeFrame(frame)}
                    className={`px-3 py-1 text-sm font-medium rounded-full transition-colors duration-200 ${
                        currentTimeFrame === frame
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                >
                    {frame}
                </button>
            ))}
        </div>
    );
});

TimeFrameSelector.displayName = 'TimeFrameSelector';

const SortButton: React.FC<SortButtonProps> = React.memo(({ column, label, currentSort, handleSort }) => {
    const isCurrent = currentSort.key === column;
    const Icon = isCurrent
        ? (currentSort.order === 'asc' ? ChevronUp : ChevronDown)
        : Filter;

    return (
        <button
            onClick={() => handleSort(column)}
            className="flex items-center space-x-1 text-xs font-semibold tracking-wider text-gray-500 uppercase transition-colors dark:text-gray-400 hover:text-indigo-500"
        >
            <span>{label}</span>
            <Icon className={`w-3 h-3 ${isCurrent ? 'text-indigo-500' : 'text-gray-400'}`} />
        </button>
    );
});

SortButton.displayName = 'SortButton';


// --- MAIN APP COMPONENT ---
export default function App() {
    const router = useRouter();
    const { user, isAuthenticated } = useAuth();
    const [coins, setCoins] = useState<CryptoCoin[]>([
        { id: 'btc', name: 'Bitcoin', symbol: 'BTC', price: 95000, change: 2.5, volume: 1500000 },
        { id: 'eth', name: 'Ethereum', symbol: 'ETH', price: 3200, change: -1.2, volume: 800000 },
        { id: 'sol', name: 'Solana', symbol: 'SOL', price: 180, change: 5.8, volume: 200000 },
        { id: 'bnb', name: 'Binance Coin', symbol: 'BNB', price: 650, change: 1.1, volume: 100000 },
        { id: 'ada', name: 'Cardano', symbol: 'ADA', price: 0.85, change: -0.5, volume: 50000 },
        { id: 'doge', name: 'Dogecoin', symbol: 'DOGE', price: 0.32, change: 3.2, volume: 30000 },
        { id: 'xrp', name: 'Ripple', symbol: 'XRP', price: 1.15, change: 0.8, volume: 40000 },
        { id: 'ltc', name: 'Litecoin', symbol: 'LTC', price: 125, change: -2.1, volume: 20000 },
        { id: 'matic', name: 'Polygon', symbol: 'MATIC', price: 1.85, change: 4.5, volume: 25000 },
        { id: 'link', name: 'Chainlink', symbol: 'LINK', price: 18.5, change: 1.8, volume: 15000 },
    ]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [timeFrame, setTimeFrame] = useState('24h');
    const [darkMode, setDarkMode] = useState(false);
    const [sort, setSort] = useState({ key: 'price', order: 'desc' });
    const [portfolio, setPortfolio] = useState<any>(null);
    const [portfolioLoading, setPortfolioLoading] = useState(true);
    const [updatingSymbols, setUpdatingSymbols] = useState<Set<string>>(new Set());

    const symbols = useMemo(() => ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'ADAUSDT', 'DOGEUSDT', 'XRPUSDT', 'LTCUSDT', 'MATICUSDT', 'LINKUSDT'], []);
    const { prices: wsLivePrices, isConnected } = useBinanceWebSocket(symbols);
    const prevCoins = usePrevious(coins);

    // Fetch portfolio data
    useEffect(() => {
        const fetchPortfolio = async () => {
            if (!isAuthenticated || !user) {
                setPortfolioLoading(false);
                return;
            }

                try {
                    const token = localStorage.getItem('accessToken');
                    if (!token) {
                        setPortfolioLoading(false);
                        return;
                    }


                    const res = await safeFetch('/api/portfolio', { headers: { 'Authorization': `Bearer ${token}` } }, 2, 700);
                    if (res.ok) {
                        setPortfolio(res.data);
                    } else {
                        console.error('Home fetchPortfolio error:', res.error, 'status:', res.status);
                    }
                } catch (error: any) {
                    console.error('Error fetching portfolio:', error);
                } finally {
                    setPortfolioLoading(false);
                }
        };

        fetchPortfolio();
        const interval = setInterval(fetchPortfolio, 30000);
        return () => clearInterval(interval);
    }, [isAuthenticated, user]);

    // Fetch initial crypto data
    useEffect(() => {
        const fetchCryptoData = async () => {
            try {
                const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'ADAUSDT', 'DOGEUSDT', 'XRPUSDT', 'LTCUSDT', 'MATICUSDT', 'LINKUSDT'];
                const responses = await Promise.all(symbols.map(symbol => fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`)));
                const data = await Promise.all(responses.map(res => res.json()));

                const formattedCoins = data.map((item: any) => {
                    const rawSymbol = item?.symbol || '';
                    const baseSymbol = rawSymbol.replace(/USDT$/i, '').replace(/USD$/i, '');
                    const mapping = coinMapping[baseSymbol] || { id: (baseSymbol || rawSymbol).toLowerCase(), name: baseSymbol || rawSymbol };

                    const price = Number(item?.lastPrice) || 0;
                    const change = Number(item?.priceChangePercent) || 0;
                    const volume = Number(item?.volume) || 0;

                    return {
                        id: mapping.id,
                        name: mapping.name,
                        symbol: baseSymbol || rawSymbol,
                        price,
                        change,
                        volume
                    };
                });

                setCoins(formattedCoins);
                setIsLoading(false);
            } catch (error: any) {
                console.error('Error fetching crypto data:', error);
                setIsLoading(false);
            }
        };

        fetchCryptoData();
    }, []);

    // Update coin data from WebSocket
    useEffect(() => {
        if (wsLivePrices.size > 0) {
            setCoins(prevCoins => 
                prevCoins.map(coin => {
                    const wsData = wsLivePrices.get(coin.symbol);
                    if (wsData) {
                        return { ...coin, price: wsData.price, change: wsData.change, volume: wsData.volume };
                    }
                    return coin;
                })
            );
        }
    }, [wsLivePrices]);

    // Manage price update animations
    useEffect(() => {
        if (prevCoins && prevCoins.length > 0 && coins.length > 0) {
            const updatedSymbols = new Set<string>();

            for (const coin of coins) {
                const prevCoin = prevCoins.find(p => p.id === coin.id);
                if (prevCoin && prevCoin.price !== coin.price) {
                    updatedSymbols.add(coin.symbol);
                }
            }

            if (updatedSymbols.size > 0) {
                setUpdatingSymbols((prev: Set<string>) => {
                    const newSet = new Set(prev);
                    updatedSymbols.forEach(s => newSet.add(s));
                    return newSet;
                });

                const timer = setTimeout(() => {
                    setUpdatingSymbols(prev => {
                        const next = new Set(prev);
                        updatedSymbols.forEach(s => next.delete(s));
                        return next;
                    });
                }, 1500);

                return () => clearTimeout(timer);
            }
        }
    }, [coins, prevCoins]);

    // Dark mode toggle
    useEffect(() => {
        if (darkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [darkMode]);

    // Handle sorting
    const handleSort = useCallback((key: string) => {
        setSort(prev => ({
            key,
            order: prev.key === key && prev.order === 'desc' ? 'asc' : 'desc',
        }));
    }, []);

    // Navigation handlers
    const handleGetStarted = useCallback(() => {
        if (!isAuthenticated) {
            router.push('/signup');
        } else {
            router.push('/dashboard');
        }
    }, [isAuthenticated, router]);

    const handleBuyCrypto = useCallback(() => {
        router.push('/trade?action=buy');
    }, [router]);

    const handleSellCrypto = useCallback(() => {
        router.push('/trade?action=sell');
    }, [router]);

    const handleDepositWithdraw = useCallback(() => {
        router.push('/wallet');
    }, [router]);

    const handleLearnClick = useCallback((topic: string) => {
        router.push(`/learn?topic=${topic}`);
    }, [router]);

    // Filtered and sorted coins
    const filteredAndSortedCoins = useMemo(() => {
        const filtered = coins.filter(coin =>
            coin.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            coin.symbol.toLowerCase().includes(searchTerm.toLowerCase())
        );

        return filtered.sort((a: CryptoCoin, b: CryptoCoin) => {
            const aValue = a[sort.key as keyof CryptoCoin];
            const bValue = b[sort.key as keyof CryptoCoin];

            if (aValue < bValue) return sort.order === 'asc' ? -1 : 1;
            if (aValue > bValue) return sort.order === 'asc' ? 1 : -1;
            return 0;
        });
    }, [coins, searchTerm, sort]);

    // Overview data calculation
    const overviewData = useMemo(() => {
        const totalVolume = coins.reduce((sum, coin) => sum + coin.volume, 0);
        const avgChange = coins.length > 0 ? coins.reduce((sum, coin) => sum + coin.change, 0) / coins.length : 0;

        if (portfolio) {
            const portfolioChange = portfolio.totalProfitLoss && portfolio.totalPortfolioValue 
                ? ((portfolio.totalProfitLoss / portfolio.totalPortfolioValue) * 100).toFixed(2)
                : '0.00';

            return {
                portfolio: portfolio.totalPortfolioValue?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00',
                change: portfolioChange,
                volume: (totalVolume / 1e9).toFixed(2),
            };
        }

        return {
            portfolio: '0.00',
            change: avgChange.toFixed(2),
            volume: (totalVolume / 1e9).toFixed(2),
        };
    }, [coins, portfolio]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen dark:bg-gray-900">
                <div className="w-32 h-32 border-b-4 border-indigo-600 rounded-full animate-spin"></div>
                <p className="ml-4 text-xl text-indigo-600 dark:text-indigo-400">Loading crypto data...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen p-4 font-sans transition-colors duration-300 bg-gray-50 dark:bg-gray-900 md:p-8">
            <div className="max-w-6xl mx-auto space-y-8">
                <header className="flex flex-col items-start justify-between space-y-4 md:flex-row md:items-center md:space-y-0">
                    <div>
                        <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">Welcome to <span className="text-indigo-600">Luno</span></h1>
                        <p className="mt-1 text-lg text-gray-600 dark:text-gray-400">Your trusted crypto trading platform</p>
                    </div>
                    <div className="flex items-center space-x-4">
                        <button
                            onClick={() => setDarkMode(!darkMode)}
                            className="p-2 text-gray-600 transition-all bg-gray-100 rounded-full dark:text-gray-300 dark:bg-gray-700 hover:ring-2 ring-indigo-500"
                            title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                        >
                            {darkMode ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5" />}
                        </button>
                        <button 
                            onClick={handleGetStarted}
                            className="flex items-center px-4 py-2 space-x-2 font-semibold text-white transition duration-150 bg-indigo-600 shadow-lg rounded-xl hover:bg-indigo-700">
                            <DollarSign className="w-5 h-5" />
                            <span>Get Started</span>
                        </button>
                    </div>
                </header>

                <Card className="text-white border-0 bg-gradient-to-r from-indigo-600 to-purple-600">
                    <div className="flex flex-col items-center justify-between md:flex-row">
                        <div className="mb-4 md:mb-0">
                            <h2 className="mb-2 text-2xl font-bold">Ready to start trading?</h2>
                            <p className="text-indigo-100">Buy, sell, and manage your crypto assets securely with industry-leading tools.</p>
                        </div>
                        <div className="flex space-x-3">
                            <button 
                                onClick={handleBuyCrypto}
                                className="px-6 py-2 font-semibold text-indigo-600 transition duration-150 bg-white rounded-lg hover:bg-gray-50">
                                Buy Crypto
                            </button>
                            <button 
                                onClick={handleSellCrypto}
                                className="px-6 py-2 font-semibold text-indigo-600 transition duration-150 bg-white rounded-lg hover:bg-gray-50">
                                Sell Crypto
                            </button>
                        </div>
                    </div>
                </Card>

                <div className="flex justify-end">
                    <TimeFrameSelector currentTimeFrame={timeFrame} setTimeFrame={setTimeFrame} />
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                    <Card icon={Globe}>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Portfolio Value ({timeFrame})</p>
                        <h1 className="mt-1 text-4xl font-extrabold text-gray-900 dark:text-white">${overviewData.portfolio}</h1>
                        <p className={`text-md mt-2 flex items-center font-medium ${parseFloat(overviewData.change) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {parseFloat(overviewData.change) >= 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                            {overviewData.change}% ({timeFrame})
                        </p>
                    </Card>
                    <Card icon={Activity}>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Trading Volume ({timeFrame})</p>
                        <h1 className="mt-1 text-4xl font-extrabold text-gray-900 dark:text-white">${overviewData.volume}B</h1>
                        <p className="mt-2 text-gray-500 text-md dark:text-gray-400">Global activity metric</p>
                    </Card>
                    <Card icon={DollarSign}>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Available Fiat Balance</p>
                        <h1 className="mt-1 text-4xl font-extrabold text-gray-900 dark:text-white">
                            ${portfolio?.balance?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                        </h1>
                        <button 
                            onClick={handleDepositWithdraw}
                            className="flex items-center mt-2 font-medium text-indigo-500 transition duration-150 text-md hover:text-indigo-600">
                            <DollarSign className="w-4 h-4 mr-1"/> Deposit / Withdraw
                        </button>
                    </Card>
                </div>

                <Card title="Top Crypto Assets" icon={Filter}>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-2">
                            <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                                {isConnected ? 'Live Updates Active' : 'Connecting to live data...'}
                            </span>
                        </div>
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                            Powered by Binance WebSocket
                        </span>
                    </div>

                    <div className="mb-6">
                        <div className="relative">
                            <Search className="absolute w-5 h-5 text-gray-400 transform -translate-y-1/2 left-3 top-1/2 dark:text-gray-500" />
                            <input
                                type="text"
                                placeholder="Search by name or symbol (e.g., BTC, Bitcoin)"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full p-3 pl-10 text-gray-900 transition-shadow border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                    </div>

                    <div className="hidden md:block">
                        <div className="grid items-center grid-cols-12 pb-2 mb-2 border-b-2 border-gray-100 dark:border-gray-700">
                        <div className="col-span-4 md:col-span-3">
                            <SortButton column="symbol" label="Asset" currentSort={sort} handleSort={handleSort} />
                        </div>
                        <div className="col-span-3 text-left md:col-span-3">
                            <SortButton column="price" label="Price" currentSort={sort} handleSort={handleSort} />
                        </div>
                        <div className="col-span-3 text-center md:col-span-2">
                            <SortButton column="change" label="24h Change" currentSort={sort} handleSort={handleSort} />
                        </div>
                        <div className="hidden text-right md:block md:col-span-2">
                            <SortButton column="volume" label="24h Volume" currentSort={sort} handleSort={handleSort} />
                        </div>
                        <div className="hidden col-span-2 text-right lg:block">
                            <span className="text-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400">7d Chart</span>
                        </div>
                    </div>
                    </div>

                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {filteredAndSortedCoins.length > 0 ? (
                            filteredAndSortedCoins.map(coin => (
                                <CoinRow 
                                    key={coin.id} 
                                    coin={coin} 
                                    isUpdating={updatingSymbols.has(coin.symbol)}
                                />
                            ))
                        ) : (
                            <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                                {!isConnected && coins.length === 0 ? (
                                    'No live data is available. Check your network, the Binance API, or try refreshing the page.'
                                ) : (
                                    searchTerm ? 'No assets match your search criteria.' : 'No data is available.'
                                )}
                            </div>
                        )}
                    </div>
                    
                    <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
                        *Real-time data from Binance WebSocket. Updates live as prices change.
                    </p>
                </Card>

                <Card title="Learn & Explore" icon={Users}>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <button 
                            onClick={() => handleLearnClick('bitcoin')}
                            className="p-4 text-center transition-colors border border-gray-100 rounded-lg cursor-pointer dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-3 bg-indigo-100 rounded-full dark:bg-indigo-900/50">
                                <TrendingUp className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <h3 className="mb-2 font-semibold text-gray-900 dark:text-white">What is Bitcoin?</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Learn the fundamentals of cryptocurrency and blockchain technology.</p>
                        </button>
                        <button 
                            onClick={() => handleLearnClick('trading')}
                            className="p-4 text-center transition-colors border border-gray-100 rounded-lg cursor-pointer dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-3 bg-green-100 rounded-full dark:bg-green-900/50">
                                <Activity className="w-6 h-6 text-green-600 dark:text-green-400" />
                            </div>
                            <h3 className="mb-2 font-semibold text-gray-900 dark:text-white">Trading Basics</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Understand buy/sell orders, market vs limit orders, and trading strategies.</p>
                        </button>
                        <button 
                            onClick={() => handleLearnClick('security')}
                            className="p-4 text-center transition-colors border border-gray-100 rounded-lg cursor-pointer dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-3 bg-purple-100 rounded-full dark:bg-purple-900/50">
                                <DollarSign className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                            </div>
                            <h3 className="mb-2 font-semibold text-gray-900 dark:text-white">Security Guide</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Keep your account safe with 2FA, secure passwords, and best practices.</p>
                        </button>
                    </div>
                </Card>
            </div>
        </div>
    );
}