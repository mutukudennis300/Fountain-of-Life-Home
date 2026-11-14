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

## 2. Create the Cloudflare database

From the repository root, enter the Worker folder and install its Wrangler
development dependency, then create the D1 database:

```powershell
cd mpesa-worker
npm install
npx wrangler d1 create fountain-life-mpesa
```

Copy the returned database ID into `database_id` in `wrangler.jsonc`, replacing
`REPLACE_WITH_D1_DATABASE_ID`. Do not put credentials in this file. Create the
tables:

```powershell
npx wrangler d1 execute fountain-life-mpesa --remote --file=schema.sql
```

## 3. Check the API custom domain

The Worker is configured for
`https://api.fountainoflifechilderenshome.org`. Your root hostname serves the
GitHub Pages website and must not be assigned to this Worker: a Worker custom
domain takes over every path on its hostname.

The custom API domain requires the domain to be an active zone in your
Cloudflare account, and there must not already be a CNAME on the `api`
hostname. Wrangler can create the DNS record and certificate on deployment
when those requirements are met. If your domain's DNS is not managed by
Cloudflare, first decide whether to move DNS management or keep the `workers.dev`
URL as the API endpoint. Do not change the root website DNS record.

## 4. Add Daraja secrets

Set each secret using the prompts. Do not put the values on the command line,
in source files, or in a committed `.env` file:

```powershell
npx wrangler secret put DARAJA_CONSUMER_KEY
npx wrangler secret put DARAJA_CONSUMER_SECRET
npx wrangler secret put DARAJA_SHORTCODE
npx wrangler secret put DARAJA_PASSKEY
npx wrangler secret put DARAJA_CALLBACK_URL
```

Deploy to create the Worker and, if the custom-domain requirements are met,
attach its API hostname:

```powershell
npx wrangler deploy
```

Set `DARAJA_CALLBACK_URL` to
`https://api.fountainoflifechilderenshome.org/api/mpesa/callback`.
It must be public HTTPS. After setting it, deploy again.

## 5. Connect the donation page

Set the `data-stk-api` attribute on the STK Push button in `donate.html` to the
Worker base URL, without a trailing slash. For example:

```html
data-stk-api="https://api.fountainoflifechilderenshome.org"
```

Publish the updated site to GitHub Pages. The URL is public configuration, not
a secret. The Worker allows browser requests only from the site origin set in
`wrangler.jsonc` (`SITE_ORIGIN`).

## 6. Test before production

1. Open `https://api.fountainoflifechilderenshome.org/health`; it should return `{"status":"ok","environment":"sandbox"}`.
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
