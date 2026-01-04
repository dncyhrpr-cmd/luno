'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUp, ArrowDown, Clock, DollarSign, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { binanceAPI, Trade } from '../lib/binance-api';

interface TradeComponentProps {
    symbol: string;
}

interface CryptoCoin {
    id: string;
    name: string;
    symbol: string;
}

const TradeComponent: React.FC<TradeComponentProps> = ({ symbol }) => {
    const [trades, setTrades] = useState<Trade[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentPrice, setCurrentPrice] = useState<number | null>(null);
    const [previousPrice, setPreviousPrice] = useState<number | null>(null);
    const [priceColor, setPriceColor] = useState<'black' | 'green' | 'red'>('black');
    const [flash, setFlash] = useState(false);

    // Placeholder data for demonstration
    const placeholderTrades: Trade[] = [
        { id: 1, price: 45000, qty: 0.001, time: Date.now() - 10000, isBuyerMaker: false },
        { id: 2, price: 44950, qty: 0.002, time: Date.now() - 20000, isBuyerMaker: true },
        { id: 3, price: 45020, qty: 0.0015, time: Date.now() - 30000, isBuyerMaker: false },
        { id: 4, price: 44980, qty: 0.003, time: Date.now() - 40000, isBuyerMaker: true },
        { id: 5, price: 45010, qty: 0.0025, time: Date.now() - 50000, isBuyerMaker: false },
    ];

    useEffect(() => {
        const fetchTrades = async () => {
            setLoading(true);
            setError(null);
            try {
                const symbolWithUSDT = symbol.toUpperCase() + 'USDT';
                const fetchedTrades = await binanceAPI.getTrades(symbolWithUSDT, 50);
                setTrades(fetchedTrades);
            } catch (err: any) {
                console.error('Failed to fetch trades:', err);
                setError('Failed to load trade data. Using demo data.');
                setTrades(placeholderTrades);
            } finally {
                setLoading(false);
            }
        };

        const fetchPrice = async () => {
            try {
                const prices = await binanceAPI.getPrices([symbol]);
                if (prices.length > 0) {
                    const newPrice = prices[0].price;
                    if (currentPrice !== null && newPrice !== currentPrice) {
                        if (newPrice > currentPrice) {
                            setPriceColor('green');
                        } else if (newPrice < currentPrice) {
                            setPriceColor('red');
                        }
                        setFlash(true);
                        setTimeout(() => setFlash(false), 500);
                    }
                    setCurrentPrice(newPrice);
                }
            } catch (err) {
                console.error('Failed to fetch price:', err);
            }
        };

        if (symbol) {
            fetchTrades();
            fetchPrice();
            // Refetch trades every 5 seconds
            const tradesInterval = setInterval(fetchTrades, 5000);
            // Fetch price every 1 second
            const priceInterval = setInterval(fetchPrice, 1000);
            return () => {
                clearInterval(tradesInterval);
                clearInterval(priceInterval);
            };
        }
    }, [symbol, currentPrice]);

    const formatTime = (timestamp: number) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    const formatPrice = (price: number) => `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const formatQuantity = (qty: number) => qty.toFixed(4);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="relative p-6 overflow-hidden border shadow-2xl bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl md:p-8 rounded-2xl shadow-black/5 dark:shadow-black/20 border-gray-200/50 dark:border-gray-700/50"
            style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(249,250,251,0.95) 100%)',
            }}
        >
            {/* Subtle gradient overlay */}
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-white/20 via-transparent to-black/5 dark:from-white/5 dark:to-black/10" />

            <div className="relative z-10">
                <motion.h2
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1, duration: 0.3 }}
                    className="flex items-center gap-2 mb-6 text-xl font-bold tracking-tight text-gray-900 dark:text-white"
                >
                    <Activity className="w-5 h-5 text-indigo-500" />
                    Recent Trades - {symbol}/USDT
                </motion.h2>

                {currentPrice && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2, duration: 0.3 }}
                        className="mb-6 text-center"
                    >
                        <div className="text-sm text-gray-600 dark:text-gray-400">Current Price</div>
                        <motion.div
                            className="text-3xl font-bold text-black"
                            animate={flash ? { scale: [1, 1.1, 1], opacity: [1, 0.7, 1] } : {}}
                            transition={{ duration: 0.5 }}
                        >
                            ${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </motion.div>
                    </motion.div>
                )}

                {error && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="p-3 mb-4 text-sm text-yellow-800 border border-yellow-200 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-700 dark:text-yellow-200"
                    >
                        {error}
                    </motion.div>
                )}

                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="w-8 h-8 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
                        <span className="ml-3 text-gray-600 dark:text-gray-400">Loading trades...</span>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="border-b border-gray-200 dark:border-gray-700">
                                    <th className="px-3 py-2 font-semibold text-left text-gray-700 dark:text-gray-300">Time</th>
                                    <th className="px-3 py-2 font-semibold text-left text-gray-700 dark:text-gray-300">Side</th>
                                    <th className="px-3 py-2 font-semibold text-right text-gray-700 dark:text-gray-300">Price</th>
                                    <th className="px-3 py-2 font-semibold text-right text-gray-700 dark:text-gray-300">Quantity</th>
                                    <th className="px-3 py-2 font-semibold text-right text-gray-700 dark:text-gray-300">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                <AnimatePresence>
                                    {trades.slice(0, 20).map((trade, index) => {
                                        const prevTrade = trades[index + 1];
                                        const priceChange = prevTrade ? trade.price - prevTrade.price : 0;
                                        const isPriceUp = priceChange > 0;
                                        const isPriceDown = priceChange < 0;

                                        return (
                                            <motion.tr
                                                key={trade.id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: index * 0.02, duration: 0.3 }}
                                                className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                                            >
                                                <td className="flex items-center gap-1 px-3 py-2 text-gray-600 dark:text-gray-400">
                                                    <Clock className="w-3 h-3" />
                                                    {formatTime(trade.time)}
                                                </td>
                                                <td className="px-3 py-2">
                                                    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                                                        trade.isBuyerMaker
                                                            ? 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                                                            : 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                                                    }`}>
                                                        {trade.isBuyerMaker ? (
                                                            <>
                                                                <ArrowDown className="w-3 h-3" />
                                                                Sell
                                                            </>
                                                        ) : (
                                                            <>
                                                                <ArrowUp className="w-3 h-3" />
                                                                Buy
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2 font-mono text-right text-black">
                                                    {formatPrice(trade.price)}
                                                </td>
                                                <td className="px-3 py-2 font-mono text-right text-gray-600 dark:text-gray-400">
                                                    {formatQuantity(trade.qty)}
                                                </td>
                                                <td className="px-3 py-2 font-mono text-right text-gray-900 dark:text-white">
                                                    {formatPrice(trade.price * trade.qty)}
                                                </td>
                                            </motion.tr>
                                        );
                                    })}
                                </AnimatePresence>
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Quick Action Buttons */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4, duration: 0.3 }}
                    className="grid grid-cols-2 gap-3 mt-6"
                >
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.98 }}
                        className="flex items-center justify-center gap-2 px-6 py-4 font-bold text-white transition-all duration-300 shadow-lg rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 hover:shadow-xl"
                    >
                        <TrendingUp className="w-6 h-6" />
                        Quick Buy
                    </motion.button>
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.98 }}
                        className="flex items-center justify-center gap-2 px-6 py-4 font-bold text-white transition-all duration-300 shadow-lg rounded-2xl bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 hover:shadow-xl"
                    >
                        <TrendingDown className="w-6 h-6" />
                        Quick Sell
                    </motion.button>
                </motion.div>
            </div>
        </motion.div>
    );
};

export default TradeComponent;