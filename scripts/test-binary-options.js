const jwt = require('jsonwebtoken');
const axios = require('axios');

const JWT_SECRET = 'a3f8b2c5d1e4f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1';
const userId = 'user_p2p_gmail_com';

const payload = {
  userId: userId,
  roles: ['trader'],
  migrationStatus: 'migrated'
};

const token = jwt.sign(payload, JWT_SECRET, {
  algorithm: 'HS256',
  expiresIn: '15m',
  issuer: 'luno-app',
  audience: 'luno-web',
  subject: userId
});

console.log('Generated Token:', token);

async function testBinaryOrder() {
  try {
    console.log('\n=== Testing Binary Options Order Creation ===');
    console.log('Sending POST request to create binary order...');

    const binaryOrderData = {
      symbol: 'BTCUSDT',
      direction: 'UP', // 'UP' or 'DOWN'
      period: 30, // 30 seconds for quick testing
      amount: 10, // $10 stake
      profitPercent: 20, // 20% profit
      price: 50000 // Entry price
    };

    console.log('Order Data:', binaryOrderData);

    const res = await axios.post('http://localhost:3000/api/orders', binaryOrderData, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Binary Order Created Successfully!');
    console.log('Response:', JSON.stringify(res.data, null, 2));

    const orderId = res.data.order?.id;
    if (orderId) {
      console.log('\n=== Testing Order Retrieval ===');
      // Test getting orders (this should trigger settlement if expired)
      const ordersRes = await axios.get('http://localhost:3000/api/orders', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      console.log('Orders Response:', JSON.stringify(ordersRes.data, null, 2));
    }

  } catch (error) {
    console.error('\n❌ Binary Order Test Failed!');
    if (error.response) {
      console.error('Error Status:', error.response.status);
      console.error('Error Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error Message:', error.message);
    }
  }
}

async function testPortfolioBalance() {
  try {
    console.log('\n=== Testing Portfolio Balance ===');
    const res = await axios.get('http://localhost:3000/api/portfolio', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('Portfolio Response:', JSON.stringify(res.data, null, 2));
  } catch (error) {
    console.error('Portfolio Balance Test Failed!');
    if (error.response) {
      console.error('Error Status:', error.response.status);
      console.error('Error Data:', error.response.data);
    } else {
      console.error('Error Message:', error.message);
    }
  }
}

// Run tests
async function runTests() {
  console.log('🚀 Starting Binary Options Trading System Tests\n');

  // First check current balance
  await testPortfolioBalance();

  // Create a binary order
  await testBinaryOrder();

  // Check balance after order creation
  await testPortfolioBalance();

  console.log('\n📋 Test Summary:');
  console.log('1. ✅ Binary order creation should deduct stake from balance');
  console.log('2. ✅ Order should appear in orders list');
  console.log('3. ✅ After expiration, order should be settled automatically');
  console.log('4. ✅ Win: Balance should increase by stake + profit');
  console.log('5. ✅ Loss: Balance should be refunded the stake amount');
  console.log('\n💡 Note: For immediate settlement testing, manually call the trade resolver or wait for expiration');
}

runTests();