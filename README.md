# Dan’s Pizza — order desk demo

A standalone, local restaurant order dashboard. It does not use Base44, a POS, a payment processor, or a connected phone line. The menu item names and listed base prices were imported from the Dan’s Pizza Co Webster listing on Slice on 2026-10-29; verify current prices, sizes, and options with the restaurant before use. Sample orders are demo data and persist locally in `.data/state.json`.

## Run locally

Requires Node.js 20 or newer; no package installation is needed.

```sh
npm start
```

Open [http://localhost:3000](http://localhost:3000). The `public/` folder is a standalone static demo; a GitHub Pages workflow is included at `.github/workflows/pages.yml`. After the project is pushed to a GitHub repository with Pages enabled for GitHub Actions, Pages can host the static demo. Its demo orders/menu edits are saved in each visitor’s browser and are not shared with the restaurant. To start fresh, stop the server and remove `.data/state.json`; sample data is recreated on next start.

## Features

- Demo order desk with kitchen status updates and itemized totals
- Editable menu prices and availability
- Text-only simulated call flow and order capture
- Tax rounded in cents at exactly 8.25%
- Optional server-side Retell custom order endpoint and webhook scaffold
- Card-data warning; no payment entry or processing

## Optional Retell setup

The local demo works without Retell. Retell account, agent, phone number, and usage are separate. Retell may charge for usage; review current charges before enabling the service. This project does not buy credits, create an account, connect a phone line, or place calls.

1. Create a Retell account yourself and review its current plan and charges. This project does not buy credits or a phone number.
2. Create an inbound agent in Retell. Keep it in test mode while checking menu matching, price confirmation, timeouts, and human handoff. Instruct the agent never to request, collect, or repeat card numbers or security codes.
3. Copy `.env.example` to `.env`. Store `RETELL_API_KEY`, `RETELL_AGENT_ID`, `RETELL_WEBHOOK_SECRET`, and a long random `ORDER_TOOL_SECRET` there only. Never put credentials in `public/` or browser code. `.env` is ignored by Git.
4. Custom order tool: `POST /api/retell/order-tool`, protected by `Authorization: Bearer $ORDER_TOOL_SECRET`. It accepts `{ "customer_name": "...", "items": [{"id":"m2","quantity":1}], "notes":"..." }` (or those fields under `args`). It checks the imported menu, creates an order labelled `Retell (test)`, and returns subtotal, 8.25% tax, and total.
5. Webhook receiver: `POST /api/retell/webhook`. Verify Retell’s current signature header and exact signing procedure against its documentation before configuring it. The scaffold expects `x-retell-signature` to be an HMAC-SHA256 hex digest over the exact JSON body using `RETELL_WEBHOOK_SECRET`; adjust this to match the account’s current Retell signing scheme before connecting it. Do not expose this local endpoint publicly without verified signing, HTTPS, and request controls.
6. Local server binds to `127.0.0.1`; Retell’s cloud cannot reach localhost. Public HTTPS deployment, agent/tool setup, and phone connection are separate steps. None is performed or claimed here. `/api/retell/call` intentionally returns a not-configured response rather than placing calls.
