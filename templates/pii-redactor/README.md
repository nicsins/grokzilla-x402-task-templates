# x402 PII Redactor & Sensitive Inventory

$0.015 USDC per redaction via x402. Detects emails, phones, SSNs, card-like numbers and name patterns; returns redacted text + structured inventory.

Stateless, agent-native, zero human in the loop. Deploy: set PAY_TO_WALLET → npm start or Vercel.

POST /redact
{ "text": "...", "mask_char": "*" }
