/**
 * x402 Structured Entity & Relation Extractor
 * Stateless, no-human-in-loop. Perfect for agent memory / RAG enrichment.
 */
require('dotenv').config();
const express = require('express');
const { paymentMiddleware } = require('@x402/express');

const app = express();
app.use(express.json({ limit: '48kb' }));

const PAY_TO = process.env.PAY_TO_WALLET || '0xYOUR_WALLET_ADDRESS_HERE';
const NETWORK = process.env.X402_NETWORK || 'base-mainnet';

app.use(paymentMiddleware(PAY_TO, {
  'POST /extract': {
    price: '0.025',
    network: NETWORK,
    description: 'Structured entity and relation extraction from text'
  }
}));

/**
 * Lightweight extraction (production: replace with Grok structured output or dedicated NER)
 */
function extractEntities(text) {
  const entities = [];
  const relations = [];

  // Simple pattern examples – expand with real LLM call
  const money = text.match(/\$[\d,]+(?:\.\d{2})?/g) || [];
  money.forEach(m => entities.push({ type: 'MONEY', value: m, confidence: 0.95 }));

  const emails = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) || [];
  emails.forEach(e => entities.push({ type: 'EMAIL', value: e, confidence: 0.99 }));

  const dates = text.match(/\b(?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/g) || [];
  dates.forEach(d => entities.push({ type: 'DATE', value: d, confidence: 0.9 }));

  // Placeholder relation example
  if (entities.length >= 2) {
    relations.push({
      subject: entities[0].value,
      predicate: 'mentioned_with',
      object: entities[1].value,
      confidence: 0.7
    });
  }

  return {
    entities,
    relations,
    stats: {
      entity_count: entities.length,
      relation_count: relations.length,
      char_length: text.length
    },
    meta: {
      model: 'grokzilla-entity-v1',
      timestamp: new Date().toISOString()
    }
  };
}

app.post('/extract', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string' || text.trim().length < 5) {
      return res.status(400).json({ error: 'text required (min 5 chars)' });
    }
    if (text.length > 12000) {
      return res.status(400).json({ error: 'text too long (max 12k chars)' });
    }

    const result = extractEntities(text);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'extraction failed' });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'entity-extractor', x402: true }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`x402 Entity Extractor on :${PORT} | payTo=${PAY_TO}`);
});
