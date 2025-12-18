/*
Backfill script: ensure every user document has a `role` string.
If a document has `roles` array but no `role`, set `role` to the first entry in `roles`.
Run locally with: node scripts/sync-user-roles.js
Requires: serviceAccountKey.json present in project root.
*/

const admin = require('firebase-admin');
const fs = require('fs');

const keyPath = './serviceAccountKey.json';
if (!fs.existsSync(keyPath)) {
  console.error('serviceAccountKey.json not found in project root. Aborting.');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(require(keyPath)),
});

const db = admin.firestore();

async function run() {
  console.log('Scanning users collection for missing `role` fields...');
  const snapshot = await db.collection('users').get();
  console.log(`Found ${snapshot.size} users.`);

  let updated = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (!data) continue;
    const hasRole = typeof data.role === 'string' && data.role.trim() !== '';
    const rolesArray = Array.isArray(data.roles) ? data.roles : null;
    if (!hasRole && rolesArray && rolesArray.length > 0) {
      const newRole = String(rolesArray[0]);
      console.log(`Setting role='${newRole}' for user ${doc.id}`);
      await db.collection('users').doc(doc.id).update({ role: newRole });
      updated += 1;
    }
    else if (!hasRole) {
      // No role and no roles array -> default to 'trader'
      console.log(`No role found for user ${doc.id}, setting default 'trader'`);
      await db.collection('users').doc(doc.id).update({ role: 'trader' });
      updated += 1;
    }
  }

  console.log(`Done. Updated ${updated} user(s).`);
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(2); });
