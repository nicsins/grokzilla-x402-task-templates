/**
 * x402 Lexical Contradiction Flag Detector
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
  'POST /flag': {
    price: '0.015',
    network: NETWORK,
    description: 'Lexical contradiction flag detection via negation + antonym heuristics'
  }
}));

const NEGATIONS = new Set([
  'not', 'no', 'never', 'none', 'neither', 'nor', 'cannot', "can't",
  "won't", "wouldn't", "shouldn't", "couldn't", "isn't", "aren't",
  "wasn't", "weren't", "doesn't", "don't", "didn't", "hasn't", "haven't",
  'without', 'lack', 'lacks', 'missing', 'absent', 'unable', 'impossible'
]);

const ANTONYM_PAIRS = [
  ['secure', 'insecure'], ['safe', 'unsafe'], ['true', 'false'],
  ['yes', 'no'], ['increase', 'decrease'], ['up', 'down'],
  ['high', 'low'], ['good', 'bad'], ['success', 'failure'],
  ['open', 'closed'], ['on', 'off'], ['positive', 'negative'],
  ['present', 'absent'], ['possible', 'impossible'], ['able', 'unable'],
  ['always', 'never'], ['all', 'none'], ['include', 'exclude'],
  ['allow', 'deny'], ['accept', 'reject'], ['valid', 'invalid'],
  ['correct', 'incorrect'], ['accurate', 'inaccurate'], ['complete', 'incomplete']
];

function sentenceSplit(text) {
  return (text || '')
    .replace(/([.!?])\s+/g, '$1|')
    .split('|')
    .map(s => s.trim())
    .filter(s => s.length > 8);
}

function tokenize(s) {
  return s.toLowerCase()
    .replace(/[^\w\s'-]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1);
}

function detectFlags(text) {
  const sentences = sentenceSplit(text);
  const flags = [];

  for (let i = 0; i < sentences.length; i++) {
    const tokens = tokenize(sentences[i]);
    const hasNeg = tokens.some(t => NEGATIONS.has(t));

    // Look at current + next 1-2 sentences for opposing signals
    for (let j = i; j < Math.min(i + 3, sentences.length); j++) {
      if (i === j && !hasNeg) continue;
      const otherTokens = tokenize(sentences[j]);
      const otherHasNeg = otherTokens.some(t => NEGATIONS.has(t));

      for (const [a, b] of ANTONYM_PAIRS) {
        const hasA = tokens.includes(a) || otherTokens.includes(a);
        const hasB = tokens.includes(b) || otherTokens.includes(b);
        if (hasA && hasB) {
          // Prefer cases where one side is negated
          const strength = (hasNeg || otherHasNeg) ? 0.8 : 0.55;
          flags.push({
            span_a: sentences[i].slice(0, 140),
            span_b: sentences[j].slice(0, 140),
            pair: [a, b],
            strength,
            reason: hasNeg || otherHasNeg ? 'negation+antonym' : 'antonym_pair'
          });
        }
      }
    }
  }

  // Dedup by pair+reason
  const seen = new Set();
  const unique = [];
  for (const f of flags) {
    const key = f.pair.join('|') + f.reason;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(f);
    }
  }

  return {
    flags: unique.slice(0, 15),
    flag_count: unique.length,
    sentence_count: sentences.length,
    meta: {
      model: 'grokzilla-contradiction-flagger-v1',
      timestamp: new Date().toISOString()
    }
  };
}

app.post('/flag', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string' || text.trim().length < 20) {
      return res.status(400).json({ error: 'text required (min 20 chars)' });
    }

    const result = detectFlags(text);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'flag detection failed' });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'contradiction-flagger', x402: true }));

const PORT = process.env.PORT || 3027;
app.listen(PORT, () => {
  console.log(`x402 Contradiction Flagger on :${PORT} | payTo=${PAY_TO}`);
});
