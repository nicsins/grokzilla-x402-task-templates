# x402 Lexical Contradiction Flag Detector

$0.015 USDC per document via x402. Flags candidate contradiction spans using negation + opposing-term heuristics. Cheap pre-filter before expensive verification agents.

Stateless, agent-native, zero human in the loop. Deploy: set PAY_TO_WALLET → npm start or Vercel.

POST /flag
{ "text": "The system is secure. However it is not secure under load." }
