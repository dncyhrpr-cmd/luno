import { NextRequest } from 'next/server';

/**
 * ValidationError is thrown for client-side request issues (400-level).
 * Handlers can catch this and return a formatted response.
 */
export class ValidationError extends Error {
  status: number;
  details?: any;
  constructor(message: string, status = 400, details?: any) {
    super(message);
    this.name = 'ValidationError';
    this.status = status;
    this.details = details;
  }
}

/**
 * Safely parse JSON body from a NextRequest. Throws ValidationError on parse failure.
 */
export async function parseJsonBody<T = any>(req: NextRequest): Promise<T> {
  try {
    const body = await req.json();
    return body as T;
  } catch (err: any) {
    throw new ValidationError('Invalid JSON body', 400);
  }
}

/**
 * Ensure a set of required fields are present (not undefined/null/empty-string).
 * Throws ValidationError listing missing fields.
 */
export function requireFields(obj: any, fields: string[]) {
  const missing = fields.filter((f) => {
    if (!Object.prototype.hasOwnProperty.call(obj, f)) return true;
    const v = obj[f];
    return v === null || typeof v === 'undefined' || (typeof v === 'string' && v.trim() === '');
  });
  if (missing.length) {
    throw new ValidationError('Missing required fields', 400, { missing });
  }
}

/**
 * Parse a positive number from an input value. Throws ValidationError if invalid.
 */
export function parsePositiveNumber(value: any, fieldName = 'value'): number {
  const n = Number(value);
  if (!isFinite(n) || n <= 0) {
    throw new ValidationError(`Invalid ${fieldName}`, 400, { value });
  }
  return n;
}

/**
 * Normalize and validate an order payload from a parsed JSON body.
 * Returns a canonical shape with numeric `quantity` and `price`.
 */
export function normalizeOrderPayload(raw: any) {
  if (!raw || typeof raw !== 'object') throw new ValidationError('Missing request body', 400);

  requireFields(raw, ['type', 'symbol', 'quantity', 'price', 'leverage']);

  const type = String(raw.type).toUpperCase();
  if (!['BUY', 'SELL'].includes(type)) throw new ValidationError('Invalid order type', 400, { type });

  const orderType = raw.orderType ? String(raw.orderType).toUpperCase() : 'MARKET';
  if (!['MARKET', 'LIMIT'].includes(orderType)) throw new ValidationError('Invalid orderType', 400, { orderType });

  const symbol = String(raw.symbol).toUpperCase();
  const quantity = parsePositiveNumber(raw.quantity, 'quantity');
  const price = parsePositiveNumber(raw.price, 'price');
  const leverage = parsePositiveNumber(raw.leverage, 'leverage');

  return { type, symbol, quantity, price, orderType, leverage } as const;
}

export default {
  ValidationError,
  parseJsonBody,
  requireFields,
  parsePositiveNumber,
  normalizeOrderPayload,
};
