/**
 * x402 Semantic Text Similarity & Pair Scorer
 * Stateless • agent-native • no human in the loop.
 */
require('dotenv').config();
const express = require('express');
const { paymentMiddleware } = require('@x402/express');

const app = express();
app.use(express.json({ limit: '32kb' }));

const PAY_TO = process.env.PAY_TO_WALLET || '0xYOUR_WALLET_ADDRESS_HERE';
const NETWORK = process.env.X402_NETWORK || 'base-mainnet';

app.use(paymentMiddleware(PAY_TO, {
  'POST /similarity': {
    price: '0.015',
    network: NETWORK,
    description: 'Semantic text similarity scoring'
  }
}));

/**
 * Lightweight bag-of-words cosine similarity (production: swap for real embeddings / Grok)
 */
function tokenize(t) {
  return (t || '').toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(Boolean);
}

function vectorize(tokens) {
  const map = {};
  tokens.forEach(tok => { map[tok] = (map[tok] || 0) + 1; });
  return map;
}

function cosine(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let dot = 0, magA = 0, magB = 0;
  keys.forEach(k => {
    const va = a[k] || 0;
    const vb = b[k] || 0;
    dot += va * vb;
    magA += va * va;
    magB += vb * vb;
  });
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

function scoreSimilarity(texts, threshold = 0.65) {
  const vectors = texts.map(t => vectorize(tokenize(t)));
  const pairs = [];
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      const score = Number(cosine(vectors[i], vectors[j]).toFixed(4));
      pairs.push({
        i, j,
        textA: texts[i].slice(0, 80),
        textB: texts[j].slice(0, 80),
        score,
        similar: score >= threshold
      });
    }
  }
  pairs.sort((a, b) => b.score - a.score);

  return {
    pairs,
    threshold,
    stats: {
      input_count: texts.length,
      pair_count: pairs.length,
      high_similarity_count: pairs.filter(p => p.similar).length
    },
    meta: {
      model: 'grokzilla-similarity-v1',
      timestamp: new Date().toISOString()
    }
  };
}

app.post('/similarity', async (req, res) => {
  try {
    const { texts, threshold } = req.body;
    if (!Array.isArray(texts) || texts.length < 2) {
      return res.status(400).json({ error: 'texts array required (min 2 items)' });
    }
    if (texts.some(t => typeof t !== 'string' || t.trim().length < 3)) {
      return res.status(400).json({ error: 'each text must be string >= 3 chars' });
    }
    if (texts.length > 12) {
      return res.status(400).json({ error: 'max 12 texts per request' });
    }

    const result = scoreSimilarity(texts, threshold || 0.65);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'similarity scoring failed' });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'semantic-similarity', x402: true }));

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
  console.log(`x402 Semantic Similarity on :${PORT} | payTo=${PAY_TO}`);
});
