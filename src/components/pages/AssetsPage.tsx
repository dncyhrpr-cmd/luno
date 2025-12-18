
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { safeFetch } from '../../lib/safeFetch';
import { useBinanceWebSocket } from '../../hooks/useBinanceWebSocket';
import { Wallet, Plus, ArrowDown, X } from 'lucide-react';
import { User } from '../../types/index';

interface Asset {
  id: string;
  symbol: string;
  quantity: number;
  averagePrice: number;
}

interface PortfolioData {
  balance: number;
  assets: Asset[];
  totalPortfolioValue: number;
}

const Card: React.FC<{ title?: string; children: React.ReactNode; className?: string }> = ({ title, children, className = '' }) => (
  <div className={`bg-white dark:bg-gray-800 p-4 md:p-6 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 ${className}`}>
    {title && <h2 className="mb-4 text-lg font-semibold text-gray-800 md:text-xl dark:text-gray-100">{title}</h2>}
    {children}
  </div>
);

const AssetRow: React.FC<{ asset: Asset; currentPrice: number; onSell: (asset: Asset) => void }> = React.memo(({ asset, currentPrice, onSell }) => {
    const currentValue = (asset?.quantity || 0) * (currentPrice || asset?.averagePrice || 0);
    const costBasis = (asset?.quantity || 0) * (asset?.averagePrice || 0);
    const pnl = currentValue - costBasis;
    const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;

    return (
    <div className="grid items-center grid-cols-1 p-4 border-b border-gray-100 md:grid-cols-4 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
      <div className="md:col-span-1">
        <div className="text-lg font-bold text-gray-900 dark:text-white">{asset?.symbol?.replace('USDT', '') || 'N/A'}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400">Avg ${asset?.averagePrice?.toFixed(2)}</div>
        <button onClick={() => onSell(asset)} className="px-2 py-1 mt-1 text-xs text-white bg-red-500 rounded hover:bg-red-600">Sell</button>
      </div>
      <div className="mt-2 text-left md:text-right md:mt-0">
        <div className="text-sm text-gray-500 dark:text-gray-300 md:hidden">Quantity:</div>
        <div className="text-sm text-gray-500 dark:text-gray-300">{(asset?.quantity || 0).toFixed(8)}</div>
      </div>
      <div className="mt-2 text-left md:text-right md:mt-0">
        <div className="text-sm text-gray-400 md:hidden">Value:</div>
        <div className="text-sm text-gray-400">${(currentPrice || asset?.averagePrice || 0).toFixed(2)}</div>
        <div className="font-medium dark:text-white">${currentValue.toFixed(2)}</div>
      </div>
      <div className="mt-2 text-left md:text-right md:mt-0">
        <div className="text-sm md:hidden">P&L:</div>
        <div className={`text-sm ${pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>{pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}</div>
        <div className={`text-xs ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>{pnlPct.toFixed(2)}%</div>
      </div>
    </div>
    );
  });
AssetRow.displayName = 'AssetRow';

const TransactionForm: React.FC<{
  transactionType: 'deposit' | 'withdraw';
  user: User | null;
  fetchData: () => void;
  onClose: () => void;
}> = ({ transactionType, user, fetchData, onClose }) => {
  const [amount, setAmount] = useState('');

  const handleTransaction = async () => {
    if (!amount || parseFloat(amount) <= 0) {
        alert('Please enter a valid amount');
        return;
    }

    try {
        if (!user || !user.accessToken) {
            alert('Please login first');
            return;
        }
        const token = user.accessToken;

        const response = await fetch('/api/portfolio', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                type: transactionType,
                amount: parseFloat(amount)
            })
        });

        const data = await response.json();

        if (response.ok) {
            alert(`${transactionType} of $${parseFloat(amount).toFixed(2)} successful!`);
            setAmount('');
            fetchData();
            onClose();
        } else {
            alert(`${transactionType} failed: ${data.error}`);
        }
    } catch (error) {
        alert(`${transactionType} failed. Please try again.`);
    }
  };

  return (
    <Card className="mt-6 lg:col-span-3">
        <div className="flex items-center justify-between">
            <h3 className="text-2xl font-bold dark:text-white">{transactionType === 'deposit' ? 'Deposit' : 'Withdraw'}</h3>
            <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                <X className="w-6 h-6 text-gray-500 dark:text-gray-400" />
            </button>
        </div>
      <div className="mt-4 space-y-4">
        <div>
          <label className="block mb-1 text-sm font-medium text-gray-500 dark:text-gray-300">Amount (USD)</label>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white" placeholder="Enter amount" />
        </div>
        <div className="flex space-x-4">
          <button onClick={handleTransaction} className="flex-1 py-2 font-semibold text-white transition-colors bg-blue-600 rounded-lg hover:bg-blue-700">Submit</button>
        </div>
      </div>
    </Card>
  );
};


const AssetsPage: React.FC<{ user: User | null }> = ({ user }) => {
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showSellAsset, setShowSellAsset] = useState<Asset | null>(null);


  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    // Prefer token from `user` prop, but fall back to localStorage (helps non-SSR flows)
    const tokenFromProp = user?.accessToken;
    let token = tokenFromProp || null;
    if (!token) {
      try {
        token = localStorage.getItem('accessToken');
      } catch (e) {
        token = null;
      }
    }

    if (!token) {
      setIsLoading(false);
      setError('Please log in to view your assets.');
      return;
    }

    try {
      const headers: any = { 'Authorization': `Bearer ${token}` };

      const res = await safeFetch('/api/portfolio', { headers }, 2, 700);
      if (!res.ok) {
        console.error('Portfolio API safeFetch error:', res.error, 'status:', res.status);
        setError(res.error || 'Failed to fetch portfolio data.');
      } else {
        setPortfolio(res.data as PortfolioData);
      }
    } catch (error: any) {
      console.error('Unexpected error fetching portfolio:', error);
      setError(`An unexpected error occurred while fetching data. ${String(error)}`);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Listen for portfolio updates triggered elsewhere in the app
  useEffect(() => {
    const onPortfolioUpdated = () => {
      fetchData();
    };
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('portfolio:updated', onPortfolioUpdated);
    }
    return () => {
      if (typeof window !== 'undefined' && window.removeEventListener) {
        window.removeEventListener('portfolio:updated', onPortfolioUpdated as EventListener);
      }
    };
  }, [fetchData]);

  // Prepare symbols for the Binance WebSocket (base symbols like 'BTC', 'ETH')
  const assetSymbols = portfolio?.assets?.map(a => a.symbol) || [];
  const { prices: wsPrices } = useBinanceWebSocket(assetSymbols);

  // Calculate total portfolio value using current prices
  const totalPortfolioValue = useMemo(() => {
    if (!portfolio) return 0;
    const totalAssetValue = portfolio.assets.reduce((sum, asset) => {
      const currentPrice = wsPrices.get(asset.symbol)?.price || asset.averagePrice || 0;
      return sum + (asset.quantity * currentPrice);
    }, 0);
    return portfolio.balance + totalAssetValue;
  }, [portfolio, wsPrices]);

  // Sell form component
  const SellForm: React.FC<{ asset: Asset; onClose: () => void; refresh: () => Promise<void> }> = ({ asset, onClose, refresh }) => {
    const [qty, setQty] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSell = async () => {
      const parsed = parseFloat(qty);
      if (!parsed || parsed <= 0) {
        alert('Enter a valid quantity to sell.');
        return;
      }
      if (parsed > asset.quantity) {
        alert('You cannot sell more than your holding quantity.');
        return;
      }

      let token = user?.accessToken || null;
      try { token = token || localStorage.getItem('accessToken'); } catch (e: any) { }
      if (!token) {
        alert('Please login to place sell orders.');
        return;
      }

      const currentPrice = wsPrices.get(asset.symbol)?.price || asset.averagePrice || 0;

      setSubmitting(true);
      try {
        const res = await safeFetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ type: 'SELL', orderType: 'MARKET', symbol: asset.symbol, quantity: parsed, price: currentPrice, leverage: 1 })
        }, 2, 800);
        if (res.ok && res.data.success) {
          alert('Sell order placed successfully.');
          await refresh();
          onClose();
        } else {
          alert(`Sell failed: ${res.error || res.data?.error || res.data?.message || JSON.stringify(res.data)}`);
        }
      } catch (err: any) {
        console.error('Sell request failed:', err);
        alert('Sell failed. Please try again.');
      } finally {
        setSubmitting(false);
      }
    };

    return (
      <Card className="mt-6 lg:col-span-3">
        <div className="flex items-center justify-between">
            <h3 className="text-2xl font-bold dark:text-white">Sell {asset.symbol.replace('USDT', '')}</h3>
            <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                <X className="w-6 h-6 text-gray-500 dark:text-gray-400" />
            </button>
        </div>
        <div className="mt-4 space-y-4">
          <div>
            <label className="block mb-1 text-sm font-medium text-gray-500 dark:text-gray-300">Quantity ({asset.symbol.replace('USDT', '')})</label>
            <input type="number" value={qty} onChange={(e) => setQty(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white" placeholder={`Max ${asset.quantity}`} />
            <div className="mt-1 text-xs text-gray-400">Available: {asset.quantity.toFixed(8)}</div>
          </div>
          <div className="flex space-x-4">
            <button onClick={handleSell} disabled={submitting} className="flex-1 py-2 font-semibold text-white transition-colors bg-red-600 rounded-lg hover:bg-red-700">{submitting ? 'Placing...' : 'Sell Now'}</button>
          </div>
        </div>
      </Card>
    );
  };


  if (isLoading) {
    return <div className="flex items-center justify-center h-screen dark:bg-gray-900"><p className="text-xl text-indigo-600 dark:text-indigo-400">Loading portfolio...</p></div>;
  }

  if (error) {
    return <div className="flex items-center justify-center h-screen dark:bg-gray-900"><p className="text-red-500 dark:text-red-400">{error}</p></div>;
  }

  if (!portfolio) {
    return <div className="flex items-center justify-center h-screen dark:bg-gray-900"><p className="text-gray-500 dark:text-gray-400">No portfolio data available.</p></div>;
  }

  return (
    <div className="min-h-screen p-4 space-y-8 md:p-8 bg-gray-50 dark:bg-gray-900">
      <h1 className="flex items-center text-4xl font-extrabold text-gray-900 dark:text-white">
        <Wallet className="w-8 h-8 mr-3 text-indigo-500" />
        My Assets
      </h1>
      
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-gray-100">Portfolio Summary</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-indigo-50 dark:bg-gray-700">
              <Wallet className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-300">Available Balance</p>
                <p className="text-2xl font-bold dark:text-white">${(portfolio?.balance || 0).toFixed(2)}</p>
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-500 dark:text-gray-300">Total Portfolio Value</p>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">${totalPortfolioValue.toFixed(2)}</p>
            </div>
          </div>
        </Card>

        <Card title="Your Holdings" className="lg:col-span-2">
            <div className="grid grid-cols-4 p-3 text-xs font-semibold text-gray-500 uppercase border-b border-gray-200 dark:text-gray-400 dark:border-gray-700">
              <div>Asset</div>
              <div className="text-right">Quantity</div>
              <div className="text-right">Value</div>
              <div className="text-right">P&L</div>
            </div>
            {Array.isArray(portfolio?.assets) && portfolio.assets.length > 0 ? (
              portfolio.assets.map(asset => {
                const currentPrice = wsPrices.get(asset.symbol)?.price || asset.averagePrice || 0;
                return <AssetRow key={asset.id} asset={asset} currentPrice={currentPrice} onSell={setShowSellAsset} />
              })
            ) : (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">No assets found.</div>
            )}
        </Card>

        <Card title="Transactions" className="lg:col-span-3">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <button onClick={() => { setShowDeposit(!showDeposit); setShowWithdraw(false); }} className="flex items-center justify-center px-4 py-3 font-semibold text-white transition-colors bg-green-600 rounded-lg hover:bg-green-700"><Plus className="w-5 h-5 mr-2" />Deposit</button>
              <button onClick={() => { setShowWithdraw(!showWithdraw); setShowDeposit(false); }} className="flex items-center justify-center px-4 py-3 font-semibold text-white transition-colors bg-orange-600 rounded-lg hover:bg-orange-700"><ArrowDown className="w-5 h-5 mr-2" />Withdraw</button>
          </div>
        </Card>
        
        {showDeposit && (
          <TransactionForm
            transactionType="deposit"
            user={user}
            fetchData={fetchData}
            onClose={() => setShowDeposit(false)}
          />
        )}

        {showWithdraw && (
          <TransactionForm
            transactionType="withdraw"
            user={user}
            fetchData={fetchData}
            onClose={() => setShowWithdraw(false)}
          />
        )}

        {showSellAsset && (
          <SellForm
            asset={showSellAsset}
            onClose={() => setShowSellAsset(null)}
            refresh={fetchData}
          />
        )}

      </div>
    </div>
  );
};

export default AssetsPage;
