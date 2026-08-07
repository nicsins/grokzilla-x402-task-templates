/**
 * x402 Table → JSON Converter
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
  'POST /table2json': {
    price: '0.015',
    network: NETWORK,
    description: 'Convert markdown/CSV table text into structured JSON array'
  }
}));

function inferType(val) {
  if (val === '' || val == null) return null;
  const s = String(val).trim();
  if (/^(true|false)$/i.test(s)) return s.toLowerCase() === 'true';
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  return s;
}

function parseMarkdownTable(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return null;

  // Find header and separator
  let headerIdx = -1;
  for (let i = 0; i < lines.length - 1; i++) {
    if (/^\|?[\s\-:|]+\|?$/.test(lines[i + 1]) && lines[i].includes('|')) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return null;

  const splitRow = (row) => {
    let cells = row.split('|').map(c => c.trim());
    if (cells[0] === '') cells.shift();
    if (cells[cells.length - 1] === '') cells.pop();
    return cells;
  };

  const headers = splitRow(lines[headerIdx]);
  const rows = [];
  for (let i = headerIdx + 2; i < lines.length; i++) {
    if (!lines[i].includes('|')) continue;
    const cells = splitRow(lines[i]);
    if (cells.length === 0) continue;
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h || `col_${idx}`] = inferType(cells[idx] ?? '');
    });
    rows.push(obj);
  }
  return { headers, rows };
}

function parseCsvLike(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return null;
  const delim = lines[0].includes('\t') ? '\t' : ',';
  const headers = lines[0].split(delim).map(h => h.trim().replace(/^["']|["']$/g, ''));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(delim).map(c => c.trim().replace(/^["']|["']$/g, ''));
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h || `col_${idx}`] = inferType(cells[idx] ?? '');
    });
    rows.push(obj);
  }
  return { headers, rows };
}

function tableToJson(text) {
  if (!text || typeof text !== 'string') return { error: 'text required' };
  if (text.length > 50000) return { error: 'max 50k chars' };

  let result = parseMarkdownTable(text);
  if (!result) result = parseCsvLike(text);
  if (!result || !result.headers || result.headers.length === 0) {
    return { error: 'could not detect table structure' };
  }
  if (result.rows.length > 200) {
    return { error: 'max 200 rows' };
  }

  return {
    headers: result.headers,
    rows: result.rows,
    row_count: result.rows.length,
    model: 'grokzilla-table2json-v1',
    timestamp: new Date().toISOString()
  };
}

app.post('/table2json', async (req, res) => {
  try {
    const text = req.body.text || req.body.content || req.body.table || '';
    const result = tableToJson(text);
    if (result.error) return res.status(400).json(result);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'table conversion failed' });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'table-to-json', x402: true }));

const PORT = process.env.PORT || 3028;
app.listen(PORT, () => {
  console.log(`x402 Table→JSON on :${PORT} | payTo=${PAY_TO}`);
});
