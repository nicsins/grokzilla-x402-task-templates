/**
 * x402 Approximate Token Counter & Cost Estimator
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
  'POST /estimate': {
    price: '0.005',
    network: NETWORK,
    description: 'Approximate LLM token count + optional cost estimate'
  }
}));

/**
 * Fast heuristic tuned for modern English-centric LLMs.
 * - ~4 chars per token average for mixed English
 * - Word-based adjustment for denser / sparser text
 * - Code / markdown slightly higher density
 * Not a true tokenizer; ±10-15% typical error on English prose.
 */
function estimateTokens(text) {
  if (!text || typeof text !== 'string') return 0;
  const clean = text.trim();
  if (!clean) return 0;

  const chars = clean.length;
  const words = clean.split(/\s+/).filter(Boolean).length;
  const lines = clean.split(/\n/).length;

  // Base: chars / 4
  let tokens = chars / 4;

  // Word density adjustment
  const avgWordLen = words > 0 ? chars / words : 5;
  if (avgWordLen < 4.5) tokens *= 1.08;      // denser (code-ish)
  else if (avgWordLen > 6.5) tokens *= 0.95; // longer words

  // Newline / structure bonus
  if (lines > words * 0.3) tokens += lines * 0.3;

  // Clamp and round
  return Math.max(1, Math.round(tokens));
}

function estimateOne(text, priceIn = null, priceOut = null) {
  const tokens = estimateTokens(text);
  const result = {
    chars: text ? text.length : 0,
    words: text ? text.trim().split(/\s+/).filter(Boolean).length : 0,
    approx_tokens: tokens,
    method: 'char-word-heuristic-v1'
  };
  if (priceIn != null && !isNaN(priceIn)) {
    result.est_input_cost_usd = Number(((tokens / 1000) * priceIn).toFixed(6));
  }
  if (priceOut != null && !isNaN(priceOut)) {
    result.est_output_cost_per_1k = priceOut;
  }
  return result;
}

app.post('/estimate', async (req, res) => {
  try {
    let texts = req.body.texts;
    if (!texts && req.body.text != null) texts = [req.body.text];
    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return res.status(400).json({ error: 'text (string) or texts (array) required' });
    }
    if (texts.length > 50) {
      return res.status(400).json({ error: 'max 50 texts per request' });
    }

    const totalChars = texts.reduce((s, t) => s + (typeof t === 'string' ? t.length : 0), 0);
    if (totalChars > 100000) {
      return res.status(400).json({ error: 'total text limited to 100k chars' });
    }

    const priceIn = req.body.price_per_1k_input != null ? Number(req.body.price_per_1k_input) : null;
    const priceOut = req.body.price_per_1k_output != null ? Number(req.body.price_per_1k_output) : null;

    const results = texts.map(t => estimateOne(String(t || ''), priceIn, priceOut));
    const totalTokens = results.reduce((s, r) => s + r.approx_tokens, 0);

    res.json({
      success: true,
      count: results.length,
      total_approx_tokens: totalTokens,
      results,
      meta: {
        model: 'grokzilla-token-cost-estimator-v1',
        note: 'Heuristic only (±10-15% typical). Use real tokenizer for billing-critical paths.',
        timestamp: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'estimate failed' });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'token-cost-estimator', x402: true }));

const PORT = process.env.PORT || 3028;
app.listen(PORT, () => {
  console.log(`x402 Token Cost Estimator on :${PORT} | payTo=${PAY_TO}`);
});
