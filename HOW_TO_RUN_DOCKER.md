# Run the Street Aware demo with Docker

Use this guide to set up the demo on another machine from the code and the database backup. Run the commands from the repository root, where `compose.yaml` lives.

## What to have ready

- The Street Aware repository or a copy of the desired revision. For the clickable heatmap, use a checkout that includes commit `b88dd4f`.
- The separately supplied database backup at `data/street-aware.dump`. Share the backup alongside the repository because Git ignores `data/`.
- Docker with Compose v2 running Linux containers. The first build needs internet access to fetch the base images and dependencies. The Streets and Terrain basemaps use online tile services.

## Restore the database

These commands use PowerShell. Use `street-aware-handoff` as the Compose project name throughout so the demo has its own database volume. If this machine already ran the handoff successfully, skip the restore and go to **Start and verify the app**.

```powershell
if (-not (Test-Path -LiteralPath './data/street-aware.dump' -PathType Leaf)) {
  throw 'Place the supplied database backup at data/street-aware.dump.'
}

docker compose -p street-aware-handoff up -d --wait db
if ($LASTEXITCODE -ne 0) { throw 'PostGIS did not start.' }

# Wait for the final server to accept TCP connections after PostGIS initialization.
docker compose -p street-aware-handoff exec -T db sh -ec 'for i in $(seq 1 30); do pg_isready -q -h 127.0.0.1 -U streetaware -d streetaware && exit 0; sleep 1; done; exit 1'
if ($LASTEXITCODE -ne 0) { throw 'PostGIS did not finish initializing.' }

$isFresh = docker compose -p street-aware-handoff exec -T db psql -U streetaware -d streetaware -Atc "SELECT to_regclass('public.crash_snapshots') IS NULL"
if ($LASTEXITCODE -ne 0 -or $isFresh -ne 't') {
  throw 'The database is already initialized. Keep it as-is and use a new Compose project name to restore another copy.'
}

docker compose -p street-aware-handoff cp ./data/street-aware.dump db:/tmp/street-aware.dump
if ($LASTEXITCODE -ne 0) { throw 'Could not copy the backup into the database container.' }

docker compose -p street-aware-handoff exec -T db pg_restore -U streetaware -d streetaware --schema=public --no-owner --no-privileges --single-transaction /tmp/street-aware.dump
if ($LASTEXITCODE -ne 0) { throw 'The restore failed. Check the pg_restore output before starting the app.' }
```

The restore loads the app tables from the backup into the PostGIS database initialized by Docker. After restoring it, go straight to starting the app.

## Start and verify the app

The example listens on port 3000. If that port is in use, change `APP_PORT` below and use the same port in the browser.

```powershell
$env:APP_PORT = '3000'
docker compose -p street-aware-handoff up -d --build --wait
if ($LASTEXITCODE -ne 0) { throw 'The app did not start. Check the Compose logs.' }

$demoUrl = "http://localhost:$($env:APP_PORT)"
$snapshot = (Invoke-RestMethod "$demoUrl/api/snapshot").snapshot
if ($snapshot.sourceCount -ne 102103 -or $snapshot.mappedCount -ne 97559) {
  throw 'The active snapshot does not match the supplied backup.'
}
$snapshot | Select-Object sourceCount, mappedCount, firstAt, lastAt
```

Open [the local demo](http://localhost:3000/) and confirm that the map shows **97,559** mapped crashes. In the heatmap preview, select a colored area and open one of its crash records.

Run `docker compose -p street-aware-handoff stop` to pause the demo. Set `APP_PORT` again if you used a custom port and opened a new shell. Then run `docker compose -p street-aware-handoff up -d --wait` to restart the same demo.
