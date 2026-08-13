import { Router } from "express";
import cookie from "cookie";
import {
  COOKIE_NAME,
  createSessionToken,
  timingSafeEqualPassword,
  isRateLimited,
  recordFailedAttempt,
  clearAttempts,
} from "../auth.js";

export const authRouter = Router();

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  };
}

authRouter.post("/login", (req, res) => {
  const ip = req.ip;

  if (isRateLimited(ip)) {
    return res.status(429).json({ error: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo." });
  }

  const { password } = req.body ?? {};
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return res.status(500).json({ error: "El servidor no tiene configurada la contraseña de administrador." });
  }

  if (typeof password !== "string" || !timingSafeEqualPassword(password, adminPassword)) {
    recordFailedAttempt(ip);
    return res.status(401).json({ error: "Contraseña incorrecta." });
  }

  clearAttempts(ip);
  const token = createSessionToken();
  res.setHeader("Set-Cookie", cookie.serialize(COOKIE_NAME, token, cookieOptions()));
  res.json({ ok: true });
});

authRouter.post("/logout", (req, res) => {
  res.setHeader("Set-Cookie", cookie.serialize(COOKIE_NAME, "", { ...cookieOptions(), maxAge: 0 }));
  res.json({ ok: true });
});

authRouter.get("/me", (req, res) => {
  res.json({ authenticated: req.authenticated === true });
});
