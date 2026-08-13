import { Router } from "express";
import { pool, toNumArray } from "../db.js";

export const tariffsRouter = Router();

function mapRow(row) {
  return { ...row, r_pot: toNumArray(row.r_pot), r_en: toNumArray(row.r_en) };
}

tariffsRouter.get("/", async (req, res) => {
  const { rows } = await pool.query(
    "SELECT * FROM tariffs WHERE is_active = true ORDER BY segment_id, name"
  );
  res.json(rows.map(mapRow));
});

tariffsRouter.post("/", async (req, res) => {
  const t = req.body ?? {};
  const { rows } = await pool.query(
    `INSERT INTO tariffs (segment_id, name, type, pot_unit, r_pot, r_en, sva, requires_auth)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [t.segment_id, t.name, t.type, t.pot_unit, t.r_pot, t.r_en, t.sva ?? 0, t.requires_auth ?? false]
  );
  res.status(201).json(mapRow(rows[0]));
});

tariffsRouter.put("/:id", async (req, res) => {
  const t = req.body ?? {};
  const { rows } = await pool.query(
    `UPDATE tariffs SET
       segment_id    = COALESCE($2, segment_id),
       name          = COALESCE($3, name),
       type          = COALESCE($4, type),
       pot_unit      = COALESCE($5, pot_unit),
       r_pot         = COALESCE($6, r_pot),
       r_en          = COALESCE($7, r_en),
       sva           = COALESCE($8, sva),
       requires_auth = COALESCE($9, requires_auth),
       is_active     = COALESCE($10, is_active)
     WHERE id = $1
     RETURNING *`,
    [req.params.id, t.segment_id, t.name, t.type, t.pot_unit, t.r_pot, t.r_en, t.sva, t.requires_auth, t.is_active]
  );
  if (!rows.length) return res.status(404).json({ error: "Tarifa no encontrada" });
  res.json(mapRow(rows[0]));
});

tariffsRouter.delete("/:id", async (req, res) => {
  await pool.query("DELETE FROM tariffs WHERE id = $1", [req.params.id]);
  res.status(204).end();
});

// Bulk-deactivate, used by the Excel/JSON tariff importer before it inserts
// the replacement rows for a segment.
tariffsRouter.patch("/deactivate", async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  if (!ids.length) return res.json({ updated: 0 });
  const { rowCount } = await pool.query(
    "UPDATE tariffs SET is_active = false WHERE id = ANY($1::uuid[])",
    [ids]
  );
  res.json({ updated: rowCount });
});
