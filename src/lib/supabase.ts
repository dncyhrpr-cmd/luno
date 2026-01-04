// Supabase client - Using Firestore-only system
// Password reset is handled through custom Firestore implementation

// Mock Supabase client to prevent import errors
export const supabase = {
  auth: {
    resetPasswordForEmail: async () => ({ data: null, error: null }),
    signUp: async () => ({ error: null }),
    setSession: async () => ({}),
    updateUser: async () => ({ error: null })
  }
};