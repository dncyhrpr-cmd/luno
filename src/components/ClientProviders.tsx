'use client';

import React, { useState, useMemo, createContext, useContext, useRef, useCallback } from 'react';
import { Moon, Sun, Bell, AlertTriangle, CheckCircle } from 'lucide-react';
import '../app/intercept-console-error';
import { AuthProvider } from '@/context/AuthContext';
import { KycProvider } from '@/context/KycContext';

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

// 2. Notifications/Toast Context
interface Notification {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
}

interface NotificationContextType {
    notifications: Notification[];
    addNotification: (message: string, type: Notification['type']) => void;
    removeNotification: (id: number) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (!context) throw new Error('useNotification must be used within a NotificationProvider');
    return context;
};

const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);

    const addNotification = (message: string, type: Notification['type']) => {
        const id = Date.now();
        const newNotification: Notification = { id, message, type };
        setNotifications(prev => [...prev, newNotification]);

        setTimeout(() => removeNotification(id), 5000);
    };

    const removeNotification = (id: number) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    const value = useMemo(() => ({ notifications, addNotification, removeNotification }), [notifications]);

    return (
        <NotificationContext.Provider value={value}>
            {children}
            <NotificationDisplay notifications={notifications} removeNotification={removeNotification} />
        </NotificationContext.Provider>
    );
};

const NotificationDisplay: React.FC<{ notifications: Notification[]; removeNotification: (id: number) => void }> = ({ notifications, removeNotification }) => {
    return (
        <div className="fixed space-y-3 bottom-4 right-4 z-100">
            {notifications.map(notification => {
                let icon: React.ElementType;
                let bgColor: string;
                let textColor: string;

                switch (notification.type) {
                    case 'success':
                        icon = CheckCircle;
                        bgColor = 'bg-green-600';
                        textColor = 'text-white';
                        break;
                    case 'error':
                        icon = AlertTriangle;
                        bgColor = 'bg-red-600';
                        textColor = 'text-white';
                        break;
                    case 'warning':
                        icon = AlertTriangle;
                        bgColor = 'bg-yellow-500';
                        textColor = 'text-gray-900';
                        break;
                    default:
                        icon = Bell;
                        bgColor = 'bg-indigo-600';
                        textColor = 'text-white';
                }

                return (
                    <div
                        key={notification.id}
                        className={`p-4 rounded-lg shadow-xl flex items-center space-x-3 transition-opacity duration-300 animate-in fade-in slide-in-from-right ${bgColor} ${textColor}`}
                        role="alert"
                    >
                        {React.createElement(icon, { className: "w-5 h-5 flex-shrink-0" })}
                        <span className="text-sm font-medium">{notification.message}</span>
                        <button onClick={() => removeNotification(notification.id)} className={`ml-4 opacity-70 hover:opacity-100 ${textColor}`}>
                            &times;
                        </button>
                    </div>
                );
            })}
        </div>
    );
};

interface ClientProvidersProps {
  children: React.ReactNode;
}

export default function ClientProviders({ children }: ClientProvidersProps) {
  return (
    <ThemeProvider>
        <AuthProvider>
            <KycProvider>
                <NotificationProvider>
                    <div className='min-h-screen transition-colors duration-300 bg-gray-50 dark:bg-gray-900'>
                        {children}
                    </div>
                </NotificationProvider>
            </KycProvider>
        </AuthProvider>
    </ThemeProvider>
  );
}
