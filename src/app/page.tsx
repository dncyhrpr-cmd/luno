'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useMemo } from 'react';
import { LayoutDashboard, DollarSign, User, BarChart2, Shield, LogOut, HelpCircle } from 'lucide-react';
import LoginPage from '@/components/pages/LoginPage';
import SignupPage from '@/components/pages/SignupPage';
import HomePage from '@/components/pages/HomePage';
import AdminPage from '@/components/pages/AdminPage';
import AdminKYCPage from '@/components/pages/AdminKYCPage';
import AssetsPage from '@/components/pages/AssetsPage';
import MarketPage from '@/components/pages/MarketPage';
import OrdersPage from '@/components/pages/OrdersPage';
import ProfilePage from '@/components/pages/ProfilePage';
import KycRequired from '@/components/KycRequired';
import { useAuth } from '@/context/AuthContext';
import { useKyc } from '@/context/KycContext';
import { PageName, NavItem } from '@/types';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';

const Page = () => {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { kycStatus, isLoading: isKycLoading } = useKyc();
  const [currentPage, setCurrentPage] = useState<PageName>('Home');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleVerificationRedirect = () => {
    setCurrentPage('Profile');
  };

  const navItems: NavItem[] = useMemo(() => [
    { name: 'Home', page: 'Home', icon: LayoutDashboard },
    { name: 'Assets', page: 'Assets', icon: DollarSign },
    { name: 'Market', page: 'Market', icon: BarChart2 },
    { name: 'Orders', page: 'Orders', icon: Shield },
    { name: 'Profile', page: 'Profile', icon: User },
    ...(user?.isAdmin ? [{ name: 'Admin', page: 'Admin' as PageName, icon: Shield }] : []),
  ], [user?.isAdmin]);

  const renderPage = () => {
    const isKycVerified = kycStatus.startsWith('Verified');
    const tradingPages: PageName[] = ['Assets', 'Market', 'Orders'];

    if (tradingPages.includes(currentPage) && !isKycVerified) {
        return <KycRequired onVerify={handleVerificationRedirect} />;
    }

    switch (currentPage) {
      case 'Home':
        return <HomePage />;
      case 'Assets':
        return <AssetsPage user={user} />;
      case 'Market':
        return <MarketPage />;
      case 'Orders':
        return <OrdersPage />;
      case 'Profile':
        return <ProfilePage />;
      case 'Admin':
        return <AdminPage />;
      case 'AdminKYC':
        return <AdminKYCPage />;
      case 'Login':
        return <LoginPage />;
      case 'Signup':
        return <SignupPage />;
      default:
        return <HomePage />;
    }
  };

  if (isAuthLoading || isKycLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
          <div className="w-16 h-16 border-4 border-t-4 border-gray-200 rounded-full animate-spin border-t-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    if (currentPage === 'Login') {
      return <LoginPage />;
    } else if (currentPage === 'Signup') {
      return <SignupPage />;
    } else {
      return <LoginPage />;
    }
  }

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      <Sidebar navItems={navItems} currentPage={currentPage} setCurrentPage={setCurrentPage} isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-200 dark:bg-gray-800">
          <div className="container px-4 py-4 mx-auto md:px-6 md:py-8">
            {renderPage()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Page;