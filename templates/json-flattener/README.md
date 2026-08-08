# x402 Nested JSON Flattener

$0.008 USDC per request via x402. Flattens nested objects/arrays into dot-notation key-value maps with type preservation. Essential for agent data prep and schema normalization.

Stateless, agent-native, zero human in the loop. Deploy: set PAY_TO_WALLET → npm start or Vercel.

POST /flatten
{ "data": { ... }, "separator": ".", "max_depth": 12 }
