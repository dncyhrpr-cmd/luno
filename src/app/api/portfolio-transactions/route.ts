import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { extractTokenFromRequest, verifyAccessToken } from '@/lib/auth-utils';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const token = extractTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyAccessToken(token);
    const userId = payload.userId;

    // Fetch user data
    const [user, activeBinaryOrders] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        include: {
          assets: true,
          orders: {
            orderBy: { createdAt: 'desc' }
          },
          transactionRequests: {
            orderBy: { createdAt: 'desc' }
          },
          transactionHistory: {
            orderBy: { createdAt: 'desc' }
          }
        }
      }),
      prisma.order.findMany({
        where: {
          userId,
          status: 'active',
          orderType: 'binary'
        }
      })
    ]);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Create temporary assets from active binary orders
    const tempAssets = activeBinaryOrders.map(order => ({
      id: `temp-${order.id}`,
      userId: order.userId,
      symbol: `BINARY-${order.id}`,
      quantity: 1,
      averagePrice: order.amount || 0,
      currentPrice: order.amount || 0,
      createdAt: order.createdAt,
    }));

    const allAssets = [...user.assets, ...tempAssets];

    // Calculate total portfolio value
    const totalPortfolioValue = user.balance + allAssets.reduce((sum, asset) => {
      const price = asset.currentPrice || asset.averagePrice;
      return sum + (asset.quantity * price);
    }, 0);

    const portfolio = {
      balance: user.balance,
      assets: user.assets,
      totalPortfolioValue
    };

    const response = {
      portfolio: {
        ...portfolio,
        assets: allAssets
      },
      orders: user.orders,
      requests: user.transactionRequests,
      transactionHistory: user.transactionHistory
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