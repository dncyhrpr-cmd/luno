"use client";

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Shield, Users, Activity, Ban, PlusCircle, MinusCircle,
  Search, Check, X, Trash2, Wallet, ArrowUpRight,
  History, PieChart, ShieldAlert, TrendingUp, DollarSign
} from 'lucide-react';
import ProtectedRoute from '../ProtectedRoute';
import TransactionRequests from '../admin/TransactionRequests';
import ChatSupport from '../admin/ChatSupport';
import { safeFetch } from '../../lib/safeFetch';
import { User as FirestoreUser } from '../../lib/firestore-db';

// --- Types ---
interface Asset {
  symbol: string;
  quantity: number;
  currentPrice: number;
  averagePrice: number;
}

interface ClientUser {
  id: string;
  name: string;
  email: string;
  balance: number;
  assets: Asset[];
  totalWithdrawn: number;
  totalDeposited: number;
  status: 'active' | 'inactive' | 'banned';
  joinedDate: string;
}

// --- Component: Financial Profile Drawer ---
const ClientProfileDrawer: React.FC<{
  user: ClientUser;
  onClose: () => void;
  onSeize: (symbol: string) => void;
  onRestore: () => void;
  onCredit: () => void;
  onStatusChange: () => void;
}> = ({ user, onClose, onSeize, onRestore, onCredit, onStatusChange }) => {

  const totalCryptoValue = useMemo(() =>
    user.assets.reduce((sum, a) => sum + (a.quantity * a.currentPrice), 0)
  , [user]);

  const netWorth = user.balance + totalCryptoValue;

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-white dark:bg-[#0f1117] shadow-[0_0_50px_rgba(0,0,0,0.3)] z-[100] border-l dark:border-gray-800 animate-in slide-in-from-right duration-300">
      <div className="flex flex-col h-full">
        {/* Profile Header */}
        <div className="flex items-center justify-between p-8 border-b dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/20">
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

        <div className="flex-1 p-8 space-y-10 overflow-y-auto custom-scrollbar">
          {/* Net Worth Highlight */}
          <div className="relative overflow-hidden p-8 bg-indigo-600 rounded-[2rem] text-white shadow-xl shadow-indigo-500/20">
            <div className="relative z-10">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">Estimated Net Worth</p>
              <h3 className="mt-1 text-4xl font-black">${netWorth.toLocaleString()}</h3>
            </div>
            <TrendingUp className="absolute w-32 h-32 -right-4 -bottom-4 opacity-10" />
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div key="deposits" className="p-5 border bg-gray-50 dark:bg-gray-900 rounded-2xl dark:border-gray-800">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Deposits</p>
              <p className="text-lg font-black dark:text-white text-emerald-500">${user.totalDeposited.toLocaleString()}</p>
            </div>
            <div key="withdrawn" className="p-5 border bg-gray-50 dark:bg-gray-900 rounded-2xl dark:border-gray-800">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Withdrawn</p>
              <p className="text-lg font-black dark:text-white text-rose-500">${user.totalWithdrawn.toLocaleString()}</p>
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

              {user.assets.map((asset) => (
                <div key={asset.symbol + asset.quantity} className="flex items-center justify-between p-5 transition-all bg-white border dark:bg-gray-900 rounded-2xl dark:border-gray-800 hover:border-rose-500/50 group">
                  <div>
                    <p className="text-sm font-black dark:text-white">{asset.symbol.replace('USDT','')}</p>
                    <p className="text-[10px] text-gray-500 font-bold">{asset.quantity.toLocaleString()} Tokens @ ${asset.currentPrice.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black dark:text-white">${(asset.quantity * asset.currentPrice).toLocaleString()}</p>
                    <button
                      onClick={() => onSeize(asset.symbol)}
                      className="text-[9px] font-black text-rose-500 uppercase opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      Seize Asset
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

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
  const [activeTab, setActiveTab] = useState<'users' | 'requests' | 'chats'>('users');
  const [selectedUser, setSelectedUser] = useState<ClientUser | null>(null);
  const [search, setSearch] = useState('');

  // Fetch users data
  const fetchUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    setUserError(null);

    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setUserError('No authentication token found');
        return;
      }

      const res = await safeFetch('/api/admin/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok && res.data?.users) {
        // Transform Firestore users to ClientUser format
        const transformedUsers: ClientUser[] = (await Promise.all(
          res.data.users.map(async (user: FirestoreUser) => {
            // Fetch assets for this user
            const assetsRes = await safeFetch(`/api/portfolio?userId=${user.id}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });

            let assets: Asset[] = [];
            if (assetsRes.ok && assetsRes.data?.assets) {
              assets = assetsRes.data.assets.map((asset: any) => ({
                symbol: asset.symbol,
                quantity: asset.quantity,
                currentPrice: asset.averagePrice, // Using averagePrice as current for now
                averagePrice: asset.averagePrice
              }));
            }

            // Fetch transaction history to calculate totals
            const historyRes = await safeFetch(`/api/activity-log?userId=${user.id}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });

            let totalDeposited = 0;
            let totalWithdrawn = 0;
            if (historyRes.ok && historyRes.data?.logs) {
              historyRes.data.logs.forEach((log: any) => {
                if (log.type === 'deposit' && log.status === 'completed') {
                  totalDeposited += log.amount || 0;
                } else if (log.type === 'withdraw' && log.status === 'completed') {
                  totalWithdrawn += log.amount || 0;
                }
              });
            }

            return {
              id: user.id,
              name: user.username,
              email: user.email,
              balance: user.balance || 0,
              assets,
              totalWithdrawn,
              totalDeposited,
              status: (user.status as 'active' | 'inactive' | 'banned') || 'active',
              joinedDate: user.createdAt ? new Date((user.createdAt as any).seconds * 1000).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              }).toUpperCase() : 'Unknown'
            };
          })
        )).filter(u => u.id);

        setUsers(transformedUsers);
      } else {
        setUserError(res.error || 'Failed to load users');
      }
    } catch (error) {
      setUserError('Connection error while loading users');
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

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
      const token = localStorage.getItem('accessToken');
      const res = await safeFetch('/api/admin/users', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
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
      const token = localStorage.getItem('accessToken');
      const res = await safeFetch('/api/admin/balance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
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
      const token = localStorage.getItem('accessToken');
      const res = await safeFetch('/api/admin/assets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
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
      const token = localStorage.getItem('accessToken');
      const res = await safeFetch('/api/admin/assets', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
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

  // State for real data
  const [users, setUsers] = useState<ClientUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [userError, setUserError] = useState<string | null>(null);

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

          <div className="flex bg-white dark:bg-gray-800 p-1.5 rounded-2xl shadow-xl border dark:border-gray-700">
            <button onClick={() => setActiveTab('users')} className={`px-8 py-3 rounded-xl text-xs font-black transition-all ${activeTab === 'users' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400'}`}>USER REGISTRY</button>
            <button onClick={() => setActiveTab('requests')} className={`px-8 py-3 rounded-xl text-xs font-black transition-all ${activeTab === 'requests' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400'}`}>PENDING TASKS</button>
            <button onClick={() => setActiveTab('chats')} className={`px-8 py-3 rounded-xl text-xs font-black transition-all ${activeTab === 'chats' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400'}`}>SUPPORT CHATS</button>
          </div>
        </header>

        <main className="mx-auto max-w-7xl">
          {activeTab === 'users' ? (
            <div className="space-y-6 duration-700 animate-in fade-in">
              {/* Filter Bar */}
              <div className="relative max-w-md group">
                <Search className="absolute text-gray-400 transition-colors -translate-y-1/2 left-5 top-1/2 group-focus-within:text-indigo-500" size={20} />
                <input
                  type="text"
                  placeholder="Search clients by name, email, or ID..."
                  className="w-full pl-14 pr-6 py-5 bg-white dark:bg-gray-800 border-none rounded-[1.5rem] shadow-sm focus:ring-4 ring-indigo-500/10 text-sm font-bold dark:text-white"
                  onChange={(e) => setSearch(e.target.value)}
                />
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
                    onClick={fetchUsers}
                    className="px-6 py-2 mt-4 font-bold text-white bg-red-600 rounded-xl hover:bg-red-700"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* User Table */}
              {!isLoadingUsers && !userError && (
                <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-2xl overflow-hidden border dark:border-gray-700">
                  <table className="w-full text-left">
                    <thead className="border-b bg-gray-50/50 dark:bg-gray-900/50 dark:border-gray-700">
                      <tr>
                        <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Client Information</th>
                        <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Liquid Balance</th>
                        <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Exposure</th>
                        <th className="px-8 py-5 text-right text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Action</th>
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
                          <td className="px-8 py-6">
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
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-2">
                               <DollarSign size={14} className="text-emerald-500" />
                               <span className="font-black text-gray-900 dark:text-white">${user.balance.toLocaleString()}</span>
                            </div>
                          </td>
                          <td className="px-8 py-6">
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
                          <td className="px-8 py-6 text-right">
                            <button className="px-6 py-2.5 bg-gray-100 dark:bg-gray-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all">
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
          ) : activeTab === 'chats' ? (
            <ChatSupport />
          ) : (
            <TransactionRequests />
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
            />
          </>
        )}
      </div>
    </ProtectedRoute>
  );
};

export default AdminPage;