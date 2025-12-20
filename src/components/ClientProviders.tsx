'use client';

import React, { useState, useMemo, createContext, useContext, useRef, useCallback, useEffect } from 'react';
import { Moon, Sun, Bell, AlertTriangle, CheckCircle } from 'lucide-react';
import '../app/intercept-console-error';
import { AuthProvider } from '@/context/AuthContext';

// 1. Theme Context (Dark/Light Mode)
interface ThemeContextType {
    theme: 'light' | 'dark';
    toggleTheme: () => void;
}
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) throw new Error('useTheme must be used within a ThemeProvider');
    return context;
};

const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [theme, setTheme] = useState<'light' | 'dark'>('light');

    const toggleTheme = () => {
        setTheme(prevTheme => {
            const newTheme = prevTheme === 'light' ? 'dark' : 'light';
            document.documentElement.classList.toggle('dark', newTheme === 'dark');
            return newTheme;
        });
    };

    React.useEffect(() => {
        if (typeof window !== 'undefined') {
            const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            const initialTheme = isSystemDark ? 'dark' : 'light';
            setTheme(initialTheme);
            document.documentElement.classList.toggle('dark', initialTheme === 'dark');
        }
    }, []);

    const value = useMemo(() => ({ theme, toggleTheme }), [theme]);

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};

// 2. Simple Notification Hook (using browser alerts)
export const useNotification = () => {
    const addNotification = (message: string, type: 'success' | 'error' | 'info' | 'warning') => {
        // Use browser alert for simplicity
        alert(`${type.toUpperCase()}: ${message}`);
    };

    return { addNotification };
};

interface ClientProvidersProps {
  children: React.ReactNode;
}

export default function ClientProviders({ children }: ClientProvidersProps) {
  return (
    <ThemeProvider>
        <AuthProvider>
            <div className='min-h-screen transition-colors duration-300 bg-gray-50 dark:bg-gray-900'>
                {children}
            </div>
        </AuthProvider>
    </ThemeProvider>
  );
}
