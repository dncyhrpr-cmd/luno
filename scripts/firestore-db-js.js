// JavaScript version of Firestore database for scripts
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(require('../serviceAccountKey.json')),
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
}

module.exports = { FirestoreDatabaseScript };