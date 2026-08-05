# x402 Nested List Structure Parser

$0.014 USDC per parse via x402. Converts indented or markdown-style bullet/numbered lists into a hierarchical JSON tree.

Stateless, agent-native, zero human in the loop. Deploy: set PAY_TO_WALLET → npm start or Vercel.

POST /parse
{ "text": "- Item\n  - Nested\n1. Numbered" }
