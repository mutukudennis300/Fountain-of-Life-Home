import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { normalizePhone, parseAmount } from '../src/worker.js';

test('normalizes Kenyan mobile numbers to international format', () => {
  assert.equal(normalizePhone('0722 308 846'), '254722308846');
  assert.equal(normalizePhone('+254722308846'), '254722308846');
  assert.equal(normalizePhone('254722308846'), '254722308846');
});

test('rejects invalid Kenyan mobile numbers', () => {
  assert.equal(normalizePhone('0722 308 84'), null);
  assert.equal(normalizePhone('254322308846'), null);
  assert.equal(normalizePhone(''), null);
});

test('accepts whole KES amounts within the M-Pesa transaction limit', () => {
  assert.equal(parseAmount(1), 1);
  assert.equal(parseAmount('250000'), 250000);
});

test('rejects invalid or out-of-range KES amounts', () => {
  for (const amount of [0, -1, 250001, '1.50', '1e3', 'abc', null]) {
    assert.equal(parseAmount(amount), null);
  }
});

test('health endpoint is public and does not expose credentials or donations', async () => {
  const response = await worker.fetch(
    new Request('https://worker.example/health'),
    { SITE_ORIGIN: 'https://fountainoflifechilderenshome.org' },
    { waitUntil() {} },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok', environment: 'sandbox' });
});

test('browser API rejects an unapproved origin', async () => {
  const response = await worker.fetch(
    new Request('https://worker.example/api/mpesa/stkpush', {
      method: 'POST',
      headers: {
        Origin: 'https://attacker.example',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ amount: 10, phoneNumber: '0722308846' }),
    }),
    { SITE_ORIGIN: 'https://fountainoflifechilderenshome.org' },
    { waitUntil() {} },
  );

  assert.equal(response.status, 403);
});

test('STK endpoint validates requests before touching database or Daraja', async () => {
  const env = {
    SITE_ORIGIN: 'https://fountainoflifechilderenshome.org',
    DB: {
      prepare() {
        assert.fail('Invalid input must not access the database.');
      },
    },
  };
  const response = await worker.fetch(
    new Request('https://worker.example/api/mpesa/stkpush', {
      method: 'POST',
      headers: {
        Origin: env.SITE_ORIGIN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ amount: 0, phoneNumber: 'not-a-phone' }),
    }),
    env,
    { waitUntil() {} },
  );

  assert.equal(response.status, 400);
});

test('callback rejects malformed JSON', async () => {
  const response = await worker.fetch(
    new Request('https://worker.example/api/mpesa/callback', {
      method: 'POST',
      body: '{',
    }),
    { SITE_ORIGIN: 'https://fountainoflifechilderenshome.org' },
    { waitUntil() {} },
  );

  assert.equal(response.status, 400);
});
