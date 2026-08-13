import { Router } from "express";
import { pool } from "../db.js";

export const noticesRouter = Router();

noticesRouter.get("/", async (req, res) => {
  const onlyActive = req.query.active === "true";
  const { rows } = await pool.query(
    onlyActive
      ? "SELECT * FROM notices WHERE is_active = true ORDER BY created_at DESC"
      : "SELECT * FROM notices ORDER BY created_at DESC"
  );
  res.json(rows);
});

noticesRouter.post("/", async (req, res) => {
  const n = req.body ?? {};
  if (!n.title || !String(n.title).trim()) {
    return res.status(400).json({ error: "El título es obligatorio." });
  }
  const { rows } = await pool.query(
    `INSERT INTO notices (type, title, body, effective_date, expires_at, is_highlighted, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [n.type ?? "noticia", n.title.trim(), n.body ?? "", n.effective_date || null, n.expires_at || null, n.is_highlighted ?? false, n.is_active ?? true]
  );
  res.status(201).json(rows[0]);
});

noticesRouter.put("/:id", async (req, res) => {
  const n = req.body ?? {};
  const { rows } = await pool.query(
    `UPDATE notices SET
       type           = COALESCE($2, type),
       title          = COALESCE($3, title),
       body           = COALESCE($4, body),
       effective_date = $5,
       expires_at     = $6,
       is_highlighted = COALESCE($7, is_highlighted),
       is_active      = COALESCE($8, is_active)
     WHERE id = $1
     RETURNING *`,
    [req.params.id, n.type, n.title, n.body, n.effective_date || null, n.expires_at || null, n.is_highlighted, n.is_active]
  );
  if (!rows.length) return res.status(404).json({ error: "Aviso no encontrado" });
  res.json(rows[0]);
});
