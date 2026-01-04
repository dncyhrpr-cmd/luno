import { NextRequest, NextResponse } from 'next/server';
import { collections } from '@/lib/db';
import { getRequestId, handleApiError, structuredLog } from '@/lib/correlation';
import { verifyAdmin } from '@/lib/auth-utils';
import admin from 'firebase-admin';

// GET - Fetch all assets with user info and lock status
export async function GET(request: NextRequest) {
  const reqId = getRequestId(request);
  const route = request.url;

  const adminPayload = await verifyAdmin(request, reqId);
  if (!adminPayload) {
    return NextResponse.json({ error: 'Unauthorized or Forbidden', correlationId: reqId }, { status: 403 });
  }

  try {
    structuredLog('INFO', reqId, 'Fetching all assets', { adminId: adminPayload.userId });

    // Get all assets with user info
    const assetsSnapshot = await collections.assets.get();
    const assets = await Promise.all(assetsSnapshot.docs.map(async (doc: admin.firestore.DocumentSnapshot) => {
      const asset = { id: doc.id, ...doc.data() };
      const userDoc = await collections.users.doc((asset as any).userId).get();
      const user = userDoc.exists ? userDoc.data() : null;
      return { ...asset, user: user ? { id: user.id, username: user.username } : null };
    }));

    // Check for active trades per asset (simplified: if binary asset exists with same symbol)
    const binaryAssetsSnapshot = await collections.assets
      .where('symbol', '>=', 'BINARY-')
      .where('symbol', '<', 'BINARY-~')
      .get();

    const binaryAssets = binaryAssetsSnapshot.docs.map((doc: admin.firestore.DocumentSnapshot) => {
      const data = doc.data();
      return data ? {
        symbol: data.symbol,
        userId: data.userId
      } : null;
    }).filter((item: any) => item !== null);

    // For each asset, check if user has active binary trades for that underlying symbol
    const assetsWithStatus = assets.map((asset: any) => {
      const underlyingSymbol = asset.symbol.startsWith('BINARY-') ? asset.symbol.replace('BINARY-', '') : asset.symbol;
      const hasActiveTrades = binaryAssets.some((ba: { symbol: string, userId: string }) =>
        ba.userId === asset.userId &&
        (ba.symbol.includes(underlyingSymbol) || underlyingSymbol === asset.symbol)
      );

      return {
        id: asset.id,
        userId: asset.userId,
        username: asset.user.username,
        symbol: asset.symbol,
        quantity: asset.quantity,
        locked: (asset as any).locked || false,
        hasActiveTrades
      };
    });

    structuredLog('INFO', reqId, `Fetched ${assetsWithStatus.length} assets`, { adminId: adminPayload.userId });

    return NextResponse.json({
      assets: assetsWithStatus,
      success: true,
      correlationId: reqId
    });

  } catch (error: any) {
    return handleApiError(reqId, error, route, 'Failed to fetch assets');
  }
}