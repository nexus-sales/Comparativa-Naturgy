import { useState } from "react";
import { supabase } from "../lib/supabase";
import { calc, fmtEur, CHART_COLS } from "../utils/calculations";
import { exportPDF, type ComercialData } from "../utils/pdfExport";
import { exportExcel } from "../utils/excelExport";
import type { SegCliente, TarifaLocal } from "../utils/calculations";
import type { User } from "@supabase/supabase-js";

export interface ComparatorActionsParams {
  user: User;
  segLabel: string;
  taxModel: string;
  potP: number;
  c: SegCliente;
  segTariffs: TarifaLocal[];
  comercialData: ComercialData;
}

export interface ComparatorResults {
  results: { t: TarifaLocal; r: ReturnType<typeof calc>; color: string }[];
  best: { t: TarifaLocal; r: ReturnType<typeof calc>; color: string };
  bestAh: number;
}

export function buildResults(taxModel: string, potP: number, c: SegCliente, segTariffs: TarifaLocal[]): ComparatorResults {
  const results = segTariffs.map((t, i) => ({ t, r: calc(taxModel, potP, c, t), color: CHART_COLS[i % CHART_COLS.length] }));
  const best = results.reduce((a, b) => b.r.total < a.r.total ? b : a, results[0]);
  const bestAh = +(c.factura - best.r.total).toFixed(2);
  return { results, best, bestAh };
}

export function useComparatorActions({ user, segLabel, taxModel, potP, c, segTariffs, comercialData }: ComparatorActionsParams) {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [saveMsg, setSaveMsg] = useState('');
  const isSaving = saveStatus === 'saving';

  const showResult = (status: 'success' | 'error', msg: string) => {
    setSaveStatus(status);
    setSaveMsg(msg);
    setTimeout(() => setSaveStatus('idle'), status === 'success' ? 3000 : 5000);
  };

  const { best, bestAh } = buildResults(taxModel, potP, c, segTariffs);

  const saveComp = async (act: "SAVE" | "PDF") => {
    if (isSaving || !user) return;
    setSaveStatus('saving');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const sEsc = (s: unknown): string => typeof s === "string" ? s.replace(/[<>"{}$%]/g, "").trim() : "";
    try {
      const request = supabase.from("client_comparisons").insert({
        user_id: user.id,
        client_name: sEsc(c.nombre) || "S/N",
        client_address: sEsc(c.dir),
        target_tariff: best.t.nombre,
        target_segment: segLabel,
        calculation_data: {
          segment: segLabel,
          tax_model: taxModel,
          pot_prices: potP,
          best_tariff: best.t.nombre,
          total_cost: best.r.total,
          saving: bestAh,
          current_invoice: c.factura,
          client_data: { ...c, nombre: sEsc(c.nombre), cups: sEsc(c.cups), dir: sEsc(c.dir) },
          available_tariffs: segTariffs.map(t => ({ ...t, selected: t.id === best.t.id }))
        }
      }).abortSignal(controller.signal);

      const { error } = await Promise.race([
        request,
        new Promise<{error: any}>((_, reject) => {
          const timeout = window.setTimeout(() => reject(new DOMException("Timeout", "AbortError")), 15000);
          controller.signal.addEventListener("abort", () => {
            clearTimeout(timeout);
            reject(new DOMException("Timeout", "AbortError"));
          });
        })
      ]);

      if (error) { showResult('error', error.message); return; }
      if (act === "SAVE") showResult('success', 'Guardado correctamente');
      else setSaveStatus('idle');
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError') {
        showResult('error', 'Tiempo de espera agotado al guardar. Revisa tu conexión.');
      } else {
        showResult('error', err instanceof Error ? err.message : 'Error desconocido');
      }
    }
  };

  const handlePDF = () => {
    try {
      exportPDF(segLabel, taxModel, potP, c, segTariffs, comercialData);
    } catch (e) {
      showResult('error', 'Error al generar PDF: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  const handleExcel = async () => {
    try {
      await exportExcel(segLabel, taxModel, potP, c, segTariffs);
    } catch (e) {
      showResult('error', 'Error al generar Excel: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  return { saveStatus, saveMsg, isSaving, saveComp, handlePDF, handleExcel };
}

export { fmtEur };
