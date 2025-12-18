import { NextRequest, NextResponse } from 'next/server';
import { FirestoreDatabase, TransactionRequest } from '../../../../lib/firestore-db';
import jwt from 'jsonwebtoken';

const firestoreDB = new FirestoreDatabase();

function verifyAdminToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any;
    if (decoded.role !== 'admin') return null;
    return decoded;
  } catch (error: any) {
    return null;
  }
}

// GET - Fetch all pending transaction requests (admin only)
export async function GET(request: NextRequest) {
  try {
    const adminUser = verifyAdminToken(request);
    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const allRequests = await firestoreDB.getRequests();
    const pendingRequests = allRequests.filter((r: TransactionRequest) => r.status === 'pending');
    
    const requestsWithUserDetails = await Promise.all(
      pendingRequests.map(async (req: TransactionRequest) => {
        const userData = await firestoreDB.findUserById(req.userId);
        return {
          ...req,
          username: userData?.username,
          email: userData?.email
        };
      })
    );

    return NextResponse.json({ 
      requests: requestsWithUserDetails,
      total: requestsWithUserDetails.length
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
  }
}

// PUT - Approve or reject a transaction request (admin only)
export async function PUT(request: NextRequest) {
  try {
    const adminUser = verifyAdminToken(request);
    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { requestId, action, reason } = await request.json();

    if (!requestId || !action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action or missing requestId' }, { status: 400 });
    }

    const allRequests = await firestoreDB.getRequests();
    const transactionRequest = allRequests.find((r: TransactionRequest) => r.id === requestId);

    if (!transactionRequest) {
      return NextResponse.json({ error: 'Request not found or already processed' }, { status: 404 });
    }
    
    if (transactionRequest.status !== 'pending') {
      return NextResponse.json({ error: `Request already ${transactionRequest.status}` }, { status: 409 });
    }

    if (action === 'approve') {
      await handleApprove(transactionRequest, adminUser.userId);
    } else { // action === 'reject'
      if (!reason) {
        return NextResponse.json({ error: 'Reason required for rejection' }, { status: 400 });
      }
      await handleReject(transactionRequest, reason, adminUser.userId);
    }

    return NextResponse.json({
      message: `Request ${action}d successfully`,
      success: true
    });
  } catch (error: any) {
    const message = error instanceof Error ? error.message : 'Failed to process request';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function handleApprove(request: TransactionRequest, adminId: string) {
  // 1. Process the transaction atomically (updates balance, creates history, sets request status to 'executed')
  await firestoreDB.processTransactionRequest(request, adminId);
  
  // 2. Create Audit Log (using 'executed' status implied by processTransactionRequest completion)
  await firestoreDB.createAuditLog({
    adminId: adminId,
    action: `${request.type}_executed`,
    resourceType: 'transaction_request',
    resourceId: request.id,
    changes: { status: 'executed', amount: request.amount },
    status: 'success'
  });

  // 3. Create Alert for user
  await firestoreDB.createAlert({
    userId: request.userId,
    type: 'transaction',
    title: `${request.type.charAt(0).toUpperCase() + request.type.slice(1)} Approved and Executed`,
    message: `Your ${request.type} of $${request.amount.toFixed(2)} has been successfully processed.`,
    read: false
  });
}

async function handleReject(request: TransactionRequest, reason: string, adminId: string) {
  await firestoreDB.updateRequest(request.id, { status: 'rejected', reason, processedBy: adminId });

  await firestoreDB.createAuditLog({
    adminId: adminId,
    action: `${request.type}_rejected`,
    resourceType: 'transaction_request',
    resourceId: request.id,
    changes: { status: 'rejected', reason },
    status: 'success'
  });

  await firestoreDB.createAlert({
    userId: request.userId,
    type: 'transaction',
    title: `${request.type.charAt(0).toUpperCase() + request.type.slice(1)} Rejected`,
    message: `Your ${request.type} request for $${request.amount.toFixed(2)} has been rejected. Reason: ${reason}`,
    read: false
  });
}
