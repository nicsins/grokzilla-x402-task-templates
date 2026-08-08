/**
 * x402 RAG Text Chunker (Overlap + Metadata)
 * Stateless • agent-native • no human in the loop.
 * Deploy to Vercel / Tailscale / any Node host.
 * Set PAY_TO_WALLET before production.
 */
require('dotenv').config();
const express = require('express');
const { paymentMiddleware } = require('@x402/express');

const app = express();
app.use(express.json({ limit: '512kb' }));

const PAY_TO = process.env.PAY_TO_WALLET || '0xYOUR_WALLET_ADDRESS_HERE';
const NETWORK = process.env.X402_NETWORK || 'base-mainnet';

app.use(paymentMiddleware(PAY_TO, {
  'POST /chunk': {
    price: '0.012',
    network: NETWORK,
    description: 'Deterministic text chunking with overlap and metadata for RAG'
  }
}));

function estimateTokens(text) {
  // Lightweight heuristic: ~4 chars per token for English-ish text
  return Math.ceil((text || '').length / 4);
}

function chunkText(text, options = {}) {
  const {
    chunk_size = 512,
    overlap = 64,
    unit = 'chars' // 'chars' | 'tokens'
  } = options;

  if (!text || typeof text !== 'string') {
    return { chunks: [], error: 'text required' };
  }

  const maxChars = unit === 'tokens' ? chunk_size * 4 : chunk_size;
  const overlapChars = unit === 'tokens' ? overlap * 4 : overlap;

  if (maxChars < 32) {
    return { chunks: [], error: 'chunk_size too small' };
  }

  const chunks = [];
  let start = 0;
  const len = text.length;
  let id = 0;

  while (start < len) {
    let end = Math.min(start + maxChars, len);

    // Prefer break at whitespace or punctuation when not at end
    if (end < len) {
      const slice = text.slice(start, end);
      const lastSpace = Math.max(
        slice.lastIndexOf('\n\n'),
        slice.lastIndexOf('\n'),
        slice.lastIndexOf('. '),
        slice.lastIndexOf(' ')
      );
      if (lastSpace > maxChars * 0.4) {
        end = start + lastSpace + 1;
      }
    }

    const content = text.slice(start, end).trim();
    if (content.length > 0) {
      chunks.push({
        id: id++,
        content,
        start_char: start,
        end_char: end,
        char_count: content.length,
        token_estimate: estimateTokens(content)
      });
    }

    if (end >= len) break;
    start = Math.max(end - overlapChars, start + 1);
  }

  return {
    chunks,
    total_chunks: chunks.length,
    total_chars: len,
    total_token_estimate: estimateTokens(text),
    settings: { chunk_size, overlap, unit },
    model: 'grokzilla-rag-text-chunker-v1',
    timestamp: new Date().toISOString()
  };
}

app.post('/chunk', async (req, res) => {
  try {
    const text = req.body.text || req.body.content || '';
    if (typeof text !== 'string' || text.length === 0) {
      return res.status(400).json({ error: 'text (string) required' });
    }
    if (text.length > 100000) {
      return res.status(400).json({ error: 'text max 100k chars' });
    }

    const options = {
      chunk_size: Number(req.body.chunk_size) || 512,
      overlap: Number(req.body.overlap) || 64,
      unit: req.body.unit === 'tokens' ? 'tokens' : 'chars'
    };

    const result = chunkText(text, options);
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }
    res.json({ success: true, ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'chunking failed' });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'rag-text-chunker', x402: true }));

const PORT = process.env.PORT || 3031;
app.listen(PORT, () => {
  console.log(`x402 RAG Text Chunker on :${PORT} | payTo=${PAY_TO}`);
});
