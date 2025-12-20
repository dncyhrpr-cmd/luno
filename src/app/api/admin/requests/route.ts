import { NextRequest, NextResponse } from 'next/server';
import { FirestoreDatabase, TransactionRequest } from '../../../../lib/firestore-db';
import { getRequestId, handleApiError, structuredLog } from '../../../../lib/correlation';
import { extractTokenFromRequest, verifyAccessToken, AuthTokenPayload } from '../../../../lib/auth-utils';

const firestoreDB = new FirestoreDatabase();

// Middleware to verify admin privileges
async function verifyAdmin(request: NextRequest, reqId: string): Promise<AuthTokenPayload | null> {
    const token = extractTokenFromRequest(request);
    if (!token) {
        structuredLog('WARN', reqId, 'Unauthorized: Missing token for admin transaction requests', { status: 401 });
        return null;
    }

    try {
        const payload = await verifyAccessToken(token);
        if (!payload.roles?.includes('admin')) {
            structuredLog('WARN', reqId, 'Forbidden: User is not an admin', { userId: payload.userId, status: 403 });
            return null;
        }
        return payload;
    } catch (error: any) {
        structuredLog('WARN', reqId, 'Auth token error on admin transaction requests', { error: error.message, status: 401 });
        return null;
    }
}

// GET - Fetch all pending transaction requests (admin only)
export async function GET(request: NextRequest) {
    const reqId = getRequestId(request);
    const route = request.url;

    const adminPayload = await verifyAdmin(request, reqId);
    if (!adminPayload) {
        return NextResponse.json({ error: 'Unauthorized or Forbidden', correlationId: reqId }, { status: 403 });
    }

    try {
        structuredLog('INFO', reqId, 'Fetching transaction requests', { adminId: adminPayload.userId });

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

        structuredLog('INFO', reqId, 'Successfully fetched transaction requests', { count: requestsWithUserDetails.length });
        return NextResponse.json({
            requests: requestsWithUserDetails,
            total: requestsWithUserDetails.length,
            correlationId: reqId
        });

    } catch (error: any) {
        if (error.message?.includes('Firebase Firestore not initialized')) {
          return NextResponse.json({ requests: [], total: 0, correlationId: reqId });
        }
        return handleApiError(reqId, error, route, 'Failed to fetch transaction requests');
    }
}

// PUT - Approve or reject a transaction request (admin only)
export async function PUT(request: NextRequest) {
    const reqId = getRequestId(request);
    const route = request.url;

    const adminPayload = await verifyAdmin(request, reqId);
    if (!adminPayload) {
        return NextResponse.json({ error: 'Unauthorized or Forbidden', correlationId: reqId }, { status: 403 });
    }

    try {
        const { requestId, action, reason } = await request.json();

        if (!requestId || !action || !['approve', 'reject'].includes(action)) {
            structuredLog('WARN', reqId, 'Invalid action or missing requestId', { status: 400 });
            return NextResponse.json({ error: 'Invalid action or missing requestId', correlationId: reqId }, { status: 400 });
        }

        structuredLog('INFO', reqId, 'Processing transaction request', { adminId: adminPayload.userId, requestId, action });

        const allRequests = await firestoreDB.getRequests();
        const transactionRequest = allRequests.find((r: TransactionRequest) => r.id === requestId);

        if (!transactionRequest) {
            structuredLog('WARN', reqId, 'Request not found or already processed', { requestId, status: 404 });
            return NextResponse.json({ error: 'Request not found or already processed', correlationId: reqId }, { status: 404 });
        }

        if (transactionRequest.status !== 'pending') {
            structuredLog('WARN', reqId, 'Request already processed', { requestId, currentStatus: transactionRequest.status, status: 409 });
            return NextResponse.json({ error: `Request already ${transactionRequest.status}`, correlationId: reqId }, { status: 409 });
        }

        if (action === 'approve') {
            try {
                await handleApprove(transactionRequest, adminPayload.userId, reqId);
            } catch (error: any) {
                // Handle business logic errors with appropriate status codes
                if (error.message === 'Insufficient balance') {
                    structuredLog('WARN', reqId, 'Insufficient balance for withdrawal approval', {
                        requestId,
                        userId: transactionRequest.userId,
                        amount: transactionRequest.amount
                    });
                    return NextResponse.json({
                        error: 'Cannot approve withdrawal: User has insufficient balance',
                        correlationId: reqId
                    }, { status: 400 });
                }
                // Re-throw other errors to be handled by the general catch block
                throw error;
            }
        } else { // action === 'reject'
            if (!reason) {
                structuredLog('WARN', reqId, 'Reason required for rejection', { status: 400 });
                return NextResponse.json({ error: 'Reason required for rejection', correlationId: reqId }, { status: 400 });
            }
            await handleReject(transactionRequest, reason, adminPayload.userId, reqId);
        }

        structuredLog('INFO', reqId, 'Successfully processed transaction request', { requestId, action });
        return NextResponse.json({
            message: `Request ${action}d successfully`,
            success: true,
            correlationId: reqId
        });

    } catch (error: any) {
        return handleApiError(reqId, error, route, 'Failed to process transaction request');
    }
}

async function handleApprove(request: TransactionRequest, adminId: string, reqId: string) {
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

    structuredLog('INFO', reqId, 'Transaction request approved and executed', { requestId: request.id, adminId, amount: request.amount });
}

async function handleReject(request: TransactionRequest, reason: string, adminId: string, reqId: string) {
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

    structuredLog('INFO', reqId, 'Transaction request rejected', { requestId: request.id, adminId, reason });
}