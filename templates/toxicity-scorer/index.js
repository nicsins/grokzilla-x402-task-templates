/**
 * x402 Toxicity & Brand-Safety Scorer
 * Fully autonomous, no-human-in-loop microservice.
 * Deploy to Vercel / any Node host / Tailscale.
 * Set PAY_TO_WALLET env var before deploy.
 */
require('dotenv').config();
const express = require('express');
const { paymentMiddleware } = require('@x402/express');

const app = express();
app.use(express.json({ limit: '32kb' }));

const PAY_TO = process.env.PAY_TO_WALLET || '0xYOUR_WALLET_ADDRESS_HERE';
const NETWORK = process.env.X402_NETWORK || 'base-mainnet';

// x402 payment gate – exact USDC micropayment
app.use(paymentMiddleware(PAY_TO, {
  'POST /score': {
    price: '0.01',
    network: NETWORK,
    description: 'Toxicity & brand-safety analysis of text content'
  }
}));

/**
 * Core scoring logic (replace with real Grok/LLM call or local model in production)
 * Returns multi-dimensional scores + optional rewrite suggestion.
 */
async function scoreContent(text) {
  // Stub – in production call Grok API or local classifier
  const lower = (text || '').toLowerCase();
  const toxicity = Math.min(1, (lower.match(/hate|kill|stupid|idiot/g) || []).length * 0.25);
  const spam = Math.min(1, (lower.match(/buy now|click here|free money/g) || []).length * 0.3);
  const brandSafety = 1 - (toxicity * 0.6 + spam * 0.4);

  return {
    scores: {
      toxicity: Number(toxicity.toFixed(3)),
      spam: Number(spam.toFixed(3)),
      brand_safety: Number(brandSafety.toFixed(3)),
      overall_risk: Number(((toxicity + spam) / 2).toFixed(3))
    },
    flags: {
      high_toxicity: toxicity > 0.5,
      potential_spam: spam > 0.4,
      brand_safe: brandSafety > 0.7
    },
    suggestion: brandSafety < 0.6
      ? 'Consider softening language and removing salesy phrases for better brand alignment.'
      : 'Content appears brand-safe.',
    meta: {
      model: 'grokzilla-toxicity-v1',
      tokens_approx: Math.ceil((text || '').length / 4),
      timestamp: new Date().toISOString()
    }
  };
}

app.post('/score', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string' || text.length < 3) {
      return res.status(400).json({ error: 'text field required (min 3 chars)' });
    }
    if (text.length > 8000) {
      return res.status(400).json({ error: 'text too long (max 8000 chars)' });
    }

    const result = await scoreContent(text);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal scoring error' });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'toxicity-scorer', x402: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`x402 Toxicity Scorer listening on :${PORT}`);
  console.log(`Pay-to wallet: ${PAY_TO}`);
});
