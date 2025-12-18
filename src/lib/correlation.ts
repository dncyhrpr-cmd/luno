
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

/**
 * Retrieves the request ID from the 'x-request-id' header or generates a new one.
 * @param req The incoming NextRequest.
 * @returns The correlation ID string.
 */
export function getRequestId(req: NextRequest): string {
  return req.headers.get('x-request-id') ?? randomUUID();
}

// A simple structured logger utility. In a production environment, this would
// integrate with a logging aggregation service (e.g., Pino/Winston/GCP Logging).
type LogLevel = 'INFO' | 'WARN' | 'ERROR';

interface LogPayload {
  level: LogLevel;
  reqId: string;
  timestamp: string;
  [key: string]: any;
}

/**
 * Custom structured logging function.
 * @param level The log level ('INFO', 'WARN', 'ERROR').
 * @param reqId The correlation ID for the request.
 * @param message A brief message describing the event.
 * @param context Additional structured data for the log.
 */
export function structuredLog(level: LogLevel, reqId: string, message: string, context: Record<string, any> = {}) {
  const payload: LogPayload = {
    level,
    reqId,
    timestamp: new Date().toISOString(),
    message,
    ...context,
  };
  
  // Use console.error for ERROR, console.warn for WARN, console.log for INFO
  // Stringify the payload to ensure structured (JSON) logging.
  const logEntry = JSON.stringify(payload);
  
  if (level === 'ERROR') {
    console.error(logEntry);
  } else if (level === 'WARN') {
    console.warn(logEntry);
  } else {
    console.log(logEntry);
  }
}

/**
 * Standardized error handling wrapper for API routes.
 * This function logs the error and returns a standardized JSON response 
 * including the correlation ID.
 * @param reqId The correlation ID for the request.
 * @param err The error object caught.
 * @param route The API route URL.
 * @param message An optional friendly error message for logging.
 * @param status The HTTP status code to return (default 500).
 * @returns A NextResponse object with a JSON error response.
 */
export function handleApiError(
  reqId: string,
  err: any,
  route: string,
  message?: string,
  status: number = 500
): NextResponse {
  structuredLog('ERROR', reqId, message || 'Unhandled API error', {
    route,
    errorName: err.name,
    errorMessage: err.message,
    stack: err.stack,
  });

  // Return a more descriptive error message to the client
  const clientError = err.message || 'An unexpected error occurred. Please check server logs for details.';

  return NextResponse.json(
    { error: clientError, correlationId: reqId },
    { status }
  );
}
