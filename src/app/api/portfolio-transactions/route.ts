import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromRequest, verifyAccessToken } from '@/lib/auth-utils';
import { collections } from '@/lib/db';
import admin from 'firebase-admin';

export async function GET(request: NextRequest) {
  try {
    const token = extractTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyAccessToken(token);
    const userId = payload.userId;

    // Fetch user data
    const userDoc = await collections.users.doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const user = userDoc.data() as any;

    // Fetch assets
    const assetsSnapshot = await collections.assets.where('userId', '==', userId).get();
    const assets = assetsSnapshot.docs.map((doc: admin.firestore.DocumentSnapshot) => ({ id: doc.id, ...doc.data() }));

    // Fetch orders
    const ordersSnapshot = await collections.orders.where('userId', '==', userId).orderBy('createdAt', 'desc').get();
    const orders = ordersSnapshot.docs.map((doc: admin.firestore.DocumentSnapshot) => ({ id: doc.id, ...doc.data() }));

    // Fetch transaction requests
    const requestsSnapshot = await collections.requests.where('userId', '==', userId).orderBy('createdAt', 'desc').get();
    const transactionRequests = requestsSnapshot.docs.map((doc: admin.firestore.DocumentSnapshot) => ({ id: doc.id, ...doc.data() }));

    // Fetch transaction history
    const historySnapshot = await collections.transactionHistory.where('userId', '==', userId).orderBy('createdAt', 'desc').get();
    const transactionHistory = historySnapshot.docs.map((doc: admin.firestore.DocumentSnapshot) => ({ id: doc.id, ...doc.data() }));

    // Fetch active binary orders
    const activeBinaryOrdersSnapshot = await collections.orders
      .where('userId', '==', userId)
      .where('status', '==', 'active')
      .where('orderType', '==', 'binary')
      .get();
    const activeBinaryOrders = activeBinaryOrdersSnapshot.docs.map((doc: admin.firestore.DocumentSnapshot) => ({ id: doc.id, ...doc.data() }));

    // Create temporary assets from active binary orders
    const tempAssets = activeBinaryOrders.map((order: any) => ({
      id: `temp-${order.id}`,
      userId: order.userId,
      symbol: `BINARY-${order.id}`,
      quantity: 1,
      averagePrice: order.amount || 0,
      currentPrice: order.amount || 0,
      createdAt: order.createdAt,
    }));

    const allAssets = [...assets, ...tempAssets];

    // Calculate total portfolio value
    const totalPortfolioValue = user.balance + allAssets.reduce((sum: number, asset: any) => {
      const price = asset.currentPrice || asset.averagePrice;
      return sum + (asset.quantity * price);
    }, 0);

    const portfolio = {
      balance: user.balance,
      assets: assets,
      totalPortfolioValue
    };

    const response = {
      portfolio: {
        ...portfolio,
        assets: allAssets
      },
      orders: orders,
      requests: transactionRequests,
      transactionHistory: transactionHistory
    };

    return NextResponse.json(response);
  } catch (error: any) {
    if (error.name === 'JWTExpired' || error.name === 'JWSInvalid') {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }
    console.error('Portfolio transactions fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch portfolio transactions' }, { status: 500 });
  }
}