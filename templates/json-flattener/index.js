/**
 * x402 Nested JSON Flattener
 * Stateless • agent-native • no human in the loop.
 * Deploy to Vercel / Tailscale / any Node host.
 * Set PAY_TO_WALLET before production.
 */
require('dotenv').config();
const express = require('express');
const { paymentMiddleware } = require('@x402/express');

const app = express();
app.use(express.json({ limit: '512kb' }));

const PAY_TO = process.env.PAY_TO_WALLET || '0xYOUR_WALLET_ADDRESS_HERE';
const NETWORK = process.env.X402_NETWORK || 'base-mainnet';

app.use(paymentMiddleware(PAY_TO, {
  'POST /flatten': {
    price: '0.008',
    network: NETWORK,
    description: 'Flatten nested JSON into dot-notation key-value map'
  }
}));

function flatten(obj, options = {}) {
  const {
    separator = '.',
    max_depth = 12,
    include_arrays = true,
    prefix = ''
  } = options;

  const result = {};
  const types = {};

  function walk(current, path, depth) {
    if (depth > max_depth) {
      result[path || 'root'] = current;
      types[path || 'root'] = typeof current;
      return;
    }

    if (current === null || current === undefined) {
      result[path || 'root'] = current;
      types[path || 'root'] = 'null';
      return;
    }

    if (Array.isArray(current)) {
      if (!include_arrays || current.length === 0) {
        result[path || 'root'] = current;
        types[path || 'root'] = 'array';
        return;
      }
      current.forEach((item, idx) => {
        const newPath = path ? `${path}${separator}${idx}` : String(idx);
        walk(item, newPath, depth + 1);
      });
      return;
    }

    if (typeof current === 'object') {
      const keys = Object.keys(current);
      if (keys.length === 0) {
        result[path || 'root'] = {};
        types[path || 'root'] = 'object';
        return;
      }
      for (const key of keys) {
        const newPath = path ? `${path}${separator}${key}` : key;
        walk(current[key], newPath, depth + 1);
      }
      return;
    }

    // primitive
    result[path || 'root'] = current;
    types[path || 'root'] = typeof current;
  }

  walk(obj, prefix, 0);
  return { flat: result, types, key_count: Object.keys(result).length };
}

app.post('/flatten', async (req, res) => {
  try {
    const data = req.body.data !== undefined ? req.body.data : req.body;
    if (data === undefined || data === null) {
      return res.status(400).json({ error: 'data (JSON object or array) required' });
    }

    // Safety: reject huge objects by approximate size
    const approxSize = JSON.stringify(data).length;
    if (approxSize > 256000) {
      return res.status(400).json({ error: 'JSON max ~256kb' });
    }

    const options = {
      separator: typeof req.body.separator === 'string' ? req.body.separator : '.',
      max_depth: Math.min(Number(req.body.max_depth) || 12, 20),
      include_arrays: req.body.include_arrays !== false
    };

    const { flat, types, key_count } = flatten(data, options);

    res.json({
      success: true,
      flat,
      types,
      key_count,
      settings: options,
      model: 'grokzilla-json-flattener-v1',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'flatten failed' });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'json-flattener', x402: true }));

const PORT = process.env.PORT || 3032;
app.listen(PORT, () => {
  console.log(`x402 JSON Flattener on :${PORT} | payTo=${PAY_TO}`);
});
