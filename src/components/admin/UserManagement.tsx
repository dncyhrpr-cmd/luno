
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Search } from 'lucide-react';

// Local Card component definition
const Card: React.FC<{ title?: string; children: React.ReactNode; className?: string }> = ({ title, children, className = '' }) => (
    <div className={`bg-white dark:bg-gray-800 shadow-md rounded-lg p-6 ${className}`}>
        {title && <h2 className="text-xl font-bold mb-4">{title}</h2>}
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
    role: 'user' | 'admin';
    status: 'active' | 'inactive' | 'banned';
    balance: number;
    createdAt: any;
}

const UserManagement: React.FC = () => {
    const { user } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchUsers = useCallback(async () => {
        if (!user || !user.accessToken) return;
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

    if (isLoading) {
        return <p>Loading users...</p>;
    }

    return (
        <Card title="Detailed User Management">
            <div className="space-y-4">
                <div className="flex items-center space-x-4 mb-4">
                    <div className="flex-1">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Search users..."
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                            />
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-800">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">User</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Role</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Balance</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
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
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                        ${user.balance.toFixed(2)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button
                                            onClick={() => handleToggleUserStatus(user.id, user.status === 'active' ? 'inactive' : 'active')}
                                            className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 mr-3"
                                        >
                                            Toggle Status
                                        </button>
                                        <button
                                            onClick={() => handleToggleUserStatus(user.id, 'banned')}
                                            className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                                        >
                                            Ban
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
