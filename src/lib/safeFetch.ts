export interface SafeFetchResult<T = any> {
  ok: boolean;
  status?: number;
  data?: T;
  error?: string;
  headers?: Headers;
}

/**
 * safeFetch: wrapper around window.fetch that retries on network errors (TypeError: Failed to fetch).
 * Returns a normalized result object instead of throwing, and logs errors for debugging.
 */
export async function safeFetch<T = any>(input: RequestInfo, init?: RequestInit, retries = 2, retryDelay = 800): Promise<SafeFetchResult<T>> {
  let attempt = 0;
  while (attempt <= retries) {
    try {
      const resp = await fetch(input, init);
      const contentType = resp.headers.get('content-type') || '';
      let body: any = null;
      if (contentType.includes('application/json')) {
        try {
          body = await resp.json();
        } catch (e) {
          body = null;
        }
      } else {
        try {
          body = await resp.text();
        } catch (e) {
          body = null;
        }
      }

      if (!resp.ok) {
        const details = body && typeof body === 'object' ? (body.details || body.error || body.message || JSON.stringify(body)) : body;
        return { ok: false, status: resp.status, error: details ? String(details) : `HTTP ${resp.status}`, headers: resp.headers };
      }

      return { ok: true, status: resp.status, data: body, headers: resp.headers };
    } catch (err: any) {
      // Network-level error, often TypeError: Failed to fetch
      const message = String(err || '');
      const isNetworkError = err instanceof TypeError || message.toLowerCase().includes('failed to fetch') || message.toLowerCase().includes('networkerror');
      attempt += 1;
      if (attempt > retries || !isNetworkError) {
        // Provide extra guidance for common browser-side failures (CORS, mixed-content, redirect loops)
        let guidance = '';
        if (message.toLowerCase().includes('failed to fetch')) {
          guidance = ' Possible causes: server unavailable, CORS policy blocking the request, mixed-content (https vs http), or a redirect loop. Check browser DevTools Network tab and server logs.';
        } else if (message.toLowerCase().includes('too many redirects') || message.toLowerCase().includes('redirect')) {
          guidance = ' The request encountered too many redirects (ERR_TOO_MANY_REDIRECTS). Check server-side redirects or middleware that may be redirecting the request repeatedly.';
        }

        console.error('safeFetch final error for', input, err, guidance);
        return { ok: false, error: `${message}${guidance}` };
      }

      // wait before retrying
      await new Promise(res => setTimeout(res, retryDelay * attempt));
      console.warn(`safeFetch retrying (${attempt}/${retries}) for ${input}: ${message}`);
      continue;
    }
  }

  return { ok: false, error: 'Exceeded retry attempts' };
}
