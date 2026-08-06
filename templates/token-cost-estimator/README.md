# x402 Approximate Token Counter & Cost Estimator

$0.005 USDC per request via x402. Fast character/word heuristic for LLM token estimates (GPT/Grok style) + optional $/1k cost projection. Supports single text or batch. Zero model calls.

Stateless, agent-native, zero human in the loop. Deploy: set PAY_TO_WALLET → npm start or Vercel.

POST /estimate
{ "text": "...", "price_per_1k_input": 0.005, "price_per_1k_output": 0.015 }
or { "texts": ["a", "b"], ... }
