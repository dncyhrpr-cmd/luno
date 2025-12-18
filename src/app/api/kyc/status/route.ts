import { NextRequest, NextResponse } from 'next/server';
import { FirestoreDatabase, KYC_STATUSES } from '../../../../lib/firestore-db';
import { extractTokenFromRequest, verifyAccessToken } from '@/lib/auth-utils';

export const dynamic = 'force-dynamic';

const firestoreDB = new FirestoreDatabase();

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
    const token = extractTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyAccessToken(token);
    const userId = payload.userId;

    const { status: dbStatus, missingFields } = await firestoreDB.getKycStatus(userId);
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