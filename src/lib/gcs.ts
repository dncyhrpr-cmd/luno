
import { Storage } from '@google-cloud/storage';

const storage = new Storage({
  keyFilename: 'gcs-service-account.json',
});

const bucketName = 'your-project-name-kyc-files'; // Replace with your bucket name
export const bucket = storage.bucket(bucketName);
