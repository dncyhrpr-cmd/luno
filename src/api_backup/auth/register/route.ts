import { NextRequest, NextResponse } from 'next/server';
import { FirestoreDatabase } from '../../../../lib/firestore-db';
import { auth } from '../../../../lib/firestore-admin';

const firestoreDB = new FirestoreDatabase();

export async function POST(request: NextRequest) {
  try {
    const { email, password, username } = await request.json();

    if (!email || !password || !username) {
      return NextResponse.json({ error: 'Email, password, and username are required' }, { status: 400 });
    }

    // Create user in Firebase Auth
    const userRecord = await auth.createUser({
        email,
        password,
        displayName: username,
    });

    const user = await firestoreDB.createUser({
        username,
        email,
        role: 'trader',
        roles: ['trader'],
        balance: 0,
        twoFactorEnabled: false,
        migrationStatus: 'migrated'
    }, userRecord.uid);

    const accessToken = 'mock-access-token';
    const refreshToken = 'mock-refresh-token';

    return NextResponse.json({
      message: 'Registration successful',
      user,
      accessToken,
      refreshToken,
    }, { status: 201 });

  } catch (error: any) {
    if (error.code === 'auth/email-already-exists') {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Registration route unexpected failure' }, { status: 500 });
  }
}
