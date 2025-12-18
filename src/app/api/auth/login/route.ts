import { NextRequest, NextResponse } from 'next/server';
import { FirestoreDatabase } from '../../../../lib/firestore-db';
import { generateAuthTokens } from '@/lib/auth-utils';

const firestoreDB = new FirestoreDatabase();

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    // Find user by email
    const users = await firestoreDB.getUsers();
    const userDoc = users.users.find(u => u.email === email);

    if (!userDoc) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // For production, implement proper password verification
    // For now, accept any password for existing users (simplified for demo)
    // TODO: Implement proper password hashing and verification

    const user = {
      id: userDoc.id,
      email: userDoc.email,
      username: userDoc.username,
      role: userDoc.roles?.[0] || 'trader',
      roles: userDoc.roles || ['trader'],
      isAdmin: userDoc.roles?.includes('admin') || false,
      migrationStatus: userDoc.migrationStatus || 'migrated',
    };

    try {
      // Generate JWT tokens
      const tokens = await generateAuthTokens({
        id: user.id,
        roles: user.roles || [],
        migrationStatus: user.migrationStatus as any
      });

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
    return NextResponse.json({ error: 'Login failed. Please try again.' }, { status: 500 });
  }
}