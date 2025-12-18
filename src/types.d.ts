declare module 'd3-time-format';

export type PageName = 'Home' | 'Market' | 'Orders' | 'Assets' | 'Profile' | 'Admin' | string;

export interface NavItem {
    name: PageName;
    icon: React.ComponentType<any>;
    page: PageName;
    requiresAdmin?: boolean;
}

interface AdminUser {
  id: number;
  username: string;
  email: string;
  role: 'user' | 'admin';
  status: 'active' | 'inactive' | 'banned';
  balance: number;
  joinDate: string;
  lastLogin: string;
}

interface AdminOrder {
  id: number;
  userId: number;
  type: 'BUY' | 'SELL';
  coin: string;
  amount: number;
  price: number;
  status: 'Pending' | 'Closed' | 'Cancelled';
  date: string;
  pnl?: number;
}

interface AdminAnalytics {
  totalUsers: number;
  activeUsers: number;
  totalOrders: number;
  totalVolume: number;
  totalRevenue: number;
  dailyActiveUsers: number[];
  weeklyOrders: number[];
  monthlyRevenue: number[];
}
