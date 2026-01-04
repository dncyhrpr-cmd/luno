import { coinGeckoAPI } from './coingecko-api';
import { collections } from './db';
import admin from 'firebase-admin';

// Mapping for symbols not on Binance to CoinGecko ids
const symbolToCoinGeckoId: Record<string, string> = {
  'BTSUSDT': 'bitshares',
  // Add more as needed
};

export async function resolveExpiredBinaryOrders() {
  try {
    const now = admin.firestore.Timestamp.fromDate(new Date());

    // 1. Fetch only relevant orders directly from DB
    const expiredOrdersSnapshot = await collections.orders
      .where('status', 'in', ['active', 'approved'])
      .where('orderType', '==', 'binary')
      .where('resolvedAt', '<=', now)
      .get();

    const expiredOrders = expiredOrdersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (expiredOrders.length === 0) return;

    // Group by userId for efficiency
    const ordersByUser = expiredOrders.reduce((acc: Record<string, any[]>, order: any) => {
      if (!acc[order.userId]) acc[order.userId] = [];
      acc[order.userId].push(order);
      return acc;
    }, {});

    for (const userId of Object.keys(ordersByUser)) {
      const userOrders = ordersByUser[userId];

      // 2. Efficiently fetch unique prices
      const symbols = [...new Set(userOrders.map((o: any) => o.symbol))] as string[];
      const priceMap = new Map<string, number>();

      await Promise.all(
        symbols.map(async (sym) => {
          try {
            // Try Binance first
            const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${sym}`);
            const data = await res.json() as { price?: string };
            if (data.price) {
              priceMap.set(sym, parseFloat(data.price));
              return;
            }
          } catch (e) {
            console.error(`Binance price fetch failed for ${sym}:`, e);
          }

          // Fallback to CoinGecko
          const coinGeckoId = symbolToCoinGeckoId[sym];
          if (coinGeckoId) {
            try {
              const markets = await coinGeckoAPI.getCoinsMarkets([coinGeckoId], 'usd', 1);
              if (markets.length > 0 && markets[0].current_price) {
                priceMap.set(sym, markets[0].current_price as number);
                console.log(`Used CoinGecko price for ${sym}: ${markets[0].current_price}`);
              }
            } catch (e) {
              console.error(`CoinGecko price fetch failed for ${sym}:`, e);
            }
          }
        })
      );

      // 3. Process each order
      for (const order of userOrders) {
        const currentPrice = priceMap.get(order.symbol);

        // Critical: If price fetch failed, skip this order for now to avoid unfair loss
        if (currentPrice === undefined) continue;

        // Check if the binary asset is locked
        const binaryAssetsSnapshot = await collections.assets
          .where('userId', '==', userId)
          .where('symbol', '==', `BINARY-${order.id}`)
          .get();

        const binaryAsset = !binaryAssetsSnapshot.empty ? { id: binaryAssetsSnapshot.docs[0].id, ...binaryAssetsSnapshot.docs[0].data() } : null;

        // If asset exists and is locked, skip resolution
        if ((binaryAsset as any)?.locked) continue;

        let isWin: boolean;
        if (order.status === 'approved') {
          // Admin approved: force outcome based on direction
          isWin = order.direction === 'UP';
        } else {
          // Active: check market
          isWin = order.direction === 'UP'
            ? currentPrice > (order.entryPrice || 0)
            : currentPrice < (order.entryPrice || 0);
        }

        const pnl = isWin ? ((order.amount || 0) * (order.profitPercent || 0)) / 100 : 0;
        const payout = isWin ? (order.amount || 0) + pnl : 0;
        const status = isWin ? 'win' : 'loss';

        // 4. Update order and handle payouts
        const batch = admin.firestore().batch();

        // Update Order
        batch.update(collections.orders.doc(order.id), {
          status,
          exitPrice: currentPrice,
          pnl,
          resolvedAt: admin.firestore.Timestamp.now(),
          updatedAt: admin.firestore.Timestamp.now()
        });

        if (payout > 0) {
          // Get user balance
          const userDoc = await collections.users.doc(userId).get();
          const userData = userDoc.data();
          const balanceBefore = userData?.balance || 0;
          const balanceAfter = balanceBefore + payout;

          // Update user balance
          batch.update(collections.users.doc(userId), {
            balance: balanceAfter,
            updatedAt: admin.firestore.Timestamp.now()
          });

          // Create transaction history
          const txId = collections.transactionHistory.doc().id;
          batch.set(collections.transactionHistory.doc(txId), {
            id: txId,
            userId,
            type: 'payout',
            amount: payout,
            symbol: order.symbol,
            description: `Binary win: ${order.symbol}`,
            status: 'completed',
            balanceBefore,
            balanceAfter,
            createdAt: admin.firestore.Timestamp.now()
          });
        }

        // Cleanup virtual assets
        const virtualAssetsSnapshot = await collections.assets
          .where('userId', '==', userId)
          .where('symbol', '==', `BINARY-${order.id}`)
          .get();

        virtualAssetsSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });

        // Commit the batch
        await batch.commit();
      }
    }
  } catch (error) {
    console.error('Critical Error in resolution engine:', error);
  }
}