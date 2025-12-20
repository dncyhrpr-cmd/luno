
export interface User {
  id: string;
  email: string;
  username: string;
  role: 'admin' | 'trader' | 'guest';
  roles: Array<'admin' | 'trader' | 'guest'>;
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
