const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase
const keyPath = path.resolve(__dirname, '../serviceAccountKey.json');
if (!fs.existsSync(keyPath)) {
  console.error('serviceAccountKey.json not found!');
  process.exit(1);
}
const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}
const db = admin.firestore();

const USERS_COLLECTION = 'users';
const ORDERS_COLLECTION = 'orders';
const ASSETS_COLLECTION = 'assets';
const TRANSACTION_HISTORY_COLLECTION = 'transaction_history';
const AUDIT_LOG_COLLECTION = 'audit_logs';
const ALERTS_COLLECTION = 'alerts';

async function run() {
  const userId = 'user_p2p_gmail_com'; // Using the user we found
  const symbol = 'BTCUSDT';
  const type = 'BUY';
  const quantity = 0.001;
  const price = 50000;
  const orderType = 'MARKET';
  const leverage = 1;

  console.log(`Starting debug order for user ${userId}...`);

  try {
    // 1. Get User
    const userDoc = await db.collection(USERS_COLLECTION).doc(userId).get();
    if (!userDoc.exists) {
      console.error('User not found');
      return;
    }
    const userData = userDoc.data();
    console.log('User balance:', userData.balance);

    const orderValue = quantity * price;
    const marginRequired = orderValue / leverage;
    console.log(`Order Value: ${orderValue}, Margin Required: ${marginRequired}`);

    if (type === 'BUY' && userData.balance < marginRequired) {
      console.error('Insufficient balance');
      return;
    }

    // 2. Create Order
    const orderData = {
      userId,
      type,
      symbol,
      quantity,
      price,
      status: 'PENDING',
      executedQuantity: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    console.log('Creating order...', orderData);
    const orderRef = await db.collection(ORDERS_COLLECTION).add(orderData);
    console.log('Order created with ID:', orderRef.id);

    // 3. Execute Market Order
    if (orderType === 'MARKET') {
      const newBalance = userData.balance - orderValue;
      console.log(`Updating balance from ${userData.balance} to ${newBalance}`);
      
      await db.collection(USERS_COLLECTION).doc(userId).update({
        balance: newBalance
      });
      console.log('Balance updated.');

      // 4. Update Assets
      console.log('Fetching assets...');
      const assetsSnapshot = await db.collection(ASSETS_COLLECTION).where('userId', '==', userId).get();
      const assets = assetsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      const existingAsset = assets.find(a => a.symbol === symbol);

      if (existingAsset) {
        console.log('Updating existing asset:', existingAsset.id);
        const totalQuantity = existingAsset.quantity + quantity;
        const newAveragePrice = (existingAsset.quantity * existingAsset.averagePrice + quantity * price) / totalQuantity;
        await db.collection(ASSETS_COLLECTION).doc(existingAsset.id).update({
          quantity: totalQuantity,
          averagePrice: newAveragePrice
        });
      } else {
        console.log('Creating new asset...');
        await db.collection(ASSETS_COLLECTION).add({
          userId,
          symbol,
          quantity,
          averagePrice: price,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      console.log('Asset updated/created.');

      // 5. Transaction History
      console.log('Creating transaction history...');
      await db.collection(TRANSACTION_HISTORY_COLLECTION).add({
        userId,
        type: type.toLowerCase(),
        symbol,
        quantity,
        price,
        amount: orderValue,
        description: `Debug Market ${type}`,
        status: 'completed',
        balanceBefore: userData.balance,
        balanceAfter: newBalance,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log('Transaction history created.');
    }

    console.log('Debug script completed successfully.');

  } catch (error) {
    console.error('Error in debug script:', error);
  }
}

run();
