const express = require('express');
const { paymentMiddleware } = require('@x402/express');

const app = express();

app.use(paymentMiddleware('0xYOUR_WALLET', {
  'POST /optimize': { price: '0.05', network: 'base-mainnet', description: 'Content optimization' }
}));

app.post('/optimize', async (req, res) => {
  // Grok API call for optimization
  res.json({ result: 'optimized' });
});

app.listen(process.env.PORT || 3000);