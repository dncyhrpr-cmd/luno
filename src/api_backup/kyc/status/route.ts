import { NextRequest, NextResponse } from 'next/server';
import { FirestoreDatabase, KYC_STATUSES } from '../../../../lib/firestore-db';
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

function mapKycStatusToClient(status: typeof KYC_STATUSES[keyof typeof KYC_STATUSES]): string {
  switch (status) {
    case KYC_STATUSES.APPROVED:
      return 'Verified';
    case KYC_STATUSES.PENDING:
      return 'Pending Review';
    case KYC_STATUSES.REJECTED:
      return 'Rejected';
    case KYC_STATUSES.UNSUBMITTED:
    default:
      return 'Not Verified';
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = verifyToken(request);
    if (!user || !user.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { status: dbStatus, missingFields } = await firestoreDB.getKycStatus(user.userId);
    const clientStatus = mapKycStatusToClient(dbStatus);

    const kycStatus = {
      status: clientStatus,
      missingFields: missingFields,
    };

    return NextResponse.json(kycStatus);
  } catch (error: any) {
    console.error("Failed to fetch KYC status:", error);
    return NextResponse.json({ error: 'Failed to fetch KYC status' }, { status: 500 });
  }
}