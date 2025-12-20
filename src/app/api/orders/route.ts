import { NextRequest, NextResponse } from 'next/server';
import { FirestoreDatabase } from '@/lib/firestore-db';
import { verifyAccessToken } from '@/lib/auth-utils';
import { parseJsonBody, normalizeOrderPayload, ValidationError } from '@/lib/request-validators';

const firestoreDB = new FirestoreDatabase();

async function verifyToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.substring(7);
  try {
    const payload = await verifyAccessToken(token);
    // payload.userId is the canonical claim used by generateAuthTokens
    return { uid: payload.userId, raw: payload } as any;
  } catch (err: unknown) {
    console.error('Access token verification failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

// GET - Fetch user's orders
export async function GET(request: NextRequest) {
  try {
    const userPayload = await verifyToken(request);
    if (!userPayload || !userPayload.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = userPayload.uid;

    const orders = await firestoreDB.getOrders(userId);
    return NextResponse.json({ orders });
  } catch (error: any) {
    console.error("Failed to fetch orders:", error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}

// POST - Create new order
export async function POST(request: NextRequest) {
  let _lastRequestBody: any = null;
  try {
    const userPayload = await verifyToken(request);
    if (!userPayload || !userPayload.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = userPayload.uid;

    const rawBody = await parseJsonBody(request);
    _lastRequestBody = rawBody;
    const { type, symbol, quantity: quantityNum, price: priceNum, orderType, leverage } = normalizeOrderPayload(rawBody);

    // --- User & Balance Check ---
    const userData = await firestoreDB.findUserById(userId);
    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const orderValue = quantityNum * priceNum;
    const marginRequired = orderValue / leverage;
    if (type === 'BUY' && userData.balance < marginRequired) {
      return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
    }

    // --- Order Creation ---
    const orderData = {
      userId,
      type,
      symbol: symbol.toUpperCase(),
      quantity: quantityNum,
      price: priceNum, // For market, this is the execution price
      status: 'PENDING', // Limit orders would be PENDING, market orders are executed instantly
      executedQuantity: 0,
    };

    console.log('Creating order with data:', orderData);
    const order = await firestoreDB.createOrder(orderData);
    console.log('Order created:', { id: order.id, status: order.status });

    // --- Immediate Market Order Execution ---
    if (orderType === 'MARKET') {
      const newBalance = type === 'BUY'
        ? userData.balance - orderValue
        : userData.balance + orderValue;

      await firestoreDB.updateUserBalance(userId, newBalance);

      if (type === 'BUY') {
        const existingAssets = await firestoreDB.getAssets(userId);
        const existingAsset = existingAssets.find(a => a.symbol === symbol.toUpperCase());

        if (existingAsset) {
          const totalQuantity = existingAsset.quantity + quantityNum;
          const newAveragePrice = (existingAsset.quantity * existingAsset.averagePrice + quantityNum * priceNum) / totalQuantity;
          console.log('Updating existing asset', { assetId: existingAsset.id, symbol: existingAsset.symbol, oldQty: existingAsset.quantity, addQty: quantityNum, newAvg: newAveragePrice });
          await firestoreDB.updateAsset(existingAsset.id, {
            quantity: totalQuantity,
            averagePrice: newAveragePrice,
          });
          console.log('Asset updated', { assetId: existingAsset.id });
        } else {
          console.log('Creating new asset', { userId, symbol: symbol.toUpperCase(), quantity: quantityNum, averagePrice: priceNum });
          const created = await firestoreDB.createAsset({
            userId,
            symbol: symbol.toUpperCase(),
            quantity: quantityNum,
            averagePrice: priceNum,
          });
          console.log('Asset created', { assetId: created.id });
        }
      } else if (type === 'SELL') {
        // Reduce asset quantity or delete if fully sold
        const existingAssets = await firestoreDB.getAssets(userId);
        const existingAsset = existingAssets.find(a => a.symbol === symbol.toUpperCase());
        if (!existingAsset) {
          console.warn('Sell attempted but no existing asset found', { userId, symbol: symbol.toUpperCase() });
          return NextResponse.json({ error: 'No asset to sell' }, { status: 400 });
        }
        if (existingAsset.quantity < quantityNum) {
          console.warn('Sell attempted with insufficient quantity', { userId, symbol: symbol.toUpperCase(), have: existingAsset.quantity, want: quantityNum });
          return NextResponse.json({ error: 'Insufficient asset quantity' }, { status: 400 });
        }

        const remaining = existingAsset.quantity - quantityNum;
        if (remaining > 0) {
          console.log('Reducing asset quantity', { assetId: existingAsset.id, oldQty: existingAsset.quantity, newQty: remaining });
          // For sells, averagePrice remains the cost basis (we don't change it here)
          await firestoreDB.updateAsset(existingAsset.id, { quantity: remaining });
        } else {
          console.log('Deleting asset after full sell', { assetId: existingAsset.id });
          // Remove asset document when fully sold
          await firestoreDB.deleteAsset(existingAsset.id);
        }
      }

      // Update order status to FILLED
      console.log('About to update order status', { orderId: order.id, status: 'FILLED', executedQuantity: quantityNum });
      await firestoreDB.updateOrder(order.id, {
        status: 'FILLED',
        executedQuantity: quantityNum
      });
      console.log('Order status updated successfully');

      // --- Logging and Notifications ---
      await firestoreDB.createTransactionHistory({
        userId,
        type: type.toLowerCase() as 'buy' | 'sell',
        symbol: symbol.toUpperCase(),
        quantity: quantityNum,
        price: priceNum,
        amount: orderValue,
        description: `Market ${type} order for ${quantityNum} ${symbol.toUpperCase()} at $${priceNum.toFixed(2)}`,
        status: 'completed',
        balanceBefore: userData.balance,
        balanceAfter: newBalance,
      });

      await firestoreDB.createAuditLog({
        userId,
        action: 'market_order_executed',
        resourceType: 'order',
        resourceId: order.id,
        changes: { type, symbol: symbol.toUpperCase(), quantity: quantityNum, price: priceNum, orderValue },
        status: 'success',
      });

      await firestoreDB.createAlert({
        userId,
        type: 'order',
        title: `Market ${type} Order Executed`,
        message: `Your ${type} order for ${quantityNum} ${symbol.toUpperCase()} at $${priceNum.toFixed(2)} has been executed. Total: $${orderValue.toFixed(2)}`,
        read: false,
      });

       return NextResponse.json({
        success: true,
        order,
        message: 'Market order executed successfully'
      });
    }

    // For limit orders, just place it
    return NextResponse.json({
      success: true,
      order,
      message: 'Limit order placed successfully'
    });

  } catch (error: any) {
    // Validation errors are client errors and should return 4xx
    if (error instanceof ValidationError) {
      console.warn('Order validation failed:', error.message, { body: (_lastRequestBody || '<no-body>'), details: error.details });
      return NextResponse.json({ error: error.message, details: error.details }, { status: error.status || 400 });
    }

    console.error("Failed to create order:", error?.message || error, { body: (_lastRequestBody || '<no-body>'), stack: error?.stack });
    return NextResponse.json({ error: 'Failed to create order', details: String(error?.message || error) }, { status: 500 });
  }
}

// PUT - Cancel order (simplified)
export async function PUT(request: NextRequest) {
  try {
    const userPayload = await verifyToken(request);
    if (!userPayload || !userPayload.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = userPayload.uid;

    const { orderId, action } = await request.json();

    if (!orderId || action !== 'CANCEL') {
      return NextResponse.json({ error: 'Missing orderId or invalid action' }, { status: 400 });
    }

    // In a real app, you would fetch the order and verify it belongs to the user and is cancellable
    // For this example, we assume the request is valid
    // const order = await firestoreDB.getOrderById(orderId);
    // if(order.userId !== userId) { ... }

    // This part is simplified. A real implementation would update the order status to 'CANCELLED'
    // await firestoreDB.updateOrder(orderId, { status: 'CANCELLED' });

    console.log(`Order ${orderId} for user ${userId} would be cancelled here.`);

    return NextResponse.json({ message: 'Order cancellation request received' });

  } catch (error: any) {
    console.error("Failed to update order:", error);
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
  }
}