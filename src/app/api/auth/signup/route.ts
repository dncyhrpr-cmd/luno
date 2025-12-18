import { NextRequest, NextResponse } from 'next/server';
import { FirestoreDatabase } from '@/lib/firestore-db';
import { validatePassword } from '@/lib/auth-utils';

const firestoreDB = new FirestoreDatabase();

export async function POST(request: NextRequest) {
  try {
    const { name, email, password } = await request.json();

    // 1. Validate input
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Missing required fields: name, email, and password are required' },
        { status: 400 }
      );
    }

    if (typeof email !== 'string' || !email.includes('@') || email.length < 5) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    const validationResult = validatePassword(password);
    if (validationResult !== true) {
      return NextResponse.json({ error: validationResult }, { status: 400 });
    }

    // 2. Check if user already exists
    const existingUsers = await firestoreDB.getUsers();
    const existingUser = existingUsers.users.find(u => u.email === email);

    if (existingUser) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 });
    }

    // 3. Generate unique username
    const baseUsername = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
    const username = `${baseUsername}${Math.floor(Math.random() * 1000).toString().padStart(4, '0')}`;

    // 4. Create user profile in Firestore
    try {
      const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      await firestoreDB.createUser({
        username,
        email,
        role: 'trader',
        roles: ['trader'],
        balance: 1000.0, // Give new users some starting balance
        twoFactorEnabled: false,
        migrationStatus: 'migrated',
      }, userId);

      return NextResponse.json(
        {
          message: 'User created successfully',
          userId: userId
        },
        { status: 201 }
      );

    } catch (firestoreError: any) {
      console.error('Failed to create user in Firestore:', firestoreError);
      return NextResponse.json({ error: 'Failed to create user profile.' }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Signup route error:', error);
    return NextResponse.json({ error: 'Signup failed. An unexpected error occurred.' }, { status: 500 });
  }
}