# x402 Lightweight Unit Converter & Normalizer

$0.008 USDC per request via x402. Converts quantities between common units (length, mass, temp, volume, speed) to SI or preferred unit. Pure deterministic math, 40+ units. Batch supported.

Stateless, agent-native, zero human in the loop. Deploy: set PAY_TO_WALLET → npm start or Vercel.

POST /convert
{ "items": [ { "value": 5, "from": "mi", "to": "km" }, { "value": 32, "from": "F", "to": "C" } ] }
