import { NextRequest, NextResponse } from 'next/server';
import { FirestoreDatabase } from '../../../../lib/firestore-db';
import { generateAuthTokens } from '@/lib/auth-utils';
import { admin } from '@/lib/firestore-admin';

const firestoreDB = new FirestoreDatabase();

async function verifyFirebaseToken(token: string) {
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    return decodedToken;
  } catch (error: any) {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization header missing or invalid' }, { status: 401 });
    }

    const idToken = authHeader.substring(7); // Remove 'Bearer '

    const decodedToken = await verifyFirebaseToken(idToken);

    if (!decodedToken) {
      return NextResponse.json({ error: 'Invalid Firebase token' }, { status: 401 });
    }

    const uid = decodedToken.uid;
    const userDoc = await firestoreDB.findUserById(uid);

    if (!userDoc) {
      return NextResponse.json({ error: 'User profile not found.' }, { status: 404 });
    }

    const user = {
      id: userDoc.id,
      email: userDoc.email,
      username: userDoc.username,
      role: userDoc.roles?.[0] || 'guest',
      roles: userDoc.roles || ['guest'],
      isAdmin: userDoc.roles?.includes('admin') || false,
      migrationStatus: userDoc.migrationStatus || 'migrated',
    };

    try {
      // Use centralized token generation
      const tokens = await generateAuthTokens({ id: user.id, roles: user.roles || [], migrationStatus: user.migrationStatus as any });
      return NextResponse.json({
        message: 'Session refreshed',
        user,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      }, { status: 200 });
    } catch (tokenErr) {
      console.error('Failed to create auth tokens:', tokenErr);
      return NextResponse.json({ error: 'Failed to create access token' }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Session route error:', error);
    return NextResponse.json({ error: 'Session route unexpected failure' }, { status: 500 });
  }
}