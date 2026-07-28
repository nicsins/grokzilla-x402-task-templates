# x402 Intent & Action Classifier

$0.02 USDC per classification via x402. Returns intent label(s), confidence, suggested action, and optional slots.

Ideal for multi-agent routers, support bots, and workflow triggers with zero human review.

Deploy: PAY_TO_WALLET → npm start or Vercel serverless.

POST /classify
{ "utterance": "...", "context": "optional short context" }
