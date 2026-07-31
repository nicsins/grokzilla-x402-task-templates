# x402 Sentiment Drift Analyzer

$0.025 USDC per series via x402. Returns per-item sentiment, trajectory, inflection points, and drift magnitude.

Critical for long-running agent conversations and monitoring without human review.

Deploy: PAY_TO_WALLET → npm start or Vercel.

POST /drift
{ "texts": ["turn1", "turn2", ...], "labels": ["optional labels"] }
