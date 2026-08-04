/**
 * x402 Readability & Complexity Scorer
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
  'POST /score': {
    price: '0.010',
    network: NETWORK,
    description: 'Readability and complexity scoring (Flesch-style)'
  }
}));

function countSyllables(word) {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
  word = word.replace(/^y/, '');
  const matches = word.match(/[aeiouy]{1,2}/g);
  return matches ? matches.length : 1;
}

function scoreReadability(text) {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  if (!clean) {
    return { error: 'empty text' };
  }

  const sentences = clean.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = clean.split(/\s+/).filter(w => w.length > 0);
  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const unique = new Set(words.map(w => w.toLowerCase().replace(/[^\w]/g, '')));

  const numSentences = Math.max(1, sentences.length);
  const numWords = Math.max(1, words.length);
  const numSyllables = Math.max(1, syllables);

  // Approximate Flesch Reading Ease
  const flesch = 206.835 - 1.015 * (numWords / numSentences) - 84.6 * (numSyllables / numWords);
  const fleschClamped = Math.max(0, Math.min(100, Number(flesch.toFixed(1))));

  // Approximate grade level
  const grade = 0.39 * (numWords / numSentences) + 11.8 * (numSyllables / numWords) - 15.59;
  const gradeClamped = Math.max(1, Number(grade.toFixed(1)));

  const avgSentenceLen = Number((numWords / numSentences).toFixed(1));
  const avgWordLen = Number((words.reduce((s, w) => s + w.length, 0) / numWords).toFixed(1));
  const lexicalDiversity = Number((unique.size / numWords).toFixed(3));

  let band = 'standard';
  if (fleschClamped >= 80) band = 'very_easy';
  else if (fleschClamped >= 60) band = 'easy';
  else if (fleschClamped >= 50) band = 'fairly_easy';
  else if (fleschClamped >= 30) band = 'difficult';
  else band = 'very_difficult';

  return {
    flesch_reading_ease: fleschClamped,
    estimated_grade_level: gradeClamped,
    complexity_band: band,
    avg_sentence_length: avgSentenceLen,
    avg_word_length: avgWordLen,
    lexical_diversity: lexicalDiversity,
    metrics: {
      sentences: numSentences,
      words: numWords,
      syllables: numSyllables,
      unique_words: unique.size
    },
    meta: {
      model: 'grokzilla-readability-scorer-v1',
      timestamp: new Date().toISOString()
    }
  };
}

app.post('/score', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string' || text.trim().length < 10) {
      return res.status(400).json({ error: 'text required (min 10 chars)' });
    }

    const result = scoreReadability(text);
    if (result.error) return res.status(400).json(result);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'scoring failed' });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'readability-scorer', x402: true }));

const PORT = process.env.PORT || 3023;
app.listen(PORT, () => {
  console.log(`x402 Readability Scorer on :${PORT} | payTo=${PAY_TO}`);
});
