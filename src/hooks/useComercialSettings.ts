import { useState, useCallback } from "react";
import type { ComercialSettings } from "../types";

const STORAGE_KEY = "naturgy_comercial_settings";

const EMPTY: ComercialSettings = { full_name: "", phone: "", email: "" };

function readSettings(): ComercialSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    return { ...EMPTY, ...JSON.parse(raw) };
  } catch {
    return EMPTY;
  }
}

// Comercial's own name/phone/email shown on client-facing PDF/Excel exports.
// Single-admin app: no backend "profile" table, just a local setting.
export function useComercialSettings() {
  const [settings, setSettings] = useState<ComercialSettings>(readSettings);

  const save = useCallback((next: ComercialSettings) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSettings(next);
  }, []);

  return { settings, save };
}
