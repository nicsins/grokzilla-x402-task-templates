# x402 RAG Text Chunker

$0.012 USDC per request via x402. Deterministic text splitting into overlapping chunks with offsets, token estimates, and metadata. Perfect first stage for agent RAG / memory pipelines.

Stateless, agent-native, zero human in the loop. Deploy: set PAY_TO_WALLET → npm start or Vercel.

POST /chunk
{ "text": "...", "chunk_size": 512, "overlap": 64, "unit": "chars" | "tokens" }
