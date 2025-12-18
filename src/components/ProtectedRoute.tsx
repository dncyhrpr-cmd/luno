'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext'; // Assuming useAuth now provides { isAuthenticated, isLoading, user }
import { useNotification } from './ClientProviders';
import LoginPage from '@/components/pages/LoginPage';
import { AlertTriangle } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Optional: The minimum required role to access this route. */
  requiredRole?: 'admin' | 'trader' | 'guest'; 
}

// --- New: Loading Spinner Component (Simulated) ---
// In a real app, this would be a custom Tailwind/Lottie component.
const LoadingSpinner: React.FC = () => (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-500"></div>
        <p className="mt-4 text-lg font-medium text-gray-700 dark:text-gray-300">Checking credentials...</p>
    </div>
);


const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole }) => {
 // Assuming useAuth now returns these enhanced values
 const { isAuthenticated, isLoading, user } = useAuth();
     const { addNotification } = useNotification();

    // 1. Handle Loading State
    if (isLoading) {
        return <LoadingSpinner />;
    }

    // 2. Handle Authentication Check (Not Logged In)
if (!isAuthenticated) {
        // Show a temporary notification explaining the block (Better UX)
        // addNotification('Please log in to access this page.', 'warning');

        // Render the login page directly, as full client-side redirection
        // can be complex without a dedicated routing library (like Next.js/React Router Navigate)
return <LoginPage />; // Pass current path for post-login redirect
}
    
    // 3. Handle Authorization Check (Logged In but wrong role)
    if (requiredRole && user?.role !== requiredRole) {
        const roleCheckFailed = true;

        if (roleCheckFailed) {
            // Note: In a real app, you would compare user.role against requiredRole
            
            addNotification(`Access Denied: You need the "${requiredRole}" role to view this page.`, 'error');
            
            // Redirect to a dashboard or unauthorized page instead of the login page
            // Since we can't use React Router's Navigate, we render a static error page.
            return (
                <div className="flex flex-col items-center justify-center min-h-screen bg-red-50 dark:bg-red-900/10 p-8">
                    <AlertTriangle className='w-12 h-12 text-red-500 mb-4' />
                    <h2 className="text-2xl font-bold text-red-700 dark:text-red-400">403 - Forbidden Access</h2>
                    <p className="mt-2 text-gray-700 dark:text-gray-300">
                        You do not have the necessary permissions to view this resource.
                    </p>
                    <a 
                        href="/" 
                        className="mt-6 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                    >
                        Go to Dashboard
                    </a>
                </div>
            );
        }
    }

    // 4. Access Granted
    return <>{children}</>;
};

export default ProtectedRoute;