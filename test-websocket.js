// Simple test to check Binance WebSocket connection
const WebSocket = require('ws');

console.log('Testing Binance WebSocket connection...');

const ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@ticker');

ws.on('open', () => {
    console.log('WebSocket connected successfully!');
    ws.close();
});

ws.on('error', (error) => {
    console.error('WebSocket error:', error.message);
});

ws.on('close', (code, reason) => {
    console.log('WebSocket closed with code:', code, 'reason:', reason.toString());
});