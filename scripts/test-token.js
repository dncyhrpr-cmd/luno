const jose = require('jose');
const axios = require('axios');

async function testToken() {
  const JWT_SECRET = 'a3f8b2c5d1e4f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1';
  const userId = 'user_p2p_gmail_com';

  // Create token using jose (same as backend)
  const secret = new TextEncoder().encode(JWT_SECRET);
  
  const token = await new jose.SignJWT({
    userId: userId,
    roles: ['trader'],
    migrationStatus: 'migrated'
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT', kid: 'v1_access_key' })
    .setIssuedAt()
    .setIssuer('luno-app')
    .setAudience('luno-web')
    .setExpirationTime('15m')
    .setSubject(userId)
    .setJti(require('crypto').randomUUID())
    .sign(secret);

  console.log('Generated Token (jose):', token);

  // Test the token with the API
  try {
    console.log('Sending POST request to http://localhost:3001/api/orders...');
    const res = await axios.post('http://localhost:3001/api/orders', {
      symbol: 'BTCUSDT',
      type: 'BUY',
      quantity: 0.001,
      price: 50000,
      orderType: 'MARKET',
      leverage: 1
    }, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    console.log('Response:', res.data);
  } catch (error) {
    if (error.response) {
      console.error('Error Status:', error.response.status);
      console.error('Error Data:', error.response.data);
    } else {
      console.error('Error Message:', error.message);
    }
  }
}

testToken().catch(console.error);
