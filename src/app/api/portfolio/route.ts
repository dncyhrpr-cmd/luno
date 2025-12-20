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

    // Fetch from Firestore
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

// POST - Create transaction request for admin approval
export async function POST(request: NextRequest) {
  try {
    const token = extractTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyAccessToken(token);
    const userId = payload.userId;
    const { amount, type, bankName, holderName, accountNumber, ifscCode } = await request.json();

    // Input Validation
    if (!['deposit', 'withdraw'].includes(type) || typeof amount !== 'number' || amount <= 0) {
        return NextResponse.json({ error: 'Invalid type or amount. Amount must be positive.' }, { status: 400 });
    }

    // Create transaction request for admin approval
    const requestData: any = {
      userId,
      type: type as 'deposit' | 'withdraw',
      amount,
    };

    // Only include bank details if they are provided and not empty
    if (type === 'withdraw') {
      if (bankName && bankName.trim()) requestData.bankName = bankName.trim();
      if (holderName && holderName.trim()) requestData.holderName = holderName.trim();
      if (accountNumber && accountNumber.trim()) requestData.accountNumber = accountNumber.trim();
      if (ifscCode && ifscCode.trim()) requestData.ifscCode = ifscCode.trim();
    }

    const transactionRequest = await firestoreDB.createTransactionRequest(requestData);

    return NextResponse.json({
      message: `${type.charAt(0).toUpperCase() + type.slice(1)} request submitted for approval`,
      requestId: transactionRequest.id,
    });
  } catch (error: any) {
    if (error.name === 'JWTExpired' || error.name === 'JWSInvalid') {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Request submission failed' }, { status: 500 });
  }
}