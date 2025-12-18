'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Eye, EyeOff, Loader, AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';

const LoginPage: React.FC = () => {
  const router = useRouter();
  const { login, isAuthenticated: isLoggedIn, isLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isAttemptingLogin, setIsAttemptingLogin] = useState(false);
 
  const isBusy = isLoading || isAttemptingLogin;

  const displayError = localError || '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');

    if (!email || !password) {
      setLocalError('Please enter both email and password.');
      return;
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setLocalError('Please enter a valid email address.');
        return;
    }

    setIsAttemptingLogin(true);

    try {
      const errorMsg = await login(email, password);
      
      if (errorMsg) {
        setLocalError(errorMsg);
      } else {
        router.push('/');
      }

    } catch (error: any) {
      setLocalError('Unexpected error during login.');
    } finally {
      setIsAttemptingLogin(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      router.push('/');
    }
  }, [isLoggedIn, router]);

  if (isLoggedIn) {
    return (
      <div className="luno-redirect-message">
        <h2>🎉 Welcome back to Luno!</h2>
        <p>You are already logged in. Redirecting to your dashboard...</p>
        <p className="security-note">
          If you're not automatically redirected,{' '}
          <button 
            onClick={() => router.push('/')}
            className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            click here to go to dashboard
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="luno-login-container">
      <h1 className="luno-logo">Luno</h1>
      <h2>Secure Account Access</h2>

      {displayError && (
        <div className="form-error fade-in-out">
          <AlertTriangle className="icon-alert" size={18} />
          <strong>Error:</strong> {displayError}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className={`login-form ${isBusy ? 'form-loading-animation' : ''}`}>
        
        <div className="input-group">
          <label htmlFor="email">Email Address</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g., satoshi@luno.io"
            required
            disabled={isBusy}
          />
        </div>

        <div className="input-group password-group">
          <label htmlFor="password">Password</label>
          <div className="password-input-wrapper">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 8 characters"
              required
              disabled={isBusy}
            />
            <button
              type="button"
              className="password-toggle-button"
              onClick={() => setShowPassword(!showPassword)}
              disabled={isBusy}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <a href="/forgot-password" className="forgot-password-link">
            Forgot Password?
          </a>
        </div>

        <button 
          type="submit" 
          className={`login-button ${isBusy ? 'button-busy' : 'button-ready'}`}
          disabled={isBusy}
        >
          {isBusy ? (
            <div className="loading-content">
                <Loader className="loading-spinner" size={20} />
                <span>Logging In...</span>
            </div>
          ) : (
            'Log In to Your Wallet'
          )}
        </button>

        <p className="security-note">
          Your security is our priority. We use industry-leading encryption.
        </p>
      </form>
      
      <div className="signup-prompt">
        <p>Don't have an account? <a href="/signup">Sign Up Now</a></p>
      </div>
    </div>
  );
};

export default LoginPage;
