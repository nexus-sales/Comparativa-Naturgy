import pg from "pg";

const { Pool, types } = pg;

// NUMERIC arrives as text by default to avoid float precision loss on the
// driver side; this app has no need for that caution and every call site
// expects a JS number, so parse it eagerly instead of converting ad hoc at
// every call site.
types.setTypeParser(types.builtins.NUMERIC, (v) => (v === null ? null : parseFloat(v)));
types.setTypeParser(types.builtins.DATE, (v) => v);
types.setTypeParser(types.builtins.INT8, (v) => (v === null ? null : parseInt(v, 10)));

// The scalar NUMERIC parser above does not cascade to numeric[] columns
// (a different OID) — route handlers that read r_pot/r_en convert those
// explicitly (see server/routes/tariffs.js).

function resolveSsl() {
  const mode = (process.env.DATABASE_SSL || "").toLowerCase();
  if (mode === "strict") return { rejectUnauthorized: true };
  if (mode === "true" || mode === "require") return { rejectUnauthorized: false };
  // Dokploy's internal Postgres is plain container-to-container traffic, no TLS.
  return false;
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: resolveSsl(),
});

export function toNumArray(arr) {
  return Array.isArray(arr) ? arr.map((v) => (typeof v === "number" ? v : parseFloat(v))) : arr;
}
