// scripts/check-kyc.js
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(require('../serviceAccountKey.json')),
});

const db = admin.firestore();

async function checkKycData() {
  try {
    console.log('🔍 Checking kyc_data collection...');
    const kycCollection = db.collection('kyc_data');
    const snapshot = await kycCollection.get();

    if (snapshot.empty) {
      console.log('No documents found in kyc_data collection.');
      return;
    }

    console.log('📄 Found documents:');
    snapshot.forEach(doc => {
      console.log(doc.id, '=>', doc.data());
    });
  } catch (error) {
    console.error('Error checking KYC data:', error);
  } finally {
    // Close the database connection
    admin.app().delete();
  }
}

checkKycData();
