const { initializeApp } = require('firebase/app');
const { getAuth, createUserWithEmailAndPassword } = require('firebase/auth');
const { FirestoreDatabaseScript } = require('./firestore-db-js');
const bcrypt = require('bcryptjs');

const firebaseConfig = {
  apiKey: "AIzaSyB6VZGyh3S4IkOv1Wz81F1jd7oa-OlC1i0",
  authDomain: "luno-0.firebaseapp.com",
  projectId: "luno-0",
  storageBucket: "luno-0.firebasestorage.app",
  messagingSenderId: "368484485180",
  appId: "1:368484485180:web:3bd9361d2e566e4e045b39",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

async function initializeFirestore() {
  try {
    console.log('🚀 Initializing Firestore database...');

    const firestoreDB = new FirestoreDatabaseScript();

    // Seed users are optional and disabled by default.
    // To enable seeding the admin user, set environment variables before running this script:
    // - CREATE_SEED_USERS=true  (or CREATE_ADMIN=true) to create the admin user
    const shouldCreateAdmin = process.env.CREATE_SEED_USERS === 'true' || process.env.CREATE_ADMIN === 'true';

    if (shouldCreateAdmin) {
      // Create admin user if doesn't exist
      const adminEmail = 'dncyhrpr@gmail.com';
      const password = 'khan212';
      const existingAdmin = await firestoreDB.findUserByEmail(adminEmail);

      if (!existingAdmin) {
        // Create user in Firebase Authentication
        const userCredential = await createUserWithEmailAndPassword(auth, adminEmail, password);
        const user = userCredential.user;
        console.log('👤 Admin user created in Firebase Authentication');
        console.log(`   Email: ${user.email}`);
        console.log(`   UID: ${user.uid}`);

        const hashedPassword = await bcrypt.hash(password, 12);
        const adminUser = await firestoreDB.createUser({
          id: user.uid,
          username: 'dncyhrpr_admin',
          email: adminEmail,
          password: hashedPassword,
          role: 'admin',
          balance: 1000000.0, // Admin gets high balance
          twoFactorEnabled: false,
        });
        console.log('👤 Admin user created in Firestore');
        console.log(`   Email: ${adminUser.email}`);
        console.log(`   Username: ${adminUser.username}`);
        console.log(`   Role: ${adminUser.role}`);
        console.log(`   Balance: ${adminUser.balance}`);
      } else {
        console.log('👤 Admin user already exists in Firestore');
        console.log(`   Email: ${existingAdmin.email}`);
        console.log(`   Username: ${existingAdmin.username}`);
        console.log(`   Role: ${existingAdmin.role}`);
      }
    } else {
      console.log('⚠️ Skipping admin user creation (set CREATE_SEED_USERS or CREATE_ADMIN=true to enable)');
    }

    console.log('\n🎉 Firestore initialization complete!');

  } catch (error) {
    console.error('❌ Firestore initialization failed:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  initializeFirestore()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { initializeFirestore };