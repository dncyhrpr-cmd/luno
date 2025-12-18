'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Eye, EyeOff, Loader, AlertTriangle, User, Mail, Lock } from 'lucide-react';

const SignupPage: React.FC = () => {
  const router = useRouter();
  const { signup } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = () => {
    if (!name || !email || !password || !confirmPassword) {
      setLocalError('Please fill in all fields.');
      return false;
    }

    if (name.length < 2) {
      setLocalError('Name must be at least 2 characters long.');
      return false;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setLocalError('Please enter a valid email address.');
      return false;
    }

    if (password.length < 8) {
      setLocalError('Password must be at least 8 characters long.');
      return false;
    }

    if (password !== confirmPassword) {
      setLocalError('Passwords do not match.');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const errorMsg = await signup(name, email, password);

      if (errorMsg) {
        setLocalError(errorMsg);
      } else {
        router.push('/'); // On success, redirect to the main dashboard
      }
    } catch (error: any) {
      setLocalError('An unexpected error occurred during signup. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="luno-login-container">
      <h1 className="luno-logo">Luno</h1>
      <h2>Create Your Account</h2>

      {localError && (
        <div className="form-error fade-in-out">
          <AlertTriangle className="icon-alert" size={18} />
          <strong>Error:</strong> {localError}
        </div>
      )}

      <form onSubmit={handleSubmit} className={`login-form ${isSubmitting ? 'form-loading-animation' : ''}`}>
        
        <div className="input-group">
          <label htmlFor="name">
            <User className="inline w-4 h-4 mr-1" />
            Full Name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your full name"
            required
            disabled={isSubmitting}
          />
        </div>

        <div className="input-group">
          <label htmlFor="email">
            <Mail className="inline w-4 h-4 mr-1" />
            Email Address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g., satoshi@luno.io"
            required
            disabled={isSubmitting}
          />
        </div>

        <div className="input-group">
          <label htmlFor="password">
            <Lock className="inline w-4 h-4 mr-1" />
            Password
          </label>
          <div className="password-input-wrapper">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 8 characters"
              required
              disabled={isSubmitting}
            />
            <button
              type="button"
              className="password-toggle-button"
              onClick={() => setShowPassword(!showPassword)}
              disabled={isSubmitting}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div className="input-group">
          <label htmlFor="confirmPassword">
            <Lock className="inline w-4 h-4 mr-1" />
            Confirm Password
          </label>
          <div className="password-input-wrapper">
            <input
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              required
              disabled={isSubmitting}
            />
            <button
              type="button"
              className="password-toggle-button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              disabled={isSubmitting}
              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
            >
              {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <button 
          type="submit" 
          className={`login-button ${isSubmitting ? 'button-busy' : 'button-ready'}`}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <div className="loading-content">
                <Loader className="loading-spinner" size={20} />
                <span>Creating Account...</span>
            </div>
          ) : (
            'Create Your Account'
          )}
        </button>

        <p className="security-note">
          By creating an account, you agree to our Terms of Service and Privacy Policy.
          We use industry-leading encryption to protect your data.
        </p>
      </form>
      
      <div className="signup-prompt">
        <p>Already have an account? <a href="/login">Log In Now</a></p>
      </div>
    </div>
  );
};

export default SignupPage;
