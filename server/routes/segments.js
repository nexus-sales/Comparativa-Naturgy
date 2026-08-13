import { Router } from "express";
import { pool } from "../db.js";

export const segmentsRouter = Router();

segmentsRouter.get("/", async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM segments ORDER BY id");
  res.json(rows);
});

segmentsRouter.put("/:id", async (req, res) => {
  const { bono_rate, excedente_rate, tax_imp_elec, tax_igic, tax_igic_red, tax_igic_7 } = req.body ?? {};
  const { rows } = await pool.query(
    `UPDATE segments SET
       bono_rate      = COALESCE($2, bono_rate),
       excedente_rate = COALESCE($3, excedente_rate),
       tax_imp_elec   = COALESCE($4, tax_imp_elec),
       tax_igic       = COALESCE($5, tax_igic),
       tax_igic_red   = COALESCE($6, tax_igic_red),
       tax_igic_7     = COALESCE($7, tax_igic_7)
     WHERE id = $1
     RETURNING *`,
    [req.params.id, bono_rate, excedente_rate, tax_imp_elec, tax_igic, tax_igic_red, tax_igic_7]
  );
  if (!rows.length) return res.status(404).json({ error: "Segmento no encontrado" });
  res.json(rows[0]);
});
