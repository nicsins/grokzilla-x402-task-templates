# x402 Content Fingerprint (SimHash Lite)

$0.007 USDC per request via x402. Generates compact 64-bit fingerprints and pairwise Hamming distances. Ideal for near-duplicate detection, cache keys, and cheap pre-filters.

Stateless, agent-native, zero human in the loop. Deploy: set PAY_TO_WALLET → npm start or Vercel.

POST /fingerprint
{ "texts": ["...", "..."] }  or  { "text": "..." }
