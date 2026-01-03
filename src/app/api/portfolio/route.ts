import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, Asset } from '@prisma/client';
import { extractTokenFromRequest, verifyAccessToken } from '@/lib/auth-utils';
import { resolveExpiredBinaryOrders } from '@/lib/trade-resolver';
import NodeCache from 'node-cache';

const prisma = new PrismaClient();
const portfolioCache = new NodeCache({ stdTTL: 300 }); // 5 minutes

// GET - Fetch user's complete portfolio: balance and assets
export async function GET(request: NextRequest) {
  try {
    const token = extractTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyAccessToken(token);
    const userId = payload.userId;

    // Resolve expired binary orders
    await resolveExpiredBinaryOrders();

    // Fetch active binary orders first to check if we should skip cache
    const activeOrders = await prisma.order.findMany({
      where: {
        userId,
        status: 'active',
        orderType: 'binary'
      }
    });

    // Check cache only if no active binary orders (to avoid stale data during trades)
    const cacheKey = `portfolio_${userId}`;
    if (activeOrders.length === 0) {
      const cachedData = portfolioCache.get(cacheKey);
      if (cachedData) {
        return NextResponse.json(cachedData);
      }
    }

    // Fetch from Prisma
    const [user, assets] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.asset.findMany({ where: { userId } }),
    ]);

    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    // Create temporary assets from active binary orders that haven't expired
    const now = new Date();
    const tempAssets = activeOrders
      .filter(order => !order.resolvedAt || order.resolvedAt > now)
      .map(order => ({
        id: `temp-${order.id}`,
        userId: order.userId,
        symbol: `BINARY-${order.id}`,
        quantity: 1,
        averagePrice: order.amount || 0,
        currentPrice: order.amount || 0,
        createdAt: order.createdAt,
      }));

    const allAssets = [...assets, ...tempAssets];

    const totalAssetValue = allAssets.reduce((sum: number, asset: any) => {
      const price = asset.currentPrice || asset.averagePrice;
      return sum + (asset.quantity * price);
    }, 0);
    const totalPortfolioValue = user.balance + totalAssetValue;

    const unrealizedGainLoss = assets.reduce((sum: number, asset: Asset) => {
      const currentPrice = asset.currentPrice || asset.averagePrice;
      const assetCostBasis = asset.quantity * asset.averagePrice;
      const assetCurrentValue = asset.quantity * currentPrice;
      return sum + (assetCurrentValue - assetCostBasis);
    }, 0);

    const responseData = {
      balance: user.balance,
      assets: allAssets,
      totalPortfolioValue,
      totalAssetValue,
      unrealizedGainLoss,
      gainLossPercent: totalAssetValue > 0 ? (unrealizedGainLoss / (totalAssetValue - unrealizedGainLoss)) * 100 : 0,
    };

    // Cache the response
    portfolioCache.set(cacheKey, responseData);

    return NextResponse.json(responseData);

  } catch (error: any) {
    if (error.name === 'JWTExpired' || error.name === 'JWSInvalid') {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Portfolio fetch failed' }, { status: 500 });
  }
}

// POST - Create transaction request for admin approval
export async function POST(request: NextRequest) {
  try {
    const token = extractTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyAccessToken(token);
    const userId = payload.userId;
    const { amount, type, bankName, holderName, accountNumber, ifscCode } = await request.json();

    // Input Validation
    if (!['deposit', 'withdraw'].includes(type) || typeof amount !== 'number' || amount <= 0) {
        return NextResponse.json({ error: 'Invalid type or amount. Amount must be positive.' }, { status: 400 });
    }

    // Create transaction request for admin approval
    const requestData: any = {
      userId,
      type: type as 'deposit' | 'withdraw',
      amount,
    };

    // Only include bank details if they are provided and not empty
    if (type === 'withdraw') {
      if (bankName && bankName.trim()) requestData.bankName = bankName.trim();
      if (holderName && holderName.trim()) requestData.holderName = holderName.trim();
      if (accountNumber && accountNumber.trim()) requestData.accountNumber = accountNumber.trim();
      if (ifscCode && ifscCode.trim()) requestData.ifscCode = ifscCode.trim();
    }

    const transactionRequest = await prisma.transactionRequest.create({
      data: requestData
    });

    return NextResponse.json({
      message: `${type.charAt(0).toUpperCase() + type.slice(1)} request submitted for approval`,
      requestId: transactionRequest.id,
    });
  } catch (error: any) {
    if (error.name === 'JWTExpired' || error.name === 'JWSInvalid') {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Request submission failed' }, { status: 500 });
  }
}