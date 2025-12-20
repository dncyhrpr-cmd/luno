

exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'ADAUSDT', 'DOGEUSDT', 'XRPUSDT', 'LTCUSDT', 'MATICUSDT', 'LINKUSDT'];
    const results = [];

    for (const symbol of symbols) {
      try {
        const [statsRes, priceRes] = await Promise.all([
          fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`),
          fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`)
        ]);

        if (statsRes.ok && priceRes.ok) {
          const [stats, price] = await Promise.all([statsRes.json(), priceRes.json()]);
          results.push({
            symbol: stats.symbol.replace('USDT', ''),
            price: parseFloat(price.price),
            change: parseFloat(stats.priceChangePercent),
            volume: parseFloat(stats.volume)
          });
        }
      } catch (err) {
        console.warn(`Error fetching ${symbol}:`, err);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(results)
    };
  } catch (error) {
    console.error('Error in binance function:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to fetch data' })
    };
  }
};