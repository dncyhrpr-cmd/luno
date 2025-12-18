import { NextRequest, NextResponse } from 'next/server';
import { FirestoreDatabase } from '../../../lib/firestore-db';
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
    const days = parseInt(searchParams.get('days') || '30');

    const userData = await firestoreDB.findUserById(user.userId);
    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const assets = await firestoreDB.getAssets(user.userId);
    const history = await firestoreDB.getTransactionHistory(user.userId);

    let totalInvestedValue = 0;
    const assetBreakdown: Record<string, number> = {};

    assets.forEach((asset: any) => {
      const assetValue = asset.quantity * (asset.currentPrice || asset.averagePrice);
      totalInvestedValue += assetValue;
      assetBreakdown[asset.symbol] = assetValue;
    });

    const cash = userData.balance;
    const totalValue = cash + totalInvestedValue;

    const buyTransactions = history.filter((h: any) => h.type === 'buy');
    const totalInvested = buyTransactions.reduce((sum: number, h: any) => sum + h.amount, 0);
    const gainLoss = totalInvestedValue - totalInvested;
    const gainLossPercent = totalInvested > 0 ? (gainLoss / totalInvested) * 100 : 0;

    const analyticsToday = await firestoreDB.createPortfolioAnalytics({
      userId: user.userId,
      date: new Date().toISOString().split('T')[0],
      totalValue,
      cash,
      investedValue: totalInvestedValue,
      gainLoss,
      gainLossPercent,
      dayChange: 0,
      dayChangePercent: 0,
      allTimeReturn: gainLossPercent,
      assetBreakdown
    });

    const previousAnalytics = await firestoreDB.getPortfolioAnalytics(user.userId, days);

    return NextResponse.json({
      current: analyticsToday,
      history: previousAnalytics,
      summary: {
        totalValue,
        cash,
        investedValue: totalInvestedValue,
        gainLoss,
        gainLossPercent,
        allTimeReturn: gainLossPercent,
        assetCount: assets.length,
        assetBreakdown
      }
    });
  } catch (error: any) {

    return NextResponse.json({ error: 'Failed to calculate portfolio analytics' }, { status: 500 });
  }
}
