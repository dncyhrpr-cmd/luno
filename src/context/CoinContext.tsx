'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface CryptoCoin {
    id: string;
    name: string;
    symbol: string;
    price?: number;
    change?: number;
    volume?: number;
    image?: string;
}

interface CoinContextType {
    selectedCoin: CryptoCoin | null;
    setSelectedCoin: (coin: CryptoCoin | null) => void;
}

const CoinContext = createContext<CoinContextType | undefined>(undefined);

export function CoinProvider({ children }: { children: ReactNode }) {
    const [selectedCoin, setSelectedCoin] = useState<CryptoCoin | null>(null);

    return (
        <CoinContext.Provider value={{ selectedCoin, setSelectedCoin }}>
            {children}
        </CoinContext.Provider>
    );
}

export function useCoin() {
    const context = useContext(CoinContext);
    if (context === undefined) {
        throw new Error('useCoin must be used within a CoinProvider');
    }
    return context;
}
