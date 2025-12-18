import { NextRequest, NextResponse } from 'next/server';
import { bucket } from '@/lib/gcs';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  const { fileType } = await request.json();
  if (!fileType) {
    return NextResponse.json({ error: 'fileType is required' }, { status: 400 });
  }

  const fileExtension = fileType.split('/')[1];
  const fileName = `${uuidv4()}.${fileExtension}`;

  const options = {
    version: 'v4' as const,
    action: 'write' as const,
    expires: Date.now() + 15 * 60 * 1000, // 15 minutes
    contentType: fileType,
  };

  try {
    const [url] = await bucket.file(fileName).getSignedUrl(options);
    return NextResponse.json({ url, fileName });
  } catch (error: any) {
    console.error('Error generating signed URL:', error);
    return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 });
  }
}