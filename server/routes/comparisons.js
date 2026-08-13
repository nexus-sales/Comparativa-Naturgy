import { Router } from "express";
import { pool } from "../db.js";

export const comparisonsRouter = Router();

comparisonsRouter.get("/", async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 200, 1000);
  const { rows } = await pool.query(
    `SELECT * FROM client_comparisons
     WHERE deleted_by_user = false
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit]
  );
  res.json(rows);
});

comparisonsRouter.post("/", async (req, res) => {
  const c = req.body ?? {};
  const { rows } = await pool.query(
    `INSERT INTO client_comparisons (client_name, client_email, client_address, target_tariff, target_segment, calculation_data)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [c.client_name ?? null, c.client_email ?? null, c.client_address ?? null, c.target_tariff ?? null, c.target_segment ?? null, c.calculation_data ?? {}]
  );
  res.status(201).json(rows[0]);
});

// Only supports soft-delete (deleted_by_user=true) — matches the original
// Supabase trigger that restricted non-admin updates to logical deletion.
comparisonsRouter.patch("/:id", async (req, res) => {
  if (req.body?.deleted_by_user !== true) {
    return res.status(400).json({ error: "Solo se admite el borrado lógico (deleted_by_user: true)." });
  }
  const { rows } = await pool.query(
    "UPDATE client_comparisons SET deleted_by_user = true WHERE id = $1 RETURNING *",
    [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: "Comparativa no encontrada" });
  res.json(rows[0]);
});
