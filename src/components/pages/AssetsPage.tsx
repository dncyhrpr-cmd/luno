'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Wallet, Plus, ArrowDown, X, TrendingUp, TrendingDown, Info, AlertCircle } from 'lucide-react';
import { safeFetch } from '../../lib/safeFetch';
import { useBinanceWebSocket } from '../../hooks/useBinanceWebSocket';
import { User } from '../../types/index';

// --- Types ---
interface Asset {
  id: string;
  symbol: string;
  quantity: number;
  averagePrice: number;
}

interface PortfolioData {
  balance: number;
  assets: Asset[];
}

// --- Shared Components ---

const Card: React.FC<{ title?: string; children: React.ReactNode; className?: string }> = ({ title, children, className = '' }) => (
  <div className={`bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 ${className}`}>
    {title && <h2 className="flex items-center gap-2 mb-6 text-lg font-bold text-gray-900 dark:text-white">{title}</h2>}
    {children}
  </div>
);

const Notification: React.FC<{ message: string; type: 'success' | 'error'; onClose: () => void }> = ({ message, type, onClose }) => (
  <div className={`fixed bottom-5 right-5 p-4 rounded-lg shadow-2xl flex items-center gap-3 z-50 animate-in slide-in-from-right ${type === 'success' ? 'bg-green-600' : 'bg-red-600'} text-white`}>
    <span>{message}</span>
    <button onClick={onClose}><X size={18} /></button>
  </div>
);

// --- Sub-components ---

const AssetRow: React.FC<{ asset: Asset; currentPrice: number; onSell: (asset: Asset) => void }> = React.memo(({ asset, currentPrice, onSell }) => {
  const currentValue = asset.quantity * currentPrice;
  const costBasis = asset.quantity * asset.averagePrice;
  const pnl = currentValue - costBasis;
  const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
  const isPositive = pnl >= 0;

  return (
    <div className="grid items-center grid-cols-2 gap-4 py-4 transition-colors border-b border-gray-50 md:grid-cols-4 dark:border-gray-700/50 hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
      <div>
        <div className="font-bold text-gray-900 dark:text-white">{asset.symbol.replace('USDT', '')}</div>
        <div className="text-xs text-gray-500">Avg: ${asset.averagePrice.toLocaleString()}</div>
      </div>
      <div className="text-right md:text-left">
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300">{asset.quantity.toLocaleString(undefined, { maximumFractionDigits: 8 })}</div>
        <button onClick={() => onSell(asset)} className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider hover:underline">Liquidate</button>
      </div>
      <div className="hidden text-right md:block">
        <div className="text-sm font-semibold dark:text-white">${currentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        <div className="text-xs text-gray-400">${currentPrice.toLocaleString()}</div>
      </div>
      <div className="text-right">
        <div className={`text-sm font-bold ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
          {isPositive ? '+' : ''}{pnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </div>
        <div className={`text-xs flex items-center justify-end gap-1 ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
          {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {pnlPct.toFixed(2)}%
        </div>
      </div>
    </div>
  );
});

// --- Main Page Component ---

const AssetsPage: React.FC<{ user: User | null }> = ({ user }) => {
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<'deposit' | 'withdraw' | 'sell' | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [notify, setNotify] = useState<{ m: string; t: 'success' | 'error' } | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // Binance WS Integration
  const assetSymbols = useMemo(() => portfolio?.assets?.map(a => a.symbol) || [], [portfolio]);
  const { prices: wsPrices } = useBinanceWebSocket(assetSymbols);

  const fetchData = useCallback(async () => {
    const token = user?.accessToken || (typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null);
    if (!token) {
      setError('Session expired. Please log in.');
      setIsLoading(false);
      return;
    }

    try {
      const res = await safeFetch('/api/portfolio', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setPortfolio(res.data);
      else setError(res.error || 'Failed to load assets');
    } catch (err) {
      setError('Connection error');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Listen for portfolio updates from other pages (e.g., after buying assets)
  useEffect(() => {
      const handlePortfolioUpdate = () => {
          fetchData();
      };
      window.addEventListener('portfolio:updated', handlePortfolioUpdate);
      return () => window.removeEventListener('portfolio:updated', handlePortfolioUpdate);
  }, [fetchData]);

  // Derived Calculations
  const stats = useMemo(() => {
    if (!portfolio) return { total: 0, pnl: 0, pnlPct: 0 };
    const totalAssets = portfolio.assets.reduce((sum, a) => {
      const price = wsPrices.get(a.symbol)?.price || a.averagePrice;
      return sum + (a.quantity * price);
    }, 0);
    const totalCost = portfolio.assets.reduce((sum, a) => sum + (a.quantity * a.averagePrice), 0);
    const totalValue = totalAssets + portfolio.balance;
    const pnl = totalAssets - totalCost;
    return { 
        total: totalValue, 
        pnl, 
        pnlPct: totalCost > 0 ? (pnl / totalCost) * 100 : 0,
        assetRatio: totalValue > 0 ? (totalAssets / totalValue) * 100 : 0
    };
  }, [portfolio, wsPrices]);

  const handleAction = async (type: string, payload: any) => {
    setFormLoading(true);
    const token = user?.accessToken || localStorage.getItem('accessToken');

    try {
      const endpoint = type === 'sell' ? '/api/orders' : '/api/portfolio';
      const body = type === 'sell'
        ? {
            ...payload,
            type: 'SELL',
            orderType: 'MARKET',
            price: wsPrices.get(payload.symbol)?.price || 0,
            leverage: 1
          }
        : { ...payload, type };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        const data = await res.json();
        setNotify({ m: data.message || 'Request processed successfully', t: 'success' });
        fetchData();
        setActiveModal(null);
      } else {
        const errData = await res.json();
        setNotify({ m: errData.error || 'Transaction failed', t: 'error' });
      }
    } catch {
      setNotify({ m: 'System error. Try again later.', t: 'error' });
    } finally {
      setFormLoading(false);
    }
  };

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center min-h-screen space-y-4 bg-gray-50 dark:bg-gray-900">
      <div className="w-12 h-12 border-4 border-indigo-500 rounded-full border-t-transparent animate-spin" />
      <p className="text-gray-500 animate-pulse">Syncing Ledger...</p>
    </div>
  );

  return (
    <div className="min-h-screen p-4 pb-20 md:p-10 bg-gray-50 dark:bg-gray-900">
      {notify && <Notification message={notify.m} type={notify.t} onClose={() => setNotify(null)} />}

      <header className="flex flex-col gap-4 mb-10 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white">Portfolio</h1>
          <p className="text-sm text-gray-500">Real-time market valuation of your holdings</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setActiveModal('deposit')} className="flex items-center gap-2 px-6 py-3 font-bold text-white transition-all bg-indigo-600 rounded-xl hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-500/30">
            <Plus size={18} /> Deposit
          </button>
          <button onClick={() => setActiveModal('withdraw')} className="flex items-center gap-2 px-6 py-3 font-bold text-gray-700 transition-all bg-white border border-gray-200 rounded-xl dark:bg-gray-800 dark:text-white dark:border-gray-700 hover:bg-gray-50">
            <ArrowDown size={18} /> Withdraw
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left Column: Stats */}
        <div className="space-y-6 lg:col-span-4">
          <Card>
            <div className="space-y-6">
              <div>
                <label className="text-xs font-bold tracking-widest text-gray-400 uppercase">Net Worth</label>
                <div className="text-4xl font-black text-gray-900 dark:text-white">${stats.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
              </div>

              <div className="grid grid-cols-2 gap-4 py-4 border-gray-100 border-y dark:border-gray-700">
                <div>
                  <div className="text-xs text-gray-500">Available USD</div>
                  <div className="text-lg font-bold dark:text-white">${portfolio?.balance.toLocaleString()}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500">Total P&L</div>
                  <div className={`text-lg font-bold ${stats.pnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {stats.pnl >= 0 ? '+$' : '-$'}{Math.abs(stats.pnl).toLocaleString()}
                  </div>
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-2 text-xs font-bold">
                  <span className="text-gray-500">Asset Allocation</span>
                  <span className="text-indigo-500">{(stats.assetRatio || 0).toFixed(0)}% Crypto</span>
                </div>
                <div className="w-full h-2 overflow-hidden bg-gray-100 rounded-full dark:bg-gray-700">
                  <div className="h-full transition-all duration-1000 bg-indigo-500" style={{ width: `${stats.assetRatio}%` }} />
                </div>
              </div>
            </div>
          </Card>
          
          <div className="p-4 border border-blue-100 rounded-2xl bg-blue-50/50 dark:bg-blue-900/10 dark:border-blue-900/30">
            <div className="flex gap-3">
              <Info className="text-blue-500 shrink-0" size={20} />
              <p className="text-xs leading-relaxed text-blue-700 dark:text-blue-300">
                Prices are streamed live from Binance. Your "Net Worth" includes both your cash balance and the current market value of your tokens.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Holdings */}
        <div className="lg:col-span-8">
          <Card title="Active Holdings">
            <div className="min-h-[300px]">
              {portfolio?.assets.length ? (
                <>
                  <div className="grid grid-cols-2 pb-2 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b dark:border-gray-700 md:grid-cols-4">
                    <div>Asset</div>
                    <div className="text-right md:text-left">Holdings</div>
                    <div className="hidden text-right md:block">Market Value</div>
                    <div className="text-right">Unrealized P&L</div>
                  </div>
                  {portfolio.assets.map(asset => (
                    <AssetRow 
                      key={asset.id} 
                      asset={asset} 
                      currentPrice={wsPrices.get(asset.symbol)?.price || asset.averagePrice}
                      onSell={(a) => { setSelectedAsset(a); setActiveModal('sell'); }}
                    />
                  ))}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="p-4 mb-4 bg-gray-100 rounded-full dark:bg-gray-700">
                    <Wallet size={32} className="text-gray-400" />
                  </div>
                  <h3 className="text-lg font-bold dark:text-white">No assets yet</h3>
                  <p className="max-w-xs text-sm text-gray-500">Deposit USD or place a buy order to start building your portfolio.</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Unified Action Modal */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden duration-200 bg-white shadow-2xl dark:bg-gray-800 rounded-3xl animate-in fade-in zoom-in">
            <div className="flex items-center justify-between p-6 border-b dark:border-gray-700">
              <h3 className="text-xl font-black capitalize dark:text-white">
                {activeModal} {selectedAsset?.symbol.replace('USDT', '')}
              </h3>
              <button onClick={() => { setActiveModal(null); setSelectedAsset(null); }} className="p-2 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            
            <form className="p-6 space-y-4" onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const amount = parseFloat(formData.get('amount') as string);
              if (activeModal === 'sell') {
                handleAction('sell', { symbol: selectedAsset?.symbol, quantity: amount });
              } else if (activeModal === 'withdraw') {
                const bankName = formData.get('bankName') as string;
                const holderName = formData.get('holderName') as string;
                const accountNumber = formData.get('accountNumber') as string;
                const ifscCode = formData.get('ifscCode') as string;
                handleAction(activeModal, { amount, bankName, holderName, accountNumber, ifscCode });
              } else {
                handleAction(activeModal, { amount });
              }
            }}>
              <div>
                <label className="block mb-2 text-xs font-bold text-gray-400 uppercase">
                    {activeModal === 'sell' ? 'Quantity to Liquidate' : 'Amount (USD)'}
                </label>
                <div className="relative">
                    <input 
                        name="amount"
                        type="number" 
                        step="any"
                        required
                        autoFocus
                        className="w-full px-4 py-4 text-lg font-bold border-2 border-gray-100 rounded-2xl focus:border-indigo-500 focus:outline-none dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        placeholder="0.00"
                    />
                    {activeModal === 'sell' && (
                        <button 
                            type="button"
                            onClick={(e) => {
                                const input = (e.currentTarget.previousSibling as HTMLInputElement);
                                if(selectedAsset) input.value = selectedAsset.quantity.toString();
                            }}
                            className="absolute px-3 py-1 text-xs font-bold text-indigo-600 -translate-y-1/2 rounded-lg bg-indigo-50 right-4 top-1/2 hover:bg-indigo-100"
                        >
                            MAX
                        </button>
                    )}
                </div>
                {activeModal === 'sell' && (
                    <p className="mt-2 text-xs text-gray-500">Available: {selectedAsset?.quantity} {selectedAsset?.symbol.replace('USDT','')}</p>
                )}
              </div>

              {activeModal === 'withdraw' && (
                <>
                  <div>
                    <label className="block mb-2 text-xs font-bold text-gray-400 uppercase">Bank Name</label>
                    <input
                      name="bankName"
                      type="text"
                      required
                      className="w-full px-4 py-4 text-lg font-bold border-2 border-gray-100 rounded-2xl focus:border-indigo-500 focus:outline-none dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      placeholder="Enter bank name"
                    />
                  </div>

                  <div>
                    <label className="block mb-2 text-xs font-bold text-gray-400 uppercase">Account Holder Name</label>
                    <input
                      name="holderName"
                      type="text"
                      required
                      className="w-full px-4 py-4 text-lg font-bold border-2 border-gray-100 rounded-2xl focus:border-indigo-500 focus:outline-none dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      placeholder="Enter account holder name"
                    />
                  </div>

                  <div>
                    <label className="block mb-2 text-xs font-bold text-gray-400 uppercase">Account Number</label>
                    <input
                      name="accountNumber"
                      type="text"
                      required
                      className="w-full px-4 py-4 text-lg font-bold border-2 border-gray-100 rounded-2xl focus:border-indigo-500 focus:outline-none dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      placeholder="Enter account number"
                    />
                  </div>

                  <div>
                    <label className="block mb-2 text-xs font-bold text-gray-400 uppercase">IFSC Code</label>
                    <input
                      name="ifscCode"
                      type="text"
                      required
                      className="w-full px-4 py-4 text-lg font-bold border-2 border-gray-100 rounded-2xl focus:border-indigo-500 focus:outline-none dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      placeholder="Enter IFSC code"
                    />
                  </div>
                </>
              )}

              <button 
                disabled={formLoading}
                className="w-full py-4 font-black text-white transition-all bg-indigo-600 rounded-2xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {formLoading ? 'Processing...' : 'Confirm Transaction'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetsPage;