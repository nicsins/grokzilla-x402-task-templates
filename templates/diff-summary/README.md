# x402 Diff Summary

Lightweight structured summary of differences between two text versions.

## Endpoint
`POST /diff-summary`

### Body
```json
{
  "before": "old text here",
  "after": "new text here"
}
```

### Response
```json
{
  "success": true,
  "added_lines": [...],
  "removed_lines": [...],
  "change_ratio": 0.23,
  "summary": "..."
}
```

## Deploy
1. Set `PAY_TO_WALLET`
2. `npm i && npm start` or push to Vercel
