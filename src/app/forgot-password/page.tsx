'use client';

import React, { useState } from 'react';
import { Loader, AlertTriangle, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

const ForgotPasswordPage: React.FC = () => {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [localError, setLocalError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isAttemptingReset, setIsAttemptingReset] = useState(false);

  const displayError = localError;
  const isBusy = isAttemptingReset;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    setSuccessMessage('');

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setLocalError('Please enter a valid email address.');
      return;
    }

    setIsAttemptingReset(true);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccessMessage('Check your email for a reset link.');
      } else {
        setLocalError(data.error || 'Failed to send reset email.');
      }
    } catch (error: any) {
      setLocalError('Unexpected error during password reset.');
    } finally {
      setIsAttemptingReset(false);
    }
  };

  return (
    <div className="luno-login-container">
      <h1 className="luno-logo">Luno</h1>
      <h2>Forgot Password</h2>

      {displayError && (
        <div className="form-error fade-in-out">
          <AlertTriangle className="icon-alert" size={18} />
          <strong>Error:</strong> {displayError}
        </div>
      )}

      {successMessage && (
        <div className="form-success fade-in-out">
          <strong>Success:</strong> {successMessage}
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

        <button
          type="submit"
          className={`login-button ${isBusy ? 'button-busy' : 'button-ready'}`}
          disabled={isBusy}
        >
          {isBusy ? (
            <div className="loading-content">
              <Loader className="loading-spinner" size={20} />
              <span>Sending...</span>
            </div>
          ) : (
            'Send Reset Email'
          )}
        </button>
      </form>

      <div className="signup-prompt">
        <button
          onClick={() => router.push('/login')}
          className="flex items-center font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          <ArrowLeft size={16} className="mr-1" />
          Back to Login
        </button>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;