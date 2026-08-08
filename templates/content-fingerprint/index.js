/**
 * x402 Content Fingerprint (SimHash Lite)
 * Stateless • agent-native • no human in the loop.
 * Deploy to Vercel / Tailscale / any Node host.
 * Set PAY_TO_WALLET before production.
 */
require('dotenv').config();
const express = require('express');
const { paymentMiddleware } = require('@x402/express');
const crypto = require('crypto');

const app = express();
app.use(express.json({ limit: '256kb' }));

const PAY_TO = process.env.PAY_TO_WALLET || '0xYOUR_WALLET_ADDRESS_HERE';
const NETWORK = process.env.X402_NETWORK || 'base-mainnet';

app.use(paymentMiddleware(PAY_TO, {
  'POST /fingerprint': {
    price: '0.007',
    network: NETWORK,
    description: 'SimHash-lite content fingerprints and pairwise Hamming distance'
  }
}));

function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1);
}

function hashToken(token) {
  // 64-bit style hash from sha256 first 8 bytes
  const h = crypto.createHash('sha256').update(token).digest();
  // return as BigInt for bit ops
  return BigInt('0x' + h.subarray(0, 8).toString('hex'));
}

function simhash(text) {
  const tokens = tokenize(text);
  if (tokens.length === 0) return 0n;

  const bits = new Array(64).fill(0);
  for (const t of tokens) {
    const h = hashToken(t);
    for (let i = 0; i < 64; i++) {
      if ((h >> BigInt(i)) & 1n) bits[i]++;
      else bits[i]--;
    }
  }

  let fingerprint = 0n;
  for (let i = 0; i < 64; i++) {
    if (bits[i] > 0) fingerprint |= (1n << BigInt(i));
  }
  return fingerprint;
}

function hamming(a, b) {
  let x = a ^ b;
  let count = 0;
  while (x) {
    count += Number(x & 1n);
    x >>= 1n;
  }
  return count;
}

function toHex64(n) {
  return n.toString(16).padStart(16, '0');
}

app.post('/fingerprint', async (req, res) => {
  try {
    let texts = [];
    if (Array.isArray(req.body.texts)) {
      texts = req.body.texts;
    } else if (typeof req.body.text === 'string') {
      texts = [req.body.text];
    } else if (typeof req.body.content === 'string') {
      texts = [req.body.content];
    } else {
      return res.status(400).json({ error: 'text (string) or texts (array) required' });
    }

    if (texts.length === 0 || texts.length > 50) {
      return res.status(400).json({ error: '1-50 texts allowed' });
    }

    let totalChars = 0;
    for (const t of texts) {
      if (typeof t !== 'string') {
        return res.status(400).json({ error: 'all texts must be strings' });
      }
      totalChars += t.length;
    }
    if (totalChars > 80000) {
      return res.status(400).json({ error: 'combined max 80k chars' });
    }

    const fingerprints = texts.map((t, i) => {
      const fp = simhash(t);
      return {
        index: i,
        fingerprint_hex: toHex64(fp),
        fingerprint_dec: fp.toString(),
        token_count: tokenize(t).length,
        char_count: t.length
      };
    });

    // Pairwise Hamming if multiple
    const distances = [];
    if (fingerprints.length > 1) {
      for (let i = 0; i < fingerprints.length; i++) {
        for (let j = i + 1; j < fingerprints.length; j++) {
          const a = BigInt(fingerprints[i].fingerprint_dec);
          const b = BigInt(fingerprints[j].fingerprint_dec);
          distances.push({
            pair: [i, j],
            hamming_distance: hamming(a, b),
            similarity_hint: hamming(a, b) <= 3 ? 'very_similar' : hamming(a, b) <= 10 ? 'similar' : 'different'
          });
        }
      }
    }

    res.json({
      success: true,
      fingerprints,
      pairwise_distances: distances,
      count: fingerprints.length,
      model: 'grokzilla-content-fingerprint-v1',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'fingerprint failed' });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'content-fingerprint', x402: true }));

const PORT = process.env.PORT || 3033;
app.listen(PORT, () => {
  console.log(`x402 Content Fingerprint on :${PORT} | payTo=${PAY_TO}`);
});
