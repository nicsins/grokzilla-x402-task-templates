# x402 Semantic Text Similarity Scorer

$0.015 USDC per comparison set via x402. Returns pairwise similarity scores, rankings, and optional cluster labels.

Ideal for agent memory deduplication, RAG filtering, and duplicate detection with zero human review.

Deploy: PAY_TO_WALLET → npm start or Vercel serverless.

POST /similarity
{ "texts": ["snippet A", "snippet B", ...], "threshold": 0.7 }
