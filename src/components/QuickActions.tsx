import React from 'react';
import { TrendingUp, TrendingDown, ArrowDown, ArrowUp, BarChart3 } from 'lucide-react';

interface QuickAction {
  label: string;
  icon: React.ElementType;
  action: () => void;
  color: string;
  hoverColor: string;
}

interface QuickActionsProps {
  onBuyCrypto: () => void;
  onSellCrypto: () => void;
  onDeposit: () => void;
  onWithdraw: () => void;
  onViewPortfolio: () => void;
}

const QuickActions: React.FC<QuickActionsProps> = ({
  onBuyCrypto,
  onSellCrypto,
  onDeposit,
  onWithdraw,
  onViewPortfolio
}) => {
  const actions: QuickAction[] = [
    {
      label: 'Buy Crypto',
      icon: TrendingUp,
      action: onBuyCrypto,
      color: 'bg-green-600',
      hoverColor: 'hover:bg-green-700'
    },
    {
      label: 'Sell Crypto',
      icon: TrendingDown,
      action: onSellCrypto,
      color: 'bg-red-600',
      hoverColor: 'hover:bg-red-700'
    },
    {
      label: 'Deposit',
      icon: ArrowDown,
      action: onDeposit,
      color: 'bg-blue-600',
      hoverColor: 'hover:bg-blue-700'
    },
    {
      label: 'Withdraw',
      icon: ArrowUp,
      action: onWithdraw,
      color: 'bg-purple-600',
      hoverColor: 'hover:bg-purple-700'
    },
    {
      label: 'Portfolio',
      icon: BarChart3,
      action: onViewPortfolio,
      color: 'bg-indigo-600',
      hoverColor: 'hover:bg-indigo-700'
    }
  ];

  return (
    <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex flex-wrap gap-3 justify-center sm:justify-start">
          {actions.map((action) => (
            <button
              key={action.label}
              onClick={action.action}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-white font-medium transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-md ${action.color} ${action.hoverColor}`}
            >
              <action.icon className="w-5 h-5" />
              <span className="text-sm">{action.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default QuickActions;