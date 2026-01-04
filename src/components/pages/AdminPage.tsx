"use client";

import React, { useState, useMemo, useEffect, useCallback, Suspense } from 'react';
import {
  Shield, Users, Activity, Ban, PlusCircle, MinusCircle,
  Search, Check, X, Trash2, Wallet, ArrowUpRight,
  History, PieChart, ShieldAlert, TrendingUp, DollarSign, RefreshCw, Star
} from 'lucide-react';
import ProtectedRoute from '../ProtectedRoute';
import { useAuthFetch } from '../../lib/authFetch';

// Lazy load admin components
const TransactionRequests = React.lazy(() => import('../admin/TransactionRequests'));
const ChatSupport = React.lazy(() => import('../admin/ChatSupport'));
const TradesManagement = React.lazy(() => import('../admin/TradesManagement'));

// --- Types ---
interface Asset {
  id: string;
  symbol: string;
  quantity: number;
  currentPrice: number;
  averagePrice: number;
  locked?: boolean;
}

interface ClientUser {
  id: string;
  name: string;
  email: string;
  balance: number;
  assets: Asset[];
  totalWithdrawn: number;
  totalDeposited: number;
  activeTrades: number;
  orders: any[]; // Active orders
  status: 'active' | 'inactive' | 'banned';
  joinedDate: string;
  clientScore: number | null;
}

// --- Component: Financial Profile Drawer ---
const ClientProfileDrawer: React.FC<{
  user: ClientUser;
  onClose: () => void;
  onSeize: (symbol: string) => void;
  onRestore: () => void;
  onCredit: () => void;
  onStatusChange: () => void;
  onResolve: (assetId: string, outcome: 'win' | 'loss') => void;
  onLock: (assetId: string, locked: boolean) => void;
  onSetScore: (userId: string) => void;
}> = ({ user, onClose, onSeize, onRestore, onCredit, onStatusChange, onResolve, onLock, onSetScore }) => {
  const activeOrders = user.orders || [];

  const totalCryptoValue = useMemo(() =>
    user.assets.reduce((sum, a) => sum + (a.quantity * a.currentPrice), 0)
  , [user]);

  const netWorth = user.balance + totalCryptoValue;

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-white dark:bg-[#0f1117] shadow-[0_0_50px_rgba(0,0,0,0.3)] z-[100] border-l dark:border-gray-800 animate-in slide-in-from-right duration-300 md:max-w-lg">
      <div className="flex flex-col h-full">
        {/* Profile Header */}
        <div className="flex items-center justify-between p-4 border-b md:p-8 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/20">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center text-xl font-black text-white bg-indigo-600 shadow-lg w-14 h-14 rounded-2xl shadow-indigo-500/20">
              {user.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight dark:text-white">{user.name}</h2>
              <p className="text-sm font-bold text-gray-400">{user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 transition-all rounded-full hover:bg-gray-200 dark:hover:bg-gray-800">
            <X size={24} className="text-gray-400" />
          </button>
        </div>

        <div className="flex-1 p-4 space-y-6 overflow-y-auto md:p-8 md:space-y-10 custom-scrollbar">
          {/* Net Worth Highlight */}
          <div className="relative overflow-hidden p-6 md:p-8 bg-indigo-600 rounded-[2rem] text-white shadow-xl shadow-indigo-500/20">
            <div className="relative z-10">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">Estimated Net Worth</p>
              <h3 className="mt-1 text-3xl font-black md:text-4xl">${netWorth.toLocaleString()}</h3>
            </div>
            <TrendingUp className="absolute w-24 h-24 md:w-32 md:h-32 -right-4 -bottom-4 opacity-10" />
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-3 gap-4">
            <div key="deposits" className="p-5 border bg-gray-50 dark:bg-gray-900 rounded-2xl dark:border-gray-800">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Deposits</p>
              <p className="text-lg font-black dark:text-white text-emerald-500">${user.totalDeposited.toLocaleString()}</p>
            </div>
            <div key="withdrawn" className="p-5 border bg-gray-50 dark:bg-gray-900 rounded-2xl dark:border-gray-800">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Withdrawn</p>
              <p className="text-lg font-black dark:text-white text-rose-500">${user.totalWithdrawn.toLocaleString()}</p>
            </div>
            <div key="score" className="p-5 border bg-gray-50 dark:bg-gray-900 rounded-2xl dark:border-gray-800">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Client Score</p>
              <p className="text-lg font-black text-blue-500 dark:text-white">{user.clientScore !== null ? user.clientScore : 'Not Rated'}</p>
            </div>
          </div>

          {/* Holdings Deep Dive */}
          <div>
            <h4 className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">
              <Wallet size={14} /> Live Portfolio
            </h4>
            <div className="space-y-3">
              <div key="cash" className="flex items-center justify-between p-5 border border-gray-200 border-dashed bg-gray-50 dark:bg-gray-800/50 rounded-2xl dark:border-gray-700">
                <span className="text-sm font-bold dark:text-white">USD Cash Balance</span>
                <span className="text-sm font-black text-indigo-500">${user.balance.toLocaleString()}</span>
              </div>

              {user.assets.map((asset) => {
                const isBinary = asset.symbol.startsWith('BINARY-');
                return (
                  <div key={asset.symbol + asset.quantity} className="flex flex-col p-4 transition-all bg-white border md:flex-row md:items-center md:justify-between md:p-5 dark:bg-gray-900 rounded-2xl dark:border-gray-800 hover:border-rose-500/50 group">
                    <div className="flex-1">
                      <p className="text-sm font-black text-gray-900 dark:text-white">{asset.symbol.replace('USDT','').replace('BINARY-','Binary ')}</p>
                      <p className="text-[10px] text-gray-500 font-bold">{asset.quantity.toLocaleString()} {isBinary ? 'Position' : 'Tokens'} @ ${asset.currentPrice.toLocaleString()}</p>
                      {asset.locked && <p className="text-[9px] text-orange-500 font-bold">LOCKED</p>}
                    </div>
                    <div className="flex items-center justify-between mt-2 md:mt-0">
                      <p className="text-sm font-black text-gray-900 dark:text-white">${(asset.quantity * asset.currentPrice).toLocaleString()}</p>
                      <div className="flex ml-4 space-x-1 md:space-x-2">
                        {isBinary ? (
                          <>
                            <button
                              onClick={() => onResolve(asset.id, 'win')}
                              className="text-[9px] font-black text-green-500 uppercase px-2 py-1 rounded"
                            >
                              Win
                            </button>
                            <button
                              onClick={() => onResolve(asset.id, 'loss')}
                              className="text-[9px] font-black text-red-500 uppercase px-2 py-1 rounded"
                            >
                              Loss
                            </button>
                            <button
                              onClick={() => onLock(asset.id, asset.locked || false)}
                              className="text-[9px] font-black text-blue-500 uppercase px-2 py-1 rounded"
                            >
                              {asset.locked ? 'Unlock' : 'Lock'}
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => onSeize(asset.symbol)}
                            className="text-[9px] font-black text-rose-500 uppercase px-2 py-1 rounded"
                          >
                            Seize
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Trades */}
          {activeOrders.length > 0 && (
            <div>
              <h4 className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">
                <Activity size={14} /> Active Trades
              </h4>
              <div className="space-y-3">
                {activeOrders.map((order) => (
                  <div key={order.id} className="p-5 bg-white border dark:bg-gray-900 rounded-2xl dark:border-gray-800">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-black text-gray-900 dark:text-white">{order.symbol}</span>
                      <span className={`px-2 py-1 text-xs font-black rounded ${order.type === 'buy' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                        {(order.type || 'unknown').toUpperCase()}
                      </span>
                    </div>
                    <div className="text-[10px] text-gray-500 font-bold">
                      Quantity: {order.quantity} | Price: ${order.price} | Status: {order.status}
                    </div>
                    {order.orderType && (
                      <div className="text-[10px] text-gray-500 font-bold">
                        Order Type: {order.orderType}
                      </div>
                    )}
                    {order.leverage && (
                      <div className="text-[10px] text-gray-500 font-bold">
                        Leverage: {order.leverage}x
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Admin Command Center */}
          <div className="space-y-3">
             <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Management Terminal</h4>
             <div className="grid grid-cols-2 gap-3">
                <button onClick={onCredit} className="flex items-center justify-center gap-2 py-4 text-xs font-black text-white transition-all shadow-lg bg-emerald-600 hover:bg-emerald-700 rounded-2xl shadow-emerald-500/20">
                  <PlusCircle size={16} /> CREDIT USD
                </button>
                <button onClick={onStatusChange} className="flex items-center justify-center gap-2 py-4 text-xs font-black text-white transition-all bg-gray-900 dark:bg-gray-700 rounded-2xl">
                  <Ban size={16} /> {user.status === 'active' ? 'BAN USER' : 'UNBAN USER'}
                </button>
             </div>
             <div className="grid grid-cols-2 gap-3">
               <button onClick={() => onSeize('ALL')} className="flex items-center justify-center gap-2 py-4 text-xs font-black transition-all border-2 border-rose-500 text-rose-500 hover:bg-rose-500 hover:text-white rounded-2xl">
                 <ShieldAlert size={16} /> SEIZE ALL
               </button>
               <button onClick={onRestore} className="flex items-center justify-center gap-2 py-4 text-xs font-black text-blue-500 transition-all border-2 border-blue-500 hover:bg-blue-500 hover:text-white rounded-2xl">
                 <PlusCircle size={16} /> RESTORE ASSET
               </button>
             </div>
          </div>
        </div>

        <div className="p-8 text-center border-t bg-gray-50 dark:bg-gray-900/50 dark:border-gray-800">
          <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Client Since {user.joinedDate}</p>
        </div>
      </div>
    </div>
  );
};

// --- Main Page ---
const AdminPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'users' | 'requests' | 'chats' | 'trades'>('users');
  const [selectedUser, setSelectedUser] = useState<ClientUser | null>(null);
  const [search, setSearch] = useState('');
  
  // State for real data
  const [users, setUsers] = useState<ClientUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [userError, setUserError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const authFetch = useAuthFetch();

  // Fetch users data
  const fetchUsers = useCallback(async (forceRefresh = false) => {
    setIsLoadingUsers(true);
    setUserError(null);
    if (forceRefresh) setRefreshing(true);

    try {
      const res = await authFetch(`/api/admin/users?includeDetails=true${forceRefresh ? '&noCache=true&_t=' + Date.now() : ''}`);

      if (res.ok && res.data?.users) {
        // Transform enriched users to ClientUser format
        const transformedUsers: ClientUser[] = res.data.users.map((user: any) => {
          const assets: Asset[] = (user.assets || []).map((asset: any) => ({
            id: asset.id,
            symbol: asset.symbol,
            quantity: asset.quantity,
            currentPrice: asset.averagePrice, // Using averagePrice as current for now
            averagePrice: asset.averagePrice,
            locked: asset.locked || false
          }));

          const totalDeposited = (user.transactionHistory || [])
            .filter((t: any) => t.type === 'deposit')
            .reduce((sum: number, t: any) => sum + t.amount, 0);

          const totalWithdrawn = (user.transactionHistory || [])
            .filter((t: any) => t.type === 'withdraw')
            .reduce((sum: number, t: any) => sum + t.amount, 0);

          const activeTrades = (user.orders || []).length;

          return {
            id: user.id,
            name: user.username,
            email: user.email,
            balance: user.balance || 0,
            assets,
            totalWithdrawn,
            totalDeposited,
            activeTrades,
            orders: user.orders || [],
            status: (user.status as 'active' | 'inactive' | 'banned') || 'active',
            joinedDate: user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            }).toUpperCase() : 'Unknown'
          };
        }).filter((u: any) => u.id);

        setUsers(transformedUsers);
      } else {
        setUserError(res.error || 'Failed to load users');
      }
    } catch (error) {
      setUserError('Connection error while loading users');
    } finally {
      setIsLoadingUsers(false);
      setRefreshing(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    }
  }, [activeTab, fetchUsers]);

  // Handler functions for drawer actions
  const handleStatusChange = async () => {
    if (!selectedUser) return;

    const newStatus = selectedUser.status === 'active' ? 'banned' : 'active';
    try {
      const res = await authFetch('/api/admin/users', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: selectedUser.id, status: newStatus })
      });

      if (res.ok) {
        // Update local state
        setUsers(users.map(u => u.id === selectedUser.id ? { ...u, status: newStatus } : u));
        setSelectedUser({ ...selectedUser, status: newStatus });
        alert(`User ${newStatus === 'banned' ? 'banned' : 'unbanned'} successfully`);
      } else {
        alert('Failed to update user status');
      }
    } catch (error) {
      alert('Error updating user status');
    }
  };

  const handleCreditUser = async () => {
    if (!selectedUser || !selectedUser.id) {
      alert('No user selected or user ID is missing');
      return;
    }

    const amountStr = prompt('Enter amount to credit (positive) or debit (negative):');
    if (!amountStr || isNaN(Number(amountStr))) return;

    const amount = Number(amountStr);
    if (amount === 0) {
      alert('Amount must be non-zero');
      return;
    }
    const reason = prompt('Enter reason for balance adjustment:') || 'Admin adjustment';

    try {
      const res = await authFetch('/api/admin/balance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: selectedUser.id, amount, reason })
      });

      if (res.ok) {
        alert(`Balance ${amount > 0 ? 'credited' : 'debited'} successfully`);
        fetchUsers(); // Refresh user data
        setSelectedUser(null); // Close drawer
      } else {
        alert(res.error || 'Failed to update balance');
      }
    } catch (error) {
      alert('Error updating balance');
    }
  };

  const handleSeizeAsset = async (symbol: string) => {
    if (!selectedUser) return;

    if (!confirm(`Are you sure you want to seize ${symbol} from ${selectedUser.name}?`)) return;

    try {
      const res = await authFetch('/api/admin/assets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: selectedUser.id, symbol })
      });

      if (res.ok) {
        alert(`Successfully seized ${symbol} from ${selectedUser.name}`);
        fetchUsers(); // Refresh user data
        setSelectedUser(null); // Close drawer
      } else {
        alert(res.error || 'Failed to seize asset');
      }
    } catch (error) {
      alert('Error seizing asset');
    }
  };

  const handleRestoreAsset = async () => {
    if (!selectedUser) return;

    const symbol = prompt('Enter asset symbol to restore (e.g., BTCUSDT):');
    if (!symbol) return;

    const quantityStr = prompt('Enter quantity to restore:');
    if (!quantityStr || isNaN(Number(quantityStr))) return;
    const quantity = Number(quantityStr);

    const priceStr = prompt('Enter price per unit:');
    if (!priceStr || isNaN(Number(priceStr))) return;
    const price = Number(priceStr);

    if (!confirm(`Are you sure you want to restore ${quantity} ${symbol} to ${selectedUser.name}?`)) return;

    try {
      const res = await authFetch('/api/admin/assets', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: selectedUser.id, symbol, quantity, price })
      });

      if (res.ok) {
        alert(`Successfully restored ${quantity} ${symbol} to ${selectedUser.name}`);
        fetchUsers(); // Refresh user data
        setSelectedUser(null); // Close drawer
      } else {
        alert(res.error || 'Failed to restore asset');
      }
    } catch (error) {
      alert('Error restoring asset');
    }
  };

  const handleResolveAsset = async (assetId: string, outcome: 'win' | 'loss') => {
    if (!selectedUser) return;

    if (!confirm(`Are you sure you want to resolve this binary asset as ${outcome}?`)) return;

    try {
      const res = await authFetch('/api/admin/assets/resolve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: selectedUser.id, assetId, outcome })
      });

      if (res.ok) {
        alert(`Successfully resolved binary asset as ${outcome}`);
        fetchUsers(); // Refresh user data
        setSelectedUser(null); // Close drawer
      } else {
        alert(res.error || 'Failed to resolve asset');
      }
    } catch (error) {
      alert('Error resolving asset');
    }
  };

  const handleBulkResolve = async (outcome: 'win' | 'loss' | 'randomize') => {
    if (!selectedUser) return;

    const binaryAssets = selectedUser.assets.filter(a => a.symbol.startsWith('BINARY-'));
    if (binaryAssets.length === 0) {
      alert('No binary assets to resolve');
      return;
    }

    if (!confirm(`Are you sure you want to resolve all ${binaryAssets.length} binary assets as ${outcome}?`)) return;

    let successCount = 0;
    for (const asset of binaryAssets) {
      const resOutcome = outcome === 'randomize' ? (Math.random() < 0.5 ? 'win' : 'loss') : outcome;
      try {
        const res = await authFetch('/api/admin/assets/resolve', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId: selectedUser.id, assetId: asset.id, outcome: resOutcome })
        });
        if (res.ok) successCount++;
      } catch (error) {
        console.error('Error resolving asset', asset.id, error);
      }
    }

    alert(`Successfully resolved ${successCount}/${binaryAssets.length} binary assets`);
    fetchUsers(); // Refresh user data
    setSelectedUser(null); // Close drawer
  };

  const handleLockAsset = async (assetId: string, locked: boolean) => {
    if (!selectedUser) return;

    const newLocked = !locked;
    if (!confirm(`Are you sure you want to ${newLocked ? 'lock' : 'unlock'} this asset?`)) return;

    let reason = '';
    if (newLocked) {
      reason = prompt('Enter reason for locking this asset:') || 'Admin lock';
    }

    try {
      const res = await authFetch('/api/admin/assets', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: selectedUser.id, assetId, locked: newLocked, reason })
      });

      if (res.ok) {
        alert(`Successfully ${newLocked ? 'locked' : 'unlocked'} asset`);
        fetchUsers(); // Refresh user data
        setSelectedUser(null); // Close drawer
      } else {
        alert(res.error || 'Failed to lock/unlock asset');
      }
    } catch (error) {
      alert('Error locking/unlocking asset');
    }
  };

  const handleSetScore = async (userId: string) => {
    const scoreInput = prompt('Enter client score (0-100):');
    if (scoreInput === null) return;
    const score = parseInt(scoreInput);
    if (isNaN(score) || score < 0 || score > 100) {
      alert('Invalid score. Must be a number between 0 and 100.');
      return;
    }

    try {
      const res = await authFetch('/api/admin/users', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, score })
      });

      if (res.ok) {
        // Update local state
        setUsers(users.map(u => u.id === userId ? { ...u, clientScore: score } : u));
        if (selectedUser && selectedUser.id === userId) {
          setSelectedUser({ ...selectedUser, clientScore: score });
        }
        alert(`Client score set to ${score}`);
      } else {
        alert('Failed to update client score');
      }
    } catch (error) {
      alert('Error updating client score');
    }
  };

  return (
    <ProtectedRoute requiredRole="admin">
      <div className="min-h-screen bg-[#f8f9fc] dark:bg-[#0a0c10] p-6 md:p-12">

        {/* Dashboard Header */}
        <header className="flex flex-col justify-between gap-8 mx-auto mb-16 max-w-7xl md:flex-row md:items-center">
          <div className="flex items-center gap-6">
            <div className="p-5 bg-indigo-600 rounded-[1.8rem] shadow-2xl shadow-indigo-500/40 text-white">
              <ShieldAlert size={36} />
            </div>
            <div>
              <h1 className="text-4xl italic font-black tracking-tighter text-gray-900 uppercase dark:text-white">Control Console</h1>
              <p className="flex items-center gap-2 mt-1 text-xs font-bold tracking-widest text-gray-400 uppercase">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Live Governance Active
              </p>
            </div>
          </div>

          <div className="flex flex-wrap bg-white dark:bg-gray-800 p-1.5 rounded-2xl shadow-xl border dark:border-gray-700 gap-2 md:gap-0">
            <button onClick={() => setActiveTab('users')} className={`px-4 md:px-8 py-3 rounded-xl text-xs font-black transition-all flex-1 md:flex-none ${activeTab === 'users' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400'}`}>USER REGISTRY</button>
            <button onClick={() => setActiveTab('requests')} className={`px-4 md:px-8 py-3 rounded-xl text-xs font-black transition-all flex-1 md:flex-none ${activeTab === 'requests' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400'}`}>PENDING TASKS</button>
            <button onClick={() => setActiveTab('trades')} className={`px-4 md:px-8 py-3 rounded-xl text-xs font-black transition-all flex-1 md:flex-none ${activeTab === 'trades' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400'}`}>TRADES</button>
            <button onClick={() => setActiveTab('chats')} className={`px-4 md:px-8 py-3 rounded-xl text-xs font-black transition-all flex-1 md:flex-none ${activeTab === 'chats' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400'}`}>SUPPORT CHATS</button>
          </div>
        </header>

        <main className="mx-auto max-w-7xl">
          {activeTab === 'users' ? (
            <div className="space-y-6 duration-700 animate-in fade-in">
              {/* Filter Bar */}
              <div className="flex flex-col items-stretch gap-4 md:flex-row md:items-center">
                <div className="relative flex-1 md:max-w-md group">
                  <Search className="absolute text-gray-400 transition-colors -translate-y-1/2 left-5 top-1/2 group-focus-within:text-indigo-500" size={20} />
                  <input
                    type="text"
                    placeholder="Search clients by name, email, or ID..."
                    className="w-full pl-14 pr-6 py-4 md:py-5 bg-white dark:bg-gray-800 border-none rounded-[1.5rem] shadow-sm focus:ring-4 ring-indigo-500/10 text-sm font-bold dark:text-white"
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <button
                  onClick={() => fetchUsers(true)}
                  disabled={refreshing}
                  className="flex items-center justify-center gap-2 px-4 py-3 text-white bg-indigo-600 md:py-2 rounded-xl hover:bg-indigo-700 disabled:opacity-50"
                >
                  <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                  Refresh
                </button>
              </div>

              {/* Loading State */}
              {isLoadingUsers && (
                <div className="flex items-center justify-center py-20">
                  <div className="w-12 h-12 border-4 border-indigo-500 rounded-full border-t-transparent animate-spin" />
                  <span className="ml-4 text-lg font-bold dark:text-white">Loading users...</span>
                </div>
              )}

              {/* Error State */}
              {userError && (
                <div className="p-8 text-center border border-red-200 bg-red-50 dark:bg-red-900/20 rounded-2xl dark:border-red-800">
                  <p className="font-bold text-red-600 dark:text-red-400">{userError}</p>
                  <button
                    onClick={() => fetchUsers(true)}
                    className="px-6 py-2 mt-4 font-bold text-white bg-red-600 rounded-xl hover:bg-red-700"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* User Table */}
              {!isLoadingUsers && !userError && (
                <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-2xl overflow-hidden border dark:border-gray-700 overflow-x-auto">
                  <table className="w-full text-left min-w-[800px]">
                    <thead className="border-b bg-gray-50/50 dark:bg-gray-900/50 dark:border-gray-700">
                      <tr>
                        <th className="px-4 md:px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Client Information</th>
                        <th className="px-4 md:px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Liquid Balance</th>
                        <th className="px-4 md:px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Active Trades</th>
                        <th className="px-4 md:px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Client Score</th>
                        <th className="px-4 md:px-8 py-5 text-right text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-gray-700">
                      {users
                        .filter(user =>
                          user.name.toLowerCase().includes(search.toLowerCase()) ||
                          user.email.toLowerCase().includes(search.toLowerCase()) ||
                          user.id.toLowerCase().includes(search.toLowerCase())
                        )
                        .map(user => (
                        <tr key={user.id} className="transition-all cursor-pointer hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 group" onClick={() => setSelectedUser(user)}>
                          <td className="px-4 py-6 md:px-8">
                            <div className="flex items-center gap-4">
                              <div className="flex items-center justify-center w-10 h-10 text-xs font-black text-gray-500 transition-all bg-gray-100 rounded-xl dark:bg-gray-700 group-hover:bg-indigo-600 group-hover:text-white">
                                {user.name.charAt(0)}
                              </div>
                              <div>
                                <div className="font-black text-gray-900 dark:text-white">{user.name}</div>
                                <div className="text-[10px] text-gray-500 font-bold uppercase">{user.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-6 md:px-8">
                            <div className="flex items-center gap-2">
                               <DollarSign size={14} className="text-emerald-500" />
                               <span className="font-black text-gray-900 dark:text-white">${user.balance.toLocaleString()}</span>
                            </div>
                          </td>
                          <td className="px-4 py-6 md:px-8">
                            <div className="flex items-center gap-2">
                               <span className="font-black text-gray-900 dark:text-white">{user.activeTrades}</span>
                            </div>
                          </td>
                          <td className="px-4 py-6 md:px-8">
                            <div className="flex -space-x-2">
                              {user.assets.slice(0, 3).map((a, index) => (
                                <div key={a.symbol} className="w-8 h-8 rounded-full border-2 border-white dark:border-gray-800 bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-[8px] font-black">
                                  {a.symbol.replace('USDT','')}
                                </div>
                              ))}
                              {user.assets.length > 3 && (
                                 <div key="more" className="w-8 h-8 rounded-full border-2 border-white bg-indigo-500 text-white flex items-center justify-center text-[8px] font-black">
                                   +{user.assets.length - 3}
                                 </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-6 text-right md:px-8">
                            <button
                              onClick={() => handleSetScore(user.id)}
                              className="px-4 md:px-6 py-2.5 bg-blue-100 dark:bg-blue-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all mb-2"
                            >
                              Set Score
                            </button>
                            <button className="px-4 md:px-6 py-2.5 bg-gray-100 dark:bg-gray-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all">
                              Manage Profile
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : activeTab === 'trades' ? (
            <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="w-12 h-12 border-4 border-indigo-500 rounded-full border-t-transparent animate-spin" /><span className="ml-4 text-lg font-bold dark:text-white">Loading...</span></div>}>
              <TradesManagement />
            </Suspense>
          ) : activeTab === 'chats' ? (
            <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="w-12 h-12 border-4 border-indigo-500 rounded-full border-t-transparent animate-spin" /><span className="ml-4 text-lg font-bold dark:text-white">Loading...</span></div>}>
              <ChatSupport />
            </Suspense>
          ) : (
            <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="w-12 h-12 border-4 border-indigo-500 rounded-full border-t-transparent animate-spin" /><span className="ml-4 text-lg font-bold dark:text-white">Loading...</span></div>}>
              <TransactionRequests />
            </Suspense>
          )}
        </main>

        {/* --- Floating Client Drawer --- */}
        {selectedUser && (
          <>
            <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[90]" onClick={() => setSelectedUser(null)} />
            <ClientProfileDrawer
              user={selectedUser}
              onClose={() => setSelectedUser(null)}
              onSeize={handleSeizeAsset}
              onRestore={handleRestoreAsset}
              onCredit={handleCreditUser}
              onStatusChange={handleStatusChange}
              onResolve={handleResolveAsset}
              onLock={handleLockAsset}
              onSetScore={handleSetScore}
            />
          </>
        )}
      </div>
    </ProtectedRoute>
  );
};

export default AdminPage;