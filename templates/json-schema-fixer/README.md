# x402 JSON Schema Validator & Soft-Fixer

$0.018 USDC per validation/fix via x402. Returns errors, a best-effort fixed payload, and compliance confidence.

Essential safety net for agent tool calls and structured handoffs. No human in the loop.

Deploy: PAY_TO_WALLET → npm start or Vercel.

POST /fix
{ "payload": { ... }, "schema": { "type": "object", "required": [...], "properties": {...} } }
