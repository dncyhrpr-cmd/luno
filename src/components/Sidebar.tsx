'use client';

import React, { useState, useEffect } from 'react';
import { X, Menu, ChevronLeft, ChevronRight, LayoutDashboard, User, DollarSign, LogOut } from 'lucide-react';
import { PageName, NavItem } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/components/ClientProviders';
import { ADMIN_NAV_ITEMS } from '@/app/admin/config';

// Reusable Luno Logo SVG Component
const LunoLogo: React.FC<{ isActive: boolean }> = ({ isActive }) => (
    <div className='flex items-center overflow-hidden whitespace-nowrap'>
        {/* Luno Icon (Simplified) */}
        <div className={`relative w-8 h-8 ${isActive ? 'mr-2' : ''} shrink-0`}>
            {/* Outer Ring - Luno Blue */}
            <div className={`absolute inset-0 rounded-full bg-blue-600 opacity-60`}></div>
            {/* Inner Ring - White Center */}
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white w-1/2 h-1/2`}></div>
        </div>

        {/* Wordmark */}
        <h1 className={`text-3xl font-extrabold text-gray-900 dark:text-white transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-0'} overflow-hidden`}>
            LUNO
        </h1>
    </div>
);


interface SidebarProps {
  navItems: NavItem[];
  currentPage: PageName;
  setCurrentPage: (page: PageName) => void;
  isOpen?: boolean;
  setIsOpen?: (open: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ navItems, currentPage, setCurrentPage, isOpen: propIsOpen, setIsOpen: propSetIsOpen }) => {
  const [localIsOpen, setLocalIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true); // Start collapsed for minimal look
  const [isHovered, setIsHovered] = useState(false);

  const isOpen = propIsOpen !== undefined ? propIsOpen : localIsOpen;
  const setIsOpen = propSetIsOpen || setLocalIsOpen;

  const { user, logout } = useAuth(); // Use real auth context
  const { theme } = useTheme(); // Use real theme context

  // Close sidebar when clicking outside (Mobile only)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const sidebar = document.getElementById('sidebar');
      const toggleBtn = document.getElementById('sidebar-toggle');
      if (
        sidebar &&
        !sidebar.contains(event.target as Node) &&
        toggleBtn &&
        !toggleBtn.contains(event.target as Node) &&
        isOpen
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, setIsOpen]);

  const handleNavClick = (page: PageName) => {
    setCurrentPage(page);
    setIsOpen(false); // Close mobile sidebar on navigation
  };

  // Determines the active width state
  const isActive = isOpen || !isCollapsed || isHovered;

  // Visibility depends on whether it's active (full width)
  const isTextVisible = isActive;

  const allNavItems = user?.roles.includes('admin') ? [...navItems, ...ADMIN_NAV_ITEMS] : navItems;

  return (
    <>
    {/* Sidebar */}
    <nav
        id="sidebar"
        // Desktop hover logic
        onMouseEnter={() => isCollapsed && setIsHovered(true)}
        onMouseLeave={() => isCollapsed && setIsHovered(false)}
        // Luno Style: White background, subtle shadow on light mode
        className={`fixed left-0 top-0 bottom-0 bg-white dark:bg-gray-900 p-6 flex flex-col justify-between z-30 transform transition-all duration-300 ease-in-out shadow-lg dark:shadow-none border-r border-gray-100 dark:border-gray-800
            ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 overflow-hidden`}
        style={{ width: isOpen ? '280px' : (isActive ? '16rem' : '0rem') }} // Professional drawer width on mobile
    >
        <div>
 {/* Logo */}
<div className={`flex items-center mb-10 transition-all duration-300 justify-center`}>
<LunoLogo isActive={isTextVisible} />
</div>

{/* Navigation Links */}
<ul className="space-y-2">
{allNavItems.map((item) => (
<li key={item.name}>
<button
onClick={() => handleNavClick(item.page)}
className={`nav-link w-full text-left flex items-center p-3 rounded-lg transition-all duration-300
${isActive ? 'justify-start' : 'justify-center'}
${currentPage === item.page
? 'bg-blue-600 text-white shadow-md' // Luno primary blue for active
: 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
}`}
>
<item.icon className={`w-6 h-6 shrink-0 transition-all duration-300 ${isActive ? 'mr-3' : 'mx-auto'}`} />
<span className={`text-base font-semibold whitespace-nowrap transition-all duration-300 ${isActive ? 'opacity-100 max-w-full' : 'opacity-0 max-w-0'} overflow-hidden`}>
{item.name}
</span>
</button>
</li>
))}
</ul>
        </div>

        {/* Footer Section: User Profile and Logout Link */}
        <div className="pt-4 border-t border-gray-100 dark:border-gray-800">

{/* User Info Card (Clickable to Profile Page) */}
<button
            onClick={() => handleNavClick('Profile')}
className={`w-full flex items-center p-3 rounded-lg transition-all duration-300 hover:bg-gray-100 dark:hover:bg-gray-800
                ${isActive ? 'justify-start' : 'justify-center'}`}
>
<div className="flex items-center justify-center w-8 h-8 text-sm font-bold text-white bg-blue-500 rounded-full dark:bg-indigo-500 shrink-0">
{user?.username ? user.username.charAt(0).toUpperCase() : '?'}
</div>
<div className={`ml-3 overflow-hidden transition-opacity duration-300 ${isTextVisible ? 'opacity-100' : 'opacity-0'} whitespace-nowrap text-left`}>
<p className="text-sm font-semibold text-gray-900 truncate dark:text-white">{user?.username || 'Guest'}</p>
<p className="text-xs text-gray-500 dark:text-gray-400">View Profile</p>
</div>
</button>

            {/* Hidden Logout Button (for completeness, in a cleaner style) */}
            <button
                        onClick={logout}
                        className={`w-full mt-2 flex items-center p-3 rounded-lg text-gray-500 dark:text-gray-400 hover:text-red-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors
                            ${isActive ? 'justify-start' : 'justify-center'}`}
                        title="Logout"
                    >
                        <LogOut className={`w-6 h-6 shrink-0 transition-all duration-300 ${isActive ? 'mr-3' : 'mx-auto'}`} />
                        <span className={`text-base font-semibold transition-all duration-300 ${isActive ? 'opacity-100 max-w-full' : 'opacity-0 max-w-0'} overflow-hidden`}>
                            Logout
                        </span>
                    </button>
        </div>
    </nav>
    </>
  );
};

export default Sidebar;
