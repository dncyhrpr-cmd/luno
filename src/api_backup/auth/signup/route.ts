import { NextRequest, NextResponse } from 'next/server';
import { FirestoreDatabase } from '@/lib/firestore-db';
import { getRequestId, handleApiError, structuredLog } from '@/lib/correlation';
import { validatePassword } from '@/lib/auth-utils';
import { admin } from '@/lib/firestore-admin';

const firestoreDB = new FirestoreDatabase();

export async function POST(request: NextRequest) {
  const reqId = getRequestId(request);
  const route = request.url;

  try {
    const { name, email, password } = await request.json();
    
    structuredLog('INFO', reqId, 'Signup request received', { route, name, email });

    // 1. Validate input
    if (!name || !email || !password) {
      structuredLog('WARN', reqId, 'Validation failed: missing required fields', { route, status: 400 });
      return NextResponse.json(
        { error: 'Missing required fields: name, email, and password are required', correlationId: reqId },
        { status: 400 }
      );
    }

    if (typeof email !== 'string' || !email.includes('@') || email.length < 5) {
      structuredLog('WARN', reqId, 'Validation failed: invalid email format', { route, email, status: 400 });
      return NextResponse.json({ error: 'Invalid email format', correlationId: reqId }, { status: 400 });
    }
    
    const validationResult = validatePassword(password);
    if (validationResult !== true) {
      structuredLog('WARN', reqId, 'Validation failed: weak password policy violation', { route, email, reason: validationResult, status: 400 });
      return NextResponse.json({ error: validationResult, correlationId: reqId }, { status: 400 });
    }

    // 2. Create user in Firebase Authentication
    let authUser;
    try {
      authUser = await admin.auth().createUser({
        email,
        password,
        displayName: name,
      });
      structuredLog('INFO', reqId, 'Firebase Auth user created successfully', { uid: authUser.uid });
    } catch (authError: any) {
      structuredLog('ERROR', reqId, 'Firebase Auth error during user creation', {
        route,
        email,
        errorCode: authError.code,
        errorMessage: authError.message,
        status: 409
      });
      if (authError.code === 'auth/email-already-exists') {
        return NextResponse.json({ error: 'User with this email already exists', correlationId: reqId }, { status: 409 });
      }
      return NextResponse.json({ error: 'Failed to create authentication user.', correlationId: reqId }, { status: 500 });
    }

    // 3. Generate unique username
    const baseUsername = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
    const username = `${baseUsername}${Math.floor(Math.random() * 1000).toString().padStart(4, '0')}`;

    // 4. Create user profile in Firestore (without password)
    let user;
    try {
      const userRef = admin.firestore().collection('users').doc(authUser.uid);
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
      user = { id: userSnapshot.id, ...userData };

      structuredLog('INFO', reqId, 'Firestore user profile created successfully', { userId: user.id });
    } catch (firestoreError: any) {
      await admin.auth().deleteUser(authUser.uid);
      structuredLog('INFO', reqId, 'Rolled back Firebase Auth user deletion.', { uid: authUser.uid });

      if (firestoreError.message.includes('User with this email already exists')) {
         return NextResponse.json({ error: 'User with this email already exists', correlationId: reqId }, { status: 409 });
      }

      throw firestoreError;
    }

    structuredLog('INFO', reqId, 'Signup completed successfully', { userId: user.id, status: 201 });
    
    return NextResponse.json(
      {
        message: 'User created successfully',
        userId: user.id,
        correlationId: reqId
      },
      { status: 201 }
    );

  } catch (error: any) {
    return handleApiError(reqId, error, route, 'Signup route unexpected failure', error.status || 500);
  }
}
