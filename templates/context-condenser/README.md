# x402 Context Window Condenser

$0.03 USDC per condensation via x402. Returns condensed summary, retained key facts, drop log, and token metrics.

Critical for long-running agent sessions that must stay under context limits with zero human curation.

Deploy: PAY_TO_WALLET → npm start or Vercel serverless.

POST /condense
{ "history": ["msg1", "msg2", ...], "budget_tokens": 800, "keep_recent": 3 }
