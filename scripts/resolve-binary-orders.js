const { resolvePendingBinaryOrders } = require('../src/lib/trade-resolver');

async function run() {
  console.log('Starting binary order resolution...');
  try {
    // Since it's for all users, we need to get all users first
    // But for simplicity, assume we pass userId or loop over users
    // For now, since the function takes userId, we need to call it per user
    // But portfolio is called per user, so perhaps call this from a cron

    // To make it background, we can set up a cron job to call this script periodically

    // For demo, let's assume we have userIds
    const userIds = ['user_dncyhrpr_gmail_com']; // Replace with actual user fetching

    for (const userId of userIds) {
      await resolvePendingBinaryOrders(userId);
    }

    console.log('Binary order resolution completed.');
  } catch (error) {
    console.error('Error in binary order resolution:', error);
  }
}

run();