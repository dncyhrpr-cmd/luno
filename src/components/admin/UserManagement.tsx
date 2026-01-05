
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Search } from 'lucide-react';

// Local Card component definition
const Card: React.FC<{ title?: string; children: React.ReactNode; className?: string }> = ({ title, children, className = '' }) => (
    <div className={`bg-white dark:bg-gray-800 shadow-md rounded-lg p-6 ${className}`}>
        {title && <h2 className="mb-4 text-xl font-bold">{title}</h2>}
        {children}
    </div>
);

// Local StatusBadge component definition
const StatusBadge: React.FC<{ status: 'active' | 'inactive' | 'banned' }> = ({ status }) => {
    const statusClasses = {
        active: 'bg-green-100 text-green-800',
        inactive: 'bg-yellow-100 text-yellow-800',
        banned: 'bg-red-100 text-red-800',
    };
    return (
        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClasses[status]}`}>
            {status}
        </span>
    );
};

interface User {
    id: string;
    username: string;
    email: string;
    role: string;
    status: 'active' | 'inactive' | 'banned';
    balance: number;
    totalBalance: number;
    availableBalance: number;
    frozenBalance: number;
    createdAt: any;
    clientScore: number | null;
}

const UserManagement: React.FC = () => {
    const { user } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchUsers = useCallback(async () => {
        if (!user || !user.accessToken) {
            setIsLoading(false);
            return;
        }
        try {
            const response = await fetch('/api/admin/users', {
                headers: { 'Authorization': `Bearer ${user.accessToken}` }
            });
            if (response.ok) {
                const data = await response.json();
                setUsers(data.users || []);
            }
        } catch (error: any) {
            console.error("Error fetching users", error);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const handleToggleUserStatus = useCallback(async (userId: string, newStatus: 'active' | 'inactive' | 'banned') => {
        if (!user || !user.accessToken) return;
        try {
            const response = await fetch('/api/admin/users', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${user.accessToken}`
                },
                body: JSON.stringify({ userId, status: newStatus })
            });

            if (response.ok) {
                setUsers(prevUsers =>
                    prevUsers.map(u =>
                        u.id === userId ? { ...u, status: newStatus } : u
                    )
                );
                alert(`User status updated to ${newStatus}`);
            } else {
                alert('Failed to update user status');
            }
        } catch (error: any) {
            alert('Error updating user status');
        }
    }, [user]);

    const handleSetScore = useCallback(async (userId: string) => {
        if (!user || !user.accessToken) return;
        const scoreInput = prompt('Enter client score (0-100):');
        if (scoreInput === null) return;
        const score = parseInt(scoreInput);
        if (isNaN(score) || score < 0 || score > 100) {
            alert('Invalid score. Must be a number between 0 and 100.');
            return;
        }
        try {
            const response = await fetch('/api/admin/users', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${user.accessToken}`
                },
                body: JSON.stringify({ userId, score })
            });

            if (response.ok) {
                setUsers(prevUsers =>
                    prevUsers.map(u =>
                        u.id === userId ? { ...u, clientScore: score } : u
                    )
                );
                alert(`User score set to ${score}`);
            } else {
                alert('Failed to update user score');
            }
        } catch (error: any) {
            alert('Error updating user score');
        }
    }, [user]);

    const handleFreeze = useCallback(async (userId: string, action: 'freeze' | 'unfreeze') => {
        if (!user || !user.accessToken) return;
        const amountInput = prompt(`Enter amount to ${action}:`);
        if (amountInput === null) return;
        const amount = parseFloat(amountInput);
        if (isNaN(amount) || amount <= 0) {
            alert('Invalid amount. Must be a positive number.');
            return;
        }
        const reason = prompt('Enter reason (optional):') || '';
        try {
            const response = await fetch('/api/admin/freeze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${user.accessToken}`
                },
                body: JSON.stringify({ userId, action, amount, reason })
            });

            if (response.ok) {
                const data = await response.json();
                setUsers(prevUsers =>
                    prevUsers.map(u =>
                        u.id === userId ? { ...u, frozenBalance: data.newFrozenBalance, availableBalance: u.totalBalance - data.newFrozenBalance } : u
                    )
                );
                alert(`Balance ${action}d successfully`);
            } else {
                const error = await response.json();
                alert(`Failed to ${action} balance: ${error.error}`);
            }
        } catch (error: any) {
            alert(`Error ${action}ing balance`);
        }
    }, [user]);

    if (isLoading) {
        return <p>Loading users...</p>;
    }

    return (
        <Card title="Detailed User Management">
            <div className="space-y-4">
                <div className="flex items-center mb-4 space-x-4">
                    <div className="flex-1">
                        <div className="relative">
                            <Search className="absolute w-4 h-4 text-gray-400 transform -translate-y-1/2 left-3 top-1/2" />
                            <input
                                type="text"
                                placeholder="Search users..."
                                className="w-full py-2 pl-10 pr-4 border border-gray-300 rounded-lg dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                            />
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-800">
                            <tr>
                                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase dark:text-gray-400">User</th>
                                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase dark:text-gray-400">Role</th>
                                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase dark:text-gray-400">Status</th>
                                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase dark:text-gray-400">Balance</th>
                                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase dark:text-gray-400">Score</th>
                                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase dark:text-gray-400">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-900 dark:divide-gray-700">
                            {users.map(user => (
                                <tr key={user.id}>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div>
                                            <div className="text-sm font-medium text-gray-900 dark:text-white">{user.username}</div>
                                            <div className="text-sm text-gray-500 dark:text-gray-400">{user.email}</div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="text-sm text-gray-900 dark:text-white">{user.role}</span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <StatusBadge status={user.status} />
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap dark:text-white">
                                        ${user.balance.toFixed(2)}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap dark:text-white">
                                        {user.clientScore !== null ? user.clientScore : 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 text-sm font-medium text-right whitespace-nowrap">
                                        <button
                                            onClick={() => handleToggleUserStatus(user.id, user.status === 'active' ? 'inactive' : 'active')}
                                            className="mr-3 text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300"
                                        >
                                            Toggle Status
                                        </button>
                                        <button
                                            onClick={() => handleToggleUserStatus(user.id, 'banned')}
                                            className="mr-3 text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                                        >
                                            Ban
                                        </button>
                                        <button
                                            onClick={() => handleSetScore(user.id)}
                                            className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                                        >
                                            Set Score
                                        </button>
                                        <button
                                          onClick={() => handleFreeze(user.id, 'freeze')}
                                          className="mr-3 text-purple-600 dark:text-purple-400 hover:text-purple-900 dark:hover:text-purple-300"
                                        >
                                          Freeze
                                        </button>
                                        <button
                                          onClick={() => handleFreeze(user.id, 'unfreeze')}
                                          className="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300"
                                        >
                                          Unfreeze
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </Card>
    );
};

export default UserManagement;
