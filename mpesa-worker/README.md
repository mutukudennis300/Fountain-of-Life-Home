# M-Pesa STK Push (sandbox)

This Worker adds an STK Push backend to the GitHub Pages site. Daraja keys stay
in Cloudflare Worker secrets; they must never be added to website JavaScript,
HTML, Git, screenshots, or chat. The Worker uses Safaricom's sandbox only.

## What it does

- Accepts a Kenyan mobile number and a whole-KES donation amount.
- Limits requests to KSh 250,000, five requests per phone per hour, and 15 per
  client IP per hour.
- Initiates the STK Push and stores only the amount, opaque status-token hash,
  Daraja request IDs, and status in D1. It does not store the donor's phone.
- Receives the Daraja callback, then independently asks Daraja to verify the
  checkout before recording success. A callback by itself is never treated as
  proof of payment.
- Gives the donor an unguessable status token for checking the result.

The public Paybill instructions remain available if the online flow is not
configured or a request cannot be started.

## 1. Create a Daraja sandbox app

1. Sign in or register at [Safaricom Daraja](https://developer.safaricom.co.ke/).
2. Create an app that enables **M-PESA Express** and obtain its sandbox consumer
   key and consumer secret.
3. Use the sandbox shortcode and passkey provided by Daraja. Add a sandbox test
   phone number to your Daraja app as required by its current test process.
4. Do not use production credentials or real payments during this setup.

## 2. Cloudflare database

The D1 database `fountain-life-mpesa` has been created and its schema applied.
Its ID is already in `wrangler.jsonc`; do not create a second database. From
the repository root, enter the Worker folder:

```powershell
cd mpesa-worker
npm install
```

To reapply the schema later, use:

```powershell
npx wrangler d1 execute fountain-life-mpesa --remote --file=schema.sql
```

## 3. Keep the website domain separate

This Worker uses its `workers.dev` hostname, so it does not change DNS or
interfere with the GitHub Pages website or the existing `fountain-backend`
Worker. Do not point the root website domain to this payment Worker.

## 4. Add Daraja secrets

Set each secret using the prompts. Do not put the values on the command line,
in source files, or in a committed `.env` file:

```powershell
npx wrangler secret put DARAJA_CONSUMER_KEY
npx wrangler secret put DARAJA_CONSUMER_SECRET
npx wrangler secret put DARAJA_SHORTCODE
npx wrangler secret put DARAJA_PASSKEY
```

The Worker is already deployed at
`https://fountain-life-mpesa.mutukudennis300.workers.dev`. After adding the
secrets, deploy again to update it:

```powershell
npx wrangler deploy
```

The callback URL is already configured as a non-secret Worker variable.

## 5. Connect the donation page

Set the `data-stk-api` attribute on the STK Push button in `donate.html` to the
Worker base URL printed by Wrangler, without a trailing slash. For example:

```html
data-stk-api="https://fountain-life-mpesa.<your-account-subdomain>.workers.dev"
```

Publish the updated site to GitHub Pages. The URL is public configuration, not
a secret. The Worker allows browser requests only from the site origin set in
`wrangler.jsonc` (`SITE_ORIGIN`).

## 6. Test before production

1. Open `https://<your-worker-url>/health`; it should return `{"status":"ok","environment":"sandbox"}`.
2. Use Daraja's sandbox test phone number on the donation page.
3. Confirm the test phone receives the STK prompt and complete or cancel it.
4. Confirm the page reports success only after Daraja's status query confirms
   the completed checkout. Try a cancellation and an invalid phone/amount too.
5. Confirm the Paybill instructions still work as the manual alternative.

Production is deliberately not enabled in this scaffold. Before accepting real
money, obtain production Daraja approval and credentials, update the API host
to Safaricom's production host, review the callback and reconciliation process,
and thoroughly test deployment and database backups. Never switch production
on by copying sandbox values.
