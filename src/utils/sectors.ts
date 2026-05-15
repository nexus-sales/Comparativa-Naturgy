export type SectorFilter = "Residencial" | "Pyme";

export function toSectorFilter(value: unknown): SectorFilter | "" {
  const label = String(value ?? "").trim().toLowerCase();
  if (!label) return "";
  if (label.includes("res")) return "Residencial";
  if (label.includes("pyme")) return "Pyme";
  return "";
}

