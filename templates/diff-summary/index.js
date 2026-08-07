/**
 * x402 Text Diff Summarizer (Semantic Lite)
 * Stateless • agent-native • no human in the loop.
 * Deploy to Vercel / Tailscale / any Node host.
 * Set PAY_TO_WALLET before production.
 */
require('dotenv').config();
const express = require('express');
const { paymentMiddleware } = require('@x402/express');

const app = express();
app.use(express.json({ limit: '256kb' }));

const PAY_TO = process.env.PAY_TO_WALLET || '0xYOUR_WALLET_ADDRESS_HERE';
const NETWORK = process.env.X402_NETWORK || 'base-mainnet';

app.use(paymentMiddleware(PAY_TO, {
  'POST /diff-summary': {
    price: '0.010',
    network: NETWORK,
    description: 'Structured summary of differences between two text versions'
  }
}));

function simpleDiff(before, after) {
  const a = (before || '').split(/\r?\n/);
  const b = (after || '').split(/\r?\n/);

  // LCS-inspired but O(n*m) limited; for micro-service we use set + ordered scan
  const setA = new Set(a);
  const setB = new Set(b);

  const removed = a.filter(l => !setB.has(l));
  const added = b.filter(l => !setA.has(l));

  // Changed sections approximation: consecutive blocks
  const changed_blocks = [];
  let i = 0, j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      i++; j++;
      continue;
    }
    const block = { removed: [], added: [] };
    while (i < a.length && (j >= b.length || a[i] !== b[j])) {
      block.removed.push(a[i++]);
    }
    while (j < b.length && (i >= a.length || a[i] !== b[j])) {
      block.added.push(b[j++]);
    }
    if (block.removed.length || block.added.length) {
      changed_blocks.push(block);
    }
  }

  const totalLines = Math.max(a.length + b.length, 1);
  const change_ratio = Math.round(((removed.length + added.length) / totalLines) * 1000) / 1000;

  let summary = '';
  if (removed.length === 0 && added.length === 0) {
    summary = 'No changes detected.';
  } else {
    summary = `${removed.length} line(s) removed, ${added.length} line(s) added (${Math.round(change_ratio * 100)}% change).`;
    if (changed_blocks.length <= 3) {
      summary += ` ${changed_blocks.length} changed block(s).`;
    } else {
      summary += ` ${changed_blocks.length} changed blocks (showing first 3).`;
    }
  }

  return {
    added_lines: added.slice(0, 50),
    removed_lines: removed.slice(0, 50),
    added_count: added.length,
    removed_count: removed.length,
    change_ratio,
    changed_blocks: changed_blocks.slice(0, 5),
    summary,
    model: 'grokzilla-diff-summary-v1',
    timestamp: new Date().toISOString()
  };
}

app.post('/diff-summary', async (req, res) => {
  try {
    const before = req.body.before || req.body.old || req.body.v1 || '';
    const after = req.body.after || req.body.new || req.body.v2 || '';
    if (typeof before !== 'string' || typeof after !== 'string') {
      return res.status(400).json({ error: 'before and after text required' });
    }
    if (before.length + after.length > 30000) {
      return res.status(400).json({ error: 'combined text max 30k chars' });
    }
    const result = simpleDiff(before, after);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'diff summary failed' });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'diff-summary', x402: true }));

const PORT = process.env.PORT || 3029;
app.listen(PORT, () => {
  console.log(`x402 Diff Summary on :${PORT} | payTo=${PAY_TO}`);
});
