# x402 Claim-Evidence Consistency Scorer

$0.022 USDC per score via x402. Scores alignment between a claim and evidence, flags contradictions, returns supporting spans.

Stateless, agent-native, zero human in the loop. Deploy: set PAY_TO_WALLET → npm start or Vercel.

POST /score
{ "claim": "...", "evidence": "..." | ["...", "..."] }
