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
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: 'ID token is required' }, { status: 400 });
    }

    // const decodedToken = await verifyFirebaseToken(token);

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
      // Use centralized token generation so other routes (which use jose verify) accept the token
      const tokens = await generateAuthTokens({ id: user.id, roles: user.roles || [], migrationStatus: user.migrationStatus as any });
      return NextResponse.json({
        message: 'Login successful',
        user,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      }, { status: 200 });
    } catch (tokenErr) {
      console.error('Failed to create auth tokens:', tokenErr);
      return NextResponse.json({ error: 'Failed to create access token' }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Login route error:', error);
    return NextResponse.json({ error: 'Login route unexpected failure' }, { status: 500 });
  }
}