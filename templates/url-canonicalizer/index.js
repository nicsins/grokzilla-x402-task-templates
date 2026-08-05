/**
 * x402 Tracking-Parameter URL Canonicalizer
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
  'POST /canonicalize': {
    price: '0.009',
    network: NETWORK,
    description: 'Strip tracking params and canonicalize URLs'
  }
}));

const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'utm_id', 'utm_cid', 'utm_reader', 'utm_referrer', 'utm_name',
  'gclid', 'gclsrc', 'dclid', 'gbraid', 'wbraid',
  'fbclid', 'fb_action_ids', 'fb_action_types', 'fb_source',
  'mc_cid', 'mc_eid', 'mc_tc',
  '_ga', '_gl', '_gac', 'msclkid', 'yclid',
  'ref', 'referrer', 'source', 'campaign', 'medium',
  'igshid', 'si', 'spm', 'scm', 'from', 'share'
]);

function canonicalizeOne(raw, stripFragment = true) {
  let url;
  try {
    url = new URL(raw.trim());
  } catch {
    return { original: raw, error: 'invalid_url' };
  }

  // Normalize scheme & host
  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');

  // Clean path (collapse multiple slashes, remove trailing slash except root)
  let path = url.pathname.replace(/\/+/g, '/');
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  url.pathname = path || '/';

  // Filter query params
  const kept = [];
  for (const [k, v] of url.searchParams.entries()) {
    const key = k.toLowerCase();
    if (!TRACKING_PARAMS.has(key) && !key.startsWith('utm_')) {
      kept.push([k, v]);
    }
  }
  // Sort remaining for determinism
  kept.sort((a, b) => a[0].localeCompare(b[0]));
  url.search = '';
  for (const [k, v] of kept) url.searchParams.append(k, v);

  if (stripFragment) url.hash = '';

  const canonical = url.toString();
  return {
    original: raw,
    canonical,
    changed: canonical !== raw,
    stripped_params: Array.from(TRACKING_PARAMS).filter(p =>
      new URL(raw).searchParams.has(p) || raw.toLowerCase().includes(p + '=')
    ).slice(0, 12)
  };
}

app.post('/canonicalize', async (req, res) => {
  try {
    let urls = req.body.urls || req.body.url;
    if (!urls) {
      return res.status(400).json({ error: 'urls (array) or url (string) required' });
    }
    if (typeof urls === 'string') urls = [urls];
    if (!Array.isArray(urls) || urls.length === 0 || urls.length > 20) {
      return res.status(400).json({ error: 'provide 1-20 urls' });
    }

    const stripFragment = req.body.strip_fragment !== false;
    const results = urls.map(u => canonicalizeOne(String(u), stripFragment));

    res.json({
      success: true,
      count: results.length,
      results,
      meta: {
        model: 'grokzilla-url-canonicalizer-v1',
        timestamp: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'canonicalize failed' });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'url-canonicalizer', x402: true }));

const PORT = process.env.PORT || 3025;
app.listen(PORT, () => {
  console.log(`x402 URL Canonicalizer on :${PORT} | payTo=${PAY_TO}`);
});
