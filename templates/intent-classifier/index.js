/**
 * x402 Intent & Action Classifier
 * Stateless • agent-native • no human in the loop.
 */
require('dotenv').config();
const express = require('express');
const { paymentMiddleware } = require('@x402/express');

const app = express();
app.use(express.json({ limit: '16kb' }));

const PAY_TO = process.env.PAY_TO_WALLET || '0xYOUR_WALLET_ADDRESS_HERE';
const NETWORK = process.env.X402_NETWORK || 'base-mainnet';

app.use(paymentMiddleware(PAY_TO, {
  'POST /classify': {
    price: '0.02',
    network: NETWORK,
    description: 'Intent & action classification for agents'
  }
}));

/**
 * Lightweight rule + keyword intent classifier (production: replace with Grok structured output)
 */
const INTENT_RULES = [
  { intent: 'search', keywords: ['find', 'search', 'look for', 'where is', 'locate'], action: 'call_search_tool' },
  { intent: 'summarize', keywords: ['summarize', 'summary', 'tl;dr', 'condense', 'brief'], action: 'call_summarizer' },
  { intent: 'extract', keywords: ['extract', 'entities', 'pull out', 'get the', 'list all'], action: 'call_entity_extractor' },
  { intent: 'translate', keywords: ['translate', 'in spanish', 'in french', 'convert to'], action: 'call_translator' },
  { intent: 'create', keywords: ['create', 'generate', 'write', 'make a', 'draft'], action: 'call_generator' },
  { intent: 'clarify', keywords: ['what do you mean', 'explain', 'clarify', 'huh', 'confused'], action: 'ask_clarification' },
  { intent: 'greeting', keywords: ['hello', 'hi', 'hey', 'good morning', 'yo'], action: 'respond_greeting' },
  { intent: 'farewell', keywords: ['bye', 'goodbye', 'see you', 'later', 'exit'], action: 'respond_farewell' },
  { intent: 'help', keywords: ['help', 'how do i', 'what can you', 'capabilities'], action: 'show_help' }
];

function classifyIntent(utterance, context = '') {
  const text = `${utterance} ${context}`.toLowerCase();
  const matches = [];

  INTENT_RULES.forEach(rule => {
    const hits = rule.keywords.filter(kw => text.includes(kw));
    if (hits.length > 0) {
      matches.push({
        intent: rule.intent,
        confidence: Number(Math.min(0.55 + hits.length * 0.15, 0.95).toFixed(2)),
        matched_keywords: hits,
        suggested_action: rule.action
      });
    }
  });

  matches.sort((a, b) => b.confidence - a.confidence);

  const primary = matches[0] || {
    intent: 'unknown',
    confidence: 0.4,
    matched_keywords: [],
    suggested_action: 'ask_clarification'
  };

  // Simple slot extraction stub
  const slots = {};
  const money = utterance.match(/\$[\d,]+(?:\.\d{2})?/);
  if (money) slots.amount = money[0];
  const email = utterance.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  if (email) slots.email = email[0];

  return {
    primary_intent: primary.intent,
    confidence: primary.confidence,
    suggested_action: primary.suggested_action,
    all_matches: matches.slice(0, 3),
    slots,
    meta: {
      model: 'grokzilla-intent-v1',
      timestamp: new Date().toISOString()
    }
  };
}

app.post('/classify', async (req, res) => {
  try {
    const { utterance, context } = req.body;
    if (!utterance || typeof utterance !== 'string' || utterance.trim().length < 2) {
      return res.status(400).json({ error: 'utterance required (min 2 chars)' });
    }

    const result = classifyIntent(utterance, context || '');
    res.json({ success: true, ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'classification failed' });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'intent-classifier', x402: true }));

const PORT = process.env.PORT || 3004;
app.listen(PORT, () => {
  console.log(`x402 Intent Classifier on :${PORT} | payTo=${PAY_TO}`);
});
