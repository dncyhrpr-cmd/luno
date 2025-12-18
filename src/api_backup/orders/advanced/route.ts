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

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'all';

    let orders;
    if (filter === 'active') {
      orders = await firestoreDB.getActiveAdvancedOrders(user.userId);
    } else {
      orders = await firestoreDB.getAdvancedOrders(user.userId);
    }

    return NextResponse.json({ 
      orders,
      total: orders.length
    });
  } catch (error: any) {

    return NextResponse.json({ error: 'Failed to fetch advanced orders' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { type, symbol, quantity, stopPrice, targetPrice, limitPrice, trailingPercent, linkedOrderIds } = await request.json();

    if (!type || !symbol || !quantity) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!['stop_loss', 'take_profit', 'trailing_stop', 'oco'].includes(type)) {
      return NextResponse.json({ error: 'Invalid order type' }, { status: 400 });
    }

    if (type === 'stop_loss' && !stopPrice) {
      return NextResponse.json({ error: 'Stop price required for stop loss orders' }, { status: 400 });
    }

    if (type === 'take_profit' && !targetPrice) {
      return NextResponse.json({ error: 'Target price required for take profit orders' }, { status: 400 });
    }

    if (type === 'trailing_stop' && !trailingPercent) {
      return NextResponse.json({ error: 'Trailing percent required for trailing stop orders' }, { status: 400 });
    }

    if (type === 'oco' && (!stopPrice || !targetPrice)) {
      return NextResponse.json({ error: 'Both stop and target prices required for OCO orders' }, { status: 400 });
    }

    const userData = await firestoreDB.findUserById(user.userId);
    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const advancedOrder = await firestoreDB.createAdvancedOrder({
      userId: user.userId,
      symbol: symbol.toUpperCase(),
      baseOrderType: type,
      quantity,
      status: 'active',
      stopPrice,
      targetPrice,
      limitPrice,
      trailingPercent,
      linkedOrderIds
    });

    if (!advancedOrder) {
        return NextResponse.json({ error: 'Failed to create advanced order' }, { status: 500 });
    }

    await firestoreDB.createAuditLog({
      userId: user.userId,
      action: 'advanced_order_created',
      resourceType: 'advanced_order',
      resourceId: advancedOrder.id,
      changes: {
        type,
        symbol: symbol.toUpperCase(),
        quantity,
        stopPrice,
        targetPrice
      },
      status: 'success'
    });

    await firestoreDB.createAlert({
      userId: user.userId,
      type: 'order',
      title: `Advanced Order Created`,
      message: `Your ${type.replace('_', ' ')} order for ${quantity} ${symbol.toUpperCase()} has been created and is now active.`,
      read: false
    });

    return NextResponse.json({
      order: advancedOrder,
      message: 'Advanced order created successfully',
      success: true
    });
  } catch (error: any) {

    return NextResponse.json({ error: 'Failed to create advanced order' }, { status: 500 });
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
      const orders = await firestoreDB.getAdvancedOrders(user.userId);
      const order = orders.find((o: any) => o.id === orderId);

      if (!order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }

      if (order.status !== 'active') {
        return NextResponse.json({ error: 'Only active orders can be cancelled' }, { status: 400 });
      }

      await firestoreDB.updateAdvancedOrder(orderId, { status: 'cancelled' });

      await firestoreDB.createAuditLog({
        userId: user.userId,
        action: 'advanced_order_cancelled',
        resourceType: 'advanced_order',
        resourceId: orderId,
        changes: { status: 'cancelled' },
        status: 'success'
      });

      await firestoreDB.createAlert({
        userId: user.userId,
        type: 'order',
        title: 'Advanced Order Cancelled',
        message: `Your advanced order ${orderId} has been cancelled.`,
        read: false
      });

      return NextResponse.json({
        message: 'Order cancelled successfully',
        success: true
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {

    return NextResponse.json({ error: 'Failed to update advanced order' }, { status: 500 });
  }
}
