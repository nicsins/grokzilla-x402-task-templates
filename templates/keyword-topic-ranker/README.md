# x402 Keyword & Topic Ranker

$0.012 USDC per analysis via x402. Returns ranked keywords, n-gram phrases, topic labels, and density metrics.

Stateless, agent-native, zero human in the loop. Deploy: set PAY_TO_WALLET → npm start or Vercel.

POST /rank
{ "text": "...", "top_k": 15, "min_ngram": 1, "max_ngram": 3 }
