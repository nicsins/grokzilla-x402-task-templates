/**
 * x402 Context Window Condenser / Token Optimizer
 * Stateless • agent-native • no human in the loop.
 */
require('dotenv').config();
const express = require('express');
const { paymentMiddleware } = require('@x402/express');

const app = express();
app.use(express.json({ limit: '96kb' }));

const PAY_TO = process.env.PAY_TO_WALLET || '0xYOUR_WALLET_ADDRESS_HERE';
const NETWORK = process.env.X402_NETWORK || 'base-mainnet';

app.use(paymentMiddleware(PAY_TO, {
  'POST /condense': {
    price: '0.03',
    network: NETWORK,
    description: 'Context window condensation & token optimization'
  }
}));

/**
 * Lightweight extractive condensation (production: replace with Grok abstractive summary)
 */
function approxTokens(text) {
  return Math.ceil((text || '').length / 4);
}

function condenseHistory(history, budgetTokens = 800, keepRecent = 2) {
  const items = Array.isArray(history) ? history.map(String) : [String(history)];
  const originalTokens = items.reduce((sum, t) => sum + approxTokens(t), 0);

  // Always keep the most recent N items
  const recent = items.slice(-keepRecent);
  const older = items.slice(0, -keepRecent);

  // Score older items by simple keyword density + length (proxy for importance)
  const scored = older.map((text, idx) => {
    const tokens = approxTokens(text);
    const keywords = (text.match(/\b(error|decision|result|important|key|final|user|goal)\b/gi) || []).length;
    const score = keywords * 2 + Math.min(tokens / 50, 3);
    return { text, tokens, score, idx };
  });
  scored.sort((a, b) => b.score - a.score);

  // Greedily pack until budget
  let used = recent.reduce((s, t) => s + approxTokens(t), 0);
  const retained = [];
  const dropped = [];

  for (const item of scored) {
    if (used + item.tokens <= budgetTokens) {
      retained.push(item);
      used += item.tokens;
    } else {
      dropped.push({ preview: item.text.slice(0, 60) + '...', tokens: item.tokens });
    }
  }

  // Reconstruct chronological order of retained older items
  retained.sort((a, b) => a.idx - b.idx);
  const condensedParts = [...retained.map(r => r.text), ...recent];

  // Build a short bullet summary of dropped content
  const dropSummary = dropped.length
    ? `Dropped ${dropped.length} older items (~${dropped.reduce((s, d) => s + d.tokens, 0)} tokens).`
    : 'Nothing dropped.';

  const condensedText = condensedParts.join('\n---\n');
  const finalTokens = approxTokens(condensedText);

  return {
    condensed: condensedText,
    key_facts_retained: retained.slice(0, 5).map(r => r.text.slice(0, 100)),
    drop_log: dropped.slice(0, 8),
    metrics: {
      original_tokens_approx: originalTokens,
      final_tokens_approx: finalTokens,
      tokens_saved: originalTokens - finalTokens,
      budget: budgetTokens,
      items_in: items.length,
      items_out: condensedParts.length
    },
    note: dropSummary,
    meta: {
      model: 'grokzilla-condenser-v1',
      timestamp: new Date().toISOString()
    }
  };
}

app.post('/condense', async (req, res) => {
  try {
    const { history, budget_tokens, keep_recent } = req.body;
    if (!history || (Array.isArray(history) && history.length === 0)) {
      return res.status(400).json({ error: 'history required (string or non-empty array)' });
    }

    const result = condenseHistory(
      history,
      budget_tokens || 800,
      keep_recent || 2
    );
    res.json({ success: true, ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'condensation failed' });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'context-condenser', x402: true }));

const PORT = process.env.PORT || 3005;
app.listen(PORT, () => {
  console.log(`x402 Context Condenser on :${PORT} | payTo=${PAY_TO}`);
});
