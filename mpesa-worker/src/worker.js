const DARAJA_BASE_URL = 'https://sandbox.safaricom.co.ke';
const MAX_AMOUNT_KES = 250000;
const RATE_WINDOW_SECONDS = 60 * 60;
const MAX_PER_PHONE_PER_WINDOW = 5;
const MAX_PER_IP_PER_WINDOW = 15;

function jsonResponse(data, status, origin) {
  const headers = {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
  };

  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Authorization, Content-Type';
    headers.Vary = 'Origin';
  }

  return new Response(JSON.stringify(data), { status, headers });
}

function normalizeOrigin(value) {
  try {
    return new URL(value).origin;
  } catch {
    return '';
  }
}

function normalizePhone(value) {
  const digits = String(value ?? '').replace(/[\s()+-]/g, '');
  const local = digits.startsWith('0') ? `254${digits.slice(1)}` : digits;
  return /^254(?:7|1)\d{8}$/.test(local) ? local : null;
}

function parseAmount(value) {
  if (
    (typeof value !== 'number' && typeof value !== 'string') ||
    !/^\d{1,6}$/.test(String(value))
  ) {
    return null;
  }

  const amount = Number(value);
  return Number.isSafeInteger(amount) && amount >= 1 && amount <= MAX_AMOUNT_KES
    ? amount
    : null;
}

function createTimestamp() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}${values.month}${values.day}${values.hour}${values.minute}${values.second}`;
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
}

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function fetchJson(url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const body = await response.json().catch(() => null);
    return { response, body };
  } finally {
    clearTimeout(timeout);
  }
}

async function getAccessToken(env) {
  const credentials = btoa(`${env.DARAJA_CONSUMER_KEY}:${env.DARAJA_CONSUMER_SECRET}`);
  const { response, body } = await fetchJson(
    `${DARAJA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${credentials}` } },
  );

  if (!response.ok || typeof body?.access_token !== 'string') {
    throw new Error('Daraja authentication failed');
  }
  return body.access_token;
}

async function applyRateLimit(env, phone, ip) {
  const bucket = Math.floor(Date.now() / (RATE_WINDOW_SECONDS * 1000));
  const phoneKey = `phone:${await sha256(phone)}`;
  const ipKey = `ip:${await sha256(ip || 'unknown')}`;

  const phoneResult = await env.DB.prepare(
    `INSERT INTO rate_limits (counter_key, bucket, count) VALUES (?, ?, 1)
     ON CONFLICT (counter_key, bucket) DO UPDATE SET count = count + 1
     RETURNING count`,
  ).bind(phoneKey, bucket).first('count');

  const ipResult = await env.DB.prepare(
    `INSERT INTO rate_limits (counter_key, bucket, count) VALUES (?, ?, 1)
     ON CONFLICT (counter_key, bucket) DO UPDATE SET count = count + 1
     RETURNING count`,
  ).bind(ipKey, bucket).first('count');

  await env.DB.prepare('DELETE FROM rate_limits WHERE bucket < ?').bind(bucket - 1).run();
  return phoneResult <= MAX_PER_PHONE_PER_WINDOW && ipResult <= MAX_PER_IP_PER_WINDOW;
}

async function startStkPush(request, env, origin) {
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    return jsonResponse({ error: 'Send a JSON request.' }, 415, origin);
  }

  const rawBody = await request.text();
  if (rawBody.length > 2048) {
    return jsonResponse({ error: 'Request is too large.' }, 413, origin);
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: 'Request body must be valid JSON.' }, 400, origin);
  }

  const amount = parseAmount(payload?.amount);
  const phone = normalizePhone(payload?.phoneNumber);
  if (!amount || !phone) {
    return jsonResponse(
      { error: `Enter a valid Kenyan mobile number and an amount from KSh 1 to ${MAX_AMOUNT_KES.toLocaleString('en-KE')}.` },
      400,
      origin,
    );
  }

  const allowed = await applyRateLimit(env, phone, request.headers.get('CF-Connecting-IP'));
  if (!allowed) {
    return jsonResponse(
      { error: 'Too many payment requests. Please wait and try again, or use the Paybill option.' },
      429,
      origin,
    );
  }

  const statusToken = randomToken();
  const statusTokenHash = await sha256(statusToken);
  const id = crypto.randomUUID();
  const accountReference = `DON-${id.replaceAll('-', '').slice(0, 8).toUpperCase()}`;
  const now = Math.floor(Date.now() / 1000);

  await env.DB.prepare(
    `INSERT INTO donations
      (id, status_token_hash, amount, account_reference, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'initiating', ?, ?)`,
  ).bind(id, statusTokenHash, amount, accountReference, now, now).run();

  try {
    const timestamp = createTimestamp();
    const password = btoa(`${env.DARAJA_SHORTCODE}${env.DARAJA_PASSKEY}${timestamp}`);
    const accessToken = await getAccessToken(env);
    const { response, body } = await fetchJson(
      `${DARAJA_BASE_URL}/mpesa/stkpush/v1/processrequest`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          BusinessShortCode: env.DARAJA_SHORTCODE,
          Password: password,
          Timestamp: timestamp,
          TransactionType: 'CustomerPayBillOnline',
          Amount: amount,
          PartyA: phone,
          PartyB: env.DARAJA_SHORTCODE,
          PhoneNumber: phone,
          CallBackURL: env.DARAJA_CALLBACK_URL,
          AccountReference: accountReference,
          TransactionDesc: 'Donation',
        }),
      },
    );

    if (
      !response.ok ||
      body?.ResponseCode !== '0' ||
      typeof body?.CheckoutRequestID !== 'string' ||
      typeof body?.MerchantRequestID !== 'string'
    ) {
      throw new Error('Daraja did not accept the STK request');
    }

    await env.DB.prepare(
      `UPDATE donations
       SET checkout_request_id = ?, merchant_request_id = ?, status = 'pending', updated_at = ?
       WHERE id = ?`,
    ).bind(body.CheckoutRequestID, body.MerchantRequestID, now, id).run();

    return jsonResponse(
      {
        status: 'pending',
        statusToken,
        message: 'Check your phone and follow the M-Pesa prompt. We are waiting for confirmation.',
      },
      202,
      origin,
    );
  } catch {
    console.error('Unable to initiate an M-Pesa STK request.');
    await env.DB.prepare(
      `UPDATE donations SET status = 'failed', updated_at = ? WHERE id = ?`,
    ).bind(Math.floor(Date.now() / 1000), id).run();

    return jsonResponse(
      { error: 'We could not start the M-Pesa request. Please use the Paybill option or try again later.' },
      502,
      origin,
    );
  }
}

async function queryStkStatus(env, checkoutRequestId) {
  const timestamp = createTimestamp();
  const password = btoa(`${env.DARAJA_SHORTCODE}${env.DARAJA_PASSKEY}${timestamp}`);
  const accessToken = await getAccessToken(env);
  const { response, body } = await fetchJson(
    `${DARAJA_BASE_URL}/mpesa/stkpushquery/v1/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        BusinessShortCode: env.DARAJA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId,
      }),
    },
  );

  if (
    !response.ok ||
    body?.ResponseCode !== '0' ||
    body?.CheckoutRequestID !== checkoutRequestId
  ) {
    throw new Error('Daraja status query was inconclusive');
  }
  return body.ResultCode;
}

async function processCallback(payload, env) {
  const callback = payload?.Body?.stkCallback;
  const checkoutRequestId = callback?.CheckoutRequestID;
  const merchantRequestId = callback?.MerchantRequestID;
  if (typeof checkoutRequestId !== 'string' || typeof merchantRequestId !== 'string') {
    return;
  }

  const donation = await env.DB.prepare(
    `SELECT id, merchant_request_id, status
     FROM donations
     WHERE checkout_request_id = ?`,
  ).bind(checkoutRequestId).first();

  if (
    !donation ||
    donation.merchant_request_id !== merchantRequestId ||
    donation.status !== 'pending'
  ) {
    return;
  }

  let resultCode;
  try {
    resultCode = await queryStkStatus(env, checkoutRequestId);
  } catch {
    console.error('Unable to verify an M-Pesa callback with Daraja.');
    return;
  }

  const status = String(resultCode) === '0' ? 'succeeded' : 'failed';
  await env.DB.prepare(
    `UPDATE donations SET status = ?, updated_at = ?
     WHERE id = ? AND status = 'pending'`,
  ).bind(status, Math.floor(Date.now() / 1000), donation.id).run();
}

async function handleCallback(request, env, ctx) {
  const rawBody = await request.text();
  if (rawBody.length > 32768) {
    return jsonResponse({ ResultCode: 1, ResultDesc: 'Request too large' }, 413);
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ ResultCode: 1, ResultDesc: 'Invalid JSON' }, 400);
  }

  ctx.waitUntil(
    processCallback(payload, env).catch(() => {
      console.error('Unable to process an M-Pesa callback.');
    }),
  );
  return jsonResponse({ ResultCode: 0, ResultDesc: 'Accepted' }, 200);
}

async function getDonationStatus(request, env, origin) {
  const authorization = request.headers.get('Authorization') ?? '';
  const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(authorization);
  if (!match) {
    return jsonResponse({ error: 'Invalid status token.' }, 401, origin);
  }

  const tokenHash = await sha256(match[1]);
  const donation = await env.DB.prepare(
    'SELECT status FROM donations WHERE status_token_hash = ?',
  ).bind(tokenHash).first();

  if (!donation) {
    return jsonResponse({ error: 'Donation request not found.' }, 404, origin);
  }

  const messages = {
    initiating: 'Starting your M-Pesa request.',
    pending: 'Waiting for M-Pesa confirmation. Check your phone and follow the prompt.',
    succeeded: 'M-Pesa confirms your donation was successful. Thank you.',
    failed: 'M-Pesa did not complete this request. You can try again or use Paybill.',
  };
  return jsonResponse({ status: donation.status, message: messages[donation.status] }, 200, origin);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const allowedOrigin = normalizeOrigin(env.SITE_ORIGIN);
    const isCallback = url.pathname === '/api/mpesa/callback';
    const isHealthCheck = url.pathname === '/health' && request.method === 'GET';
    const corsOrigin = origin && normalizeOrigin(origin) === allowedOrigin ? allowedOrigin : '';

    if (!isCallback && !isHealthCheck && (!origin || !corsOrigin)) {
      return jsonResponse({ error: 'Origin not allowed.' }, 403);
    }

    if (isHealthCheck && origin && !corsOrigin) {
      return jsonResponse({ error: 'Origin not allowed.' }, 403);
    }

    if (request.method === 'OPTIONS' && !isCallback) {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': corsOrigin,
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type',
          'Access-Control-Max-Age': '86400',
          Vary: 'Origin',
        },
      });
    }

    if (url.pathname === '/api/mpesa/callback' && request.method === 'POST') {
      return handleCallback(request, env, ctx);
    }

    if (url.pathname === '/api/mpesa/stkpush' && request.method === 'POST') {
      return startStkPush(request, env, corsOrigin);
    }

    if (url.pathname === '/api/mpesa/status' && request.method === 'GET') {
      return getDonationStatus(request, env, corsOrigin);
    }

    if (url.pathname === '/health' && request.method === 'GET') {
      return jsonResponse({ status: 'ok', environment: 'sandbox' }, 200, corsOrigin);
    }

    return jsonResponse({ error: 'Not found.' }, 404, corsOrigin);
  },
};

export { normalizePhone, parseAmount };
