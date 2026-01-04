import { useAuth } from '@/context/AuthContext';
import { safeFetch, SafeFetchResult } from './safeFetch';
import { useCallback } from 'react';

export function useAuthFetch() {
  const { accessToken, refreshTokens } = useAuth();

  const authFetch = useCallback(async <T = any>(
    input: RequestInfo,
    init?: RequestInit,
    retries = 2,
    retryDelay = 800
  ): Promise<SafeFetchResult<T>> => {
    // Ensure API calls use the correct base URL
    let apiUrl = input as string;
    if (typeof input === 'string' && input.startsWith('/api/')) {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? '';
      apiUrl = `${baseUrl}${input}`;
    }

    // Add authorization header if we have a token
    const headers = new Headers(init?.headers);
    if (accessToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }

    const authInit = { ...init, headers };

    let result = await safeFetch<T>(apiUrl, authInit, retries, retryDelay);

    // If unauthorized and we have a token, try refreshing once
    if (result.status === 401 && accessToken) {
      const refreshSuccess = await refreshTokens();
      if (refreshSuccess) {
        // Retry with new token
        const newHeaders = new Headers(init?.headers);
        const newToken = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
        if (newToken) {
          newHeaders.set('Authorization', `Bearer ${newToken}`);
        }
        const newInit = { ...init, headers: newHeaders };
        result = await safeFetch<T>(input, newInit, retries, retryDelay);
      }
    }

    return result;
  }, [accessToken, refreshTokens]);

  return authFetch;
}