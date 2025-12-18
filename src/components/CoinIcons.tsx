import React from 'react';

interface CoinIconProps {
  symbol: string;
  size?: number;
  className?: string;
}

export const CoinIcon: React.FC<CoinIconProps> = ({ symbol, size = 24, className = '' }) => {
  const getCoinIcon = (symbol: string) => {
    switch (symbol.toUpperCase()) {
      case 'BTC':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
            <circle cx="12" cy="12" r="11" fill="#F7931A"/>
            <path d="M8.5 6.5h4.5c1.5 0 2.5 1 2.5 2.5s-1 2.5-2.5 2.5H8.5v-5zm0 7h5c1.5 0 2.5 1 2.5 2.5s-1 2.5-2.5 2.5h-5v-5z" fill="white"/>
            <circle cx="10" cy="9" r="1" fill="#F7931A"/>
            <circle cx="14" cy="15" r="1" fill="#F7931A"/>
          </svg>
        );
      case 'ETH':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
            <circle cx="12" cy="12" r="11" fill="#627EEA"/>
            <path d="M12 4l6 8-6 4-6-4 6-8zm0 12l6-4-6 8-6-8 6 4z" fill="white" opacity="0.9"/>
          </svg>
        );
      case 'SOL':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
            <circle cx="12" cy="12" r="11" fill="#00D4AA"/>
            <path d="M12 6l3 3-3 3-3-3 3-3zm0 6l3 3-3 3-3-3 3-3z" fill="white"/>
            <circle cx="12" cy="9" r="1" fill="#00D4AA"/>
            <circle cx="12" cy="15" r="1" fill="#00D4AA"/>
          </svg>
        );
      case 'BNB':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
            <circle cx="12" cy="12" r="11" fill="#F3BA2F"/>
            <path d="M12 6l2 2-2 2-2-2 2-2zm0 4l2 2-2 2-2-2 2-2zm-3-1l2 2-2 2-2-2 2-2zm6 0l2 2-2 2-2-2 2-2zm-3 5l2 2-2 2-2-2 2-2z" fill="white"/>
          </svg>
        );
      case 'ADA':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
            <circle cx="12" cy="12" r="11" fill="#0033AD"/>
            <path d="M12 6l1 3-1 2-1-2 1-3zm0 5l1 3-1 2-1-2 1-3zm-2-4l1 3-1 2-1-2 1-3zm4 0l1 3-1 2-1-2 1-3z" fill="white"/>
          </svg>
        );
      case 'DOGE':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
            <circle cx="12" cy="12" r="11" fill="#C2A633"/>
            <path d="M8 10h8v2H8v-2zm0 4h8v2H8v-2zm-1-6h2v12H7V8zm8 0h2v12h-2V8z" fill="white"/>
            <circle cx="10" cy="12" r="1" fill="#C2A633"/>
            <circle cx="14" cy="12" r="1" fill="#C2A633"/>
          </svg>
        );
      case 'XRP':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
            <circle cx="12" cy="12" r="11" fill="#23292F"/>
            <path d="M6 8h12v2H6V8zm0 6h12v2H6v-2zm3-3h6v2H9v-2z" fill="white"/>
            <circle cx="9" cy="9" r="1" fill="#23292F"/>
            <circle cx="15" cy="15" r="1" fill="#23292F"/>
          </svg>
        );
      case 'LTC':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
            <circle cx="12" cy="12" r="11" fill="#BFBBBB"/>
            <path d="M8 6h8v2H8V6zm0 4h8v2H8v-2zm0 4h8v2H8v-2zm4 2l2 4-2-2-2 2 2 4z" fill="white"/>
            <circle cx="12" cy="12" r="1" fill="#BFBBBB"/>
          </svg>
        );
      case 'MATIC':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
            <circle cx="12" cy="12" r="11" fill="#8247E5"/>
            <path d="M8 8l8 0v4l-4 4-4-4V8zm4 4l2 2-2 2-2-2 2-2z" fill="white"/>
            <circle cx="12" cy="10" r="1" fill="#8247E5"/>
          </svg>
        );
      case 'LINK':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
            <circle cx="12" cy="12" r="11" fill="#2A5ADA"/>
            <path d="M8 10l4-4 4 4-4 4-4-4zm0 4l4 4 4-4-4-4-4 4z" fill="white"/>
            <circle cx="12" cy="12" r="1.5" fill="#2A5ADA"/>
          </svg>
        );
      default:
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
            <circle cx="12" cy="12" r="11" fill="#6B7280"/>
            <text x="12" y="16" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">
              {symbol.slice(0, 3).toUpperCase()}
            </text>
          </svg>
        );
    }
  };

  return getCoinIcon(symbol);
};
