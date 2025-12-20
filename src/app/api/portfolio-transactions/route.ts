import { NextRequest, NextResponse } from 'next/server';
import { FirestoreDatabase } from '@/lib/firestore-db';
import { extractTokenFromRequest, verifyAccessToken } from '@/lib/auth-utils';

const firestoreDB = new FirestoreDatabase();

// GET - Fetch user's complete portfolio and transactions data
export async function GET(request: NextRequest) {
  console.log('Portfolio-transactions API called');
  try {
    const token = extractTokenFromRequest(request);
    if (!token) {
      console.log('No token found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyAccessToken(token);
    const url = new URL(request.url);
    const requestedUserId = url.searchParams.get('userId');
    const userId = requestedUserId || payload.userId;

    // Check if user is admin to allow viewing other users
    if (requestedUserId) {
      const currentUser = await firestoreDB.findUserById(payload.userId);
      if (!currentUser || !currentUser.roles.includes('admin')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Fetch all data in parallel
    const [user, assets, orders, requests, transactionHistory] = await Promise.all([
      firestoreDB.findUserById(userId),
      firestoreDB.getAssets(userId),
      firestoreDB.getOrders(userId),
      firestoreDB.getUserRequests(userId),
      firestoreDB.getTransactionHistory(userId),
    ]);

    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    const totalAssetValue = assets.reduce((sum, asset) => sum + (asset.quantity * asset.averagePrice), 0);
    const totalPortfolioValue = user.balance + totalAssetValue;

    return NextResponse.json({
      portfolio: {
        balance: user.balance,
        assets,
        totalPortfolioValue,
      },
      orders,
      requests,
      transactionHistory,
    });

  } catch (error: any) {
    console.error('API Error:', error);
    if (error.name === 'JWTExpired' || error.name === 'JWSInvalid') {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to fetch portfolio and transactions' }, { status: 500 });
  }
}