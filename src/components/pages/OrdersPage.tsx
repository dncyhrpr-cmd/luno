'use client';

import React, { useMemo, useCallback, useEffect, useState } from 'react';
import { Clock, CheckCircle, XCircle, Trash2, ArrowUpDown, Filter, DollarSign, Wallet, Shield, RefreshCw, TrendingUp, TrendingDown, Eye, AlertTriangle, History } from 'lucide-react';

type Portfolio = {
  balance: number;
  assets: Asset[];
  totalPortfolioValue: number;
};

type Order = {
   id: string;
   userId: string;
   type: 'BUY' | 'SELL';
   symbol: string;
   quantity: number;
   price: number;
   status: 'PENDING' | 'FILLED' | 'CANCELLED';
   executedQuantity: number;
   createdAt: any;
   orderType?: 'MARKET' | 'LIMIT';
   leverage?: number;
   pnl?: number;
};

type TransactionRequest = {
    id: string;
    userId: string;
    type: 'deposit' | 'withdraw';
    amount: number;
    status: 'pending' | 'approved' | 'rejected' | 'executed';
    reason?: string;
    createdAt: any;
    approvedAt?: any;
    approvedBy?: string;
    executedAt?: any;
    processedBy?: string;
};

type Asset = {
    id: string;
    userId: string;
    symbol: string;
    quantity: number;
    averagePrice: number;
    currentPrice?: number;
    createdAt: any;
};

type TransactionHistory = {
    id: string;
    userId: string;
    type: 'deposit' | 'withdraw' | 'buy' | 'sell' | 'fee' | 'seizure' | 'restoration';
    amount: number;
    symbol?: string;
    quantity?: number;
    price?: number;
    description: string;
    reason?: string;
    status: 'completed' | 'pending' | 'failed';
    balanceBefore: number;
    balanceAfter: number;
    createdAt: any;
};

type SortKey = keyof TransactionHistory | 'createdAt';

// Reusable Card component
const Card: React.FC<{ title?: string; children: React.ReactNode; className?: string; onRefresh?: () => void }> = ({ title, children, className = '', onRefresh }) => (
  <div className={`bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 ${className}`}>
    {title && (
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">{title}</h2>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="p-2 text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            title="Refresh data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}
      </div>
    )}
    {children}
  </div>
);

// Transaction Detail Modal Component
const TransactionDetailModal: React.FC<{ transaction: TransactionHistory | null; onClose: () => void }> = ({ transaction, onClose }) => {
  if (!transaction) return null;

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'buy': return <TrendingUp className="w-5 h-5 text-green-500" />;
      case 'sell': return <TrendingDown className="w-5 h-5 text-red-500" />;
      case 'deposit': return <DollarSign className="w-5 h-5 text-green-500" />;
      case 'withdraw': return <DollarSign className="w-5 h-5 text-red-500" />;
      case 'seizure': return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'restoration': return <Shield className="w-5 h-5 text-blue-500" />;
      default: return <History className="w-5 h-5 text-gray-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900 bg-opacity-75">
      <Card className="w-full max-w-md">
        <div className="flex items-center mb-4">
          {getTypeIcon(transaction.type)}
          <h3 className="ml-2 text-2xl font-bold capitalize dark:text-white">{transaction.type} Details</h3>
        </div>
        <ul className="space-y-3 text-gray-700 dark:text-gray-300">
          <DetailItem label="Type" value={transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)} />
          <DetailItem label="Amount" value={`$${transaction.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} />
          {transaction.symbol && <DetailItem label="Asset" value={transaction.symbol.replace('USDT', '')} />}
          {transaction.quantity && <DetailItem label="Quantity" value={transaction.quantity.toFixed(8)} />}
          {transaction.price && <DetailItem label="Price" value={`$${transaction.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} />}
          <DetailItem label="Status" value={transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)} highlight={
            transaction.status === 'completed' ? 'text-green-500' :
            transaction.status === 'pending' ? 'text-yellow-500' : 'text-red-500'
          } />
          <DetailItem label="Balance Before" value={`$${transaction.balanceBefore.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} />
          <DetailItem label="Balance After" value={`$${transaction.balanceAfter.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} />
          <DetailItem label="Date" value={new Date(transaction.createdAt?.seconds * 1000).toLocaleString()} />
          {transaction.reason && <DetailItem label="Reason" value={transaction.reason} />}
        </ul>
        <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">{transaction.description}</p>
        <button
          onClick={onClose}
          className="w-full py-2 mt-6 font-semibold text-white transition bg-indigo-600 rounded-lg hover:bg-indigo-700"
        >
          Close
        </button>
      </Card>
    </div>
  );
};

const DetailItem: React.FC<{ label: string; value: string; highlight?: string }> = ({ label, value, highlight = 'text-gray-900 dark:text-white' }) => (
  <li className="flex items-center justify-between pb-1 border-b border-gray-100 dark:border-gray-700">
    <span className="text-sm font-medium">{label}</span>
    <span className={`text-base font-semibold ${highlight}`}>{value}</span>
  </li>
);

// Portfolio Overview Component
const PortfolioOverview: React.FC<{ portfolio: Portfolio }> = ({ portfolio }) => (
  <div className="grid grid-cols-1 gap-6 mb-8 md:grid-cols-3">
    <Card>
      <div className="text-center">
        <Wallet className="w-8 h-8 mx-auto mb-2 text-indigo-600" />
        <div className="text-2xl font-bold text-gray-900 dark:text-white">
          ${portfolio.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">Available Balance</div>
      </div>
    </Card>
    <Card>
      <div className="text-center">
        <TrendingUp className="w-8 h-8 mx-auto mb-2 text-green-600" />
        <div className="text-2xl font-bold text-gray-900 dark:text-white">
          ${(portfolio.totalPortfolioValue - portfolio.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">Invested Value</div>
      </div>
    </Card>
    <Card>
      <div className="text-center">
        <DollarSign className="w-8 h-8 mx-auto mb-2 text-blue-600" />
        <div className="text-2xl font-bold text-gray-900 dark:text-white">
          ${portfolio.totalPortfolioValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">Total Portfolio</div>
      </div>
    </Card>
  </div>
);

// Transaction Item Component
const TransactionItem: React.FC<{ transaction: TransactionHistory; onViewDetails: (transaction: TransactionHistory) => void }> = ({ transaction, onViewDetails }) => {
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'buy': return 'text-green-500';
      case 'sell': return 'text-red-500';
      case 'deposit': return 'text-green-500';
      case 'withdraw': return 'text-red-500';
      case 'seizure': return 'text-red-600';
      case 'restoration': return 'text-blue-500';
      default: return 'text-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'pending': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div
      className="flex flex-col p-4 border-b border-gray-100 cursor-pointer md:grid md:grid-cols-5 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
      onClick={() => onViewDetails(transaction)}
    >
      <div className="mb-2 md:mb-0">
        <span className="font-medium">Type: </span>
        <span className={`font-bold capitalize ${getTypeColor(transaction.type)}`}>
          {transaction.type}
        </span>
      </div>
      <div className="mb-2 md:mb-0">
        <span className="font-medium">Asset: </span>
        <span className="text-gray-900 dark:text-white">
          {transaction.symbol ? transaction.symbol.replace('USDT', '') : '--'}
        </span>
      </div>
      <div className="mb-2 md:mb-0">
        <span className="font-medium">Amount: </span>
        <span className="text-gray-600 dark:text-gray-300">
          ${transaction.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </span>
      </div>
      <div className="flex items-center mb-2 md:mb-0">
        <span className="font-medium">Status: </span>
        {getStatusIcon(transaction.status)}
        <span className="ml-2 capitalize">{transaction.status}</span>
      </div>
      <div className="mb-2 md:mb-0">
        <span className="font-medium">Date: </span>
        <span className="text-sm text-gray-400">
          {new Date(transaction.createdAt?.seconds * 1000).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
};

// OrdersPage Component
const OrdersPage: React.FC = () => {
  const [activeSection, setActiveSection] = useState('overview');
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [requests, setRequests] = useState<TransactionRequest[]>([]);
  const [transactionHistory, setTransactionHistory] = useState<TransactionHistory[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'ascending' | 'descending' }>({ key: 'createdAt', direction: 'descending' });
  const [filterType, setFilterType] = useState('All');
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionHistory | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  const itemsPerPage = 10;

  const sections = [
    { key: 'overview', label: 'Portfolio Overview', icon: Wallet },
    { key: 'requests', label: 'Deposit/Withdraw Requests', icon: DollarSign },
    { key: 'history', label: 'Transaction History', icon: History },
    { key: 'orders', label: 'Trading Orders', icon: ArrowUpDown },
  ];

  // Fetch data from new unified API
  const fetchData = useCallback(async (userId?: string) => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        // Set empty data to show proper "not logged in" message
        setPortfolio(null);
        setOrders([]);
        setRequests([]);
        setTransactionHistory([]);
        setIsLoading(false);
        return;
      }

      const headers = { 'Authorization': `Bearer ${token}` };
      const url = userId ? `/api/portfolio-transactions?userId=${userId}` : '/api/portfolio-transactions';
      const response = await fetch(url, { headers });

      if (response.ok) {
        const data = await response.json();
        setPortfolio(data.portfolio);
        setOrders(data.orders || []);
        setRequests(data.requests || []);
        setTransactionHistory(data.transactionHistory || []);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [fetchData]);

  // Refresh when switching to orders section
  useEffect(() => {
    if (activeSection === 'orders') {
      fetchData();
    }
  }, [activeSection, fetchData]);

  // Get unique transaction types for filter
  const uniqueTypes = useMemo(() => {
    const types = new Set(transactionHistory.map(t => t.type));
    return ['All', ...Array.from(types)];
  }, [transactionHistory]);

  // Sorting logic
  const requestSort = (key: SortKey) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  // Filtered and sorted transactions
  const filteredAndSortedTransactions = useMemo(() => {
    let currentTransactions = transactionHistory;

    if (filterType !== 'All') {
      currentTransactions = currentTransactions.filter(t => t.type === filterType);
    }

    currentTransactions.sort((a, b) => {
      const aValue = a[sortConfig.key as keyof TransactionHistory] as any;
      const bValue = b[sortConfig.key as keyof TransactionHistory] as any;

      if (aValue < bValue) {
        return sortConfig.direction === 'ascending' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'ascending' ? 1 : -1;
      }
      return 0;
    });

    return currentTransactions;
  }, [transactionHistory, filterType, sortConfig]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedTransactions.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentTransactions = filteredAndSortedTransactions.slice(indexOfFirstItem, indexOfLastItem);

  const paginate = (pageNumber: number) => {
    if (pageNumber > 0 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen dark:bg-gray-900">
        <div className="w-32 h-32 border-b-4 border-indigo-600 rounded-full animate-spin"></div>
        <p className="ml-4 text-xl text-indigo-600 dark:text-indigo-400">Loading portfolio...</p>
      </div>
    );
  }

  // Check if user is not authenticated
  const isAuthenticated = !!localStorage.getItem('accessToken');
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen p-4 space-y-8 bg-gray-50 dark:bg-gray-900">
        <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white">Portfolio & Transactions</h1>
        <div className="flex items-center justify-center h-64">
          <Card className="w-full max-w-md text-center">
            <h2 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">Authentication Required</h2>
            <p className="mb-6 text-gray-600 dark:text-gray-400">
              Please log in to view your portfolio and transaction data.
            </p>
            <button
              onClick={() => window.location.href = '/login'}
              className="w-full px-4 py-2 text-white transition-colors bg-indigo-600 rounded-lg hover:bg-indigo-700"
            >
              Go to Login
            </button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 space-y-8 bg-gray-50 dark:bg-gray-900">
      <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white">Portfolio & Transactions</h1>

      {/* Section Navigation */}
      <div className="flex flex-col p-1 mb-4 bg-gray-100 sm:flex-row dark:bg-gray-700 rounded-xl">
        {sections.map(section => (
          <button
            key={section.key}
            onClick={() => { setActiveSection(section.key); setCurrentPage(1); }}
            className={`flex-1 py-3 text-sm font-medium rounded-lg transition-all duration-200 flex items-center justify-center ${
              activeSection === section.key
                ? 'bg-indigo-600 shadow text-white dark:bg-indigo-700 dark:text-white'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <section.icon className="w-4 h-4 mr-2" />
            {section.label}
            <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-gray-800 text-indigo-600 dark:text-indigo-400">
              {section.key === 'overview' ? (portfolio ? 1 : 0) :
               section.key === 'requests' ? requests.length :
               section.key === 'history' ? transactionHistory.length :
               orders.length}
            </span>
          </button>
        ))}
      </div>

      {/* Portfolio Overview */}
      {activeSection === 'overview' && portfolio && (
        <>
          <PortfolioOverview portfolio={portfolio} />
          <Card title="Current Assets" onRefresh={fetchData}>
            <div className="space-y-4">
              {portfolio.assets.length > 0 ? (
                portfolio.assets.map(asset => (
                  <div key={asset.id} className="p-4 border border-gray-200 rounded-lg dark:border-gray-700">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-gray-900 dark:text-white">{asset.symbol.replace('USDT', '')}</span>
                        <span className="ml-2 text-gray-600 dark:text-gray-300">
                          {asset.quantity.toFixed(8)} units
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-gray-900 dark:text-white">
                          ${(asset.quantity * asset.averagePrice).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          @ ${asset.averagePrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  No assets found.
                </div>
              )}
            </div>
          </Card>
        </>
      )}

      {/* Requests Section */}
      {activeSection === 'requests' && (
        <Card title="Deposit & Withdrawal Requests" onRefresh={fetchData}>
          <div className="space-y-4">
            {requests.length > 0 ? (
              requests.map(request => (
                <div key={request.id} className="p-4 border border-gray-200 rounded-lg dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className={`font-bold capitalize ${request.type === 'deposit' ? 'text-green-500' : 'text-red-500'}`}>
                        {request.type}
                      </span>
                      <span className="ml-2 text-gray-600 dark:text-gray-300">
                        ${request.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                      request.status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-400' :
                      request.status === 'approved' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-400' :
                      request.status === 'executed' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-400' :
                      'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-400'
                    }`}>
                      {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    {new Date(request.createdAt?.seconds * 1000).toLocaleString()}
                  </p>
                  {request.reason && (
                    <p className="mt-1 text-sm text-red-500 dark:text-red-400">
                      Reason: {request.reason}
                    </p>
                  )}
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                No requests found.
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Transaction History */}
      {activeSection === 'history' && (
        <Card title="Transaction History" onRefresh={fetchData}>
          <div className="flex items-center mb-4 space-x-4">
            <Filter className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            <select
              value={filterType}
              onChange={(e) => { setFilterType(e.target.value); setCurrentPage(1); }}
              className="p-2 border border-gray-300 rounded-lg dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              {uniqueTypes.map(type => (
                <option key={type} value={type}>{type === 'All' ? 'All Types' : type.charAt(0).toUpperCase() + type.slice(1)}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <div className="hidden p-4 text-xs font-semibold text-gray-500 uppercase border-b border-gray-200 md:grid md:grid-cols-5 dark:text-gray-400 dark:border-gray-700">
              <TableHeader onClick={() => requestSort('type')} label="Type" currentSort={sortConfig} sortKey='type' />
              <TableHeader onClick={() => requestSort('symbol')} label="Asset" currentSort={sortConfig} sortKey='symbol' />
              <TableHeader onClick={() => requestSort('amount')} label="Amount" currentSort={sortConfig} sortKey='amount' />
              <span>Status</span>
              <TableHeader onClick={() => requestSort('createdAt')} label="Date" currentSort={sortConfig} sortKey='createdAt' className='text-right' />
            </div>

            {currentTransactions.length > 0 ? (
              currentTransactions.map(transaction =>
                <TransactionItem
                  key={transaction.id}
                  transaction={transaction}
                  onViewDetails={setSelectedTransaction}
                />
              )
            ) : (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                No transactions found.
              </div>
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">Page {currentPage} of {totalPages}</p>
              <div className="flex space-x-2">
                <button
                  onClick={() => paginate(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-lg dark:border-gray-600 dark:bg-gray-700 dark:text-white disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => paginate(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-lg dark:border-gray-600 dark:bg-gray-700 dark:text-white disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Orders Section - Simplified */}
      {activeSection === 'orders' && (
        <Card title="Trading Orders" onRefresh={fetchData}>
          <div className="mb-4 text-center">
            <button
              onClick={() => fetchData()}
              className="flex items-center justify-center px-4 py-2 mx-auto text-white transition-colors bg-indigo-600 rounded-lg hover:bg-indigo-700"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh Orders
            </button>
          </div>
          <div className="space-y-4">
            {orders.length > 0 ? (
              orders.map(order => (
                <div key={order.id} className="p-4 border border-gray-200 rounded-lg dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className={`font-bold ${order.type === 'BUY' ? 'text-green-500' : 'text-red-500'}`}>
                        {order.type} {order.orderType}
                      </span>
                      <span className="ml-2 text-gray-600 dark:text-gray-300">
                        {order.quantity} {order.symbol} @ ${order.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                      order.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-400' :
                      order.status === 'FILLED' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-400' :
                      'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-400'
                    }`}>
                      {order.status}
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    {new Date(order.createdAt?.seconds * 1000).toLocaleString()}
                  </p>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                No orders found.
              </div>
            )}
          </div>
        </Card>
      )}

      <TransactionDetailModal transaction={selectedTransaction} onClose={() => setSelectedTransaction(null)} />
    </div>
  );
};

// Helper component for Sortable Table Headers
const TableHeader: React.FC<{ label: string; onClick: () => void; currentSort: { key: SortKey; direction: 'ascending' | 'descending' }; sortKey: SortKey; className?: string }> = ({ label, onClick, currentSort, sortKey, className = '' }) => (
  <button
    onClick={onClick}
    className={`flex items-center group ${className}`}
  >
    {label}
    <ArrowUpDown className={`w-3 h-3 ml-1 transition-opacity ${currentSort.key === sortKey ? 'opacity-100' : 'opacity-40 group-hover:opacity-70'}`} />
  </button>
);

export default OrdersPage;
