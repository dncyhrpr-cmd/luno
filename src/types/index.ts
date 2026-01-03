
export interface User {
  id: string;
  email: string;
  username: string;
  role: string;
  roles: string[];
  isAdmin: boolean;
  accessToken?: string;
  migrationStatus: 'migrated' | 'legacy';
}

export type PageName =
  | 'Home'
  | 'Assets'
  | 'Market'
  | 'Orders'
  | 'Profile'
  | 'Settings'
  | 'Support'
  | 'Admin'
  | 'Login'
  | 'Signup';

export interface NavItem {
  name: string;
  page: PageName;
  icon: React.ElementType;
}
