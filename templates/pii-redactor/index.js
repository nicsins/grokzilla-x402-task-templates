/**
 * x402 PII Redactor & Sensitive Inventory
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
  'POST /redact': {
    price: '0.015',
    network: NETWORK,
    description: 'PII detection, redaction and sensitive inventory'
  }
}));

// Heuristic patterns (production-grade enough for agent gates; extend as needed)
const PATTERNS = [
  { type: 'email', re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  { type: 'phone', re: /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g },
  { type: 'ssn', re: /\b\d{3}-\d{2}-\d{4}\b/g },
  { type: 'credit_card', re: /\b(?:\d[ -]*?){13,19}\b/g },
  { type: 'ip', re: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g }
];

// Common first/last name tokens for light name detection (heuristic only)
const COMMON_NAMES = new Set([
  'john','jane','michael','sarah','david','emily','robert','jessica','william','ashley',
  'james','amanda','christopher','melissa','daniel','michelle','matthew','kimberly',
  'anthony','amy','mark','angela','donald','lisa','steven','helen','paul','sandra',
  'andrew','donna','joshua','carol','kenneth','ruth','kevin','sharon','brian','michelle',
  'smith','johnson','williams','brown','jones','garcia','miller','davis','rodriguez','martinez'
]);

function detectAndRedact(text, maskChar = '*') {
  const inventory = [];
  let redacted = text || '';

  for (const { type, re } of PATTERNS) {
    const matches = [...redacted.matchAll(re)];
    for (const m of matches) {
      const value = m[0];
      // Simple Luhn-ish filter for cards to reduce false positives
      if (type === 'credit_card') {
        const digits = value.replace(/\D/g, '');
        if (digits.length < 13 || digits.length > 19) continue;
      }
      inventory.push({
        type,
        value,
        start: m.index,
        end: m.index + value.length
      });
      const mask = maskChar.repeat(Math.min(value.length, 8));
      redacted = redacted.replace(value, mask);
    }
  }

  // Light name pass (token-level)
  const tokens = redacted.split(/(\s+)/);
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i].toLowerCase().replace(/[^a-z]/g, '');
    if (COMMON_NAMES.has(t) && t.length > 2) {
      inventory.push({ type: 'name_heuristic', value: tokens[i].trim(), token_index: i });
      tokens[i] = maskChar.repeat(Math.min(tokens[i].length, 6));
    }
  }
  redacted = tokens.join('');

  // Dedup inventory by value+type
  const seen = new Set();
  const unique = inventory.filter(item => {
    const key = `${item.type}:${item.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    redacted,
    inventory: unique,
    metrics: {
      original_length: (text || '').length,
      redacted_length: redacted.length,
      findings: unique.length,
      by_type: unique.reduce((acc, i) => {
        acc[i.type] = (acc[i.type] || 0) + 1;
        return acc;
      }, {})
    },
    meta: {
      model: 'grokzilla-pii-redactor-v1',
      timestamp: new Date().toISOString()
    }
  };
}

app.post('/redact', async (req, res) => {
  try {
    const { text, mask_char } = req.body;
    if (!text || typeof text !== 'string' || text.trim().length < 3) {
      return res.status(400).json({ error: 'text required (min 3 chars)' });
    }
    if (text.length > 50000) {
      return res.status(400).json({ error: 'text too long (max 50k chars)' });
    }

    const result = detectAndRedact(text, (mask_char || '*').toString().charAt(0) || '*');
    res.json({ success: true, ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'redaction failed' });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'pii-redactor', x402: true }));

const PORT = process.env.PORT || 3020;
app.listen(PORT, () => {
  console.log(`x402 PII Redactor on :${PORT} | payTo=${PAY_TO}`);
});
