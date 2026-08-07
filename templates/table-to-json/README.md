# x402 Table → JSON

Deterministic parser that turns markdown tables or simple CSV text into clean JSON arrays.

## Endpoint
`POST /table2json`

### Body
```json
{
  "text": "| Name | Age |\n|------|-----|\n| Ada  | 36  |\n| Bob  | 42  |"
}
```

### Response
```json
{
  "success": true,
  "headers": ["Name", "Age"],
  "rows": [{"Name": "Ada", "Age": 36}, {"Name": "Bob", "Age": 42}],
  "row_count": 2
}
```

## Deploy
1. Set `PAY_TO_WALLET`
2. `npm i && npm start` or push to Vercel
