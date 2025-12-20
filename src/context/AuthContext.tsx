
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '@/types/index';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  accessToken: string | null;
  login: (email: string, password: string) => Promise<string | null>;
  signup: (name: string, email: string, password: string) => Promise<string | null>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const handleAuthResponse = async (response: Response): Promise<string | null> => {
    if (!response.ok) {
      const data = await response.json();
      return data.error || 'Authentication failed. Please try again.';
    }

    const data = await response.json();

    if (!data.user || !data.user.id) {
      console.error('Invalid auth response structure:', data);
      return `Login successful, but the user object in the response was missing or malformed.`;
    }

    const roles = data.user.roles || ['trader'];
    // Temporary: grant admin role to specific user
    if (data.user.email === 'dncyhrpr@gmail.com' && !roles.includes('admin')) {
      roles.push('admin');
    }

    const authUser: User = {
      id: data.user.id,
      email: data.user.email,
      username: data.user.username,
      role: data.user.role || 'trader',
      roles: roles,
      migrationStatus: data.user.migrationStatus || 'migrated',
      isAdmin: roles.includes('admin'),
      accessToken: data.accessToken,
    };

    setUser(authUser);
    setAccessToken(data.accessToken);
    localStorage.setItem('accessToken', data.accessToken);
    return null;
  };

  const login = async (email: string, password: string): Promise<string | null> => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      return await handleAuthResponse(response);
    } catch (error: any) {
      console.error('Login Error:', error);
      return 'Login failed. An unexpected error occurred.';
    }
  };

  const signup = async (name: string, email: string, password: string): Promise<string | null> => {
    try {
      const signupResponse = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      if (!signupResponse.ok) {
        const data = await signupResponse.json();
        return data.error || 'Signup failed. Please try again.';
      }

      return await login(email, password);
    } catch (error: any) {
      console.error('Signup Error:', error);
      return 'Signup failed. An unexpected error occurred.';
    }
  };

  const logout = () => {
    setUser(null);
    setAccessToken(null);
    localStorage.removeItem('accessToken');
  };

  useEffect(() => {
    const checkStoredAuth = async () => {
      const storedToken = localStorage.getItem('accessToken');
      if (storedToken) {
        try {
          const response = await fetch('/api/auth/session', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${storedToken}`
            }
          });

          if (response.ok) {
            const data = await response.json();
            const roles = data.user.roles || ['trader'];
            // Temporary: grant admin role to specific user
            if (data.user.email === 'dncyhrpr@gmail.com' && !roles.includes('admin')) {
              roles.push('admin');
            }

            const authUser: User = {
              id: data.user.id,
              email: data.user.email,
              username: data.user.username,
              role: data.user.role || 'trader',
              roles: roles,
              migrationStatus: data.user.migrationStatus || 'migrated',
              isAdmin: roles.includes('admin'),
              accessToken: data.accessToken,
            };
            setUser(authUser);
            setAccessToken(data.accessToken);
            localStorage.setItem('accessToken', data.accessToken);
          } else {
            localStorage.removeItem('accessToken');
            setUser(null);
            setAccessToken(null);
          }
        } catch (error: any) {
          console.error('Session refresh error:', error);
          localStorage.removeItem('accessToken');
          setUser(null);
          setAccessToken(null);
        }
      }
      setIsLoading(false);
    };

    checkStoredAuth();
  }, []);


  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    accessToken,
    login,
    signup,
    logout,
    isLoading,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
