import { NextRequest, NextResponse } from 'next/server';
import { collections } from '@/lib/db';
import { extractTokenFromRequest, verifyAccessToken } from '@/lib/auth-utils';
import admin from 'firebase-admin';



export async function GET(request: NextRequest) {
  try {
    const token = extractTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyAccessToken(token);
    const userId = payload.userId;

    const ordersQuery = await collections.scheduledOrders
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

    const orders = ordersQuery.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return NextResponse.json({
      orders,
      total: orders.length
    });
  } catch (error: any) {
    if (error.name === 'JWTExpired' || error.name === 'JWSInvalid') {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }
    console.error('Failed to fetch scheduled orders:', error);
    return NextResponse.json({ error: 'Failed to fetch scheduled orders' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = extractTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyAccessToken(token);
    const userId = payload.userId;

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

    const userDoc = await collections.users.doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const scheduledOrderRef = await collections.scheduledOrders.add({
      userId,
      symbol: symbol.toUpperCase(),
      type,
      quantity,
      price,
      orderType: orderType || 'market',
      scheduledTime: admin.firestore.Timestamp.fromDate(scheduledDate),
      triggerCondition,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const scheduledOrder = {
      id: scheduledOrderRef.id,
      userId,
      symbol: symbol.toUpperCase(),
      type,
      quantity,
      price,
      orderType: orderType || 'market',
      scheduledTime: admin.firestore.Timestamp.fromDate(scheduledDate),
      triggerCondition,
      status: 'pending'
    };

    await collections.auditLogs.add({
      userId,
      action: 'scheduled_order_created',
      resourceType: 'scheduled_order',
      resourceId: scheduledOrder.id,
      changes: {
        symbol: symbol.toUpperCase(),
        type,
        quantity,
        scheduledTime: scheduledDate.toISOString()
      },
      status: 'success',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await collections.alerts.add({
      userId,
      type: 'order',
      title: 'Scheduled Order Created',
      message: `Your ${type} order for ${quantity} ${symbol.toUpperCase()} is scheduled for ${scheduledDate.toLocaleString()}.`,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
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
    const token = extractTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyAccessToken(token);
    const userId = payload.userId;

    const { orderId, action } = await request.json();

    if (!orderId || !action) {
      return NextResponse.json({ error: 'Missing orderId or action' }, { status: 400 });
    }

    if (!['cancel'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    if (action === 'cancel') {
      const orderDoc = await collections.scheduledOrders.doc(orderId).get();

      if (!orderDoc.exists || orderDoc.data()?.userId !== userId) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }

      const orderData = orderDoc.data()!;

      if (orderData.status !== 'pending') {
        return NextResponse.json({ error: 'Only pending orders can be cancelled' }, { status: 400 });
      }

      await collections.scheduledOrders.doc(orderId).update({
        status: 'cancelled'
      });

      await collections.auditLogs.add({
        userId,
        action: 'scheduled_order_cancelled',
        resourceType: 'scheduled_order',
        resourceId: orderId,
        changes: { status: 'cancelled' },
        status: 'success',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await collections.alerts.add({
        userId,
        type: 'order',
        title: 'Scheduled Order Cancelled',
        message: `Your scheduled order ${orderId} has been cancelled.`,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return NextResponse.json({
        message: 'Scheduled order cancelled successfully',
        success: true
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    if (error.name === 'JWTExpired' || error.name === 'JWSInvalid') {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }
    console.error('Failed to update scheduled order:', error);
    return NextResponse.json({ error: 'Failed to update scheduled order' }, { status: 500 });
  }
}
