/**
 * x402 Slug Extractor / Canonicalizer Lite
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
  'POST /slug': {
    price: '0.006',
    network: NETWORK,
    description: 'Deterministic URL/title to clean slug conversion'
  }
}));

function toSlug(input, opts = {}) {
  if (!input || typeof input !== 'string') return { slug: '', error: 'input required' };
  const maxLen = Math.min(Math.max(parseInt(opts.max_length) || 80, 8), 200);
  let s = input.trim();

  // Strip protocol and domain if present (keep path)
  try {
    if (/^https?:\/\//i.test(s)) {
      const u = new URL(s);
      s = u.pathname + (u.search || '');
    }
  } catch (_) { /* not a full URL */ }

  // Normalize
  s = s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')          // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')              // non-alnum → hyphen
    .replace(/^-+|-+$/g, '')                  // trim hyphens
    .replace(/-{2,}/g, '-');                  // collapse

  if (s.length > maxLen) {
    s = s.slice(0, maxLen).replace(/-+$/g, '');
  }

  return {
    slug: s || 'untitled',
    original_length: input.length,
    slug_length: (s || 'untitled').length,
    model: 'grokzilla-slug-v1',
    timestamp: new Date().toISOString()
  };
}

app.post('/slug', async (req, res) => {
  try {
    const body = req.body || {};
    const inputs = Array.isArray(body.inputs)
      ? body.inputs
      : [body.input || body.text || body.title || body.url || ''];

    if (inputs.length === 0 || inputs.length > 50) {
      return res.status(400).json({ error: 'provide 1-50 strings via input or inputs[]' });
    }

    const results = inputs.map((t) => toSlug(String(t || ''), {
      max_length: body.max_length
    }));

    res.json({
      success: true,
      count: results.length,
      results,
      model: 'grokzilla-slug-v1'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'slug extraction failed' });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'slug-extractor', x402: true }));

const PORT = process.env.PORT || 3027;
app.listen(PORT, () => {
  console.log(`x402 Slug Extractor on :${PORT} | payTo=${PAY_TO}`);
});
