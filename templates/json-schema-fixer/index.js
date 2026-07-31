/**
 * x402 JSON Schema Validator & Soft-Fixer
 * Stateless • agent-native • no human in the loop.
 * Validates agent outputs and produces a best-effort compliant version.
 */
require('dotenv').config();
const express = require('express');
const { paymentMiddleware } = require('@x402/express');

const app = express();
app.use(express.json({ limit: '128kb' }));

const PAY_TO = process.env.PAY_TO_WALLET || '0xYOUR_WALLET_ADDRESS_HERE';
const NETWORK = process.env.X402_NETWORK || 'base-mainnet';

app.use(paymentMiddleware(PAY_TO, {
  'POST /fix': {
    price: '0.018',
    network: NETWORK,
    description: 'JSON schema validation and soft auto-fix for agent outputs'
  }
}));

function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

function softFix(payload, schema) {
  const errors = [];
  const fixed = JSON.parse(JSON.stringify(payload)); // deep clone
  let fixes = 0;

  if (!schema || typeof schema !== 'object') {
    return {
      valid: true,
      errors: [],
      fixed: payload,
      confidence: 1.0,
      note: 'No schema provided — returned original payload'
    };
  }

  // Required keys
  if (Array.isArray(schema.required)) {
    for (const key of schema.required) {
      if (!(key in fixed) || fixed[key] === undefined) {
        errors.push({ path: key, message: `Missing required property "${key}"` });
        // Soft default based on property type if available
        const prop = schema.properties && schema.properties[key];
        if (prop) {
          if (prop.type === 'string') fixed[key] = prop.default ?? '';
          else if (prop.type === 'number' || prop.type === 'integer') fixed[key] = prop.default ?? 0;
          else if (prop.type === 'boolean') fixed[key] = prop.default ?? false;
          else if (prop.type === 'array') fixed[key] = prop.default ?? [];
          else if (prop.type === 'object') fixed[key] = prop.default ?? {};
          else fixed[key] = null;
          fixes++;
        }
      }
    }
  }

  // Property type checks + soft coercion
  if (schema.properties && typeof schema.properties === 'object') {
    for (const [key, prop] of Object.entries(schema.properties)) {
      if (!(key in fixed)) continue;
      const actual = typeOf(fixed[key]);
      const expected = prop.type;

      if (expected && actual !== expected) {
        // Attempt soft coercion
        let coerced = false;
        if (expected === 'string' && fixed[key] != null) {
          fixed[key] = String(fixed[key]);
          coerced = true;
        } else if (expected === 'number' && !isNaN(Number(fixed[key]))) {
          fixed[key] = Number(fixed[key]);
          coerced = true;
        } else if (expected === 'integer' && !isNaN(parseInt(fixed[key], 10))) {
          fixed[key] = parseInt(fixed[key], 10);
          coerced = true;
        } else if (expected === 'boolean') {
          if (fixed[key] === 'true' || fixed[key] === 1) { fixed[key] = true; coerced = true; }
          else if (fixed[key] === 'false' || fixed[key] === 0) { fixed[key] = false; coerced = true; }
        } else if (expected === 'array' && !Array.isArray(fixed[key])) {
          fixed[key] = [fixed[key]];
          coerced = true;
        }

        if (coerced) {
          fixes++;
          errors.push({ path: key, message: `Type mismatch (${actual} → ${expected}), coerced`, severity: 'fixed' });
        } else {
          errors.push({ path: key, message: `Type mismatch: expected ${expected}, got ${actual}`, severity: 'error' });
        }
      }

      // Enum check
      if (prop.enum && Array.isArray(prop.enum) && !prop.enum.includes(fixed[key])) {
        errors.push({ path: key, message: `Value not in enum: ${JSON.stringify(prop.enum)}` });
        // Soft: pick first enum value
        fixed[key] = prop.enum[0];
        fixes++;
      }
    }
  }

  // Additional properties policy (if additionalProperties === false)
  if (schema.additionalProperties === false && schema.properties) {
    const allowed = new Set(Object.keys(schema.properties));
    for (const key of Object.keys(fixed)) {
      if (!allowed.has(key)) {
        errors.push({ path: key, message: `Additional property not allowed`, severity: 'stripped' });
        delete fixed[key];
        fixes++;
      }
    }
  }

  const hardErrors = errors.filter(e => e.severity === 'error' || !e.severity).length;
  const confidence = Math.max(0, 1 - (hardErrors * 0.25 + (errors.length - hardErrors) * 0.05));

  return {
    valid: hardErrors === 0,
    errors,
    fixed,
    fixes_applied: fixes,
    confidence: Number(confidence.toFixed(3)),
    meta: {
      model: 'grokzilla-json-fixer-v1',
      timestamp: new Date().toISOString()
    }
  };
}

app.post('/fix', async (req, res) => {
  try {
    const { payload, schema } = req.body;
    if (payload === undefined) {
      return res.status(400).json({ error: 'payload required' });
    }
    // Allow non-object payload only if schema expects it; otherwise reject
    if (typeof payload !== 'object' || payload === null) {
      return res.status(400).json({ error: 'payload must be a JSON object or array' });
    }

    const result = softFix(payload, schema);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'validation/fix failed' });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'json-schema-fixer', x402: true }));

const PORT = process.env.PORT || 3012;
app.listen(PORT, () => {
  console.log(`x402 JSON Schema Fixer on :${PORT} | payTo=${PAY_TO}`);
});
