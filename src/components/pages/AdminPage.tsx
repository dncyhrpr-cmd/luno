
"use client";

import React from 'react';
import { Shield } from 'lucide-react';
import TransactionRequests from '../admin/TransactionRequests';
import UserManagement from '../admin/UserManagement';
import ProtectedRoute from '../ProtectedRoute';
import AdminKYCPage from './AdminKYCPage';

const AdminPage: React.FC = () => {
  return (
    <ProtectedRoute requiredRole="admin">
      <div className="p-4 space-y-8 bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div className="flex items-center space-x-3 border-b border-gray-200 dark:border-gray-700 pb-4">
          <Shield className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
          <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white">System Admin Console</h1>
        </div>

        <TransactionRequests />
        <UserManagement />
        <AdminKYCPage />

      </div>
    </ProtectedRoute>
  );
};

export default AdminPage;
