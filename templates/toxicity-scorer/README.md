# x402 Toxicity & Brand-Safety Scorer

No-human-in-loop microservice. Pay $0.01 USDC (exact) via x402 for each scan.

## Quick Deploy
1. `cp .env.example .env` → set `PAY_TO_WALLET`
2. `npm i && npm start`
3. Or push to Vercel (zero-config serverless)

## Endpoint
`POST /score`  
Body: `{ "text": "your content here" }`

Returns multi-score JSON + flags + rewrite suggestion.

Secure by design: payment verified by facilitator before handler runs.
