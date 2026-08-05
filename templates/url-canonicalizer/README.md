# x402 Tracking-Parameter URL Canonicalizer

$0.009 USDC per URL via x402. Strips utm_*, gclid, fbclid and other trackers, normalizes scheme/host/path, sorts remaining query params.

Stateless, agent-native, zero human in the loop. Deploy: set PAY_TO_WALLET → npm start or Vercel.

POST /canonicalize
{ "urls": ["https://example.com/?utm_source=x&id=1"], "strip_fragment": true }
