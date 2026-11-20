import { copyFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const worker = require.resolve("maplibre-gl/dist/maplibre-gl-worker.mjs");
await copyFile(worker, new URL("../public/maps/maplibre-gl-worker.mjs", import.meta.url));
