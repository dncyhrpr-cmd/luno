// JavaScript version of Firestore database for scripts
const admin = require('firebase-admin');
const fs = require('fs');

const keyPath = require('path').resolve(__dirname, '../serviceAccountKey.json');
if (!fs.existsSync(keyPath)) {
  console.error('serviceAccountKey.json not found at:', keyPath);
  console.error('Please ensure it exists in the project root directory.');
  console.error('Download it from Firebase Console > Project Settings > Service Accounts > Generate new private key.');
  process.exit(1);
}

// Initialize Firebase Admin SDK
const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Firestore Database Service for scripts
class FirestoreDatabaseScript {
  constructor() {
    this.USERS_COLLECTION = 'users';
  }

  async createUser(userData) {
    const usersRef = db.collection(this.USERS_COLLECTION);
    const existingDocs = await usersRef.where('email', '==', userData.email).get();
    
    if (!existingDocs.empty) {
      throw new Error('User with this email already exists');
    }

    const newUserRef = usersRef.doc();
    const newUser = {
      id: newUserRef.id,
      ...userData,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await newUserRef.set(newUser);
    return newUser;
  }

  async findUserByEmail(email) {
    const usersRef = db.collection(this.USERS_COLLECTION);
    const snapshot = await usersRef.where('email', '==', email).get();

    if (snapshot.empty) {
      return null;
    }

    const userDoc = snapshot.docs[0].data();
    return userDoc;
  }

  async updateUserBalance(userId, newBalance) {
    const usersRef = db.collection(this.USERS_COLLECTION);
    await usersRef.doc(userId).update({
      balance: newBalance,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  async createAsset(assetData) {
    const assetsRef = db.collection('assets');
    const newAssetRef = assetsRef.doc();
    const newAsset = {
      id: newAssetRef.id,
      ...assetData,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await newAssetRef.set(newAsset);
    return newAsset;
  }
}

module.exports = { FirestoreDatabaseScript };