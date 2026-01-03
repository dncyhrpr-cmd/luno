'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const ResetPasswordPage: React.FC = () => {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const type = params.get('type');

      if (type === 'recovery' && accessToken && refreshToken) {
        supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        }).then(() => {
          setLoading(false);
        }).catch(() => {
          setError('Invalid or expired reset link.');
          setLoading(false);
        });
      } else {
        setError('Invalid reset link.');
        setLoading(false);
      }
    } else {
      setError('No reset token found.');
      setLoading(false);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    // Additional password strength validation can be added here

    setLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError('Failed to update password.');
    } else {
      setSuccess(true);
      setTimeout(() => router.push('/login'), 2000);
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="luno-login-container">
        <h1 className="luno-logo">Luno</h1>
        <div>Loading...</div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="luno-login-container">
        <h1 className="luno-logo">Luno</h1>
        <h2>Password Updated</h2>
        <div>Password updated successfully! Redirecting to login...</div>
      </div>
    );
  }

  return (
    <div className="luno-login-container">
      <h1 className="luno-logo">Luno</h1>
      <h2>Reset Your Password</h2>

      {error && (
        <div className="form-error fade-in-out">
          <strong>Error:</strong> {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="login-form">
        <div className="input-group password-group">
          <label htmlFor="password">New Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min 8 characters"
            required
            disabled={loading}
          />
        </div>

        <div className="input-group password-group">
          <label htmlFor="confirmPassword">Confirm New Password</label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter new password"
            required
            disabled={loading}
          />
        </div>

        <button
          type="submit"
          className="login-button"
          disabled={loading}
        >
          {loading ? 'Updating...' : 'Update Password'}
        </button>
      </form>
    </div>
  );
};

export default ResetPasswordPage;