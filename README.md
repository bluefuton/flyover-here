<img src="public/favicon.svg" alt="Flyover Here’s smiling cloud" width="80" height="61">

# Flyover Here

**What’s up?** A whimsical plane-spotting app showing the nearest aircraft to you, with live data, a blue-washed map, and aircraft photos.

**[Try Flyover Here →](https://flyoverhere.bluefuton.com)**

![A live aircraft near Mortlake, London](docs/screenshot.jpg)

## Run locally

Requires **Node.js 22.13+** and npm. No API keys or database setup needed.

```sh
git clone https://github.com/bluefuton/flyover-here.git
cd flyover-here
npm ci
npm run dev
```

Open **http://localhost:5173** and allow location access. To try a public test location, use [Mortlake, London](http://localhost:5173/?lat=51.4696&lon=-0.2665). Both `lat` and `lon` are required; clicking the logo returns to device-location mode.

## How it works

The closest reported airborne aircraft within 5–100 km is selected by ground distance and refreshed about every 15 seconds. Stale positions are excluded, background tabs pause polling, and failures back off automatically. Nearby does not necessarily mean directly overhead.

- [adsb.lol](https://www.adsb.lol/docs/open-data/api/): aircraft positions and telemetry ([ODbL](https://opendatacommons.org/licenses/odbl/1-0/)).
- [adsbdb](https://www.adsbdb.com/): operators and available flight numbers; callsigns can differ from passenger flight numbers.
- [Planespotters.net](https://www.planespotters.net/photo/api): credited aircraft photos, which may show an earlier livery.
- [OpenStreetMap](https://www.openstreetmap.org/copyright): map tiles and geographic data.

Coverage and availability depend on these services. Altitude is barometric, not height above you. This is a curiosity tool, not a navigation aid.

Device coordinates stay in app memory and are sent through the lookup endpoint to adsb.lol; the app does not save them to browser storage or a database. OpenStreetMap receives tile requests. URL overrides remain in browser history—use public locations in shared links.

## Development

React, TypeScript, Vinext, Vite, and plain CSS, running on Cloudflare Workers.

```sh
npm test           # Offline logic and API tests
npm run typecheck  # TypeScript checks
npm run build      # Build Worker and browser assets
npm start          # Preview the built Worker locally
```

## Deployment

Connect this repository in **Cloudflare Workers & Pages**, using `main`, the repository root, and `NODE_VERSION=22`:

| Command           | Value                  |
| ----------------- | ---------------------- |
| Build             | `npm run build`        |
| Deploy            | `npx wrangler deploy`  |
| Branch/PR preview | `npx wrangler preview` |

The build generates the Worker configuration that Wrangler automatically discovers. No application secrets or storage bindings are required.

For a manual deployment, run `npx wrangler login` and `npm run deploy`. Use `npm run deploy:preview` for a preview or `npm run deploy -- --dry-run` to validate without publishing.
