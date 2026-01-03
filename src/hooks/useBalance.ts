import { useState, useEffect } from 'react';
import { useAuthFetch } from '../lib/authFetch';

interface CachedBalance {
    balance: number;
    timestamp: number;
    authenticated: boolean;
}

const BALANCE_CACHE_KEY = 'luno_balance_cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface UseBalanceReturn {
    balance: number;
    isLoading: boolean;
    isAuthenticated: boolean;
    refreshBalance: () => Promise<void>;
}

export const useBalance = (): UseBalanceReturn => {
    const [balance, setBalance] = useState<number>(0);
    const [isLoading, setIsLoading] = useState<boolean>(true); // Start with loading true
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
    const authFetch = useAuthFetch();

    // Load cached balance on mount
    useEffect(() => {
        const cached = localStorage.getItem(BALANCE_CACHE_KEY);
        if (cached) {
            try {
                const parsed: CachedBalance = JSON.parse(cached);
                const now = Date.now();
                if (now - parsed.timestamp < CACHE_DURATION) {
                    setBalance(parsed.balance);
                    setIsAuthenticated(parsed.authenticated);
                    setIsLoading(false);
                }
            } catch (error) {
                console.warn('Failed to parse balance cache:', error);
            }
        }
    }, []);

    const updateCache = (balance: number, authenticated: boolean) => {
        const cache: CachedBalance = {
            balance,
            authenticated,
            timestamp: Date.now()
        };
        localStorage.setItem(BALANCE_CACHE_KEY, JSON.stringify(cache));
    };

    const fetchBalance = async () => {
        setIsLoading(true);
        try {
            const res = await authFetch('/api/portfolio', undefined, 2, 1000);
            if (res.ok && res.data) {
                const newBalance = res.data.balance || 0;
                setBalance(newBalance);
                setIsAuthenticated(true);
                updateCache(newBalance, true);
            } else if (res.status === 401) {
                // User is not authenticated
                setBalance(0);
                setIsAuthenticated(false);
                updateCache(0, false);
            } else {
                console.error('Failed to fetch balance:', res.error, 'status:', res.status);
                // Don't set isAuthenticated to false on other errors
            }
        } catch (error) {
            console.error('Failed to fetch balance:', error);
            // setBalance(0);
            // setIsAuthenticated(false);
        } finally {
            setIsLoading(false);
        }
    };

    const refreshBalance = async () => {
        await fetchBalance();
    };

    useEffect(() => {
        // If no cached balance was loaded, fetch immediately
        if (isLoading) {
            fetchBalance();
        }

        // Refresh balance every 30 seconds
        const interval = setInterval(fetchBalance, 30000);
        return () => clearInterval(interval);
    }, [isLoading]); // Depend on isLoading to avoid double fetch

    return { balance, isLoading, isAuthenticated, refreshBalance };
};