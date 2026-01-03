"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp, Lock, Unlock, Check, X, RefreshCw,
  Search, CheckSquare, Square, AlertTriangle
} from 'lucide-react';
import { useAuthFetch } from '../../lib/authFetch';

// Types
interface BinaryTrade {
  id: string;
  assetId: string | null;
  userId: string;
  username: string;
  symbol: string;
  quantity: number;
  entryPrice: number;
  amount: number;
  profitPercent: number;
  createdAt: string;
  status: string;
  resolvedAt: string | null;
  pnl: number | null;
  isResolved: boolean;
  canResolve: boolean;
  isBinary: boolean;
}

interface AssetLock {
  id: string;
  userId: string;
  username: string;
  symbol: string;
  quantity: number;
  locked: boolean;
  hasActiveTrades: boolean;
}

const TradesManagement: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'resolution' | 'assets'>('resolution');
  const [binaryTrades, setBinaryTrades] = useState<BinaryTrade[]>([]);
  const [assets, setAssets] = useState<AssetLock[]>([]);
  const [isLoadingTrades, setIsLoadingTrades] = useState(true);
  const [isLoadingAssets, setIsLoadingAssets] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedTrades, setSelectedTrades] = useState<Set<string>>(new Set());
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());

  const authFetch = useAuthFetch();

  // Fetch unresolved binary trades
  const fetchBinaryTrades = useCallback(async (forceRefresh = false) => {
    setIsLoadingTrades(true);
    if (forceRefresh) setRefreshing(true);

    try {
      const res = await authFetch('/api/admin/trades/binary?unresolved=true&_t=' + Date.now());

      if (res.ok && res.data?.trades) {
        setBinaryTrades(res.data.trades);
      } else {
        console.error('Failed to fetch binary trades');
      }
    } catch (error) {
      console.error('Error fetching binary trades:', error);
    } finally {
      setIsLoadingTrades(false);
      setRefreshing(false);
    }
  }, [authFetch]);

  // Fetch all assets for locking management
  const fetchAssets = useCallback(async (forceRefresh = false) => {
    setIsLoadingAssets(true);
    if (forceRefresh) setRefreshing(true);

    try {
      const res = await authFetch('/api/admin/assets/all?_t=' + Date.now());

      if (res.ok && res.data?.assets) {
        setAssets(res.data.assets);
      } else {
        console.error('Failed to fetch assets');
      }
    } catch (error) {
      console.error('Error fetching assets:', error);
    } finally {
      setIsLoadingAssets(false);
      setRefreshing(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (activeSubTab === 'resolution') {
      fetchBinaryTrades();
    } else {
      fetchAssets();
    }
  }, [activeSubTab, fetchBinaryTrades, fetchAssets]);

  // Real-time updates every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (activeSubTab === 'resolution') {
        fetchBinaryTrades();
      } else {
        fetchAssets();
      }
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [activeSubTab, fetchBinaryTrades, fetchAssets]);

  // Resolve individual trade
  const handleResolveTrade = async (assetId: string | null, userId: string, outcome: 'win' | 'loss') => {
    if (!assetId) {
      alert('Invalid trade');
      return;
    }

    if (!confirm(`Are you sure you want to approve this trade as ${outcome}?`)) return;

    try {
      const res = await authFetch('/api/admin/assets/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, assetId, outcome })
      });

      if (res.ok) {
        alert(`Trade approved as ${outcome}`);
        fetchBinaryTrades(true);
      } else {
        alert('Failed to approve trade');
      }
    } catch (error) {
      alert('Error resolving trade');
    }
  };

  // Bulk resolve selected trades
  const handleBulkResolve = async (outcome: 'win' | 'loss') => {
    if (selectedTrades.size === 0) {
      alert('No trades selected');
      return;
    }

    if (!confirm(`Approve ${selectedTrades.size} selected trades as ${outcome}?`)) return;

    let successCount = 0;
    for (const tradeId of selectedTrades) {
      const trade = binaryTrades.find(t => t.id === tradeId);
      if (trade) {
        try {
          const res = await authFetch('/api/admin/assets/resolve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: trade.userId, assetId: trade.assetId, outcome })
          });
          if (res.ok) successCount++;
        } catch (error) {
          console.error('Error resolving trade', tradeId, error);
        }
      }
    }

    alert(`Approved ${successCount}/${selectedTrades.size} trades`);
    setSelectedTrades(new Set());
    fetchBinaryTrades(true);
  };

  // Toggle asset lock
  const handleToggleLock = async (assetId: string, userId: string, currentlyLocked: boolean, hasActiveTrades: boolean) => {
    if (!currentlyLocked && hasActiveTrades) {
      if (!confirm('This asset has active trades. Locking it may affect ongoing transactions. Continue?')) return;
    }

    const newLocked = !currentlyLocked;
    let reason = '';
    if (newLocked) {
      reason = prompt('Enter reason for locking this asset:') || 'Admin lock';
    }

    try {
      const res = await authFetch('/api/admin/assets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, assetId, locked: newLocked, reason })
      });

      if (res.ok) {
        alert(`Asset ${newLocked ? 'locked' : 'unlocked'} successfully`);
        fetchAssets(true);
      } else {
        alert('Failed to update asset lock');
      }
    } catch (error) {
      alert('Error updating asset lock');
    }
  };

  // Bulk lock/unlock assets
  const handleBulkLock = async (lock: boolean) => {
    if (selectedAssets.size === 0) {
      alert('No assets selected');
      return;
    }

    const action = lock ? 'lock' : 'unlock';
    if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} ${selectedAssets.size} selected assets?`)) return;

    let reason = '';
    if (lock) {
      reason = prompt('Enter reason for bulk locking:') || 'Bulk admin lock';
    }

    let successCount = 0;
    for (const assetId of selectedAssets) {
      const asset = assets.find(a => a.id === assetId);
      if (asset && asset.locked !== lock) {
        try {
          const res = await authFetch('/api/admin/assets', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: asset.userId, assetId, locked: lock, reason })
          });
          if (res.ok) successCount++;
        } catch (error) {
          console.error('Error updating asset', assetId, error);
        }
      }
    }

    alert(`${successCount} assets ${action}ed successfully`);
    setSelectedAssets(new Set());
    fetchAssets(true);
  };

  const filteredTrades = binaryTrades.filter(trade =>
    trade.username.toLowerCase().includes(search.toLowerCase()) ||
    trade.symbol.toLowerCase().includes(search.toLowerCase())
  );

  const filteredAssets = assets.filter(asset =>
    asset.username.toLowerCase().includes(search.toLowerCase()) ||
    asset.symbol.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex bg-white dark:bg-gray-800 p-1.5 rounded-2xl shadow-xl border dark:border-gray-700">
        <button
          onClick={() => setActiveSubTab('resolution')}
          className={`px-8 py-3 rounded-xl text-xs font-black transition-all ${activeSubTab === 'resolution' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400'}`}
        >
          TRADE RESOLUTION
        </button>
        <button
          onClick={() => setActiveSubTab('assets')}
          className={`px-8 py-3 rounded-xl text-xs font-black transition-all ${activeSubTab === 'assets' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400'}`}
        >
          ASSET MANAGEMENT
        </button>
      </div>

      {/* Search and Refresh */}
      <div className="flex items-center gap-4">
        <div className="relative max-w-md group">
          <Search className="absolute text-gray-400 transition-colors -translate-y-1/2 left-5 top-1/2 group-focus-within:text-indigo-500" size={20} />
          <input
            type="text"
            placeholder={`Search ${activeSubTab === 'resolution' ? 'trades' : 'assets'}...`}
            className="w-full py-4 pr-6 text-sm font-bold bg-white border-none shadow-sm pl-14 dark:bg-gray-800 rounded-2xl focus:ring-4 ring-indigo-500/10 dark:text-white"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          onClick={() => activeSubTab === 'resolution' ? fetchBinaryTrades(true) : fetchAssets(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {activeSubTab === 'resolution' ? (
        <div className="space-y-4">
          {/* Bulk Actions */}
          {selectedTrades.size > 0 && (
            <div className="flex items-center gap-4 p-4 border border-indigo-200 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl dark:border-indigo-800">
              <span className="text-sm font-bold dark:text-white">{selectedTrades.size} trades selected</span>
              <button
                onClick={() => handleBulkResolve('win')}
                className="px-4 py-2 text-sm font-bold text-white bg-green-600 rounded-xl hover:bg-green-700"
              >
                Approve as Win
              </button>
              <button
                onClick={() => handleBulkResolve('loss')}
                className="px-4 py-2 text-sm font-bold text-white bg-red-600 rounded-xl hover:bg-red-700"
              >
                Approve as Loss
              </button>
            </div>
          )}

          {/* Trades Table */}
          <div className="overflow-x-auto bg-white border shadow-2xl dark:bg-gray-800 rounded-2xl dark:border-gray-700">
            <table className="w-full text-left min-w-[800px]">
              <thead className="border-b bg-gray-50/50 dark:bg-gray-900/50 dark:border-gray-700">
                <tr>
                  <th className="px-4 md:px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                    <button
                      onClick={() => {
                        if (selectedTrades.size === filteredTrades.length) {
                          setSelectedTrades(new Set());
                        } else {
                          setSelectedTrades(new Set(filteredTrades.map(t => t.id)));
                        }
                      }}
                      className="flex items-center gap-2"
                    >
                      {selectedTrades.size === filteredTrades.length && filteredTrades.length > 0 ? <CheckSquare size={20} className="md:w-4 md:h-4" /> : <Square size={20} className="md:w-4 md:h-4" />}
                      Select All
                    </button>
                  </th>
                  <th className="px-4 md:px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">User</th>
                  <th className="px-4 md:px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Trade Details</th>
                  <th className="px-4 md:px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Amount</th>
                  <th className="hidden px-4 md:px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] md:table-cell">Created</th>
                  <th className="px-4 md:px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-gray-700">
                {isLoadingTrades ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center">
                      <div className="w-8 h-8 mx-auto mb-2 border-4 border-indigo-500 rounded-full border-t-transparent animate-spin" />
                      <span className="text-sm font-bold dark:text-white">Loading trades...</span>
                    </td>
                  </tr>
                ) : filteredTrades.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                      No active binary trades found
                    </td>
                  </tr>
                ) : (
                  filteredTrades.map((trade) => (
                    <tr key={trade.id} className="transition-all hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10">
                      <td className="px-4 py-4 md:px-6">
                        <button
                          onClick={() => {
                            const newSelected = new Set(selectedTrades);
                            if (newSelected.has(trade.id)) {
                              newSelected.delete(trade.id);
                            } else {
                              newSelected.add(trade.id);
                            }
                            setSelectedTrades(newSelected);
                          }}
                          className="text-indigo-500"
                        >
                          {selectedTrades.has(trade.id) ? <CheckSquare size={20} className="md:w-4 md:h-4" /> : <Square size={20} className="md:w-4 md:h-4" />}
                        </button>
                      </td>
                      <td className="px-4 py-4 md:px-6">
                        <div className="font-black text-gray-900 dark:text-white">{trade.username}</div>
                        <div className="text-[10px] text-gray-500 font-bold uppercase">ID: {trade.userId.slice(-8)}</div>
                      </td>
                      <td className="px-4 py-4 md:px-6">
                        <div className="font-black dark:text-white">{trade.symbol}</div>
                        <div className="text-[10px] text-gray-500 font-bold">
                          {trade.quantity} @ ${trade.entryPrice.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-4 py-4 md:px-6">
                        <div className="font-black dark:text-white">${trade.amount.toLocaleString()}</div>
                        <div className="text-[10px] text-green-500 font-bold">+{trade.profitPercent}% payout</div>
                      </td>
                      <td className="hidden px-4 md:px-6 py-4 text-[10px] text-gray-500 font-bold md:table-cell">
                        {new Date(trade.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-4 space-x-2 text-right md:px-6">
                        {trade.canResolve ? (
                          <>
                            <button
                              onClick={() => handleResolveTrade(trade.assetId, trade.userId, 'win')}
                              className="px-4 py-2 text-sm font-bold text-white bg-green-600 rounded md:px-3 md:py-1 md:text-xs hover:bg-green-700"
                            >
                              Win
                            </button>
                            <button
                              onClick={() => handleResolveTrade(trade.assetId, trade.userId, 'loss')}
                              className="px-4 py-2 text-sm font-bold text-white bg-red-600 rounded md:px-3 md:py-1 md:text-xs hover:bg-red-700"
                            >
                              Loss
                            </button>
                          </>
                        ) : (
                          <span className="text-[10px] text-gray-400 font-bold">Resolved</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Bulk Actions */}
          {selectedAssets.size > 0 && (
            <div className="flex items-center gap-4 p-4 border border-indigo-200 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl dark:border-indigo-800">
              <span className="text-sm font-bold dark:text-white">{selectedAssets.size} assets selected</span>
              <button
                onClick={() => handleBulkLock(true)}
                className="px-4 py-2 text-sm font-bold text-white bg-orange-600 rounded-xl hover:bg-orange-700"
              >
                Lock Selected
              </button>
              <button
                onClick={() => handleBulkLock(false)}
                className="px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700"
              >
                Unlock Selected
              </button>
            </div>
          )}

          {/* Assets Table */}
          <div className="overflow-x-auto bg-white border shadow-2xl dark:bg-gray-800 rounded-2xl dark:border-gray-700">
            <table className="w-full text-left min-w-[800px]">
              <thead className="border-b bg-gray-50/50 dark:bg-gray-900/50 dark:border-gray-700">
                <tr>
                  <th className="px-4 md:px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                    <button
                      onClick={() => {
                        if (selectedAssets.size === filteredAssets.length) {
                          setSelectedAssets(new Set());
                        } else {
                          setSelectedAssets(new Set(filteredAssets.map(a => a.id)));
                        }
                      }}
                      className="flex items-center gap-2"
                    >
                      {selectedAssets.size === filteredAssets.length && filteredAssets.length > 0 ? <CheckSquare size={20} className="md:w-4 md:h-4" /> : <Square size={20} className="md:w-4 md:h-4" />}
                      Select All
                    </button>
                  </th>
                  <th className="px-4 md:px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">User</th>
                  <th className="px-4 md:px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Asset</th>
                  <th className="px-4 md:px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Status</th>
                  <th className="px-4 md:px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-gray-700">
                {isLoadingAssets ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center">
                      <div className="w-8 h-8 mx-auto mb-2 border-4 border-indigo-500 rounded-full border-t-transparent animate-spin" />
                      <span className="text-sm font-bold dark:text-white">Loading assets...</span>
                    </td>
                  </tr>
                ) : filteredAssets.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                      No assets found
                    </td>
                  </tr>
                ) : (
                  filteredAssets.map((asset) => (
                    <tr key={asset.id} className="transition-all hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10">
                      <td className="px-4 py-4 md:px-6">
                        <button
                          onClick={() => {
                            const newSelected = new Set(selectedAssets);
                            if (newSelected.has(asset.id)) {
                              newSelected.delete(asset.id);
                            } else {
                              newSelected.add(asset.id);
                            }
                            setSelectedAssets(newSelected);
                          }}
                          className="text-indigo-500"
                        >
                          {selectedAssets.has(asset.id) ? <CheckSquare size={20} className="md:w-4 md:h-4" /> : <Square size={20} className="md:w-4 md:h-4" />}
                        </button>
                      </td>
                      <td className="px-4 py-4 md:px-6">
                        <div className="font-black text-gray-900 dark:text-white">{asset.username}</div>
                        <div className="text-[10px] text-gray-500 font-bold uppercase">ID: {asset.userId.slice(-8)}</div>
                      </td>
                      <td className="px-4 py-4 md:px-6">
                        <div className="font-black dark:text-white">{asset.symbol.replace('USDT', '')}</div>
                        <div className="text-[10px] text-gray-500 font-bold">{asset.quantity.toLocaleString()} tokens</div>
                      </td>
                      <td className="px-4 py-4 md:px-6">
                        <div className={`inline-flex items-center gap-2 px-2 py-1 rounded text-xs font-bold ${asset.locked ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'}`}>
                          {asset.locked ? <Lock size={12} /> : <Unlock size={12} />}
                          {asset.locked ? 'Locked' : 'Unlocked'}
                        </div>
                        {asset.hasActiveTrades && (
                          <div className="flex items-center gap-1 mt-1 text-[10px] text-amber-600 font-bold">
                            <AlertTriangle size={10} />
                            Active trades
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right md:px-6">
                        <button
                          onClick={() => handleToggleLock(asset.id, asset.userId, asset.locked, asset.hasActiveTrades)}
                          className={`px-4 py-2 rounded text-sm font-bold md:px-3 md:py-1 md:text-xs ${asset.locked ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-orange-600 text-white hover:bg-orange-700'}`}
                        >
                          {asset.locked ? 'Unlock' : 'Lock'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default TradesManagement;