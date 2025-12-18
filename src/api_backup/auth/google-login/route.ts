import { NextRequest, NextResponse } from 'next/server';
import { auth as adminAuth, db as firestore } from '@/lib/firestore-admin';
import { generateAuthTokens } from '@/lib/auth-utils';
import * as admin from 'firebase-admin';

// Replicating necessary User type from src/lib/firestore-db for server logic
interface User {
  id: string;
  username: string;
  email: string;
  password: string;
  role: string;
  roles: string[];
  balance: number;
  twoFactorEnabled: boolean;
  migrationStatus: 'legacy' | 'migrated';
  createdAt: admin.firestore.FieldValue;
}

const USERS_COLLECTION = 'users';

export async function POST(request: NextRequest) {
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { message: 'Authorization token required' },
        { status: 401 }
      );
    }
    const idToken = authorizationHeader.split('Bearer ')[1];

    // 1. Verify the Firebase ID token
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;
    const email = decodedToken.email;
    const displayName = decodedToken.name || '';

    if (!uid || !email) {
      return NextResponse.json(
        { message: 'Invalid token structure' },
        { status: 401 }
      );
    }

    // 2. Check if user profile exists in Firestore (our internal database)
    const userRef = firestore.collection(USERS_COLLECTION).doc(uid);
    let userDoc = await userRef.get();
    let user: User | undefined;

    if (userDoc.exists) {
      user = userDoc.data() as User;
    } else {
      // If user doesn't exist, create a new profile in Firestore
      // Use display name if available, otherwise generate a username
      const baseUsername = displayName.split(' ')[0] || email.split('@')[0];
      const username = `${baseUsername.replace(/[^a-zA-Z0-9]/g, '')}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

      const newUserData: Omit<User, 'createdAt'> = {
        id: uid,
        username,
        email,
        password: '',
        role: 'trader',
        roles: ['trader'],
        balance: 10000.0,
        twoFactorEnabled: false,
        migrationStatus: 'migrated',
      };
      
      await userRef.set({
        ...newUserData,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      user = {
        ...newUserData,
        createdAt: admin.firestore.FieldValue.serverTimestamp() as any
      };
    }
    
    if (!user) {
      // This should ideally not happen if logic above is correct
      return NextResponse.json(
        { message: 'User profile creation/retrieval failed' },
        { status: 500 }
      );
    }

    // 3. Generate internal JWT
    // We cast to 'any' as 'User' includes 'createdAt' as a Firestore FieldValue type
    // which may not be compatible with generateAuthTokens expected User type.
    const { accessToken } = await generateAuthTokens(user as any);

    const { password: _, ...userWithoutPassword } = user as any;
    return NextResponse.json(
      {
        message: 'Google login successful',
        user: userWithoutPassword,
        accessToken,
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('Google Login Server Error:', error);
    return NextResponse.json(
      {
        message: 'Failed to authenticate with Google.',
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 401 }
    );
  }
}