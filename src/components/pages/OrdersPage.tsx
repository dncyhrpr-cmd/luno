'use client';

import React, { useMemo, useCallback, useEffect, useState } from 'react';
import { Clock, CheckCircle, XCircle, Trash2, ArrowUpDown, Filter } from 'lucide-react';

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

type SortKey = keyof Order | 'pnl' | 'createdAt';

// Reusable Card component
const Card: React.FC<{ title?: string; children: React.ReactNode; className?: string }> = ({ title, children, className = '' }) => (
  <div className={`bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 ${className}`}>
    {title && <h2 className="mb-4 text-xl font-semibold text-gray-800 dark:text-gray-100">{title}</h2>}
    {children}
  </div>
);

// Order Detail Modal Component
const OrderDetailModal: React.FC<{ order: Order | null; onClose: () => void }> = ({ order, onClose }) => {
  if (!order) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900 bg-opacity-75">
      <Card className="w-full max-w-md duration-300 animate-in slide-in-from-bottom-2">
        <h3 className="mb-4 text-2xl font-bold dark:text-white">Order #{order.id} Details</h3>
        <ul className="space-y-3 text-gray-700 dark:text-gray-300">
          <DetailItem label="Asset" value={order.symbol} highlight={order.type === 'BUY' ? 'text-green-500' : 'text-red-500'} />
          <DetailItem label="Side" value={order.type} highlight={order.type === 'BUY' ? 'text-green-500' : 'text-red-500'} />
          <DetailItem label="Order Type" value={order.orderType || 'MARKET'} />
          <DetailItem label="Amount" value={`${order.quantity} ${order.symbol}`} />
          <DetailItem label="Execution Price" value={`$${order.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} />
          <DetailItem label="Leverage" value={`${order.leverage || 1}x`} />
          <DetailItem label="Status" value={order.status} highlight={order.status === 'PENDING' ? 'text-yellow-500' : order.status === 'FILLED' ? 'text-green-500' : 'text-red-500'} />
          <DetailItem label="Date" value={new Date(order.createdAt?.seconds * 1000).toLocaleString()} />
          {order.status === 'FILLED' && (
            <DetailItem 
              label="P&L (USD)" 
              value={`${order.pnl! > 0 ? '+' : ''}${order.pnl!.toFixed(2)}`} 
              highlight={order.pnl! > 0 ? 'text-green-500 font-bold' : order.pnl! < 0 ? 'text-red-500 font-bold' : 'font-bold'}
            />
          )}
        </ul>
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

// OrderItem Component
const OrderItem: React.FC<{ order: Order; onCancel: (id: string) => void; onViewDetails: (order: Order) => void }> = ({ order, onCancel, onViewDetails }) => {
  const isBuy = order.type === 'BUY';
  let statusIcon: React.ElementType, statusColor: string, pnlColor: string = 'text-gray-400';

  switch (order.status) {
    case 'PENDING':
      statusIcon = Clock;
      statusColor = 'text-yellow-500 bg-yellow-100 dark:bg-yellow-900/50';
      break;
    case 'FILLED':
      statusIcon = CheckCircle;
      statusColor = 'text-green-500 bg-green-100 dark:bg-green-900/50';
      if (order.pnl !== undefined) {
        pnlColor = order.pnl > 0 ? 'text-green-500' : order.pnl < 0 ? 'text-red-500' : 'text-gray-400';
      } else {
        pnlColor = 'text-gray-400';
      }
      break;
    case 'CANCELLED':
      statusIcon = XCircle;
      statusColor = 'text-red-500 bg-red-100 dark:bg-red-900/50';
      break;
    default:
      statusIcon = Clock;
      statusColor = 'text-gray-500 bg-gray-100 dark:bg-gray-700';
  }

  return (
    <div 
      className="grid items-center grid-cols-6 p-4 border-b border-gray-100 cursor-pointer dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
      onClick={() => onViewDetails(order)}
    >
      <div className={`font-bold ${isBuy ? 'text-green-500' : 'text-red-500'}`}>{order.type} ({order.orderType})</div>
      <div className="font-medium text-gray-900 dark:text-white">{order.quantity} {order.symbol}</div>
      <div className="text-gray-600 dark:text-gray-300">@ ${order.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      
      <div className='flex justify-center'>
        <div className={`flex items-center text-sm font-medium px-3 py-1 rounded-full ${statusColor}`}>
          {React.createElement(statusIcon, { className: "w-4 h-4 mr-1" })}
          {order.status}
        </div>
      </div>
      
      <div className='text-right'>
        {order.status === 'FILLED' ? (
          <span className={`font-bold ${pnlColor}`}>
            {order.pnl !== undefined ? (order.pnl > 0 ? '+' : '') + order.pnl.toFixed(2) : '0.00'} USD
          </span>
        ) : (
          <span className='text-gray-500'>--</span>
        )}
        <p className="mt-1 text-xs text-gray-400">{new Date(order.createdAt?.seconds * 1000).toLocaleDateString()}</p>
      </div>
      {/* Action Column */}
      <div className='flex justify-end'>
          {order.status === 'PENDING' && (
              <button 
                  onClick={(e) => { e.stopPropagation(); onCancel(order.id); }} 
                  className="p-2 text-red-500 transition hover:text-red-700 dark:hover:text-red-400"
                  title="Cancel Order"
              >
                  <Trash2 className='w-4 h-4' />
              </button>
          )}
      </div>
    </div>
  );
};

// OrdersPage Component with API integration
const OrdersPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('PENDING');
  const [orders, setOrders] = useState<Order[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'ascending' | 'descending' }>({ key: 'createdAt', direction: 'descending' });
  const [filterCoin, setFilterCoin] = useState('All');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const ordersPerPage = 5;

  const tabs = ['PENDING', 'FILLED', 'CANCELLED'];

  // Fetch orders from API
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setIsLoading(false);
          return;
        }

        const response = await fetch('/api/orders', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setOrders(data.orders || []);
        }
      } catch (error: any) {
        // Silent error handling
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrders();
  }, []);

  // Get unique coins from orders for filter
  const uniqueCoins = useMemo(() => {
    const coins = new Set(orders.map(o => o.symbol));
    return ['All', ...Array.from(coins)];
  }, [orders]);

  // --- Sorting Logic ---
  const requestSort = (key: SortKey) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };
 
// --- Action Handlers ---
const handleViewDetails = (order: Order) => {
    setSelectedOrder(order);
};

// --- Memoized Filtered and Sorted Orders ---
const filteredAndSortedOrders = useMemo(() => {
  let currentOrders = orders.filter(order => order.status === activeTab);

  // 1. Apply Coin Filter
  if (filterCoin !== 'All') {
      currentOrders = currentOrders.filter(order => order.symbol === filterCoin);
  }

  // 2. Apply Sorting
  currentOrders.sort((a, b) => {
      const aValue = a[sortConfig.key as keyof Order] as any;
      const bValue = b[sortConfig.key as keyof Order] as any;

      if (aValue === undefined || bValue === undefined) return 0; // Handle missing P&L for Pending orders

      if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
      }
      if (aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
      }
      return 0;
  });

  return currentOrders;
}, [orders, activeTab, filterCoin, sortConfig]);

  // --- Pagination Logic ---
  const totalPages = Math.ceil(filteredAndSortedOrders.length / ordersPerPage);
  const indexOfLastOrder = currentPage * ordersPerPage;
  const indexOfFirstOrder = indexOfLastOrder - ordersPerPage;
  const currentOrders = filteredAndSortedOrders.slice(indexOfFirstOrder, indexOfLastOrder);

  // --- Action Handlers ---
  const handleCancelOrder = useCallback(async (id: string) => {
      if (window.confirm(`Are you sure you want to cancel order #${id}?`)) {
          try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/orders', {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ orderId: id, action: 'CANCEL' })
            });

            if (response.ok) {
              setOrders(prevOrders =>
                  prevOrders.map(order =>
                      order.id === id ? { ...order, status: 'CANCELLED' } : order
                  )
              );
              alert(`Order #${id} has been cancelled.`);
            } else {
              alert('Failed to cancel order');
            }
          } catch (error: any) {
            alert('Error cancelling order');
          }
      }
  }, []);

    const paginate = (pageNumber: number) => {
        if (pageNumber > 0 && pageNumber <= totalPages) {
            setCurrentPage(pageNumber);
        }
    };
    
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen dark:bg-gray-900">
        <div className="w-32 h-32 border-b-4 border-indigo-600 rounded-full animate-spin"></div>
        <p className="ml-4 text-xl text-indigo-600 dark:text-indigo-400">Loading orders...</p>
      </div>
    );
  }
 
  return (
    <div className="min-h-screen p-4 space-y-8 bg-gray-50 dark:bg-gray-900">
      <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white">Order History & Management</h1>
      
      <Card title="Order List">
        {/* Tab Navigation */}
        <div className="flex p-1 mb-4 bg-gray-100 dark:bg-gray-700 rounded-xl">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setCurrentPage(1); }} // Reset page on tab change
              className={`flex-1 py-2 text-md font-medium rounded-lg transition-all duration-200 ${
                activeTab === tab
                  ? 'bg-indigo-600 shadow text-white dark:bg-indigo-700 dark:text-white'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {tab}
              <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-gray-800 text-indigo-600 dark:text-indigo-400">
                {orders.filter(o => o.status === tab).length}
              </span>
            </button>
          ))}
        </div>
        
        {/* Filtering and Search Controls */}
        <div className='flex items-center mb-4 space-x-4'>
            <Filter className='w-5 h-5 text-gray-500 dark:text-gray-400' />
            <select
                value={filterCoin}
                onChange={(e) => { setFilterCoin(e.target.value); setCurrentPage(1); }}
                className="p-2 border border-gray-300 rounded-lg dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
                {uniqueCoins.map(coin => (
                    <option key={coin} value={coin}>{coin}</option>
                ))}
            </select>
        </div>

        <div className="space-y-1">
          {/* Table Header */}
          <div className="grid grid-cols-6 p-4 text-xs font-semibold text-gray-500 uppercase border-b border-gray-200 dark:text-gray-400 dark:border-gray-700">
            <TableHeader onClick={() => requestSort('type')} label="Type/Order" currentSort={sortConfig} sortKey='type' />
            <TableHeader onClick={() => requestSort('symbol')} label="Asset/Amount" currentSort={sortConfig} sortKey='symbol' />
            <TableHeader onClick={() => requestSort('price')} label="Price" currentSort={sortConfig} sortKey='price' />
            <span className='text-center'>Status</span>
            <TableHeader onClick={() => requestSort('pnl')} label="P&L / Date" currentSort={sortConfig} sortKey='pnl' className='text-right'/>
            <span className='text-right'>Actions</span>
          </div>
            
          {currentOrders.length > 0 ? (
            currentOrders.map(order => 
                <OrderItem 
                    key={order.id} 
                    order={order} 
                    onCancel={handleCancelOrder}
                    onViewDetails={handleViewDetails}
                />
            )
          ) : (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              No {filterCoin !== 'All' ? filterCoin : ''} {activeTab.toLowerCase()} orders found.
            </div>
          )}
        </div>
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
            <div className='flex items-center justify-between pt-4 mt-4 border-t border-gray-200 dark:border-gray-700'>
                <p className='text-sm text-gray-500 dark:text-gray-400'>Page {currentPage} of {totalPages}</p>
                <div className='flex space-x-2'>
                    <button
                        onClick={() => paginate(currentPage - 1)}
                        disabled={currentPage === 1}
                        className='px-3 py-1 text-sm border border-gray-300 rounded-lg dark:border-gray-600 dark:bg-gray-700 dark:text-white disabled:opacity-50'
                    >
                        Previous
                    </button>
                    <button
                        onClick={() => paginate(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className='px-3 py-1 text-sm border border-gray-300 rounded-lg dark:border-gray-600 dark:bg-gray-700 dark:text-white disabled:opacity-50'
                    >
                        Next
                    </button>
                </div>
            </div>
        )}

      </Card>
      
      {/* Modal for viewing detailed order */}
      <OrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />
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
