
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User } from '@/types/index';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  login: (email: string, password: string) => Promise<string | null>;
  signup: (name: string, email: string, password: string) => Promise<string | null>;
  logout: () => void;
  refreshTokens: () => Promise<boolean>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const handleAuthResponse = useCallback(async (response: Response): Promise<string | null> => {
    if (!response.ok) {
      const data = await response.json();
      return data.error || 'Authentication failed. Please try again.';
    }

    const data = await response.json();

    if (!data.user || !data.user.id) {
      console.error('Invalid auth response structure:', data);
      return `Login successful, but the user object in the response was missing or malformed.`;
    }

    let roles: string[] = [];
    if (Array.isArray(data.user.roles)) {
      roles = data.user.roles;
    } else if (typeof data.user.roles === 'string') {
      try {
        roles = JSON.parse(data.user.roles);
      } catch {
        roles = [data.user.role || 'trader'];
      }
    } else {
      roles = [data.user.role || 'trader'];
    }

    // Temporary: grant admin role to specific user if not already present
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
    setRefreshToken(data.refreshToken);
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    return null;
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<string | null> => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return await handleAuthResponse(response);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.error('Login request timed out');
        return 'Login request timed out. Please try again.';
      }
      console.error('Login Error:', error);
      return 'Login failed. An unexpected error occurred.';
    }
  }, [handleAuthResponse]);

  const signup = useCallback(async (name: string, email: string, password: string): Promise<string | null> => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const signupResponse = await fetch(`${baseUrl}/api/auth/signup`, {
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
  }, [login]);

  const logout = useCallback(() => {
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }, []);

  const refreshTokens = useCallback(async (): Promise<boolean> => {
    const storedRefreshToken = localStorage.getItem('refreshToken');
    if (!storedRefreshToken) {
      return false;
    }

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const response = await fetch(`${baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: storedRefreshToken }),
      });

      if (!response.ok) {
        logout(); // Clear tokens if refresh fails
        return false;
      }

      const data = await response.json();
      setAccessToken(data.accessToken);
      setRefreshToken(data.refreshToken);
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      return true;
    } catch (error) {
      console.error('Token refresh failed:', error);
      logout();
      return false;
    }
  }, [logout]);

  useEffect(() => {
    const checkStoredAuth = async () => {
      const storedToken = localStorage.getItem('accessToken');
      const storedRefreshToken = localStorage.getItem('refreshToken');
      if (storedToken) {
        try {
          const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
          const response = await fetch(`${baseUrl}/api/auth/session`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${storedToken}`
            }
          });

          if (response.ok) {
            const data = await response.json();
            
            let roles: string[] = [];
            if (Array.isArray(data.user.roles)) {
              roles = data.user.roles;
            } else if (typeof data.user.roles === 'string') {
              try {
                roles = JSON.parse(data.user.roles);
              } catch {
                roles = [data.user.role || 'trader'];
              }
            } else {
              roles = [data.user.role || 'trader'];
            }

            // Temporary: grant admin role to specific user if not already present
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
              accessToken: storedToken, // Use the existing token
            };
            setUser(authUser);
            setAccessToken(storedToken);
            setRefreshToken(storedRefreshToken);
          } else if (response.status === 401 && storedRefreshToken) {
            // Token might be expired, try to refresh
            const refreshSuccess = await refreshTokens();
            if (!refreshSuccess) {
              logout();
            }
          } else {
            logout();
          }
        } catch (error: any) {
          console.error('Session refresh error:', error);
          logout();
        }
      }
      setIsLoading(false);
    };

    checkStoredAuth();
  }, []);


  const value: AuthContextType = React.useMemo(() => ({
    user,
    isAuthenticated: !!user,
    accessToken,
    refreshToken,
    login,
    signup,
    logout,
    refreshTokens,
    isLoading,
  }), [user, accessToken, refreshToken, login, signup, logout, refreshTokens, isLoading]);

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
