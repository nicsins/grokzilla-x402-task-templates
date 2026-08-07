# x402 Slug Extractor

Deterministic, zero-dependency (beyond Express) slug generator for agent pipelines.

## Endpoint
`POST /slug`

### Body
```json
{
  "input": "My Awesome Title / Path?",
  "max_length": 80
}
```
or batch:
```json
{ "inputs": ["Title One", "https://example.com/path/to/page"] }
```

### Response
```json
{
  "success": true,
  "count": 1,
  "results": [{ "slug": "my-awesome-title-path", ... }]
}
```

## Deploy
1. Set `PAY_TO_WALLET`
2. `npm i && npm start` or push to Vercel
3. Optional: `X402_NETWORK=base-mainnet`
