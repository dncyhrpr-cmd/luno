import { NextRequest, NextResponse } from 'next/server';
import { collections } from '@/lib/db';
import admin from 'firebase-admin';
import { getRequestId, handleApiError, structuredLog } from '@/lib/correlation';
import { verifyAdmin } from '@/lib/auth-utils';

// GET - Fetch all binary trades
export async function GET(request: NextRequest) {
  const reqId = getRequestId(request);
  const route = request.url;

  const adminPayload = await verifyAdmin(request, reqId);
  if (!adminPayload) {
    return NextResponse.json({ error: 'Unauthorized or Forbidden', correlationId: reqId }, { status: 403 });
  }

  try {
    structuredLog('INFO', reqId, 'Fetching all active trades', { adminId: adminPayload.userId });

    // Get all active orders (not resolved)
    const ordersSnapshot = await collections.orders.get();
    const activeOrders = ordersSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter((order: any) => !['win', 'loss'].includes(order.status));

    console.log('Found active orders:', activeOrders.length);

    // Get binary assets for binary orders
    const binaryAssetsSnapshot = await collections.assets
      .where('symbol', '>=', 'BINARY-')
      .where('symbol', '<', 'BINARY-~')
      .get();

    const binaryAssets = await Promise.all(binaryAssetsSnapshot.docs.map(async (doc) => {
      const asset = { id: doc.id, ...doc.data() } as any;
      const userDoc = await collections.users.doc(asset.userId).get();
      const user = userDoc.exists ? userDoc.data() : null;
      return { ...asset, user: { id: user?.id, username: user?.username } };
    }));

    console.log('Found binary assets:', binaryAssets.length);

    // Combine data for active trades
    const trades = activeOrders.map((order: any) => {
      const isBinary = order.orderType === 'binary' || order.direction !== null;
      const asset = isBinary ? binaryAssets.find((a: any) => a.symbol === `BINARY-${order.id}`) : null;
      const isResolved = order.status === 'win' || order.status === 'loss';
      const canResolve = isBinary && !isResolved && order.status === 'active' && asset !== null;

      return {
        id: order.id,
        assetId: asset?.id || null,
        userId: order.userId,
        username: asset?.user?.username || 'Unknown',
        symbol: order.symbol,
        quantity: order.quantity,
        entryPrice: order.entryPrice || 0,
        amount: order.amount || 0,
        profitPercent: order.profitPercent || 0,
        createdAt: order.createdAt?.toDate?.()?.toISOString() || order.createdAt,
        status: order.status,
        resolvedAt: order.resolvedAt?.toDate?.()?.toISOString() || order.resolvedAt,
        pnl: order.pnl || null,
        isResolved,
        canResolve,
        isBinary
      };
    });

    structuredLog('INFO', reqId, `Fetched ${trades.length} binary trades`, { adminId: adminPayload.userId });

    return NextResponse.json({
      trades,
      assets: binaryAssets,
      success: true,
      correlationId: reqId
    });

  } catch (error: any) {
    return handleApiError(reqId, error, route, 'Failed to fetch binary trades');
  }
}