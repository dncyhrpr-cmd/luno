import { coinGeckoAPI } from './coingecko-api';
import { prisma } from './db';

// Mapping for symbols not on Binance to CoinGecko ids
const symbolToCoinGeckoId: Record<string, string> = {
  'BTSUSDT': 'bitshares',
  // Add more as needed
};

export async function resolveExpiredBinaryOrders() {
  try {
    const now = new Date();

    // 1. Fetch only relevant orders directly from DB
    const expiredOrders = await prisma.order.findMany({
      where: {
        status: { in: ['active', 'approved'] }, // Active or admin approved orders
        orderType: 'binary',
        resolvedAt: { lte: now } // Only orders where time has passed
      }
    });

    if (expiredOrders.length === 0) return;

    // Group by userId for efficiency
    const ordersByUser = expiredOrders.reduce((acc, order) => {
      if (!acc[order.userId]) acc[order.userId] = [];
      acc[order.userId].push(order);
      return acc;
    }, {} as Record<string, typeof expiredOrders>);

    for (const userId of Object.keys(ordersByUser)) {
      const userOrders = ordersByUser[userId];

      // 2. Efficiently fetch unique prices
      const symbols = [...new Set(userOrders.map((o) => o.symbol))];
      const priceMap = new Map<string, number>();

      await Promise.all(
        symbols.map(async (sym) => {
          try {
            // Try Binance first
            const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${sym}`);
            const data = await res.json();
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
                priceMap.set(sym, markets[0].current_price);
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
        const binaryAsset = await prisma.asset.findUnique({
          where: {
            userId_symbol: { userId, symbol: `BINARY-${order.id}` }
          }
        });

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

        // 4. Atomic Transaction for Safety
        await prisma.$transaction(async (tx) => {
          // Update Order
          await tx.order.update({
            where: { id: order.id },
            data: {
              status,
              exitPrice: currentPrice,
              pnl,
              resolvedAt: new Date(),
            },
          });

          if (payout > 0) {
            // Get balance before payout
            const userBefore = await tx.user.findUnique({ where: { id: userId } });

            // Atomic increment to prevent balance overwrites
            const updatedUser = await tx.user.update({
              where: { id: userId },
              data: { balance: { increment: payout } },
            });

            await tx.transactionHistory.create({
              data: {
                userId,
                type: 'payout',
                amount: payout,
                symbol: order.symbol,
                description: `Binary win: ${order.symbol}`,
                status: 'completed',
                balanceBefore: userBefore!.balance,
                balanceAfter: updatedUser.balance
              },
            });
          }

          // Cleanup virtual assets
          await tx.asset.deleteMany({
            where: {
              userId,
              symbol: `BINARY-${order.id}`
            }
          });
        });
      }
    }
  } catch (error) {
    console.error('Critical Error in resolution engine:', error);
  }
}