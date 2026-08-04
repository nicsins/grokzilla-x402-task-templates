# x402 Near-Duplicate Detector

$0.012 USDC per comparison via x402. Returns Jaccard + length-normalized similarity, shared tokens, and is_near_duplicate flag.

Stateless, agent-native, zero human in the loop. Deploy: set PAY_TO_WALLET → npm start or Vercel.

POST /compare
{ "text_a": "...", "text_b": "...", "threshold": 0.65 }
