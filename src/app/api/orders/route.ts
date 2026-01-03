import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { extractTokenFromRequest, verifyAccessToken } from '@/lib/auth-utils';

const prisma = new PrismaClient();

// GET - Fetch user's orders
export async function GET(request: NextRequest) {
  try {
    const token = extractTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyAccessToken(token);
    const userId = payload.userId;

    const orders = await prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ orders });
  } catch (error: any) {
    if (error.name === 'JWTExpired' || error.name === 'JWSInvalid') {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }
    console.error('Failed to fetch orders:', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}

// POST - Create new order
export async function POST(request: NextRequest) {
  try {
    const token = extractTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyAccessToken(token);
    const userId = payload.userId;

    const { type, symbol, quantity, price, orderType, leverage, direction, period, profitPercent, binaryAmount } = await request.json();

    if (!type || !symbol) {
      return NextResponse.json({ error: 'Type and symbol are required' }, { status: 400 });
    }

    // Basic validation
    if (!['buy', 'sell'].includes(type)) {
      return NextResponse.json({ error: 'Invalid order type' }, { status: 400 });
    }

    if (orderType === 'binary') {
      if (!binaryAmount || binaryAmount <= 0) {
        return NextResponse.json({ error: 'Binary amount must be positive' }, { status: 400 });
      }
      if (!direction || !['UP', 'DOWN'].includes(direction)) {
        return NextResponse.json({ error: 'Direction must be UP or DOWN for binary orders' }, { status: 400 });
      }
      if (!period || period <= 0) {
        return NextResponse.json({ error: 'Period must be positive for binary orders' }, { status: 400 });
      }
    } else {
      if (!quantity || quantity <= 0) {
        return NextResponse.json({ error: 'Quantity must be positive' }, { status: 400 });
      }
    }

    // Fetch user balance
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const stakeAmount = orderType === 'binary' ? binaryAmount : quantity;
    if (user.balance < stakeAmount) {
      return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
    }

    const createdAt = new Date();
    const resolvedAt = orderType === 'binary' && period ? new Date(createdAt.getTime() + period * 1000) : null;

    // Deduct balance for binary orders
    if (orderType === 'binary') {
      await prisma.user.update({
        where: { id: userId },
        data: { balance: user.balance - binaryAmount }
      });

      // Log transaction
      await prisma.transactionHistory.create({
        data: {
          userId,
          type: 'buy', // or 'binary_stake'
          amount: -binaryAmount,
          symbol: symbol.toUpperCase(),
          quantity: 1,
          price: binaryAmount,
          description: `Binary trade stake deduction for ${symbol.toUpperCase()}`,
          status: 'completed',
          balanceBefore: user.balance,
          balanceAfter: user.balance - binaryAmount
        }
      });
    }

    const order = await prisma.order.create({
      data: {
        userId,
        type,
        symbol: symbol.toUpperCase(),
        quantity: quantity || binaryAmount,
        price: price || null,
        orderType: orderType || 'market',
        leverage: leverage || null,
        status: orderType === 'binary' ? 'active' : 'pending',
        direction: direction || null,
        entryPrice: price || null,
        amount: binaryAmount || quantity,
        profitPercent: profitPercent || null,
        resolvedAt
      }
    });

    // Create virtual asset for binary orders
    if (orderType === 'binary') {
      await prisma.asset.create({
        data: {
          userId,
          symbol: `BINARY-${order.id}`,
          quantity: 1,
          averagePrice: binaryAmount,
          currentPrice: binaryAmount
        }
      });
    }

    return NextResponse.json({ order, message: 'Order created successfully' });
  } catch (error: any) {
    if (error.name === 'JWTExpired' || error.name === 'JWSInvalid') {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }
    console.error('Failed to create order:', error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}

// PUT - Cancel order
export async function PUT(request: NextRequest) {
  try {
    const token = extractTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyAccessToken(token);
    const userId = payload.userId;

    const { orderId } = await request.json();

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId, userId }
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.status !== 'pending') {
      return NextResponse.json({ error: 'Only pending orders can be cancelled' }, { status: 400 });
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { status: 'cancelled' }
    });

    return NextResponse.json({ order: updatedOrder, message: 'Order cancelled successfully' });
  } catch (error: any) {
    if (error.name === 'JWTExpired' || error.name === 'JWSInvalid') {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }
    console.error('Failed to cancel order:', error);
    return NextResponse.json({ error: 'Failed to cancel order' }, { status: 500 });
  }
}