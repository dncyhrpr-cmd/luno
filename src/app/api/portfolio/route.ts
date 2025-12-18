import { NextRequest, NextResponse } from 'next/server';
import { FirestoreDatabase } from '@/lib/firestore-db';
import { extractTokenFromRequest, verifyAccessToken } from '@/lib/auth-utils';

const firestoreDB = new FirestoreDatabase();

// GET - Fetch user's complete portfolio: balance and assets
export async function GET(request: NextRequest) {
  try {
    const token = extractTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyAccessToken(token);
    const userId = payload.userId;

    // Atomically fetch user and assets
    const [user, assets] = await Promise.all([
      firestoreDB.findUserById(userId),
      firestoreDB.getAssets(userId),
    ]);

    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    const totalAssetValue = assets.reduce((sum, asset) => sum + (asset.quantity * asset.averagePrice), 0);
    const totalPortfolioValue = user.balance + totalAssetValue;

    return NextResponse.json({
      balance: user.balance,
      assets,
      totalPortfolioValue,
    });

  } catch (error: any) {
    if (error.name === 'JWTExpired' || error.name === 'JWSInvalid') {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Portfolio fetch failed' }, { status: 500 });
  }
}

// POST - Deposit or withdraw funds from user's balance
export async function POST(request: NextRequest) {
  try {
    const token = extractTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyAccessToken(token);
    const userId = payload.userId;
    const { amount, type } = await request.json();

    // Input Validation
    if (!['deposit', 'withdraw'].includes(type) || typeof amount !== 'number' || amount <= 0) {
        return NextResponse.json({ error: 'Invalid type or amount. Amount must be positive.' }, { status: 400 });
    }

    // User and Balance Check
    const user = await firestoreDB.findUserById(userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    let newBalance;
    const balanceBefore = user.balance;

    if (type === 'deposit') {
      newBalance = balanceBefore + amount;
    } else { // withdraw
      if (balanceBefore < amount) {
        return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
      }
      newBalance = balanceBefore - amount;
    }

    // Database Operations
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

    return NextResponse.json({
      message: `${type.charAt(0).toUpperCase() + type.slice(1)} successful`,
      newBalance,
    });

  } catch (error: any) {
     if (error.name === 'JWTExpired' || error.name === 'JWSInvalid') {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Portfolio transaction failed' }, { status: 500 });
  }
}