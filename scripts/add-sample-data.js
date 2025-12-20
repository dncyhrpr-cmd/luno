const { FirestoreDatabaseScript } = require('./firestore-db-js');

async function addSampleData() {
  try {
    console.log('Adding sample data...');

    const firestoreDB = new FirestoreDatabaseScript();

    // Assuming the userId is 'user_dncyhrpr_gmail_com' from logs
    const userId = 'user_dncyhrpr_gmail_com';

    // Update user balance
    await firestoreDB.updateUserBalance(userId, 10000);

    // Add sample assets
    const assets = [
      { symbol: 'BTCUSDT', quantity: 0.5, averagePrice: 50000 },
      { symbol: 'ETHUSDT', quantity: 5, averagePrice: 3000 },
      { symbol: 'ADAUSDT', quantity: 1000, averagePrice: 1.5 },
    ];

    for (const asset of assets) {
      await firestoreDB.createAsset({
        userId,
        symbol: asset.symbol,
        quantity: asset.quantity,
        averagePrice: asset.averagePrice,
      });
    }

    console.log('Sample data added successfully.');

  } catch (error) {
    console.error('Error adding sample data:', error);
  }
}

// Run if called directly
if (require.main === module) {
  addSampleData()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { addSampleData };