/**
 * x402 Claim-Evidence Consistency Scorer
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
  'POST /score': {
    price: '0.022',
    network: NETWORK,
    description: 'Claim-evidence consistency scoring and contradiction detection'
  }
}));

const STOP = new Set([
  'the','a','an','and','or','but','in','on','at','to','for','of','with','by',
  'is','are','was','were','be','been','being','have','has','had','do','does','did',
  'will','would','could','should','may','might','must','shall','can','this','that',
  'these','those','it','its','i','you','he','she','we','they','me','him','her','us',
  'them','my','your','his','our','their','from','as','into','about','over','after'
]);

const NEGATION = new Set(['not','no','never','none','nobody','nothing','neither','nor','without','hardly','scarcely','barely','deny','denied','refute','false','incorrect','wrong']);

function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^\w\s'-]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1 && !STOP.has(t));
}

function jaccard(a, b) {
  const setA = new Set(a);
  const setB = new Set(b);
  let inter = 0;
  for (const x of setA) if (setB.has(x)) inter++;
  const union = setA.size + setB.size - inter;
  return union === 0 ? 0 : inter / union;
}

function scoreClaimEvidence(claim, evidenceList) {
  const claimTokens = tokenize(claim);
  if (claimTokens.length === 0) {
    return { score: 0, alignment: 'none', contradictions: [], supporting_spans: [], rationale: 'empty claim' };
  }

  const evidences = Array.isArray(evidenceList) ? evidenceList : [evidenceList];
  let bestOverlap = 0;
  let bestSpan = null;
  const contradictions = [];
  const supporting = [];

  for (const ev of evidences) {
    if (!ev || typeof ev !== 'string') continue;
    const evTokens = tokenize(ev);
    const overlap = jaccard(claimTokens, evTokens);
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      bestSpan = ev.slice(0, 220);
    }

    // Simple negation check: if claim has positive key tokens and evidence has negation near them
    const claimKeys = claimTokens.filter(t => t.length > 3);
    for (const key of claimKeys) {
      const idx = ev.toLowerCase().indexOf(key);
      if (idx >= 0) {
        const window = ev.toLowerCase().slice(Math.max(0, idx - 40), idx + key.length + 40);
        const hasNeg = [...NEGATION].some(n => window.includes(n));
        if (hasNeg) {
          contradictions.push({
            token: key,
            evidence_snippet: window.trim().slice(0, 120)
          });
        } else if (overlap > 0.15) {
          supporting.push({
            token: key,
            evidence_snippet: window.trim().slice(0, 120)
          });
        }
      }
    }
  }

  // Final score: overlap penalized by contradictions
  let score = bestOverlap;
  if (contradictions.length > 0) {
    score = Math.max(0, score - 0.25 * Math.min(contradictions.length, 3));
  }
  score = Number(score.toFixed(3));

  let alignment = 'weak';
  if (score >= 0.55) alignment = 'strong';
  else if (score >= 0.3) alignment = 'moderate';
  else if (score < 0.15 && contradictions.length > 0) alignment = 'contradictory';

  return {
    score,
    alignment,
    contradictions: contradictions.slice(0, 5),
    supporting_spans: supporting.slice(0, 5),
    best_evidence_preview: bestSpan,
    metrics: {
      claim_tokens: claimTokens.length,
      evidence_count: evidences.length,
      contradiction_count: contradictions.length
    },
    meta: {
      model: 'grokzilla-claim-evidence-scorer-v1',
      timestamp: new Date().toISOString()
    }
  };
}

app.post('/score', async (req, res) => {
  try {
    const { claim, evidence } = req.body;
    if (!claim || typeof claim !== 'string' || claim.trim().length < 5) {
      return res.status(400).json({ error: 'claim required (min 5 chars)' });
    }
    if (!evidence || (typeof evidence !== 'string' && !Array.isArray(evidence))) {
      return res.status(400).json({ error: 'evidence required (string or array of strings)' });
    }

    const result = scoreClaimEvidence(claim, evidence);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'scoring failed' });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'claim-evidence-scorer', x402: true }));

const PORT = process.env.PORT || 3021;
app.listen(PORT, () => {
  console.log(`x402 Claim-Evidence Scorer on :${PORT} | payTo=${PAY_TO}`);
});
