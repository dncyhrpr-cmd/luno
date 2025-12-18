import { NextRequest, NextResponse } from 'next/server';
import { FirestoreDatabase } from '@/lib/firestore-db';
import { validatePassword } from '@/lib/auth-utils';
import { admin, getDb } from '@/lib/firestore-admin';

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

    // 2. Create user in Firebase Authentication
    let authUser;
    try {
      authUser = await admin.auth().createUser({
        email,
        password,
        displayName: name,
      });
    } catch (authError: any) {
      if (authError.code === 'auth/email-already-exists') {
        return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Failed to create authentication user.' }, { status: 500 });
    }

    // 3. Generate unique username
    const baseUsername = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
    const username = `${baseUsername}${Math.floor(Math.random() * 1000).toString().padStart(4, '0')}`;

    // 4. Create user profile in Firestore
    try {
      const db = getDb();
      const userRef = db.collection('users').doc(authUser.uid);
      await userRef.set({
        username,
        email,
        role: 'trader',
        roles: ['trader'],
        balance: 0.0,
        twoFactorEnabled: false,
        migrationStatus: 'migrated',
        createdAt: new Date(),
      });
      const userSnapshot = await userRef.get();
      const userData = userSnapshot.data();
      const user = { id: userSnapshot.id, ...userData };

      return NextResponse.json(
        {
          message: 'User created successfully',
          userId: user.id
        },
        { status: 201 }
      );

    } catch (firestoreError: any) {
      await admin.auth().deleteUser(authUser.uid);
      throw firestoreError;
    }

  } catch (error: any) {
    console.error('Signup route error:', error);
    return NextResponse.json({ error: 'Signup failed. An unexpected error occurred.' }, { status: 500 });
  }
}