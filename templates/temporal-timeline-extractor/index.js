/**
 * x402 Temporal Event Timeline Extractor
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
  'POST /timeline': {
    price: '0.018',
    network: NETWORK,
    description: 'Temporal event timeline extraction from text'
  }
}));

// Relative + absolute time patterns
const TIME_PATTERNS = [
  { type: 'absolute_date', re: /\b(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/gi },
  { type: 'relative', re: /\b(?:yesterday|today|tomorrow|last\s+(?:week|month|year|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|next\s+(?:week|month|year|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|(?:\d+|a|an|one|two|three|few|several)\s+(?:days?|weeks?|months?|years?|hours?|minutes?)\s+(?:ago|later|from\s+now)|earlier|later|previously|subsequently|afterwards|before|after|then|meanwhile)\b/gi },
  { type: 'clock', re: /\b(?:\d{1,2}:\d{2}\s*(?:am|pm|AM|PM)?|\d{1,2}\s*(?:am|pm|AM|PM))\b/g },
  { type: 'year', re: /\b(?:19|20)\d{2}\b/g }
];

function extractTimeline(text) {
  if (!text || typeof text !== 'string') {
    return { events: [], metrics: { events: 0 } };
  }

  const sentences = text
    .replace(/([.!?])\s+/g, '$1|')
    .split('|')
    .map(s => s.trim())
    .filter(s => s.length > 8);

  const events = [];
  let order = 0;

  for (const sent of sentences) {
    let hasTime = false;
    const cues = [];

    for (const { type, re } of TIME_PATTERNS) {
      const matches = [...sent.matchAll(re)];
      for (const m of matches) {
        hasTime = true;
        cues.push({ type, value: m[0], index: m.index });
      }
    }

    // Also capture sentences that look like events even without explicit time
    // (verb-heavy or starts with action)
    const looksLikeEvent = /\b(?:announced|launched|released|signed|agreed|occurred|happened|began|started|ended|finished|completed|arrived|departed|founded|created|published|filed|won|lost|acquired|merged)\b/i.test(sent);

    if (hasTime || looksLikeEvent) {
      order += 1;
      events.push({
        order,
        text: sent.slice(0, 300),
        time_cues: cues,
        confidence: hasTime ? 0.85 : 0.55,
        has_explicit_time: hasTime
      });
    }
  }

  // Simple chronological sort: absolute dates first by year, then relative order preserved
  events.sort((a, b) => {
    const yearA = (a.time_cues.find(c => c.type === 'year' || c.type === 'absolute_date') || {}).value;
    const yearB = (b.time_cues.find(c => c.type === 'year' || c.type === 'absolute_date') || {}).value;
    if (yearA && yearB) {
      const ya = parseInt(String(yearA).match(/\d{4}/)?.[0] || '0', 10);
      const yb = parseInt(String(yearB).match(/\d{4}/)?.[0] || '0', 10);
      if (ya !== yb) return ya - yb;
    }
    return a.order - b.order;
  });

  // Re-number after sort
  events.forEach((e, i) => { e.order = i + 1; });

  return {
    events,
    metrics: {
      total_sentences: sentences.length,
      events_found: events.length,
      with_explicit_time: events.filter(e => e.has_explicit_time).length
    },
    meta: {
      model: 'grokzilla-temporal-timeline-v1',
      timestamp: new Date().toISOString()
    }
  };
}

app.post('/timeline', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string' || text.trim().length < 20) {
      return res.status(400).json({ error: 'text required (min 20 chars)' });
    }
    if (text.length > 60000) {
      return res.status(400).json({ error: 'text too long (max 60k chars)' });
    }

    const result = extractTimeline(text);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'timeline extraction failed' });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'temporal-timeline-extractor', x402: true }));

const PORT = process.env.PORT || 3022;
app.listen(PORT, () => {
  console.log(`x402 Temporal Timeline Extractor on :${PORT} | payTo=${PAY_TO}`);
});
