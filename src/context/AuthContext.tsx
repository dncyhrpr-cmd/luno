
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { getAuth2 } from '@/lib/client-db';
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

  const firebaseAuth = getAuth2();

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

    const authUser: User = {
      id: data.user.id,
      email: data.user.email,
      username: data.user.username,
      role: data.user.role || 'trader',
      roles: data.user.roles || ['trader'],
      migrationStatus: data.user.migrationStatus || 'migrated',
      isAdmin: data.user.role === 'admin',
      accessToken: data.accessToken, 
    };

    setUser(authUser);
    setAccessToken(data.accessToken);
    localStorage.setItem('accessToken', data.accessToken);
    return null;
  };

  const login = async (email: string, password: string): Promise<string | null> => {
    try {
      const userCredential = await signInWithEmailAndPassword(firebaseAuth, email, password);
      const idToken = await userCredential.user.getIdToken();

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: idToken }),
      });

      return await handleAuthResponse(response);
    } catch (error: any) {
      console.error('Login Error:', error);
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
          return 'Invalid email or password.';
      }
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
    firebaseAuth.signOut();
    setUser(null);
    setAccessToken(null);
    localStorage.removeItem('accessToken');
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        try {
            const idToken = await firebaseUser.getIdToken(true);
            const response = await fetch('/api/auth/session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                }
            });

            if(response.ok) {
                const data = await response.json();
                const authUser: User = {
                    id: data.user.id,
                    email: data.user.email,
                    username: data.user.username,
                    role: data.user.role || 'trader',
                    roles: data.user.roles || ['trader'],
                    migrationStatus: data.user.migrationStatus || 'migrated',
                    isAdmin: data.user.role === 'admin',
                    accessToken: data.accessToken, 
                };
                setUser(authUser);
                setAccessToken(data.accessToken);
                localStorage.setItem('accessToken', data.accessToken);
            } else {
                logout();
            }
        } catch (error: any) {
            console.error('Session refresh error:', error);
            logout();
        }
      } else {
        setUser(null);
        setAccessToken(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [firebaseAuth]);


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
