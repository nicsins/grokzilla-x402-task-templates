/**
 * x402 Keyword & Topic Ranker
 * Stateless • agent-native • no human in the loop.
 * Deploy to Vercel / Tailscale / any Node host.
 * Set PAY_TO_WALLET before production.
 */
require('dotenv').config();
const express = require('express');
const { paymentMiddleware } = require('@x402/express');

const app = express();
app.use(express.json({ limit: '64kb' }));

const PAY_TO = process.env.PAY_TO_WALLET || '0xYOUR_WALLET_ADDRESS_HERE';
const NETWORK = process.env.X402_NETWORK || 'base-mainnet';

app.use(paymentMiddleware(PAY_TO, {
  'POST /rank': {
    price: '0.012',
    network: NETWORK,
    description: 'Keyword and topic ranking from text'
  }
}));

const STOP = new Set([
  'the','a','an','and','or','but','in','on','at','to','for','of','with','by',
  'is','are','was','were','be','been','being','have','has','had','do','does','did',
  'will','would','could','should','may','might','must','shall','can','this','that',
  'these','those','it','its','i','you','he','she','we','they','me','him','her','us',
  'them','my','your','his','our','their','from','as','into','about','over','after',
  'before','between','under','again','further','then','once','here','there','when',
  'where','why','how','all','any','both','each','few','more','most','other','some',
  'such','no','nor','not','only','own','same','so','than','too','very','just','also'
]);

function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^\w\s'-]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1 && !STOP.has(t) && !/^\d+$/.test(t));
}

function extractNgrams(tokens, minN = 1, maxN = 3) {
  const counts = new Map();
  for (let n = minN; n <= maxN; n++) {
    for (let i = 0; i <= tokens.length - n; i++) {
      const gram = tokens.slice(i, i + n).join(' ');
      counts.set(gram, (counts.get(gram) || 0) + 1);
    }
  }
  return counts;
}

function rankKeywords(text, topK = 15, minNgram = 1, maxNgram = 3) {
  const tokens = tokenize(text);
  if (tokens.length === 0) {
    return { keywords: [], topics: [], metrics: { tokens: 0 } };
  }

  const counts = extractNgrams(tokens, minNgram, maxNgram);
  const total = tokens.length;

  // Score: frequency * length boost * uniqueness
  const scored = [...counts.entries()].map(([term, freq]) => {
    const words = term.split(' ').length;
    const density = freq / total;
    const score = freq * (1 + 0.35 * (words - 1)) * (1 + Math.log1p(freq));
    return { term, freq, density: Number(density.toFixed(4)), score, words };
  });

  scored.sort((a, b) => b.score - a.score);
  const keywords = scored.slice(0, topK).map(({ term, freq, density, score }) => ({
    term,
    frequency: freq,
    density,
    score: Number(score.toFixed(3))
  }));

  // Simple topic labels from top unigrams + bigrams
  const topics = keywords
    .filter(k => k.term.split(' ').length <= 2)
    .slice(0, 5)
    .map(k => k.term);

  return {
    keywords,
    topics,
    metrics: {
      total_tokens: total,
      unique_terms: counts.size,
      top_k: keywords.length,
      char_length: text.length
    },
    meta: {
      model: 'grokzilla-keyword-ranker-v1',
      timestamp: new Date().toISOString()
    }
  };
}

app.post('/rank', async (req, res) => {
  try {
    const { text, top_k, min_ngram, max_ngram } = req.body;
    if (!text || typeof text !== 'string' || text.trim().length < 8) {
      return res.status(400).json({ error: 'text required (min 8 chars)' });
    }
    if (text.length > 20000) {
      return res.status(400).json({ error: 'text too long (max 20k chars)' });
    }

    const result = rankKeywords(
      text,
      Math.min(Math.max(Number(top_k) || 15, 3), 50),
      Math.min(Math.max(Number(min_ngram) || 1, 1), 3),
      Math.min(Math.max(Number(max_ngram) || 3, 1), 4)
    );
    res.json({ success: true, ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'ranking failed' });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'keyword-topic-ranker', x402: true }));

const PORT = process.env.PORT || 3010;
app.listen(PORT, () => {
  console.log(`x402 Keyword & Topic Ranker on :${PORT} | payTo=${PAY_TO}`);
});
