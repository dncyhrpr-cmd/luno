import { NextRequest, NextResponse } from 'next/server';
import { FirestoreDatabase, KYC_STATUSES } from '../../../lib/firestore-db';
import jwt from 'jsonwebtoken';

const firestoreDB = new FirestoreDatabase();

function verifyToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const JWT_SECRET = process.env.JWT_SECRET;

  if (!JWT_SECRET) {
    console.error("JWT_SECRET is not defined in environment variables.");
    return null;
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return decoded;
  } catch (error: any) {
    console.error("JWT verification error:", error);
    return null;
  }
}

// GET - Fetch user's transaction requests
export async function GET(request: NextRequest) {
  try {
    const user = verifyToken(request);
    if (!user || !user.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const requests = await firestoreDB.getUserRequests(user.userId);
    return NextResponse.json({ requests });
  } catch (error: any) {
    console.error("Failed to fetch requests:", error);
    return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
  }
}

// POST - Process deposit/withdraw
export async function POST(request: NextRequest) {
  try {
    const user = verifyToken(request);
    if (!user || !user.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { type, amount } = await request.json();
    const parsedAmount = parseFloat(amount);

    if (!type || !parsedAmount || parsedAmount <= 0) {
      return NextResponse.json({ error: 'Invalid type or amount' }, { status: 400 });
    }

    if (!['deposit', 'withdraw'].includes(type)) {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    // 1. KYC Check Enforcement
    const { status: kycStatus, missingFields } = await firestoreDB.getKycStatus(user.userId);
    
    if (kycStatus !== KYC_STATUSES.APPROVED) {
        return NextResponse.json({
            error: 'KYC verification required to initiate financial transactions.',
            kycStatus: kycStatus,
            missingFields: missingFields,
        }, { status: 403 });
    }
    
    // 2. Validate balance for withdrawal (if applicable)
    if (type === 'withdraw') {
      const userData = await firestoreDB.findUserById(user.userId);
      if (!userData) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      if (userData.balance < parsedAmount) {
        return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
      }
    }

    // 3. Create a pending transaction request for admin review
    const requestData = {
        userId: user.userId,
        type: type as 'deposit' | 'withdraw',
        amount: parsedAmount,
    };

    const newRequest = await firestoreDB.createTransactionRequest(requestData);

    return NextResponse.json({
      message: `${type.charAt(0).toUpperCase() + type.slice(1)} request submitted successfully for review.`,
      request: newRequest
    });
  } catch (error: any) {
    console.error("Failed to create transaction request:", error);
    return NextResponse.json({ error: 'Failed to process transaction request' }, { status: 500 });
  }
}
