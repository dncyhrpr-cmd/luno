// Note: In a production environment, this in-memory store should be replaced 
// with a persistent, distributed store like Redis (e.g., using Redis ZSETs for attempts).
// The async structure is kept here to mimic a network-based store.

interface RateLimitData {
  attempts: number[]; // Array of timestamps for attempts within the window
  blockedUntil: number; // Timestamp until which the key is blocked
}

// In-memory store for development/conceptual use
const store = new Map<string, RateLimitData>();

// Constants for login rate limiting (Brute Force Protection)
export const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const LOGIN_MAX_ATTEMPTS = 5;

/**
 * Executes a rate limit check and update for a given key (e.g., IP or user/email combination).
 * This implements a combination of sliding log (for attempts) and fixed ban (for blocking).
 * It is structured as an async function to mimic interaction with an external store (like Redis).
 * @param key The identifier to rate limit (e.g., ip:email).
 * @param windowMs The time window in milliseconds (default 15 minutes).
 * @param maxAttempts The maximum allowed attempts within the window (default 5).
 * @returns A promise resolving to an object indicating allowance status, reset time, and limit.
 */
export async function checkAndIncrementRateLimit(
  key: string,
  windowMs: number = LOGIN_WINDOW_MS,
  maxAttempts: number = LOGIN_MAX_ATTEMPTS
): Promise<{ allowed: boolean; resetInMs?: number; limit: number; remaining?: number }> {
  
  // Simulate async store access
  let data: RateLimitData = store.get(key) || { attempts: [], blockedUntil: 0 };
  const now = Date.now();

  // 1. Check if currently blocked (Brute Force Protection)
  if (data.blockedUntil > now) {
    return { 
      allowed: false, 
      resetInMs: data.blockedUntil - now, 
      limit: maxAttempts, 
      remaining: 0 
    };
  }

  // 2. Drop old attempts outside the sliding window
  data.attempts = data.attempts.filter(ts => now - ts < windowMs);
  
  // 3. Check if limit is reached
  if (data.attempts.length >= maxAttempts) {
    // Block the key for the entire window duration
    data.blockedUntil = now + windowMs;
    store.set(key, data);
    return { 
      allowed: false, 
      resetInMs: windowMs, 
      limit: maxAttempts, 
      remaining: 0 
    };
  }

  // 4. Increment the attempt count
  data.attempts.push(now);
  store.set(key, data);
  
  return { 
    allowed: true, 
    limit: maxAttempts, 
    remaining: maxAttempts - data.attempts.length 
  };
}

/**
 * Cleanup function for expired records in the in-memory store.
 * Not strictly necessary for the new implementation but kept for maintenance.
 */
export function cleanupExpiredRecords() {
  const now = Date.now();
  for (const [key, data] of store.entries()) {
    // We only need to check blockedUntil to clean up, as successful keys 
    // are naturally cleaned by the filter inside checkAndIncrementRateLimit.
    if (data.blockedUntil < now && data.attempts.length === 0) {
      store.delete(key);
    }
  }
}

// Start cleanup interval if running in a Node.js environment
// This interval is only useful if this module persists in a long-running process
if (typeof window === 'undefined') {
  setInterval(cleanupExpiredRecords, LOGIN_WINDOW_MS / 5); 
}
