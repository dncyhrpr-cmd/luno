import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromRequest, verifyAccessToken } from '@/lib/auth-utils';
import { collections } from '@/lib/db';
import admin from 'firebase-admin';

// GET - Fetch user profile
export async function GET(request: NextRequest) {
  try {
    const token = extractTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyAccessToken(token);
    const userId = payload.userId;

    const userDoc = await collections.users.doc(userId).get();

    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const user = userDoc.data()!;

    // Get KYC data
    const kycQuery = await collections.kycData.where('userId', '==', userId).limit(1).get();
    const kycData = kycQuery.empty ? null : kycQuery.docs[0].data();

    // Calculate tier based on score
    const clientScore = user.clientScore || 0;
    let tier = 'Bronze';
    if (clientScore >= 90) tier = 'Platinum';
    else if (clientScore >= 80) tier = 'Gold';
    else if (clientScore >= 70) tier = 'Silver';

    // Fee discount based on tier
    const feeDiscounts = { Bronze: '0%', Silver: '5%', Gold: '10%', Platinum: '15%' };
    const feeDiscount = feeDiscounts[tier as keyof typeof feeDiscounts];

    // Since date
    const since = user.createdAt ? new Date(user.createdAt.seconds * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long'
    }) : 'Unknown';

    // Security score based on 2FA and other factors
    let securityScore = 20; // Base
    if (user.twoFactorEnabled) securityScore += 40;
    if (kycData?.status === 'approved') securityScore += 40;

    const profile = {
      id: userDoc.id,
      username: user.username,
      email: user.email,
      balance: user.balance,
      role: user.role,
      status: user.status,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
      kycStatus: kycData?.status || 'unsubmitted',
      kycSubmittedAt: kycData?.submittedAt,
      kycVerifiedAt: kycData?.verifiedAt,
      clientScore: user.clientScore || null,
      tier,
      feeDiscount,
      since,
      securityScore: Math.min(securityScore, 100) // Max 100
    };

    console.log('DEBUG: Profile API - user.clientScore:', user.clientScore, 'hasOwnProperty clientScore:', user.hasOwnProperty('clientScore'), 'for user', userId);
    return NextResponse.json({ profile });
  } catch (error: any) {
    if (error.name === 'JWTExpired' || error.name === 'JWSInvalid') {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }
    console.error('Failed to fetch profile:', error);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}

// PUT - Update user profile
export async function PUT(request: NextRequest) {
  try {
    const token = extractTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyAccessToken(token);
    const userId = payload.userId;

    const { username, email } = await request.json();

    // Temporary dev mode bypass
    if (process.env.NODE_ENV === 'development') {
      return NextResponse.json({
        message: 'Profile updated successfully',
        profile: {
          id: 'dev-user',
          username: username || 'devuser',
          email: email || 'dev@example.com'
        }
      });
    }

    if (!username || !email) {
      return NextResponse.json({ error: 'Username and email are required' }, { status: 400 });
    }

    // Check if username or email is already taken by another user
    const usernameQuery = await collections.users.where('username', '==', username).get();
    const emailQuery = await collections.users.where('email', '==', email).get();

    const existingUsername = usernameQuery.docs.find((doc: admin.firestore.DocumentSnapshot) => doc.id !== userId);
    const existingEmail = emailQuery.docs.find((doc: admin.firestore.DocumentSnapshot) => doc.id !== userId);

    if (existingUsername || existingEmail) {
      return NextResponse.json({ error: 'Username or email already taken' }, { status: 409 });
    }

    await collections.users.doc(userId).update({
      username,
      email
    });

    const updatedUser = { id: userId, username, email };

    return NextResponse.json({
      message: 'Profile updated successfully',
      profile: {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email
      }
    });
  } catch (error: any) {
    if (error.name === 'JWTExpired' || error.name === 'JWSInvalid') {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }
    console.error('Failed to update profile:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}