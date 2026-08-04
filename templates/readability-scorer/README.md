# x402 Readability & Complexity Scorer

$0.010 USDC per score via x402. Returns Flesch-style readability, lexical diversity, avg lengths, and complexity band.

Stateless, agent-native, zero human in the loop. Deploy: set PAY_TO_WALLET → npm start or Vercel.

POST /score
{ "text": "..." }
