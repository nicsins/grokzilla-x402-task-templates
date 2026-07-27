# x402 Prompt Optimizer

$0.02 USDC per optimization via x402. Returns improved prompt + metrics + rationale.

Ideal for agent fleets that want better downstream LLM results without human tuning.

Deploy: PAY_TO_WALLET → npm start or Vercel serverless.

POST /optimize
{ "prompt": "...", "goal": "clarity|reduce tokens|creative" }
