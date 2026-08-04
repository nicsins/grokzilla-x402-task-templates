/**
 * x402 Near-Duplicate Detector
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
  'POST /compare': {
    price: '0.012',
    network: NETWORK,
    description: 'Near-duplicate text detection with Jaccard similarity'
  }
}));

const STOP = new Set([
  'the','a','an','and','or','but','in','on','at','to','for','of','with','by',
  'is','are','was','were','be','been','being','have','has','had','do','does','did',
  'will','would','could','should','may','might','must','shall','can','this','that',
  'these','those','it','its','i','you','he','she','we','they','me','him','her','us',
  'them','my','your','his','our','their','from','as','into','about','over','after'
]);

function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^\w\s'-]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1 && !STOP.has(t));
}

function jaccard(a, b) {
  const setA = new Set(a);
  const setB = new Set(b);
  let inter = 0;
  for (const x of setA) if (setB.has(x)) inter++;
  const union = setA.size + setB.size - inter;
  return union === 0 ? 0 : inter / union;
}

function lengthNorm(a, b) {
  const la = a.length || 1;
  const lb = b.length || 1;
  return Math.min(la, lb) / Math.max(la, lb);
}

function compareTexts(textA, textB, threshold = 0.65) {
  const tokensA = tokenize(textA);
  const tokensB = tokenize(textB);
  const jac = jaccard(tokensA, tokensB);
  const lenFactor = lengthNorm(tokensA, tokensB);
  const score = Number((jac * 0.75 + lenFactor * 0.25).toFixed(4));

  const shared = [];
  const setB = new Set(tokensB);
  for (const t of tokensA) {
    if (setB.has(t) && !shared.includes(t)) shared.push(t);
  }

  return {
    score,
    is_near_duplicate: score >= threshold,
    threshold,
    shared_tokens: shared.slice(0, 40),
    metrics: {
      tokens_a: tokensA.length,
      tokens_b: tokensB.length,
      jaccard: Number(jac.toFixed(4)),
      length_factor: Number(lenFactor.toFixed(4))
    },
    meta: {
      model: 'grokzilla-near-duplicate-detector-v1',
      timestamp: new Date().toISOString()
    }
  };
}

app.post('/compare', async (req, res) => {
  try {
    const { text_a, text_b, threshold } = req.body;
    if (!text_a || typeof text_a !== 'string' || text_a.trim().length < 3) {
      return res.status(400).json({ error: 'text_a required (min 3 chars)' });
    }
    if (!text_b || typeof text_b !== 'string' || text_b.trim().length < 3) {
      return res.status(400).json({ error: 'text_b required (min 3 chars)' });
    }
    const th = typeof threshold === 'number' && threshold >= 0 && threshold <= 1
      ? threshold
      : 0.65;

    const result = compareTexts(text_a, text_b, th);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'comparison failed' });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'near-duplicate-detector', x402: true }));

const PORT = process.env.PORT || 3022;
app.listen(PORT, () => {
  console.log(`x402 Near-Duplicate Detector on :${PORT} | payTo=${PAY_TO}`);
});
