import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getRequestId, handleApiError, structuredLog } from '@/lib/correlation';
import { verifyAdmin } from '@/lib/auth-utils';
import { Order, Asset } from '@prisma/client';

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
    const activeOrders = await prisma.order.findMany({
      where: {
        status: {
          notIn: ['win', 'loss']
        }
      },
      include: {
        user: {
          select: {
            id: true,
            username: true
          }
        }
      }
    });

    console.log('Found active orders:', activeOrders.length);

    // Get binary assets for binary orders
    const binaryAssets = await prisma.asset.findMany({
      where: {
        symbol: {
          startsWith: 'BINARY-'
        }
      },
      include: {
        user: {
          select: {
            id: true,
            username: true
          }
        }
      }
    });

    console.log('Found binary assets:', binaryAssets.length);

    // Combine data for active trades
    const trades = activeOrders.map((order: Order & { user: { id: string, username: string } }) => {
      const isBinary = order.orderType === 'binary' || order.direction !== null;
      const asset = isBinary ? binaryAssets.find((a: Asset & { user: { id: string, username: string } }) => a.symbol === `BINARY-${order.id}`) : null;
      const isResolved = order.status === 'win' || order.status === 'loss';
      const canResolve = isBinary && !isResolved && order.status === 'active' && asset !== null;

      return {
        id: order.id,
        assetId: asset?.id || null,
        userId: order.userId,
        username: order.user.username,
        symbol: order.symbol,
        quantity: order.quantity,
        entryPrice: order.entryPrice || 0,
        amount: order.amount || 0,
        profitPercent: order.profitPercent || 0,
        createdAt: order.createdAt.toISOString(),
        status: order.status,
        resolvedAt: order.resolvedAt?.toISOString() || null,
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