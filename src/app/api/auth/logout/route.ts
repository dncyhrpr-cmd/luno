import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromRequest, verifyAccessToken } from '@/lib/auth-utils';
import { collections } from '@/lib/db';
import admin from 'firebase-admin';

export async function POST(request: NextRequest) {
  try {
    const token = extractTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyAccessToken(token);
    const userId = payload.userId;

    if (payload.jti && payload.exp) {
      const revocationId = collections.tokenRevocation.doc().id;
      await collections.tokenRevocation.doc(revocationId).set({
        id: revocationId,
        userId,
        expiresAt: admin.firestore.Timestamp.fromDate(new Date(payload.exp * 1000))
      });
    }

    return NextResponse.json({
      message: 'Logged out successfully',
      success: true,
    }, { status: 200 });

  } catch (error: any) {
    console.error('Logout error:', error);
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 });
  }
}
