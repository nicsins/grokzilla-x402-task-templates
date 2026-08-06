/**
 * x402 Lightweight Unit Converter & Normalizer
 * Stateless • agent-native • no human in the loop.
 * Deploy to Vercel / Tailscale / any Node host.
 * Set PAY_TO_WALLET before production.
 */
require('dotenv').config();
const express = require('express');
const { paymentMiddleware } = require('@x402/express');

const app = express();
app.use(express.json({ limit: '64kb' }));

const PAY_TO = process.env.PAY_TO_WALLET || '0xYOUR_WALLET_ADDRESS_HERE';
const NETWORK = process.env.X402_NETWORK || 'base-mainnet';

app.use(paymentMiddleware(PAY_TO, {
  'POST /convert': {
    price: '0.008',
    network: NETWORK,
    description: 'Deterministic unit conversion and quantity normalization'
  }
}));

// All conversions go through SI base then to target. Factors are exact where possible.
const UNITS = {
  // length → meter
  m: 1, meter: 1, meters: 1,
  km: 1000, kilometer: 1000, kilometers: 1000,
  cm: 0.01, centimeter: 0.01,
  mm: 0.001, millimeter: 0.001,
  mi: 1609.344, mile: 1609.344, miles: 1609.344,
  yd: 0.9144, yard: 0.9144, yards: 0.9144,
  ft: 0.3048, foot: 0.3048, feet: 0.3048,
  in: 0.0254, inch: 0.0254, inches: 0.0254,
  nmi: 1852, 'nautical mile': 1852,

  // mass → kilogram
  kg: 1, kilogram: 1, kilograms: 1,
  g: 0.001, gram: 0.001, grams: 0.001,
  mg: 0.000001, milligram: 0.000001,
  lb: 0.45359237, pound: 0.45359237, pounds: 0.45359237, lbs: 0.45359237,
  oz: 0.028349523125, ounce: 0.028349523125, ounces: 0.028349523125,
  ton: 1000, tonne: 1000, t: 1000,
  st: 6.35029318, stone: 6.35029318,

  // volume → liter
  l: 1, liter: 1, litre: 1, liters: 1, litres: 1,
  ml: 0.001, milliliter: 0.001, millilitre: 0.001,
  gal: 3.785411784, gallon: 3.785411784, gallons: 3.785411784, // US
  qt: 0.946352946, quart: 0.946352946,
  pt: 0.473176473, pint: 0.473176473,
  cup: 0.2365882365,
  floz: 0.0295735295625, 'fl oz': 0.0295735295625,
  m3: 1000, 'cubic meter': 1000,
  cm3: 0.001, 'cubic centimeter': 0.001,

  // speed → m/s
  'm/s': 1, mps: 1,
  'km/h': 1000 / 3600, kph: 1000 / 3600, kmh: 1000 / 3600,
  mph: 1609.344 / 3600, 'mi/h': 1609.344 / 3600,
  knot: 1852 / 3600, kn: 1852 / 3600, knots: 1852 / 3600,
  fps: 0.3048, 'ft/s': 0.3048
};

// Temperature is special (offset)
function convertTemp(value, from, to) {
  const f = from.toUpperCase();
  const t = to.toUpperCase();
  let c;
  if (f === 'C' || f === 'CELSIUS') c = value;
  else if (f === 'F' || f === 'FAHRENHEIT') c = (value - 32) * 5 / 9;
  else if (f === 'K' || f === 'KELVIN') c = value - 273.15;
  else return null;

  if (t === 'C' || t === 'CELSIUS') return c;
  if (t === 'F' || t === 'FAHRENHEIT') return c * 9 / 5 + 32;
  if (t === 'K' || t === 'KELVIN') return c + 273.15;
  return null;
}

function convertOne(item) {
  const { value, from, to } = item;
  if (typeof value !== 'number' || isNaN(value)) {
    return { ...item, error: 'value must be number' };
  }
  const f = String(from || '').toLowerCase().trim();
  const t = String(to || '').toLowerCase().trim();

  // Temperature path
  if (['c', 'f', 'k', 'celsius', 'fahrenheit', 'kelvin'].includes(f) ||
      ['c', 'f', 'k', 'celsius', 'fahrenheit', 'kelvin'].includes(t)) {
    const result = convertTemp(value, f, t);
    if (result === null) return { ...item, error: 'unsupported temperature unit' };
    return {
      original: { value, unit: from },
      converted: { value: Number(result.toFixed(8)), unit: to },
      factor: null
    };
  }

  const fromFactor = UNITS[f];
  const toFactor = UNITS[t];
  if (fromFactor == null || toFactor == null) {
    return { ...item, error: `unsupported unit: ${from} or ${to}` };
  }

  const si = value * fromFactor;
  const converted = si / toFactor;
  return {
    original: { value, unit: from },
    converted: { value: Number(converted.toFixed(10)), unit: to },
    factor: Number((fromFactor / toFactor).toFixed(12))
  };
}

app.post('/convert', async (req, res) => {
  try {
    let items = req.body.items || req.body;
    if (!Array.isArray(items)) {
      if (req.body.value != null) items = [req.body];
      else return res.status(400).json({ error: 'items array or single {value,from,to} required' });
    }
    if (items.length === 0 || items.length > 30) {
      return res.status(400).json({ error: 'provide 1-30 items' });
    }

    const results = items.map(convertOne);
    res.json({
      success: true,
      count: results.length,
      results,
      meta: {
        model: 'grokzilla-unit-converter-lite-v1',
        timestamp: new Date().toISOString(),
        supported_categories: ['length', 'mass', 'volume', 'speed', 'temperature']
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'conversion failed' });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'unit-converter-lite', x402: true }));

const PORT = process.env.PORT || 3027;
app.listen(PORT, () => {
  console.log(`x402 Unit Converter Lite on :${PORT} | payTo=${PAY_TO}`);
});
