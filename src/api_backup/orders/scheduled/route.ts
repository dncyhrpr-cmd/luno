import { NextRequest, NextResponse } from 'next/server';
import { FirestoreDatabase } from '../../../../lib/firestore-db';
import jwt from 'jsonwebtoken';

const firestoreDB = new FirestoreDatabase();

function verifyToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any;
    return decoded;
  } catch (error: any) {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orders = await firestoreDB.getScheduledOrders(user.userId);
    
    return NextResponse.json({ 
      orders,
      total: orders.length
    });
  } catch (error: any) {

    return NextResponse.json({ error: 'Failed to fetch scheduled orders' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { symbol, type, quantity, price, orderType, scheduledTime, triggerCondition } = await request.json();

    if (!symbol || !type || !quantity || !scheduledTime) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!['buy', 'sell'].includes(type)) {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    if (!['limit', 'market'].includes(orderType || 'market')) {
      return NextResponse.json({ error: 'Invalid order type' }, { status: 400 });
    }

    if (orderType === 'limit' && !price) {
      return NextResponse.json({ error: 'Price required for limit orders' }, { status: 400 });
    }

    const scheduledDate = new Date(scheduledTime);
    if (scheduledDate < new Date()) {
      return NextResponse.json({ error: 'Scheduled time must be in the future' }, { status: 400 });
    }

    const userData = await firestoreDB.findUserById(user.userId);
    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const scheduledOrder = await firestoreDB.createScheduledOrder({
      userId: user.userId,
      symbol: symbol.toUpperCase(),
      type,
      quantity,
      price,
      orderType: orderType || 'market',
      scheduledTime: scheduledDate,
      triggerCondition,
      status: 'pending'
    });

    await firestoreDB.createAuditLog({
      userId: user.userId,
      action: 'scheduled_order_created',
      resourceType: 'scheduled_order',
      resourceId: scheduledOrder.id,
      changes: {
        symbol: symbol.toUpperCase(),
        type,
        quantity,
        scheduledTime: scheduledDate.toISOString()
      },
      status: 'success'
    });

    await firestoreDB.createAlert({
      userId: user.userId,
      type: 'order',
      title: 'Scheduled Order Created',
      message: `Your ${type} order for ${quantity} ${symbol.toUpperCase()} is scheduled for ${scheduledDate.toLocaleString()}.`,
      read: false
    });

    return NextResponse.json({
      order: scheduledOrder,
      message: 'Scheduled order created successfully',
      success: true
    });
  } catch (error: any) {

    return NextResponse.json({ error: 'Failed to create scheduled order' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orderId, action } = await request.json();

    if (!orderId || !action) {
      return NextResponse.json({ error: 'Missing orderId or action' }, { status: 400 });
    }

    if (!['cancel'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    if (action === 'cancel') {
      const orders = await firestoreDB.getScheduledOrders(user.userId);
      const order = orders.find((o: any) => o.id === orderId);

      if (!order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }

      if (order.status !== 'pending') {
        return NextResponse.json({ error: 'Only pending orders can be cancelled' }, { status: 400 });
      }

      await firestoreDB.updateScheduledOrder(orderId, { status: 'cancelled' });

      await firestoreDB.createAuditLog({
        userId: user.userId,
        action: 'scheduled_order_cancelled',
        resourceType: 'scheduled_order',
        resourceId: orderId,
        changes: { status: 'cancelled' },
        status: 'success'
      });

      await firestoreDB.createAlert({
        userId: user.userId,
        type: 'order',
        title: 'Scheduled Order Cancelled',
        message: `Your scheduled order ${orderId} has been cancelled.`,
        read: false
      });

      return NextResponse.json({
        message: 'Scheduled order cancelled successfully',
        success: true
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {

    return NextResponse.json({ error: 'Failed to update scheduled order' }, { status: 500 });
  }
}
