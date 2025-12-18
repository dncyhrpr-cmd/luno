'use client';

import React from 'react';
import { User, Menu } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';


const Header: React.FC<{ isSidebarOpen: boolean; setIsSidebarOpen: (open: boolean) => void }> = ({ isSidebarOpen, setIsSidebarOpen }) => {
  const { user } = useAuth();







  return (
    <header className="flex items-center justify-between px-2 py-2 bg-white border-b border-gray-200 shadow-sm md:px-4 md:py-3 dark:bg-gray-800 dark:border-gray-700">
      <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 mr-2 text-gray-700 md:hidden dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"><Menu className="w-5 h-5" /></button>
      <div className="flex items-center space-x-1 md:space-x-2">
        <img src="/luno-logo.svg" alt="LUNO Logo" className="w-8 h-8 transition-transform duration-300 md:w-10 md:h-10 hover:scale-105" />
        <h1 className="text-xl font-bold text-gray-900 md:text-2xl dark:text-white">LUNO</h1>
      </div>
      <div className="flex items-center space-x-2 md:space-x-4">
        <span className="hidden text-sm text-gray-700 md:block dark:text-gray-300">Welcome, {user?.username}</span>
        <User className="w-5 h-5 text-gray-700 dark:text-gray-300" />
      </div>
    </header>
  );
};

export default Header;
