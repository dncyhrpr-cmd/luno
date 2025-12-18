
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';

// Local Card component definition
const Card: React.FC<{ title?: string; children: React.ReactNode; className?: string }> = ({ title, children, className = '' }) => (
    <div className={`bg-white dark:bg-gray-800 shadow-md rounded-lg p-6 ${className}`}>
        {title && <h2 className="text-xl font-bold mb-4">{title}</h2>}
        {children}
    </div>
);

// Local StatusBadge component definition
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const statusClasses: { [key: string]: string } = {
        pending: 'bg-yellow-100 text-yellow-800',
        approved: 'bg-green-100 text-green-800',
        rejected: 'bg-red-100 text-red-800',
    };
    return (
        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClasses[status]}`}>
            {status}
        </span>
    );
};

interface TransactionRequest {
    id: string;
    userId: string;
    type: 'deposit' | 'withdraw';
    amount: number;
    status: 'pending' | 'approved' | 'rejected';
    reason?: string;
    username?: string;
    email?: string;
    createdAt: any;
}

const TransactionRequests: React.FC = () => {
    const { user } = useAuth();
    const [transactionRequests, setTransactionRequests] = useState<TransactionRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [processingRequest, setProcessingRequest] = useState<string | null>(null);

    const fetchTransactionRequests = useCallback(async () => {
        if (!user || !user.accessToken) return;
        try {
            const response = await fetch('/api/admin/requests', {
                headers: { 'Authorization': `Bearer ${user.accessToken}` }
            });
            if (response.ok) {
                const data = await response.json();
                setTransactionRequests(data.requests || []);
            }
        } catch (error: any) {
            console.error("Error fetching requests", error);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchTransactionRequests();
    }, [fetchTransactionRequests]);

    const handleRequestAction = useCallback(async (requestId: string, action: 'approve' | 'reject', reason?: string) => {
        if (!user || !user.accessToken) return;
        setProcessingRequest(requestId);
        try {
            const response = await fetch('/api/admin/requests', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${user.accessToken}`
                },
                body: JSON.stringify({ requestId, action, reason })
            });

            if (response.ok) {
                await fetchTransactionRequests();
                alert(`Request ${action}d successfully`);
            } else {
                alert(`Failed to ${action} request`);
            }
        } catch (error: any) {
            alert(`Error ${action}ing request`);
        } finally {
            setProcessingRequest(null);
        }
    }, [user, fetchTransactionRequests]);

    if (isLoading) {
        return <p>Loading transaction requests...</p>;
    }

    return (
        <Card title="Transaction Requests">
            <div className="space-y-4">
                {transactionRequests.length === 0 ? (
                    <p className="text-center text-gray-500 dark:text-gray-400">No pending requests</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-800">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">User</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Amount</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                                {transactionRequests.map(request => (
                                    <tr key={request.id}>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div>
                                                <div className="text-sm font-medium text-gray-900 dark:text-white">{request.username}</div>
                                                <div className="text-sm text-gray-500 dark:text-gray-400">{request.email}</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`text-sm font-medium capitalize ${request.type === 'deposit' ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}>
                                                {request.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                            ${request.amount.toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <StatusBadge status={request.status.toLowerCase()} />
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            {request.status === 'pending' && (
                                                <>
                                                    <button
                                                        onClick={() => handleRequestAction(request.id, 'approve')}
                                                        disabled={processingRequest === request.id}
                                                        className="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300 mr-3 disabled:opacity-50"
                                                    >
                                                        Approve
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            const reason = prompt('Enter rejection reason:');
                                                            if (reason) {
                                                                handleRequestAction(request.id, 'reject', reason);
                                                            }
                                                        }}
                                                        disabled={processingRequest === request.id}
                                                        className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 disabled:opacity-50"
                                                    >
                                                        Reject
                                                    </button>
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </Card>
    );
};

export default TransactionRequests;
