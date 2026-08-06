# x402 Markdown Heading Outline Extractor

$0.012 USDC per document via x402. Extracts hierarchical outline tree (title, level, children, path) from markdown or plain-text headings. Supports #, ##, numbered, and underline styles.

Stateless, agent-native, zero human in the loop. Deploy: set PAY_TO_WALLET → npm start or Vercel.

POST /outline
{ "text": "# Title\n## Section\n...", "max_depth": 6 }
