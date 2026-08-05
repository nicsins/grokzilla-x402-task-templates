/**
 * x402 Nested List Structure Parser
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
  'POST /parse': {
    price: '0.014',
    network: NETWORK,
    description: 'Nested bullet/list hierarchy parser to JSON tree'
  }
}));

function parseList(text) {
  const lines = (text || '').split(/\r?\n/);
  const root = { type: 'root', children: [] };
  const stack = [{ node: root, depth: -1 }];

  const bulletRe = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;

  for (const raw of lines) {
    const line = raw.replace(/\t/g, '  ');
    const m = line.match(bulletRe);
    if (!m) continue;

    const indent = m[1].length;
    const marker = m[2];
    const content = m[3].trim();
    if (!content) continue;

    const depth = Math.floor(indent / 2); // 2-space or tab approx
    const type = /^\d/.test(marker) ? 'ordered' : 'unordered';

    const node = {
      text: content,
      type,
      depth,
      marker,
      children: []
    };

    // Pop stack until we find a parent with lower depth
    while (stack.length > 1 && stack[stack.length - 1].depth >= depth) {
      stack.pop();
    }

    const parent = stack[stack.length - 1].node;
    parent.children.push(node);
    stack.push({ node, depth });
  }

  return {
    tree: root.children,
    node_count: countNodes(root.children),
    max_depth: maxDepth(root.children),
    meta: {
      model: 'grokzilla-list-structure-parser-v1',
      timestamp: new Date().toISOString()
    }
  };
}

function countNodes(nodes) {
  let n = 0;
  for (const node of nodes) {
    n += 1 + countNodes(node.children || []);
  }
  return n;
}

function maxDepth(nodes, d = 0) {
  if (!nodes || !nodes.length) return d;
  return Math.max(...nodes.map(n => maxDepth(n.children || [], d + 1)));
}

app.post('/parse', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string' || text.trim().length < 3) {
      return res.status(400).json({ error: 'text required (min 3 chars)' });
    }

    const result = parseList(text);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'parse failed' });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'list-structure-parser', x402: true }));

const PORT = process.env.PORT || 3026;
app.listen(PORT, () => {
  console.log(`x402 List Structure Parser on :${PORT} | payTo=${PAY_TO}`);
});
