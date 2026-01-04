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

    // Get all active and recently resolved binary orders
    const ordersSnapshot = await collections.orders
      .where('orderType', '==', 'binary')
      .where('status', 'in', ['active', 'resolved'])
      .get();
    const allOrders = ordersSnapshot.docs
      .map((doc: admin.firestore.DocumentSnapshot) => ({ id: doc.id, ...doc.data() }))
      .filter((order: any) => {
        if (order.status === 'active') return true;
        if (order.status === 'resolved') {
          // Check if still within keep period after expiry
          const createdAt = order.createdAt?.toDate?.() || new Date(order.createdAt);
          const expiryTime = order.expiryTime?.toDate?.() || new Date(order.expiryTime);
          const durationMs = expiryTime.getTime() - createdAt.getTime();
          const keepUntil = new Date(expiryTime.getTime() + durationMs);
          return new Date() < keepUntil;
        }
        return false;
      });

    console.log('Found active and recent resolved orders:', allOrders.length);

    // Get user data for user emails
    const userIds = [...new Set(allOrders.map((o: any) => o.userId))];
    const usersSnapshot = await collections.users.where(admin.firestore.FieldPath.documentId(), 'in', userIds.slice(0, 10)).get();
    const users: any = usersSnapshot.docs.reduce((acc: any, doc: any) => {
      acc[doc.id] = doc.data();
      return acc;
    }, {});

    // Get binary assets for binary orders
    const binaryAssetsSnapshot = await collections.assets
      .where('type', '==', 'binary')
      .get();

    const binaryAssets = binaryAssetsSnapshot.docs.map((doc: admin.firestore.DocumentSnapshot) => {
      const asset = { id: doc.id, ...doc.data() } as any;
      return asset;
    });

    console.log('Found binary assets:', binaryAssets.length);

    // Combine data for active and recent resolved trades
    const trades = allOrders.map((order: any) => {
      const isBinary = order.orderType === 'binary' || order.direction !== null;
      const asset = isBinary ? binaryAssets.find((a: any) => a.orderId === order.id) : null;
      const isResolved = ['win', 'loss', 'resolved'].includes(order.status);
      const isExpired = order.expiryTime && order.expiryTime.toDate() <= new Date();
      const canResolve = isBinary && !isResolved && order.status === 'active' && asset !== null && isExpired;

      return {
        id: order.id,
        assetId: asset?.id || null,
        userId: order.userId,
        userEmail: users[order.userId]?.email || 'Unknown',
        symbol: order.symbol,
        quantity: order.quantity,
        entryPrice: order.entryPrice || 0,
        amount: order.amount || 0,
        profitPercent: order.profitPercent || 0,
        expiryTime: order.expiryTime?.toDate?.()?.toISOString() || null,
        createdAt: order.createdAt?.toDate?.()?.toISOString() || order.createdAt,
        status: order.status,
        result: order.result || null,
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