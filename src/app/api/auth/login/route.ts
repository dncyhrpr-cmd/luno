import { NextRequest, NextResponse } from 'next/server';
import { generateAuthTokens } from '@/lib/auth-utils';
import { FirestoreDatabase } from '@/lib/firestore-db';
import { logUserActivity } from '@/lib/db';

const firestoreDB = new FirestoreDatabase();

// Simple in-memory user store for demo purposes
// In production, replace with proper database
const users = new Map();

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    // Check if user exists (for demo, accept any email/password combination)
    // In production, implement proper user validation
    const userId = `user_${email.replace('@', '_').replace('.', '_')}`;
    const username = email.split('@')[0];

    const user = {
      id: userId,
      email: email,
      username: username,
      role: email === 'dncyhrpr@gmail.com' ? 'admin' : 'trader',
      roles: email === 'dncyhrpr@gmail.com' ? ['admin', 'trader'] : ['trader'],
      isAdmin: email === 'dncyhrpr@gmail.com',
      migrationStatus: 'migrated',
    };

    // Store user in Firestore for persistence
    try {
      await firestoreDB.createUser({
        username: user.username,
        email: user.email,
        role: user.role,
        roles: user.roles,
        balance: 0, // Starting balance
        twoFactorEnabled: false,
        migrationStatus: user.migrationStatus as any,
      }, userId);
    } catch (error: any) {
      // User might already exist, continue
      console.log('User creation skipped:', error.message);
    }

    // Store user for future reference
    users.set(userId, user);

    const tokens = await generateAuthTokens({
      id: user.id,
      roles: user.roles,
      migrationStatus: user.migrationStatus as any
    });

    // Log the login activity
    try {
      await logUserActivity(user.id, 'User Login', `Logged in from ${request.headers.get('x-forwarded-for') || 'unknown IP'}`);
    } catch (error) {
      console.error('Failed to log login activity:', error);
    }

    return NextResponse.json({
      message: 'Login successful',
      user: user,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    }, { status: 200 });

  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}