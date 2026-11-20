import { readFile } from "node:fs/promises";
import { database } from "../src/lib/db.ts";

const pool = database();
try {
  const schema = await readFile(new URL("./schema.sql", import.meta.url), "utf8");
  await pool.query(schema);
  console.log("Street Aware schema is ready.");
} finally {
  await pool.end();
}
