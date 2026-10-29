# Dan’s Pizza — order desk demo

A standalone, browser-based restaurant order dashboard. Try the live demo at https://petegarzafit.github.io/dans-pizza-ordering-demo/. It does not use Base44, a POS, a payment processor, or a connected phone line. The menu item names and listed base prices were imported from the Dan’s Pizza Co Webster listing on Slice on 2026-10-29; verify current prices, sizes, and options with the restaurant before use. Sample orders are demo data and persist locally in `.data/state.json`.

## Run locally

Requires Node.js 22.9 or newer; no package installation is needed.

```sh
npm start
```

Open [http://localhost:3000](http://localhost:3000). The `public/` folder is a standalone static demo; a GitHub Pages workflow is included at `.github/workflows/pages.yml`. The static demo is published on GitHub Pages at https://petegarzafit.github.io/dans-pizza-ordering-demo/. Its demo orders/menu edits are saved in each visitor’s browser and are not shared with the restaurant. To start fresh, stop the server and remove `.data/state.json`; sample data is recreated on next start.

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
3. Copy `.env.example` to `.env`. Set a strong `DASHBOARD_PASSWORD`, a random 32-character `SESSION_SECRET`, and a different random 32-character `ORDER_TOOL_SECRET`. Store `RETELL_API_KEY` and `RETELL_AGENT_ID` there only. The Retell API key must have the webhook verification badge if you enable the webhook. Never put credentials in `public/` or browser code. `.env` is ignored by Git.
4. Custom order tool: `POST /api/retell/order-tool`, protected by `Authorization: Bearer <ORDER_TOOL_SECRET>`. It accepts `{ "customer_name": "...", "items": [{"name":"Pepperoni Amore Pizza","quantity":1}], "notes":"..." }` (or those fields under `args`). It checks the imported menu, creates an order labelled `Retell (demo)`, and returns subtotal, 8.25% tax, and total.
5. Webhook receiver: `POST /api/retell/webhook`. It verifies Retell’s `x-retell-signature` using the raw request body, a webhook-enabled `RETELL_API_KEY`, and a five-minute timestamp window. See [Retell’s webhook security guide](https://docs.retellai.com/features/secure-webhook). Do not expose this local endpoint publicly before deploying it over HTTPS and setting server-side secrets.
6. The server listens on the host and `PORT` supplied by the hosting service (and uses port 3000 locally). Retell’s cloud cannot reach localhost. The dashboard API requires sign-in on a public deployment. `/health` is the deployment health check. `/api/retell/call` intentionally returns a not-configured response rather than placing calls.

## Demo hosting

The `render.yaml` Blueprint deploys the full Node app (dashboard and API together) as a free Render web service. This is suitable for a short demo only: free services sleep after inactivity, and their local filesystem can be reset on restart or redeploy, so saved orders are not durable. Do not use this free setup for real restaurant operations. The standalone GitHub Pages build remains a static simulation and does not receive Retell orders.
