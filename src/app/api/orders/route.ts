import { NextRequest, NextResponse } from 'next/server';
import { collections } from '@/lib/db';
import { extractTokenFromRequest, verifyAccessToken } from '@/lib/auth-utils';
import { coinGeckoAPI } from '@/lib/coingecko-api';
import admin from 'firebase-admin';



export async function GET(request: NextRequest) {
  try {
    const token = extractTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyAccessToken(token);
    const userId = payload.userId;

    // Temporary dev mode bypass
    if (process.env.NODE_ENV === 'development') {
      return NextResponse.json({
        orders: [
          { id: '1', symbol: 'BTC', type: 'buy', quantity: 0.5, price: 40000, scheduledTime: new Date().toISOString(), status: 'pending' }
        ],
        total: 1
      });
    }

    const ordersQuery = await collections.scheduledOrders
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

    const orders = ordersQuery.docs.map((doc: admin.firestore.DocumentSnapshot) => ({
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

    const body = await request.json();
    const { orderType } = body;

    // Skip dev bypass for binary orders to enable proper testing

    // Handle binary options orders
    if (orderType === 'binary') {
      const { symbol, direction, period, quantity, binaryAmount, profitPercent, price } = body;
      const amount = binaryAmount || quantity;

      if (!symbol || !direction || !period || !amount || !profitPercent || !price) {
        return NextResponse.json({ error: 'Missing required fields for binary order' }, { status: 400 });
      }

      if (!['UP', 'DOWN'].includes(direction)) {
        return NextResponse.json({ error: 'Direction must be UP or DOWN' }, { status: 400 });
      }

      if (typeof period !== 'number' || period <= 0 || period > 300) { // Max 5 minutes
        return NextResponse.json({ error: 'Period must be a positive number <= 300 seconds' }, { status: 400 });
      }

      if (typeof amount !== 'number' || amount <= 0) {
        return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 });
      }

      if (typeof profitPercent !== 'number' || profitPercent <= 0) {
        return NextResponse.json({ error: 'Profit percent must be a positive number' }, { status: 400 });
      }

      const userDoc = await collections.users.doc(userId).get();
      if (!userDoc.exists) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      const userData = userDoc.data()!;
      const currentBalance = userData.balance || 0;

      if (currentBalance < amount) {
        return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
      }

      // Create binary order and deduct balance in transaction
      const expiryTime = new Date(Date.now() + period * 1000);
      let orderId!: string;

      await admin.firestore().runTransaction(async (transaction) => {
        const userRef = collections.users.doc(userId);

        // Get current balance
        const userSnap = await transaction.get(userRef) as unknown as admin.firestore.DocumentSnapshot;
        const balanceBefore = userSnap.exists ? userSnap.data()?.balance || 0 : 0;

        if (balanceBefore < amount) {
          throw new Error('Insufficient balance');
        }

        // Deduct amount from balance
        transaction.update(userRef, {
          balance: admin.firestore.FieldValue.increment(-amount)
        });

        // Create binary order
        const orderRef = collections.orders.doc();
        transaction.set(orderRef, {
          userId,
          symbol: symbol.toUpperCase(),
          orderType: 'binary',
          direction,
          period,
          amount,
          profitPercent,
          entryPrice: price,
          status: 'active',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          expiryTime: admin.firestore.Timestamp.fromDate(expiryTime)
        });

        orderId = orderRef.id;

        // Create binary asset
        const assetRef = collections.assets.doc();
        transaction.set(assetRef, {
          userId,
          symbol: symbol.toUpperCase(),
          quantity: amount,
          averagePrice: price,
          type: 'binary',
          expiryTime: expiryTime,
          orderId,
          direction,
          profitPercent,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          status: 'active'
        });
      });

      // Audit log
      await collections.auditLogs.add({
        userId,
        action: 'binary_order_created',
        resourceType: 'binary_order',
        resourceId: orderId,
        changes: {
          symbol: symbol.toUpperCase(),
          direction,
          amount,
          period,
          profitPercent
        },
        status: 'success',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Alert
      await collections.alerts.add({
        userId,
        type: 'order',
        title: 'Binary Order Placed',
        message: `Your ${direction} binary order for ${amount} expires in ${period} seconds.`,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return NextResponse.json({
        order: {
          id: orderId,
          userId,
          symbol: symbol.toUpperCase(),
          orderType: 'binary',
          direction,
          period,
          amount,
          profitPercent,
          entryPrice: price,
          status: 'active',
          expiryTime: expiryTime.toISOString()
        },
        message: 'Binary order created successfully',
        success: true
      });
    }

    // Handle scheduled orders (existing logic)
    const { symbol, type, quantity, price, scheduledTime, triggerCondition } = body;

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

    const userData = userDoc.data()!;
    const currentBalance = userData.balance || 0;
    let costInr = 0;
    let rate: number | null = null;
    let costUsdt = 0;

    if (type === 'buy') {
      if (orderType === 'limit' && price) {
        costUsdt = price * quantity;
      } else if (orderType === 'market') {
        // Fetch current price
        try {
          const symbolUsdt = symbol.toUpperCase() + 'USDT';
          const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbolUsdt}`);
          if (response.ok) {
            const data = await response.json();
            const currentPrice = parseFloat(data.price);
            costUsdt = currentPrice * quantity;
          } else {
            return NextResponse.json({ error: 'Unable to fetch current price for market order' }, { status: 400 });
          }
        } catch (err) {
          return NextResponse.json({ error: 'Unable to fetch current price' }, { status: 500 });
        }
      }

      const fetchedRate = await coinGeckoAPI.getInrToUsdtRate();
      if (fetchedRate === null) {
        return NextResponse.json({ error: 'Unable to fetch exchange rate' }, { status: 500 });
      }
      rate = fetchedRate;

      costInr = costUsdt * rate;
      if (currentBalance < costInr) {
        return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
      }

      // Deduct balance
      await collections.users.doc(userId).update({
        balance: admin.firestore.FieldValue.increment(-costInr)
      });
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

    if (type === 'buy') {
      await collections.transactionHistory.add({
        userId,
        type: 'buy',
        amount: costInr,
        symbol: symbol.toUpperCase(),
        quantity,
        price: price || (costUsdt / quantity),
        description: `Scheduled buy order for ${quantity} ${symbol.toUpperCase()}`,
        status: 'completed',
        balanceBefore: currentBalance,
        balanceAfter: currentBalance - costInr,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await collections.auditLogs.add({
        userId,
        action: 'currency_conversion',
        resourceType: 'scheduled_order',
        resourceId: scheduledOrder.id,
        changes: {
          from: 'USDT',
          to: 'INR',
          amountUsdt: costUsdt,
          amountInr: costInr,
          rate
        },
        status: 'success',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

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

    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
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
