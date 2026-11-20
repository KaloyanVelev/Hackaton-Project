# Deploy Street Aware on Coolify

Deploy the repository with Coolify’s **Docker Compose** build strategy. The committed stack builds the app and restores the included crash snapshot on its first start.

## Set up the application

1. In your project and environment, create a new application from the [Street Aware GitHub repository](https://github.com/KaloyanVelev/Hackaton-Project).
2. Select branch `main` and the **Docker Compose** build strategy.
3. Set **Base Directory** to `/` and **Docker Compose Location** to `/compose.coolify.yaml`. Use Coolify’s managed Compose deployment mode.
4. Use the generated domain for the `app` service, or add your own HTTPS domain for `app` with internal port `3000`. Coolify generates and stores the database passwords from the Compose file.
5. Select **Deploy**. The database, migration, and seed services run before the app starts. Use the deployment logs to check that the seed restored the bundled snapshot.

[Coolify Docker Compose setup](https://coolify.io/docs/applications/builds/docker-compose)

## Verify the first deploy

Open the app domain. The map should show **97,559** mapped crashes. Opening `/api/snapshot` on the same domain should show `sourceCount: 102103` and `mappedCount: 97559`. Try **Check your trip** between Sofia and Plovdiv to verify online routing.

The database uses a named volume. Later deploys run migrations and preserve the active snapshot. Keep the volume attached to the same Coolify application across redeploys. A fresh volume loads the bundled snapshot again.

## Optional runtime settings

- `MAPTILER_PUBLIC_KEY` enables MapTiler imagery. Restrict the key to the app domain.
- `OSM_STREET_STYLE_URL` overrides the default OpenStreetMap street style.
- `TRIP_ROUTING_URL` points to an OSRM driving service. The bundled default is the [FOSSGIS public demo service](https://routing.openstreetmap.de/about.html) for light use. Set an endpoint appropriate for your traffic before a broader rollout.

The build needs internet access for Docker images and npm dependencies. The running app uses internet access for map tiles and routing.
