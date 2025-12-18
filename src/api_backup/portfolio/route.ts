import { NextRequest, NextResponse } from 'next/server';
import { FirestoreDatabase } from '@/lib/firestore-db';
import { getRequestId, handleApiError, structuredLog } from '@/lib/correlation';
import { extractTokenFromRequest, verifyAccessToken } from '@/lib/auth-utils';

const firestoreDB = new FirestoreDatabase();

// GET - Fetch user's complete portfolio: balance and assets
export async function GET(request: NextRequest) {
  const reqId = getRequestId(request);
  const route = request.url;

  try {
    const token = extractTokenFromRequest(request);
    if (!token) {
      structuredLog('WARN', reqId, 'Unauthorized: Missing token', { route, status: 401 });
      return NextResponse.json({ error: 'Unauthorized', correlationId: reqId }, { status: 401 });
    }

    const payload = await verifyAccessToken(token);
    const userId = payload.userId;
    structuredLog('INFO', reqId, 'Token verified, fetching portfolio', { route, userId });

    // Atomically fetch user and assets
    const [user, assets] = await Promise.all([
      firestoreDB.findUserById(userId),
      firestoreDB.getAssets(userId),
    ]);

    if (!user) {
      structuredLog('ERROR', reqId, 'User not found for portfolio', { userId, status: 404 });
      return NextResponse.json({ error: 'User not found.', correlationId: reqId }, { status: 404 });
    }

    // In a real-world scenario, you might enrich asset data with real-time prices here
    // For now, we use the stored average price.

    const totalAssetValue = assets.reduce((sum, asset) => sum + (asset.quantity * asset.averagePrice), 0);
    const totalPortfolioValue = user.balance + totalAssetValue;

    structuredLog('INFO', reqId, 'Successfully fetched portfolio', { userId, status: 200, assetCount: assets.length });

    return NextResponse.json({
      balance: user.balance,
      assets,
      totalPortfolioValue,
      correlationId: reqId
    });

  } catch (error: any) {
    if (error.name === 'JWTExpired' || error.name === 'JWSInvalid') {
      structuredLog('WARN', reqId, 'Auth token error', { route, error: error.message, status: 401 });
      return NextResponse.json({ error: 'Invalid or expired token', correlationId: reqId }, { status: 401 });
    }
    return handleApiError(reqId, error, route, 'Portfolio fetch failed');
  }
}

// POST - Deposit or withdraw funds from user's balance
export async function POST(request: NextRequest) {
  const reqId = getRequestId(request);
  const route = request.url;

  try {
    const token = extractTokenFromRequest(request);
    if (!token) {
      structuredLog('WARN', reqId, 'Unauthorized: Missing token for transaction', { route, status: 401 });
      return NextResponse.json({ error: 'Unauthorized', correlationId: reqId }, { status: 401 });
    }

    const payload = await verifyAccessToken(token);
    const userId = payload.userId;
    const { amount, type } = await request.json();

    structuredLog('INFO', reqId, 'Transaction request received', { route, userId, type, amount });

    // --- Input Validation ---
    if (!['deposit', 'withdraw'].includes(type) || typeof amount !== 'number' || amount <= 0) {
        structuredLog('WARN', reqId, 'Invalid transaction request', { userId, type, amount, status: 400 });
        return NextResponse.json({ error: 'Invalid type or amount. Amount must be positive.', correlationId: reqId }, { status: 400 });
    }

    // --- User and Balance Check ---
    const user = await firestoreDB.findUserById(userId);
    if (!user) {
      structuredLog('ERROR', reqId, 'User not found for transaction', { userId, status: 404 });
      return NextResponse.json({ error: 'User not found.', correlationId: reqId }, { status: 404 });
    }

    let newBalance;
    const balanceBefore = user.balance;

    if (type === 'deposit') {
      newBalance = balanceBefore + amount;
    } else { // withdraw
      if (balanceBefore < amount) {
        structuredLog('WARN', reqId, 'Insufficient balance for withdrawal', { userId, balance: balanceBefore, amount, status: 400 });
        return NextResponse.json({ error: 'Insufficient balance', correlationId: reqId }, { status: 400 });
      }
      newBalance = balanceBefore - amount;
    }

    // --- Database Operations ---
    await firestoreDB.updateUserBalance(userId, newBalance);

    // Create a transaction history record
    await firestoreDB.createTransactionHistory({
        userId,
        type: type as 'deposit' | 'withdraw',
        amount,
        description: `${type.charAt(0).toUpperCase() + type.slice(1)} of $${amount.toFixed(2)}`,
        status: 'completed',
        balanceBefore,
        balanceAfter: newBalance,
    });

    structuredLog('INFO', reqId, 'Transaction successful', { userId, type, amount, newBalance, status: 200 });

    return NextResponse.json({
      message: `${type.charAt(0).toUpperCase() + type.slice(1)} successful`,
      newBalance,
      correlationId: reqId
    });

  } catch (error: any) {
     if (error.name === 'JWTExpired' || error.name === 'JWSInvalid') {
      structuredLog('WARN', reqId, 'Auth token error on transaction', { route, error: error.message, status: 401 });
      return NextResponse.json({ error: 'Invalid or expired token', correlationId: reqId }, { status: 401 });
    }
    return handleApiError(reqId, error, route, 'Portfolio transaction failed');
  }
}
