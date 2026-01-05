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

    // Get user data for user emails
    const userIds = [...new Set(allOrders.map((o: any) => o.userId))];
    let users: any = {};
    if (userIds.length > 0) {
      const usersSnapshot = await collections.users.where(admin.firestore.FieldPath.documentId(), 'in', userIds.slice(0, 10)).get();
      users = usersSnapshot.docs.reduce((acc: any, doc: any) => {
        acc[doc.id] = doc.data();
        return acc;
      }, {});
    }

    // Get binary assets for binary orders
    const binaryAssetsSnapshot = await collections.assets
      .where('type', '==', 'binary')
      .get();

    const binaryAssets = binaryAssetsSnapshot.docs.map((doc: admin.firestore.DocumentSnapshot) => {
      const asset = { id: doc.id, ...doc.data() } as any;
      return asset;
    });

    // Auto-resolve expired trades with admin outcome
    for (const order of allOrders) {
      if (order.status === 'active' && order.adminOutcome && order.expiryTime) {
        const expiryTime = order.expiryTime?.toDate?.() || new Date(order.expiryTime);
        const isExpired = expiryTime <= new Date();
        if (isExpired) {
          console.log('DEBUG: Auto-resolving expired trade with admin outcome', order.id, order.adminOutcome);
          try {
            // Get user data
            const userDoc = await collections.users.doc(order.userId).get();
            const userData = userDoc.data();

            // Calculate PnL
            const pnl = order.adminOutcome === 'win' ? order.amount + (order.amount * (order.profitPercent / 100)) : -order.amount;

            const now = admin.firestore.Timestamp.now();

            // Resolve the trade
            await admin.firestore().runTransaction(async (transaction) => {
              const orderRef = collections.orders.doc(order.id);
              const userRef = collections.users.doc(order.userId);

              const userSnap: any = await transaction.get(userRef);
              const balanceBefore = userSnap.exists ? userSnap.data()?.balance || 0 : 0;

              transaction.update(orderRef, {
                status: 'resolved',
                result: order.adminOutcome,
                pnl: pnl,
                resolvedAt: now,
                resolvedBy: 'admin',
                updatedAt: now
              });

              transaction.update(userRef, {
                balance: admin.firestore.FieldValue.increment(pnl)
              });

              // Transaction history
              const historyRef = collections.transactionHistory.doc();
              transaction.set(historyRef, {
                userId: order.userId,
                type: 'binary_payout',
                amount: pnl,
                description: `Admin-resolved binary trade ${order.adminOutcome}: ${order.symbol} ${order.direction}`,
                status: 'completed',
                balanceBefore,
                balanceAfter: balanceBefore + pnl,
                createdAt: now
              });
            });

            // Delete asset
            const asset = binaryAssets.find((a: any) => a.orderId === order.id);
            if (asset) {
              await collections.assets.doc(asset.id).delete();
            }

            // Notification
            await collections.alerts.add({
              userId: order.userId,
              type: 'trade_resolved_admin',
              title: 'Trade Resolved by Admin',
              message: `Hi ${userData?.email}, your binary trade has been resolved as ${order.adminOutcome} by admin. ${order.adminOutcome === 'win' ? `You won ${Math.abs(pnl).toFixed(2)} (including your stake)!` : `You lost ${Math.abs(pnl).toFixed(2)}.`}`,
              read: false,
              createdAt: now
            });

            console.log('DEBUG: Auto-resolved trade', order.id);
          } catch (error) {
            console.error('Error auto-resolving trade', order.id, error);
          }
        }
      }
    }

    // Re-fetch orders after auto-resolution
    const updatedOrdersSnapshot = await collections.orders
      .where('orderType', '==', 'binary')
      .where('status', 'in', ['active', 'resolved'])
      .get();
    const updatedAllOrders = updatedOrdersSnapshot.docs
      .map((doc: admin.firestore.DocumentSnapshot) => ({ id: doc.id, ...doc.data() }))
      .filter((order: any) => {
        if (order.status === 'active') return true;
        if (order.status === 'resolved') {
          const createdAt = order.createdAt?.toDate?.() || new Date(order.createdAt);
          const expiryTime = order.expiryTime?.toDate?.() || new Date(order.expiryTime);
          const durationMs = expiryTime.getTime() - createdAt.getTime();
          const keepUntil = new Date(expiryTime.getTime() + durationMs);
          return new Date() < keepUntil;
        }
        return false;
      });

    // Combine data for active and recent resolved trades
    const trades = updatedAllOrders.map((order: any) => {
      const isBinary = order.orderType === 'binary' || order.direction !== null;
      const asset = isBinary ? binaryAssets.find((a: any) => a.orderId === order.id) : null;
      const isResolved = ['win', 'loss', 'resolved'].includes(order.status);
      const expiryTime = order.expiryTime?.toDate?.() || new Date(order.expiryTime);
      const isExpired = expiryTime <= new Date();
      const canResolve = isBinary && !isResolved && order.status === 'active' && asset !== null && !order.adminOutcome;
      console.log('DEBUG: Trade resolution check', { id: order.id, status: order.status, isResolved, isExpired, canResolve, adminOutcome: order.adminOutcome, expiryTime: expiryTime?.toISOString?.() });

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
        isBinary,
        adminOutcome: order.adminOutcome || null,
        adminSelectedAt: order.adminSelectedAt?.toDate?.()?.toISOString() || null
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