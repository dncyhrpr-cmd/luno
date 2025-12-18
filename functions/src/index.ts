/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import {setGlobalOptions} from "firebase-functions";
import {onRequest} from "firebase-functions/v2/https";

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({ maxInstances: 10 });

// export const helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

// Firebase function for Binance API
export const binance = onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
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

    res.json(results);
  } catch (error) {
    console.error('Error in binance function:', error);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});
