import { NextRequest, NextResponse } from 'next/server';
import { FirestoreDatabase, KYCData } from '@/lib/firestore-db';
import { getRequestId, handleApiError, structuredLog } from '@/lib/correlation';
import { extractTokenFromRequest, verifyAccessToken } from '@/lib/auth-utils';

const firestoreDB = new FirestoreDatabase();

function isMissing(value: any): boolean {
    return !value || (typeof value === 'string' && value.trim() === '');
}

// Helper function to upload image to ImgBB
async function uploadImageToImgBB(base64Image: string, reqId: string): Promise<string> {
  const imgbbApiKey = process.env.IMGBB_API_KEY;
  if (!imgbbApiKey) {
    structuredLog('ERROR', reqId, 'IMGBB_API_KEY environment variable is not set.');
    throw new Error('Image upload service is not configured.');
  }

  const formData = new FormData();
  formData.append('key', imgbbApiKey);
  // The image needs to be stripped of the data URL prefix if it has one
  const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");
  formData.append('image', cleanBase64);

  try {
    const response = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      structuredLog('ERROR', reqId, 'ImgBB upload failed', { status: response.status, errorData });
      throw new Error(`ImgBB upload failed: ${response.status} - ${errorData.error?.message || response.statusText}`);
    }

    const result = await response.json();
    if (result.success && result.data && result.data.url) {
      return result.data.url;
    } else {
      structuredLog('ERROR', reqId, 'ImgBB upload failed with unexpected response', { result });
      throw new Error('ImgBB upload failed: Unexpected response format.');
    }
  } catch (error: any) {
    structuredLog('ERROR', reqId, 'Error uploading image to ImgBB', { error: (error as Error).message });
    // Re-throw a more generic error to the client
    throw new Error(`Image upload service unavailable.`);
  }
}

// POST - Submit KYC data for a user
export async function POST(request: NextRequest) {
  const reqId = getRequestId(request);
  const route = request.url;

  try {
    const token = extractTokenFromRequest(request);
    if (!token) {
      structuredLog('WARN', reqId, 'Unauthorized: Missing token for KYC submission', { route, status: 401 });
      return NextResponse.json({ error: 'Unauthorized', correlationId: reqId }, { status: 401 });
    }

    const payload = await verifyAccessToken(token);
    const userId = payload.userId;
    
    let kycData: Omit<KYCData, 'id' | 'submittedAt' | 'createdAt' | 'status' | 'rejectionReason' | 'verifiedAt' | 'verifiedBy'> & { documentImage?: string; selfieImage?: string; idType?: string; idNumber?: string; phoneNumber?: string; nationality?: string; city?: string; postalCode?: string; country?: string };

    try {
      kycData = await request.json();
    } catch (jsonError: any) {
      structuredLog('WARN', reqId, 'JSON parsing error in KYC submission', { route, userId, error: jsonError.message, status: 400 });
      return NextResponse.json({ error: 'Invalid JSON payload', correlationId: reqId }, { status: 400 });
    }

    structuredLog('INFO', reqId, 'KYC submission received', { route, userId });

    // Handle image uploads if provided (document and selfie)
    if (kycData.documentImage) {
      try {
        const documentUrl = await uploadImageToImgBB(kycData.documentImage, reqId);
        kycData.documentUrl = documentUrl;
        structuredLog('INFO', reqId, 'KYC document image uploaded successfully', { userId, documentUrl });
      } catch (imageUploadError: any) {
        structuredLog('ERROR', reqId, 'Failed to upload KYC document image', { userId, error: imageUploadError.message, status: 500 });
        return NextResponse.json({ error: `Image processing failed: ${imageUploadError.message}`, correlationId: reqId }, { status: 500 });
      } finally {
        // Remove the base64 image data from kycData before saving to Firestore
        delete kycData.documentImage;
      }
    }

    if (kycData.selfieImage) {
      try {
        const selfieUrl = await uploadImageToImgBB(kycData.selfieImage, reqId);
        kycData.selfieUrl = selfieUrl;
        structuredLog('INFO', reqId, 'KYC selfie image uploaded successfully', { userId, selfieUrl });
      } catch (imageUploadError: any) {
        structuredLog('ERROR', reqId, 'Failed to upload KYC selfie image', { userId, error: imageUploadError.message, status: 500 });
        return NextResponse.json({ error: `Image processing failed: ${imageUploadError.message}`, correlationId: reqId }, { status: 500 });
      } finally {
        delete kycData.selfieImage;
      }
    }

    // Check if user already has a pending or approved KYC
    const existingKyc = await firestoreDB.getKYCByUserId(userId);
    if (existingKyc && (existingKyc.status === 'pending' || existingKyc.status === 'approved')) {
      structuredLog('WARN', reqId, 'Duplicate KYC submission attempt', { userId, status: 409 });
      return NextResponse.json({ error: `KYC already in '${existingKyc.status}' state.` }, { status: 409 });
    }

    // --- Database Operation ---
    const newKyc = await firestoreDB.createKYC({ ...kycData, userId });

    // --- Audit Log ---
    await firestoreDB.createAuditLog({
      userId,
      action: 'kyc_submitted',
      resourceType: 'kyc_data',
      resourceId: newKyc.id,
      changes: { status: 'pending' },
      status: 'success',
    });
    
    structuredLog('INFO', reqId, 'Successfully submitted KYC', { userId, kycId: newKyc.id, status: 201 });

    return NextResponse.json({ 
      message: 'KYC data submitted successfully. Verification is pending.',
      kycId: newKyc.id,
      correlationId: reqId
    }, { status: 201 });

  } catch (error: any) {
    if (error.name === 'JWTExpired' || error.name === 'JWSInvalid') {
      structuredLog('WARN', reqId, 'Auth token error on KYC submission', { route, error: error.message, status: 401 });
      return NextResponse.json({ error: 'Invalid or expired token', correlationId: reqId }, { status: 401 });
    }
    return handleApiError(reqId, error, route, 'KYC submission failed');
  }
}
