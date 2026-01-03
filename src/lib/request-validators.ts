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

  // Check if it's a binary trade
  if (raw.direction && raw.period) {
    requireFields(raw, ['symbol', 'direction', 'period', 'amount', 'profitPercent', 'price']);
    
    const direction = String(raw.direction).toUpperCase();
    if (!['UP', 'DOWN'].includes(direction)) throw new ValidationError('Invalid direction', 400, { direction });
    
    const period = parsePositiveNumber(raw.period, 'period');
    const amount = parsePositiveNumber(raw.amount, 'amount');
    const profitPercent = parsePositiveNumber(raw.profitPercent, 'profitPercent');
    const price = parsePositiveNumber(raw.price, 'price');
    const symbol = String(raw.symbol).toUpperCase();

    return { 
      isBinary: true, 
      symbol, 
      direction, 
      period, 
      amount, 
      profitPercent, 
      price 
    } as const;
  }

  requireFields(raw, ['type', 'symbol', 'quantity', 'price', 'leverage']);

  const type = String(raw.type).toUpperCase();
  if (!['BUY', 'SELL'].includes(type)) throw new ValidationError('Invalid order type', 400, { type });

  const orderType = raw.orderType ? String(raw.orderType).toUpperCase() : 'MARKET';
  if (!['MARKET', 'LIMIT'].includes(orderType)) throw new ValidationError('Invalid orderType', 400, { orderType });

  const symbol = String(raw.symbol).toUpperCase();
  
  // Validate symbol format
  if (!/^[A-Z]{2,}USDT$/.test(symbol) && !/^[A-Z]{2,}$/.test(symbol)) {
    throw new ValidationError('Invalid symbol format', 400, { symbol });
  }

  const quantity = parsePositiveNumber(raw.quantity, 'quantity');
  if (quantity > 1000000) {
    throw new ValidationError('Order quantity too large', 400, { quantity });
  }

  const price = parsePositiveNumber(raw.price, 'price');
  if (price > 1000000) {
    throw new ValidationError('Order price too high', 400, { price });
  }

  const leverage = parsePositiveNumber(raw.leverage, 'leverage');
  const MAX_LEVERAGE = 100;
  if (leverage > MAX_LEVERAGE) {
    throw new ValidationError(`Leverage cannot exceed ${MAX_LEVERAGE}x`, 400, { leverage, maxLeverage: MAX_LEVERAGE });
  }
  if (leverage < 1) {
    throw new ValidationError('Leverage must be at least 1x', 400, { leverage });
  }

  return { type, symbol, quantity, price, orderType, leverage } as const;
}

export default {
  ValidationError,
  parseJsonBody,
  requireFields,
  parsePositiveNumber,
  normalizeOrderPayload,
};
