/**
 * x402 Markdown Heading Outline Extractor
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
  'POST /outline': {
    price: '0.012',
    network: NETWORK,
    description: 'Extract hierarchical heading outline from markdown/plain text'
  }
}));

function extractOutline(text, maxDepth = 6) {
  if (!text || typeof text !== 'string') return { outline: [], error: 'text required' };
  const lines = text.split(/\r?\n/);
  const root = { title: 'ROOT', level: 0, children: [], path: [] };
  const stack = [root];

  // Patterns: ATX (#), Setext (=== / ---), numbered (1. 1.1)
  const atxRe = /^(#{1,6})\s+(.+?)(?:\s+#*)?$/;
  const numberedRe = /^(\d+(?:\.\d+)*)[.)]\s+(.+)$/;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trimEnd();
    let level = 0;
    let title = null;

    // ATX
    const atx = line.match(atxRe);
    if (atx) {
      level = atx[1].length;
      title = atx[2].trim();
    }

    // Numbered
    if (!title) {
      const num = line.match(numberedRe);
      if (num) {
        const parts = num[1].split('.');
        level = parts.length;
        title = num[2].trim();
      }
    }

    // Setext (look ahead)
    if (!title && i + 1 < lines.length) {
      const next = lines[i + 1].trim();
      if (/^=+$/.test(next)) {
        level = 1;
        title = line.trim();
        i++; // consume underline
      } else if (/^-+$/.test(next)) {
        level = 2;
        title = line.trim();
        i++;
      }
    }

    if (title && level > 0 && level <= maxDepth) {
      // Pop stack until parent level is lower
      while (stack.length > 1 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }
      const parent = stack[stack.length - 1];
      const path = [...parent.path, title];
      const node = { title, level, children: [], path };
      parent.children.push(node);
      stack.push(node);
    }
    i++;
  }

  return {
    outline: root.children,
    meta: {
      heading_count: countNodes(root),
      max_depth_found: maxDepthFound(root),
      model: 'grokzilla-heading-outline-v1',
      timestamp: new Date().toISOString()
    }
  };
}

function countNodes(node) {
  let c = node.level > 0 ? 1 : 0;
  for (const ch of node.children || []) c += countNodes(ch);
  return c;
}

function maxDepthFound(node) {
  let m = node.level || 0;
  for (const ch of node.children || []) m = Math.max(m, maxDepthFound(ch));
  return m;
}

app.post('/outline', async (req, res) => {
  try {
    const text = req.body.text || req.body.content || '';
    if (!text || text.length > 50000) {
      return res.status(400).json({ error: 'text required, max 50k chars' });
    }
    const maxDepth = Math.min(Math.max(parseInt(req.body.max_depth) || 6, 1), 8);
    const result = extractOutline(text, maxDepth);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'outline extraction failed' });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'heading-outline-extractor', x402: true }));

const PORT = process.env.PORT || 3026;
app.listen(PORT, () => {
  console.log(`x402 Heading Outline Extractor on :${PORT} | payTo=${PAY_TO}`);
});
