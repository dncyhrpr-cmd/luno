'use client';

import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { useKyc } from '@/context/KycContext';

interface KycRequiredProps {
  onVerify: () => void;
}

const KycRequired: React.FC<KycRequiredProps> = ({ onVerify }) => {
  const { kycStatus, isLoading } = useKyc();

  if (isLoading) {
    return (
      <div className="luno-card flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="w-12 h-12 border-4 border-t-4 border-gray-200 rounded-full animate-spin border-t-blue-600"></div>
        <p className="mt-4 text-lg font-semibold text-gray-700 dark:text-gray-300">Checking KYC Status...</p>
      </div>
    );
  }

  return (
    <div className="luno-card flex flex-col items-center justify-center h-full p-8 text-center bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
      <ShieldAlert className="w-16 h-16 text-red-500 dark:text-red-400 mb-6" />
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Identity Verification Required</h2>
      <p className="max-w-md text-gray-600 dark:text-gray-400 mb-6">
        To access trading features, you must complete our Know Your Customer (KYC) identity verification process. This is a one-time process required for security and compliance.
      </p>
      <p className="text-sm font-semibold text-red-600 dark:text-red-400 mb-6">Your Current Status: {kycStatus}</p>
      <button 
        onClick={onVerify}
        className="px-8 py-3 font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        disabled={kycStatus === 'Pending Review'}
      >
        {kycStatus === 'Pending Review' ? 'Verification Pending...' : 'Start KYC Verification'}
      </button>
    </div>
  );
};

export default KycRequired;
