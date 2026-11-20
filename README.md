# Street Aware

Street Aware is a bilingual map of recorded road crashes in Bulgaria. The local demo starts in the Bulgarian Hotspots view. Select a colored area to open its crash list, or switch to Crashes for severity markers.

## Run the demo

Follow the [Docker handoff guide](HOW_TO_RUN_DOCKER.md) to restore the included backup at `data/street-aware.dump` and start the app.

### Start from a source JSON

Start Docker Desktop in Linux containers mode, then copy the environment template.

```powershell
Copy-Item .env.example .env
```

Set `CRASH_JSON` in `.env` to the supplied JSON's absolute path. Quote paths with spaces and use forward slashes on Windows. Set `APP_PORT` if port 3000 is in use.

```powershell
docker compose up -d --build
docker compose run --rm importer
```

Open [the local map](http://localhost:3000) at your configured port. The importer prints the date range and mapped, missing, invalid, and out-of-country counts. Supply a replacement file and run the same command to switch snapshots after a successful import. Reload the map to see the active snapshot.

## Basemaps and data

- **Check your trip** uses a city list adapted from [GeoNames Bulgaria](https://download.geonames.org/export/dump/BG.zip) under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The prototype filters for at least 10,000 residents in the source and localizes city names. Driving routes use [FOSSGIS OSRM](https://routing.openstreetmap.de/about.html). Set `TRIP_ROUTING_URL` to use another OSRM driving service.

- **Streets** uses [OpenStreetMap’s Graybeard style](https://vector.openstreetmap.org/styles/shortbread/graybeard.json) and loads [official Shortbread vector tiles](https://operations.osmfoundation.org/policies/vector/) directly for the visible area. Set `OSM_STREET_STYLE_URL` to change to another compatible hosted style. The basemap is masked to Bulgaria and the crash counts remain legible at the border.
- **Terrain** uses [Mapzen elevation tiles](https://registry.opendata.aws/terrain-tiles/) to shade mountain slopes over the [Copernicus Land Monitoring Service 2021 mosaic](https://sdi.eea.europa.eu/catalogue/srv/api/records/ac127b0b-8087-4889-8f99-cab372cfc0fc). Both sources are keyless. To use higher-resolution imagery for the demo, set `MAPTILER_PUBLIC_KEY` to an origin-restricted [MapTiler Free key](https://docs.maptiler.com/guides/developer/credentials/api-key/) and recreate the app container. MapTiler key or tile failures fall back to Copernicus, then [EOxCloudless 2016](https://cloudless.eox.at/documentation/faq) if needed.
- The shared [geoBoundaries ADM0 source](https://www.geoboundaries.org/api/current/gbOpen/BGR/ADM0/) is pinned to commit `9469f09`. The vendored GeoJSON's SHA-256 is `5d4899950d612adc7df3ab726f6b5e831b654ed1952787060878b024efa73a6a`.
- The imported snapshot has 102,103 records through November 20, 2026. PostGIS maps 97,559. A coordinate is missing in 4,060 records and 484 are outside the boundary. The matching [Bulgarian Interior Ministry catalog entry](https://testdata.egov.bg/data/view/0c5d9df9-2162-4b32-8c12-862b259efbdc) lists the source dataset. The local JSON is mounted read-only.

## Verify

```powershell
npm ci
npm run typecheck
npm test
docker compose build migrate
docker compose run --rm --no-deps migrate npm run test:integration
node --env-file-if-exists=.env --test tests/demo.smoke.ts
```

The PostGIS test uses an isolated schema and exercises the four severity classes, coordinate clipping, row preservation, snapshot replacement, and rollback after a database write error.

`GET /api/snapshot` gives the active version and coverage. Under `/api/snapshots/{snapshot}`, `/points.geojson` serves the compressed map feed and `/crashes` serves a paginated list with optional `bounds=west,south,east,north` and `after` cursor. `/crashes/{id}` returns the crash detail.
