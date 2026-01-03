'use client';

// Client-side database utilities - moved to Supabase
// For now, providing stubs to avoid import errors
// TODO: Implement Supabase client when needed

export const getDb = () => {
  throw new Error('Firebase has been replaced with Supabase. Use API routes for data access.');
};

export const getAuth2 = () => {
  throw new Error('Firebase Auth has been replaced with custom JWT authentication.');
};

export const storage = null;
