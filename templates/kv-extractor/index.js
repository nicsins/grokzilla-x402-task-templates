/**
 * x402 Key-Value Field Extractor
 * Stateless • agent-native • no human in the loop.
 * Deploy to Vercel / Tailscale / any Node host.
 * Set PAY_TO_WALLET before production.
 */
require('dotenv').config();
const express = require('express');
const { paymentMiddleware } = require('@x402/express');

const app = express();
app.use(express.json({ limit: '128kb' }));

const PAY_TO = process.env.PAY_TO_WALLET || '0xYOUR_WALLET_ADDRESS_HERE';
const NETWORK = process.env.X402_NETWORK || 'base-mainnet';

app.use(paymentMiddleware(PAY_TO, {
  'POST /extract': {
    price: '0.016',
    network: NETWORK,
    description: 'Key-value field extraction from free-form text'
  }
}));

function extractKV(text) {
  const pairs = {};
  const lines = (text || '').split(/\r?\n/);

  // Pattern 1: key: value or key = value (with optional quotes)
  const colonEq = /^[\s*•\-]*([A-Za-z0-9_\-\s]{2,40}?)\s*[:=]\s*["']?(.+?)["']?\s*$/i;
  // Pattern 2: key is value / key was value
  const isWas = /^[\s*•\-]*([A-Za-z0-9_\-\s]{2,40}?)\s+(?:is|was|are|were|=)\s+["']?(.+?)["']?\s*$/i;
  // Pattern 3: "key" : "value" style
  const quoted = /["']([A-Za-z0-9_\-\s]{2,40}?)["']\s*[:=]\s*["'](.+?)["']/gi;

  for (const line of lines) {
    let m = line.match(colonEq);
    if (m) {
      const key = m[1].trim().toLowerCase().replace(/\s+/g, '_');
      const val = m[2].trim();
      if (key && val && val.length < 500) pairs[key] = val;
      continue;
    }
    m = line.match(isWas);
    if (m) {
      const key = m[1].trim().toLowerCase().replace(/\s+/g, '_');
      const val = m[2].trim();
      if (key && val && val.length < 500) pairs[key] = val;
    }
  }

  // Global quoted pairs
  let qm;
  while ((qm = quoted.exec(text)) !== null) {
    const key = qm[1].trim().toLowerCase().replace(/\s+/g, '_');
    const val = qm[2].trim();
    if (key && val && !pairs[key]) pairs[key] = val;
  }

  // Also catch simple "Key Value" on same line when key is short
  const simple = /^[\s*•\-]*([A-Z][A-Za-z0-9_\-]{1,25})\s+([^\n]{3,120})$/;
  for (const line of lines) {
    const m = line.match(simple);
    if (m) {
      const key = m[1].trim().toLowerCase().replace(/\s+/g, '_');
      const val = m[2].trim();
      if (key && val && !pairs[key] && !/^(the|and|for|with)$/i.test(key)) {
        pairs[key] = val;
      }
    }
  }

  return {
    fields: pairs,
    field_count: Object.keys(pairs).length,
    keys: Object.keys(pairs),
    meta: {
      model: 'grokzilla-kv-extractor-v1',
      timestamp: new Date().toISOString()
    }
  };
}

app.post('/extract', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string' || text.trim().length < 5) {
      return res.status(400).json({ error: 'text required (min 5 chars)' });
    }

    const result = extractKV(text);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'extraction failed' });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'kv-extractor', x402: true }));

const PORT = process.env.PORT || 3024;
app.listen(PORT, () => {
  console.log(`x402 KV Extractor on :${PORT} | payTo=${PAY_TO}`);
});
