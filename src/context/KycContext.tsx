
'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useAuth } from './AuthContext';

interface KycContextType {
  kycStatus: string;
  checkKycStatus: () => Promise<void>;
  isLoading: boolean;
}

const KycContext = createContext<KycContextType | undefined>(undefined);

export function KycProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, accessToken } = useAuth();
  const [kycStatus, setKycStatus] = useState('Not Verified');
  const [isLoading, setIsLoading] = useState(true);

  const checkKycStatus = async () => {
    if (!isAuthenticated || !user) {
        setKycStatus('Not Verified');
        setIsLoading(false);
        return;
    }

    setIsLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
      const response = await fetch('/api/kyc/status', { headers });
      if (response.ok) {
        const data = await response.json();
        setKycStatus(data.status || 'Not Verified');
      } else {
        setKycStatus('Not Verified');
      }
    } catch (error: any) {
      console.error('Error fetching KYC status:', error);
      setKycStatus('Not Verified');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkKycStatus();
  }, [isAuthenticated, user]);

  const value: KycContextType = {
    kycStatus,
    checkKycStatus,
    isLoading,
  };

  return (
    <KycContext.Provider value={value}>
      {children}
    </KycContext.Provider>
  );
}

export function useKyc(): KycContextType {
  const context = useContext(KycContext);
  if (context === undefined) {
    throw new Error('useKyc must be used within a KycProvider');
  }
  return context;
}
