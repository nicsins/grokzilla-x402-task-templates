/**
 * x402 Sentiment Drift Analyzer
 * Stateless • agent-native • no human in the loop.
 * Tracks sentiment trajectory across ordered text series.
 */
require('dotenv').config();
const express = require('express');
const { paymentMiddleware } = require('@x402/express');

const app = express();
app.use(express.json({ limit: '96kb' }));

const PAY_TO = process.env.PAY_TO_WALLET || '0xYOUR_WALLET_ADDRESS_HERE';
const NETWORK = process.env.X402_NETWORK || 'base-mainnet';

app.use(paymentMiddleware(PAY_TO, {
  'POST /drift': {
    price: '0.025',
    network: NETWORK,
    description: 'Sentiment drift analysis across text series'
  }
}));

const POS = new Set(['good','great','excellent','amazing','love','happy','joy','success','win','best','awesome','fantastic','positive','pleased','grateful','excited','proud','wonderful','perfect','brilliant']);
const NEG = new Set(['bad','terrible','awful','hate','sad','angry','fail','worst','horrible','negative','frustrated','annoyed','disappointed','upset','poor','broken','error','problem','issue','crisis']);

function scoreText(text) {
  const tokens = (text || '').toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(Boolean);
  let pos = 0, neg = 0;
  for (const t of tokens) {
    if (POS.has(t)) pos++;
    if (NEG.has(t)) neg++;
  }
  const total = pos + neg || 1;
  const raw = (pos - neg) / total;
  // Normalize to [-1, 1] with slight length damping
  const score = Math.max(-1, Math.min(1, raw * (1 - 1 / (1 + tokens.length / 20))));
  return {
    score: Number(score.toFixed(3)),
    positive_hits: pos,
    negative_hits: neg,
    token_count: tokens.length
  };
}

function analyzeDrift(texts, labels = []) {
  const items = texts.map((t, i) => {
    const s = scoreText(t);
    return {
      index: i,
      label: labels[i] || `item_${i}`,
      preview: String(t).slice(0, 80) + (String(t).length > 80 ? '...' : ''),
      ...s
    };
  });

  const scores = items.map(i => i.score);
  const n = scores.length;
  if (n === 0) {
    return { items: [], drift: {}, inflection_points: [] };
  }

  // Simple linear trend (least squares slope)
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += scores[i];
    sumXY += i * scores[i];
    sumX2 += i * i;
  }
  const slope = n > 1 ? (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX) : 0;
  const mean = sumY / n;
  const variance = scores.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);

  // Inflection: largest absolute consecutive deltas
  const deltas = [];
  for (let i = 1; i < n; i++) {
    deltas.push({ from: i - 1, to: i, delta: Number((scores[i] - scores[i - 1]).toFixed(3)) });
  }
  deltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const inflection_points = deltas.slice(0, 3).map(d => ({
    ...d,
    from_label: items[d.from].label,
    to_label: items[d.to].label
  }));

  const direction = slope > 0.05 ? 'improving' : slope < -0.05 ? 'declining' : 'stable';

  return {
    items,
    drift: {
      overall_mean: Number(mean.toFixed(3)),
      slope: Number(slope.toFixed(4)),
      std_dev: Number(std.toFixed(3)),
      direction,
      magnitude: Number(Math.abs(slope * (n - 1)).toFixed(3)),
      series_length: n
    },
    inflection_points,
    meta: {
      model: 'grokzilla-sentiment-drift-v1',
      timestamp: new Date().toISOString()
    }
  };
}

app.post('/drift', async (req, res) => {
  try {
    const { texts, labels } = req.body;
    if (!Array.isArray(texts) || texts.length < 2) {
      return res.status(400).json({ error: 'texts must be an array of at least 2 strings' });
    }
    if (texts.length > 100) {
      return res.status(400).json({ error: 'max 100 items per request' });
    }
    for (const t of texts) {
      if (typeof t !== 'string' || t.length > 4000) {
        return res.status(400).json({ error: 'each text must be a string <= 4000 chars' });
      }
    }

    const result = analyzeDrift(texts, Array.isArray(labels) ? labels : []);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'drift analysis failed' });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'sentiment-drift-analyzer', x402: true }));

const PORT = process.env.PORT || 3011;
app.listen(PORT, () => {
  console.log(`x402 Sentiment Drift Analyzer on :${PORT} | payTo=${PAY_TO}`);
});
